/** Server-side translation with an in-memory cache shared by all requests
 *  hitting this worker instance, plus parallel chunking for speed. */

const CHUNK = 20;
const MAX_CACHE = 8000;
const cache = new Map<string, string>();

function ckey(lang: string, text: string) {
  return `${lang}\u0000${text}`;
}

function remember(lang: string, text: string, out: string) {
  if (cache.size > MAX_CACHE) cache.clear();
  cache.set(ckey(lang, text), out);
}

async function translateChunk(
  texts: string[],
  lang: string,
  langName: string,
  key: string,
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
            "You are a UI localization engine. Translate each string into the requested language. " +
            "Keep placeholders, numbers, emojis, brand/product names (e.g. Galileo, APK, GMA) intact. " +
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

  if (!res.ok) return texts;

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

  const settled = await Promise.all(
    chunks.map((c) => translateChunk(c.map((x) => x.t), lang, langName, key)),
  );

  settled.forEach((out, ci) => {
    chunks[ci].forEach((item, k) => {
      const val = out[k] ?? item.t;
      result[item.i] = val;
      remember(lang, item.t, val);
    });
  });

  return { translations: result };
}
