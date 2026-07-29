// App metadata (version + arch flags + preview images) stored in Supabase Storage
// since the external DB user doesn't have permission to ALTER the `apps` table.
// A single index file "apps-index.json" holds every app's metadata.

const BUCKET = "app-metadata";
const INDEX_KEY = "apps-index.json";

export type ArchFlags = {
  arm64_v8a: boolean;
  armeabi_v7a: boolean;
  x86: boolean;
  x86_64: boolean;
};

export type PreviewMeta = {
  id: string;
  contentType: string;
};

export type AppMeta = {
  version: string | null; // null means "NaN"
  arch: ArchFlags;
  previews?: PreviewMeta[];
  apkFilename?: string | null;
  comingSoon?: boolean;
};

export type AppMetaIndex = Record<string, AppMeta>;

export const EMPTY_ARCH: ArchFlags = {
  arm64_v8a: false,
  armeabi_v7a: false,
  x86: false,
  x86_64: false,
};

export function archLabel(a: ArchFlags | undefined | null): string {
  if (!a) return "NaN";
  const all = a.arm64_v8a && a.armeabi_v7a && a.x86 && a.x86_64;
  if (all) return "Universal";
  const parts: string[] = [];
  if (a.armeabi_v7a) parts.push("v7a");
  if (a.arm64_v8a) parts.push("v8a");
  if (a.x86) parts.push("x86");
  if (a.x86_64) parts.push("x86_64");
  if (parts.length === 0) return "NaN";
  return parts.join(" & ");
}

export function versionLabel(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : "NaN";
}

export async function readIndex(): Promise<AppMetaIndex> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(INDEX_KEY);
  if (error || !data) return {};
  try {
    const text = await data.text();
    const parsed = JSON.parse(text) as AppMetaIndex;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeIndex(next: AppMetaIndex): Promise<void> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const body = new Blob([JSON.stringify(next)], { type: "application/json" });
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(INDEX_KEY, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw new Error(`Meta index write failed: ${error.message}`);
}

export async function setAppMeta(id: string, meta: AppMeta): Promise<void> {
  const idx = await readIndex();
  const prev = idx[id];
  idx[id] = { ...meta, previews: meta.previews ?? prev?.previews ?? [] };
  await writeIndex(idx);
}

export async function updateAppMeta(
  id: string,
  patch: Partial<AppMeta>,
): Promise<AppMeta> {
  const idx = await readIndex();
  const prev: AppMeta = idx[id] ?? {
    version: null,
    arch: { ...EMPTY_ARCH },
    previews: [],
  };
  const next: AppMeta = {
    version: patch.version !== undefined ? patch.version : prev.version,
    arch: patch.arch ?? prev.arch,
    previews: patch.previews ?? prev.previews ?? [],
    apkFilename:
      patch.apkFilename !== undefined ? patch.apkFilename : prev.apkFilename ?? null,
    comingSoon:
      patch.comingSoon !== undefined ? patch.comingSoon : prev.comingSoon ?? false,
  };
  idx[id] = next;
  await writeIndex(idx);
  return next;
}

export async function removeAppMeta(id: string): Promise<void> {
  const idx = await readIndex();
  if (id in idx) {
    delete idx[id];
    await writeIndex(idx);
  }
}

/** Look up a preview across all apps by preview id. */
export async function findPreview(previewId: string): Promise<PreviewMeta | null> {
  const idx = await readIndex();
  for (const meta of Object.values(idx)) {
    const found = (meta.previews ?? []).find((p) => p.id === previewId);
    if (found) return found;
  }
  return null;
}
