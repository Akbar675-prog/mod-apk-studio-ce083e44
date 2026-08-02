import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { translateTextsFn } from "./translate.functions";
import { VOCAB } from "./i18n-vocab";
import { installDomTranslator, resetDomOutputs, retranslateDocument } from "./dom-i18n";

export type Language = { code: string; name: string; native: string; flag: string };

/** Source language of all hardcoded copy in this app. */
export const SOURCE_LANG = "id";

export const LANGUAGES: Language[] = [
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "en", name: "English (US)", native: "English", flag: "🇺🇸" },
  { code: "en-GB", name: "English (UK)", native: "English (UK)", flag: "🇬🇧" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "简体中文", flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese (Traditional)", native: "繁體中文", flag: "🇹🇼" },
  { code: "es", name: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "pt-BR", name: "Portuguese (Brazil)", native: "Português (Brasil)", flag: "🇧🇷" },
  { code: "pt", name: "Portuguese (Portugal)", native: "Português", flag: "🇵🇹" },
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", name: "Arabic", native: "العربية", flag: "🇸🇦" },
  { code: "bn", name: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { code: "ru", name: "Russian", native: "Русский", flag: "🇷🇺" },
  { code: "ja", name: "Japanese", native: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", native: "한국어", flag: "🇰🇷" },
  { code: "de", name: "German", native: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "French", native: "Français", flag: "🇫🇷" },
  { code: "it", name: "Italian", native: "Italiano", flag: "🇮🇹" },
  { code: "nl", name: "Dutch", native: "Nederlands", flag: "🇳🇱" },
  { code: "tr", name: "Turkish", native: "Türkçe", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", name: "Thai", native: "ไทย", flag: "🇹🇭" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "fil", name: "Filipino", native: "Filipino", flag: "🇵🇭" },
  { code: "jv", name: "Javanese", native: "Basa Jawa", flag: "🇮🇩" },
  { code: "su", name: "Sundanese", native: "Basa Sunda", flag: "🇮🇩" },
  { code: "pl", name: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "uk", name: "Ukrainian", native: "Українська", flag: "🇺🇦" },
  { code: "ro", name: "Romanian", native: "Română", flag: "🇷🇴" },
  { code: "cs", name: "Czech", native: "Čeština", flag: "🇨🇿" },
  { code: "sk", name: "Slovak", native: "Slovenčina", flag: "🇸🇰" },
  { code: "hu", name: "Hungarian", native: "Magyar", flag: "🇭🇺" },
  { code: "el", name: "Greek", native: "Ελληνικά", flag: "🇬🇷" },
  { code: "sv", name: "Swedish", native: "Svenska", flag: "🇸🇪" },
  { code: "no", name: "Norwegian", native: "Norsk", flag: "🇳🇴" },
  { code: "da", name: "Danish", native: "Dansk", flag: "🇩🇰" },
  { code: "fi", name: "Finnish", native: "Suomi", flag: "🇫🇮" },
  { code: "he", name: "Hebrew", native: "עברית", flag: "🇮🇱" },
  { code: "fa", name: "Persian", native: "فارسی", flag: "🇮🇷" },
  { code: "ur", name: "Urdu", native: "اردو", flag: "🇵🇰" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇱🇰" },
  { code: "te", name: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ne", name: "Nepali", native: "नेपाली", flag: "🇳🇵" },
  { code: "si", name: "Sinhala", native: "සිංහල", flag: "🇱🇰" },
  { code: "km", name: "Khmer", native: "ខ្មែរ", flag: "🇰🇭" },
  { code: "lo", name: "Lao", native: "ລາວ", flag: "🇱🇦" },
  { code: "my", name: "Burmese", native: "မြန်မာ", flag: "🇲🇲" },
  { code: "sw", name: "Swahili", native: "Kiswahili", flag: "🇰🇪" },
  { code: "am", name: "Amharic", native: "አማርኛ", flag: "🇪🇹" },
  { code: "ha", name: "Hausa", native: "Hausa", flag: "🇳🇬" },
  { code: "yo", name: "Yoruba", native: "Yorùbá", flag: "🇳🇬" },
  { code: "ig", name: "Igbo", native: "Igbo", flag: "🇳🇬" },
  { code: "zu", name: "Zulu", native: "isiZulu", flag: "🇿🇦" },
  { code: "af", name: "Afrikaans", native: "Afrikaans", flag: "🇿🇦" },
  { code: "bg", name: "Bulgarian", native: "Български", flag: "🇧🇬" },
  { code: "sr", name: "Serbian", native: "Српски", flag: "🇷🇸" },
  { code: "hr", name: "Croatian", native: "Hrvatski", flag: "🇭🇷" },
  { code: "bs", name: "Bosnian", native: "Bosanski", flag: "🇧🇦" },
  { code: "sl", name: "Slovenian", native: "Slovenščina", flag: "🇸🇮" },
  { code: "sq", name: "Albanian", native: "Shqip", flag: "🇦🇱" },
  { code: "mk", name: "Macedonian", native: "Македонски", flag: "🇲🇰" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių", flag: "🇱🇹" },
  { code: "lv", name: "Latvian", native: "Latviešu", flag: "🇱🇻" },
  { code: "et", name: "Estonian", native: "Eesti", flag: "🇪🇪" },
  { code: "ka", name: "Georgian", native: "ქართული", flag: "🇬🇪" },
  { code: "hy", name: "Armenian", native: "Հայերեն", flag: "🇦🇲" },
  { code: "az", name: "Azerbaijani", native: "Azərbaycanca", flag: "🇦🇿" },
  { code: "kk", name: "Kazakh", native: "Қазақша", flag: "🇰🇿" },
  { code: "uz", name: "Uzbek", native: "Oʻzbekcha", flag: "🇺🇿" },
  { code: "mn", name: "Mongolian", native: "Монгол", flag: "🇲🇳" },
  { code: "ca", name: "Catalan", native: "Català", flag: "🇪🇸" },
  { code: "gl", name: "Galician", native: "Galego", flag: "🇪🇸" },
  { code: "eu", name: "Basque", native: "Euskara", flag: "🇪🇸" },
  { code: "is", name: "Icelandic", native: "Íslenska", flag: "🇮🇸" },
  { code: "ga", name: "Irish", native: "Gaeilge", flag: "🇮🇪" },
  { code: "cy", name: "Welsh", native: "Cymraeg", flag: "🏴" },
  { code: "mt", name: "Maltese", native: "Malti", flag: "🇲🇹" },
  { code: "es-MX", name: "Spanish (Latin America)", native: "Español (LatAm)", flag: "🇲🇽" },
  { code: "fr-CA", name: "French (Canada)", native: "Français (Canada)", flag: "🇨🇦" },
];

export function findLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

const LANG_KEY = "galileo:lang:v1";
const CACHE_PREFIX = "galileo:i18n:";
/** Every source string this browser has ever rendered, so a language switch can
 *  translate the whole known vocabulary at once instead of lazily per render. */
const KEYS_KEY = "galileo:i18n:keys:v1";

type Ctx = {
  lang: string;
  setLang: (code: string) => void;
  t: (text: string) => string;
  loading: boolean;
};

const I18nContext = createContext<Ctx>({
  lang: SOURCE_LANG,
  setLang: () => {},
  t: (s) => s,
  loading: false,
});

function readCache(lang: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_PREFIX + lang) || "{}");
  } catch {
    return {};
  }
}

function writeCache(lang: string, dict: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(dict));
  } catch {
    /* quota */
  }
}

function readKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEYS_KEY) || "[]");
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

function writeKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS_KEY, JSON.stringify(Array.from(keys).slice(-4000)));
  } catch {
    /* quota */
  }
}

/** Queue every string the app can render, not just the ones already seen. */
function seedAll(known: Set<string>, cached: Record<string, string>, pending: Set<string>) {
  VOCAB.forEach((k) => known.add(k));
  known.forEach((k) => {
    if (cached[k] === undefined) pending.add(k);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(SOURCE_LANG);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const pending = useRef<Set<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());
  const failures = useRef<Map<string, number>>(new Map());
  const known = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    known.current = new Set(readKeys());
    VOCAB.forEach((k) => known.current.add(k));
    writeKeys(known.current);
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && saved !== SOURCE_LANG) {
      setLangState(saved);
      const cached = readCache(saved);
      setDict(cached);
      // Warm up the whole vocabulary, not just strings this browser has seen.
      seedAll(known.current, cached, pending.current);
      if (pending.current.size > 0) {
        langRef.current = saved;
        timer.current = setTimeout(() => void flush(), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = /^(ar|he|fa|ur)/.test(lang) ? "rtl" : "ltr";
    }
  }, [lang]);

  const flush = useCallback(async () => {
    const target = langRef.current;
    if (target === SOURCE_LANG) return;
    // Cap each round so a big vocabulary doesn't fire dozens of parallel calls.
    const all = Array.from(pending.current).slice(0, 300);
    if (all.length === 0) return;
    all.forEach((b) => {
      pending.current.delete(b);
      inFlight.current.add(b);
    });
    setLoading(true);
    const meta = findLanguage(target);

    // Split into groups and fire them all at once so the whole UI flips over
    // in roughly the time of a single request instead of batch after batch.
    const groups: string[][] = [];
    for (let i = 0; i < all.length; i += 20) groups.push(all.slice(i, i + 20));

    // Cap concurrency: firing every group at once trips the AI gateway's rate
    // limit (HTTP 429), and a rate-limited batch comes back untranslated.
    const CONCURRENCY = 4;
    let cursor = 0;
    const runBatch = async (batch: string[]) => {
        try {
          const res = await translateTextsFn({
            data: { texts: batch, lang: target, langName: meta.name },
          });
          if (langRef.current !== target) return;
          // Merge as soon as each group lands: text appears progressively.
          setDict((prev) => {
            const next = { ...prev };
            batch.forEach((text, i) => {
              const out = res.translations[i];
              // Identical output means the gateway failed / returned the source:
              // don't cache it, retry instead of freezing the UI in Indonesian.
              if (out && out !== text) {
                next[text] = out;
                failures.current.delete(text);
              } else {
                const n = (failures.current.get(text) ?? 0) + 1;
                failures.current.set(text, n);
                if (n <= 5) pending.current.add(text);
              }
            });
            writeCache(target, { ...readCache(target), ...next });
            return next;
          });
        } catch {
          if (langRef.current === target) {
            batch.forEach((text) => {
              const n = (failures.current.get(text) ?? 0) + 1;
              failures.current.set(text, n);
              if (n <= 5) pending.current.add(text);
            });
          }
        } finally {
          batch.forEach((b) => inFlight.current.delete(b));
        }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, groups.length) }, async () => {
        while (cursor < groups.length) {
          const batch = groups[cursor++];
          await runBatch(batch);
        }
      }),
    );

    setLoading(false);
    if (pending.current.size > 0) {
      timer.current = setTimeout(() => void flush(), 30);
    }
  }, []);

  const request = useCallback(
    (text: string) => {
      if (!known.current.has(text)) {
        known.current.add(text);
        writeKeys(known.current);
      }
      if (pending.current.has(text) || inFlight.current.has(text)) return;
      if ((failures.current.get(text) ?? 0) > 5) return;
      pending.current.add(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 40);
    },
    [flush],
  );

  const t = useCallback(
    (text: string) => {
      if (!text) return text;
      if (langRef.current === SOURCE_LANG) return text;
      const hit = dict[text];
      if (hit !== undefined) return hit;
      if (/^[\s\d.,:%+\-/()]*$/.test(text)) return text;
      request(text);
      return text;
    },
    [dict, request],
  );

  // Whole-document translation: any string a component forgot to wrap in t()
  // still gets translated, so a language switch changes the entire page.
  const dictRef = useRef(dict);
  dictRef.current = dict;
  const domApply = useCallback(
    () => ({
      dict: langRef.current === SOURCE_LANG ? {} : dictRef.current,
      request,
      restore: langRef.current === SOURCE_LANG,
    }),
    [request],
  );

  useEffect(() => installDomTranslator(domApply), [domApply]);

  useEffect(() => {
    retranslateDocument(domApply);
  }, [dict, lang, domApply]);

  // Switching straight from one target language to another leaves the previous
  // language's text in the DOM: restore the source copy first, then re-translate.
  const prevLang = useRef(lang);
  useEffect(() => {
    if (prevLang.current !== lang) {
      prevLang.current = lang;
      retranslateDocument(() => ({ dict: {}, request, restore: true }));
      resetDomOutputs();
      retranslateDocument(domApply);
    }
  }, [lang, request, domApply]);

  // Safety net: React can commit text after our last pass, so keep sweeping for
  // a while after a language change until the page has settled.
  useEffect(() => {
    if (lang === SOURCE_LANG) return;
    let rounds = 0;
    const id = setInterval(() => {
      rounds += 1;
      retranslateDocument(domApply);
      if (rounds > 40) clearInterval(id);
    }, 1500);
    return () => clearInterval(id);
  }, [lang, domApply]);

  const setLang = useCallback(
    (code: string) => {
      window.localStorage.setItem(LANG_KEY, code);
      pending.current.clear();
      inFlight.current.clear();
      failures.current.clear();
      if (timer.current) clearTimeout(timer.current);
      langRef.current = code;
      setLangState(code);
      const cached = code === SOURCE_LANG ? {} : readCache(code);
      setDict(cached);
      if (code === SOURCE_LANG) return;
      // Translate the entire known vocabulary immediately so the whole UI
      // switches over at once instead of string-by-string on re-render.
      seedAll(known.current, cached, pending.current);
      if (pending.current.size > 0) timer.current = setTimeout(() => void flush(), 0);
    },
    [flush],
  );

  const value = useMemo<Ctx>(() => ({ lang, setLang, t, loading }), [lang, setLang, t, loading]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Translate a single string reactively. */
export function useT() {
  return useI18n().t;
}

/** Inline translated text. */
export function T({ children }: { children: string }) {
  const t = useT();
  return <>{t(children)}</>;
}
