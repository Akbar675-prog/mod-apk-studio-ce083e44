/** Whole-document translation.
 *
 *  Wrapping every literal in t() is impossible to keep complete — any string a
 *  component forgot to wrap stays in the source language forever. Instead we walk
 *  the rendered DOM, translate every text node and user-visible attribute, and
 *  re-apply after React re-renders via a MutationObserver. */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "SVG",
  "PATH",
  "TEXTAREA",
]);

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

/** Source text per node, so we can restore when switching back to Indonesian. */
const originals = new WeakMap<Text, string>();
/** Last value we wrote, to tell our own writes apart from React's. */
const applied = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Record<string, string>>();
const attrApplied = new WeakMap<Element, Record<string, string>>();

const NUMERIC = /^[\s\d.,:%+\-/()[\]|·—–]*$/;

/** Every value we've ever written into the DOM. React can re-render a node with
 *  an already-translated string; without this we'd treat it as fresh source text
 *  and burn a translation request on it. */
const outputs = new Set<string>();

function translatable(raw: string) {
  const key = raw.trim();
  if (key.length < 1) return null;
  if (NUMERIC.test(key)) return null;
  // Skip URLs / emails / base64-ish blobs.
  if (/^https?:\/\//i.test(key) || /^[\w.+-]+@[\w.-]+$/.test(key)) return null;
  return key;
}

function skipped(node: Node) {
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute?.("data-no-translate")) return true;
    if (el.getAttribute?.("translate") === "no") return true;
    el = el.parentElement;
  }
  return false;
}

type Apply = {
  dict: Record<string, string>;
  request: (text: string) => void;
  restore: boolean;
};

function handleText(node: Text, { dict, request, restore }: Apply) {
  const isOurs = applied.get(node) === node.data;
  const source = isOurs ? (originals.get(node) ?? node.data) : node.data;
  if (!isOurs) originals.set(node, source);

  if (restore) {
    if (node.data !== source) node.data = source;
    applied.delete(node);
    return;
  }

  const key = translatable(source);
  if (!key) return;
  if (outputs.has(key)) return;
  const hit = dict[key];
  if (hit === undefined) {
    request(key);
    return;
  }
  const next = source.replace(key, hit);
  if (node.data !== next) node.data = next;
  applied.set(node, next);
  outputs.add(hit);
}

function handleAttrs(el: Element, { dict, request, restore }: Apply) {
  for (const attr of ATTRS) {
    const current = el.getAttribute(attr);
    if (current === null) continue;
    const mineMap = attrApplied.get(el) ?? {};
    const origMap = attrOriginals.get(el) ?? {};
    const isOurs = mineMap[attr] === current;
    const source = isOurs ? (origMap[attr] ?? current) : current;
    if (!isOurs) {
      origMap[attr] = source;
      attrOriginals.set(el, origMap);
    }

    if (restore) {
      if (current !== source) el.setAttribute(attr, source);
      delete mineMap[attr];
      attrApplied.set(el, mineMap);
      continue;
    }

    const key = translatable(source);
    if (!key) continue;
    if (outputs.has(key)) continue;
    const hit = dict[key];
    if (hit === undefined) {
      request(key);
      continue;
    }
    const next = source.replace(key, hit);
    if (current !== next) el.setAttribute(attr, next);
    mineMap[attr] = next;
    attrApplied.set(el, mineMap);
    outputs.add(hit);
  }
}

function walk(root: Node, apply: Apply) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!skipped(root)) handleText(root as Text, apply);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (skipped(root)) return;

  handleAttrs(root as Element, apply);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!skipped(n)) handleText(n as Text, apply);
    } else if (SKIP_TAGS.has((n as Element).tagName)) {
      // Don't descend into skipped subtrees.
    } else {
      handleAttrs(n as Element, apply);
    }
    n = walker.nextNode();
  }
}

/** Translate the whole document now, and keep doing it as React re-renders.
 *  Returns a cleanup that stops observing. */
export function installDomTranslator(get: () => Apply) {
  if (typeof document === "undefined") return () => {};

  let scheduled = false;
  let observer: MutationObserver | null = null;

  const run = (roots?: Node[]) => {
    const apply = get();
    // Never disconnect while writing: MutationObserver drops queued records on
    // disconnect, so a React text update delivered right before our write would
    // be lost and that node would stay in the source language forever. Applying
    // a translation is idempotent (see handleText/handleAttrs), so observing our
    // own writes is safe and cannot loop.
    (roots ?? [document.body]).forEach((r) => {
      if (r.isConnected) walk(r, apply);
    });
  };

  const schedule = (roots?: Node[]) => {
    if (roots && roots.length > 0) {
      run(roots);
      return;
    }
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };

  observer = new MutationObserver((records) => {
    const roots: Node[] = [];
    for (const rec of records) {
      if (rec.type === "characterData") roots.push(rec.target);
      else if (rec.type === "attributes") roots.push(rec.target);
      else rec.addedNodes.forEach((n) => roots.push(n));
    }
    schedule(roots.length > 0 && roots.length < 200 ? roots : undefined);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });

  run();
  return () => observer?.disconnect();
}

/** Re-scan everything (after new translations land, or on language change). */
export function retranslateDocument(get: () => Apply) {
  if (typeof document === "undefined") return;
  walk(document.body, get());
}

/** Forget which strings we produced. Required when switching directly from one
 *  target language to another: the DOM still holds the previous language's text,
 *  which would otherwise be skipped as "already translated". */
export function resetDomOutputs() {
  outputs.clear();
}
