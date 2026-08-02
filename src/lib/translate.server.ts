/** Server-side translation with an in-memory cache shared by all requests
 *  hitting this worker instance, plus parallel chunking for speed. */

const CHUNK = 20;
/** The AI gateway rate-limits bursts (HTTP 429). Keep concurrency low and retry. */
const CONCURRENCY = 3;
const RETRIES = 4;
const MAX_CACHE = 8000;
const cache = new Map<string, string>();

function ckey(lang: string, text: string) {
  return `${lang}\u0000${text}`;
}

function remember(lang: string, text: string, out: string) {
  if (cache.size > MAX_CACHE) cache.clear();
  cache.set(ckey(lang, text), out);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run tasks with a small concurrency pool so we never burst the gateway. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

async function translateChunk(
  texts: string[],
  lang: string,
  langName: string,
  key: string,
  attempt = 0,
): Promise<string[]> {
  const payload = texts.map((t, i) => ({ i, t }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "You are a UI localization engine. Every input string is Indonesian UI copy. " +
            "Always output the target-language translation, even for a single word: a lone word like " +
            '"Terang" or "Gelap" is UI copy, never a person\'s name. ' +
            "Leave a string unchanged ONLY if it is a brand/product name (Galileo, GMA, APK, WhatsApp, YouTube). " +
            "Keep placeholders, numbers and emojis intact. " +
            "Keep translations short and natural for app UI. " +
            'Reply ONLY with JSON: {"items":[{"i":0,"t":"..."}]} preserving every index.',
        },
        {
          role: "user",
          content: `Target language: ${langName} (${lang})\nStrings:\n${JSON.stringify(payload)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    // 429 / 5xx are transient: back off and try again instead of silently
    // returning the Indonesian source (which is what made whole strings never
    // translate in production, where traffic hits the rate limit).
    if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
      await sleep(500 * 2 ** attempt + Math.random() * 250);
      return translateChunk(texts, lang, langName, key, attempt + 1);
    }
    return texts;
  }

  try {
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as {
      items?: { i: number; t: string }[];
    };
    const out = [...texts];
    for (const item of parsed.items ?? []) {
      if (typeof item?.i === "number" && typeof item?.t === "string" && out[item.i] !== undefined) {
        out[item.i] = item.t;
      }
    }
    return out;
  } catch {
    if (attempt < RETRIES) {
      await sleep(400 * 2 ** attempt);
      return translateChunk(texts, lang, langName, key, attempt + 1);
    }
    return texts;
  }
}

export async function translateBatch(texts: string[], lang: string, langName: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { translations: texts };

  const result = [...texts];
  const missing: { i: number; t: string }[] = [];
  texts.forEach((t, i) => {
    const hit = cache.get(ckey(lang, t));
    if (hit !== undefined) result[i] = hit;
    else missing.push({ i, t });
  });
  if (missing.length === 0) return { translations: result };

  const chunks: { i: number; t: string }[][] = [];
  for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));

  const settled = await pool(
    chunks.map((c) => () => translateChunk(c.map((x) => x.t), lang, langName, key)),
    CONCURRENCY,
  );

  settled.forEach((out, ci) => {
    chunks[ci].forEach((item, k) => {
      const val = out[k] ?? item.t;
      result[item.i] = val;
      // A value identical to the source means the model dropped that index or the
      // gateway call failed. Caching it would poison this string for every later
      // request, so leave it out and let the client retry.
      if (val !== item.t) remember(lang, item.t, val);
    });
  });

  return { translations: result };
}
