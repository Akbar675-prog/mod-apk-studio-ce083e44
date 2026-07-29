import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { customAlphabet } from "nanoid";
import { listExclusiveIds, isExclusive } from "./exclusive.functions";
import {
  readIndex,
  setAppMeta,
  updateAppMeta,
  removeAppMeta,
  EMPTY_ARCH,
  type ArchFlags,
  type PreviewMeta,
} from "./metadata.functions";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const genId = customAlphabet(alphabet, 22);

export type AppListItem = {
  ID: string;
  App_name: string;
  Description: string;
  App_icon: string;
  Download_url: string;
  Created_at?: string;
  Download_count?: number;
  Has_apk?: boolean;
  Apk_url?: string;
  Apk_filename?: string | null;
  Is_exclusive?: boolean;
  Coming_soon?: boolean;
  Version: string | null;
  Arch: ArchFlags;
  Previews?: PreviewItem[]; // list of preview media (image or video)
};

export type PreviewItem = { url: string; contentType: string };

function toBase64Url(input: string): string {
  const b64 = btoa(input);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const archSchema = z.object({
  arm64_v8a: z.boolean().default(false),
  armeabi_v7a: z.boolean().default(false),
  x86: z.boolean().default(false),
  x86_64: z.boolean().default(false),
});

const createInput = z.object({
  app_name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).default(""),
  download_url: z.string().trim().max(2000).default(""),
  icon_kind: z.enum(["upload", "url", "none"]),
  icon_url: z.string().trim().url().max(2000).optional().nullable(),
  icon_data_base64: z.string().max(8_000_000).optional().nullable(),
  icon_content_type: z.string().max(100).optional().nullable(),
  apk_id: z.string().max(64).optional().nullable(),
  apk_content_type: z.string().max(100).optional().nullable(),
  apk_size: z.number().int().nonnegative().optional().nullable(),
  apk_filename: z.string().max(255).optional().nullable(),
  is_exclusive: z.boolean().optional().default(false),
  exclusive_password: z.string().trim().min(1).max(200).optional().nullable(),
  coming_soon: z.boolean().optional().default(false),
  version: z.string().trim().max(40).optional().nullable(),
  arch: archSchema.optional(),
  previews: z
    .array(z.object({ id: z.string().max(64), contentType: z.string().max(100) }))
    .max(10)
    .optional(),
});

const updateInput = z.object({
  id: z.string().min(1).max(40),
  app_name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  download_url: z.string().trim().max(2000).optional(),
  // Icon replacement
  icon_kind: z.enum(["keep", "upload", "url", "none"]).optional(),
  icon_url: z.string().trim().url().max(2000).optional().nullable(),
  icon_data_base64: z.string().max(8_000_000).optional().nullable(),
  icon_content_type: z.string().max(100).optional().nullable(),
  // APK replacement (from signed upload) — pass null to remove
  apk_action: z.enum(["keep", "replace", "remove"]).optional(),
  apk_id: z.string().max(64).optional().nullable(),
  apk_content_type: z.string().max(100).optional().nullable(),
  apk_size: z.number().int().nonnegative().optional().nullable(),
  apk_filename: z.string().max(255).optional().nullable(),
  version: z.string().trim().max(40).optional().nullable(),
  arch: archSchema.optional(),
  previews: z
    .array(z.object({ id: z.string().max(64), contentType: z.string().max(100) }))
    .max(20)
    .optional(),
});

// coming soon flag for updates
const updateInputWithComing = updateInput.extend({
  coming_soon: z.boolean().optional(),
});

function iconUrlFor(row: {
  icon_id: string | null;
  icon_external_url: string | null;
}): string {
  if (row.icon_external_url) return row.icon_external_url;
  if (row.icon_id) return `/apps/icon/FGJ01/${row.icon_id}`;
  return "";
}

function apkUrlFor(id: string): string {
  return `/apps/gyps/${toBase64Url(id)}`;
}

function previewUrls(previews: PreviewMeta[] | undefined): PreviewItem[] {
  return (previews ?? []).map((p) => ({
    url: `/apps/preview/${p.id}`,
    contentType: p.contentType || "image/jpeg",
  }));
}

export const listAppsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppListItem[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data, error }, exclusiveIds, metaIndex] = await Promise.all([
      supabaseAdmin
        .from("apps")
        .select(
          "id, app_name, description, download_url, icon_id, icon_external_url, apk_id, created_at, download_count",
        )
        .order("created_at", { ascending: false }),
      listExclusiveIds(),
      readIndex(),
    ]);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const hasApk = !!(r as { apk_id?: string | null }).apk_id;
      const excl = exclusiveIds.has(r.id);
      const meta = metaIndex[r.id];
      return {
        ID: r.id,
        App_name: r.app_name,
        Description: r.description ?? "",
        Download_url: excl ? "" : r.download_url ?? "",
        App_icon: iconUrlFor(r),
        Created_at: (r as { created_at?: string }).created_at,
        Download_count:
          (r as { download_count?: number }).download_count ?? 0,
        Has_apk: hasApk,
        Apk_url: hasApk && !excl ? apkUrlFor(r.id) : undefined,
        Apk_filename: meta?.apkFilename ?? null,
        Is_exclusive: excl,
        Version: meta?.version ?? null,
        Arch: meta?.arch ?? { ...EMPTY_ARCH },
        Previews: previewUrls(meta?.previews),
      };
    });
  },
);

export const getAppFn = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }): Promise<AppListItem | null> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data: row, error }, metaIndex] = await Promise.all([
      supabaseAdmin
        .from("apps")
        .select(
          "id, app_name, description, download_url, icon_id, icon_external_url, created_at, download_count, apk_id",
        )
        .eq("id", data.id)
        .maybeSingle(),
      readIndex(),
    ]);
    if (error) throw new Error(error.message);
    if (!row) return null;
    const hasApk = !!(row as { apk_id?: string | null }).apk_id;
    const excl = await isExclusive(row.id);
    const meta = metaIndex[row.id];
    return {
      ID: row.id,
      App_name: row.app_name,
      Description: row.description ?? "",
      Download_url: excl ? "" : row.download_url ?? "",
      App_icon: iconUrlFor(row),
      Created_at: row.created_at,
      Download_count: (row as { download_count?: number }).download_count ?? 0,
      Has_apk: hasApk,
      Apk_url: hasApk && !excl ? apkUrlFor(row.id) : undefined,
      Apk_filename: meta?.apkFilename ?? null,
      Is_exclusive: excl,
      Version: meta?.version ?? null,
      Arch: meta?.arch ?? { ...EMPTY_ARCH },
      Previews: previewUrls(meta?.previews),
    };
  });

export const incrementDownloadFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ count: number }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error: selErr } = await supabaseAdmin
      .from("apps")
      .select("download_count")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    const current = (row as { download_count?: number } | null)?.download_count ?? 0;
    const next = current + 1;
    const { error } = await supabaseAdmin
      .from("apps")
      .update({ download_count: next } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { count: next };
  });

/** Create a signed upload URL for direct browser -> Supabase Storage upload.
 *  This bypasses the worker's request body limit that caused 413s. */
export const createUploadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["apk", "preview"]),
      })
      .parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ id: string; token: string; path: string; bucket: string; signedUrl: string }> => {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const id = genId();
      const bucket = data.kind === "apk" ? "app-files" : "app-icons";
      const path = data.kind === "apk" ? `GYPS/${id}` : `PREVIEWS/${id}`;
      const { data: signed, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(path);
      if (error || !signed) throw new Error(error?.message || "Signed URL gagal");
      return {
        id,
        token: signed.token,
        path: signed.path,
        bucket,
        signedUrl: signed.signedUrl,
      };
    },
  );

/** Return a fresh signed URL to download the APK. Called on button click so
 *  the URL never appears in the initial HTML source. */
export const getApkDownloadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const [{ data: row }, meta] = await Promise.all([
      supabaseAdmin
        .from("apps")
        .select("app_name, apk_id, download_url")
        .eq("id", data.id)
        .maybeSingle(),
      readIndex(),
    ]);
    if (!row) return { url: null };
    const apkId = (row as { apk_id?: string | null }).apk_id;
    if (!apkId) {
      const fallback = (row as { download_url?: string }).download_url ?? "";
      return { url: fallback || null };
    }
    const fname =
      meta[data.id]?.apkFilename ||
      `${(row as { app_name?: string }).app_name ?? "app"}.apk`;
    const { data: signed } = await supabaseAdmin.storage
      .from("app-files")
      .createSignedUrl(`GYPS/${apkId}`, 3600);
    const { withDownloadName } = await import("./download-url");
    return {
      url: signed?.signedUrl ? withDownloadName(signed.signedUrl, fname) : null,
    };
  });

export const createAppFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createInput.parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const id = genId();
    let icon_id: string | null = null;
    const icon_external_url: string | null = null;
    let icon_content_type: string | null = null;

    let iconBytes: Uint8Array | null = null;
    if (data.icon_kind === "upload" && data.icon_data_base64) {
      iconBytes = Uint8Array.from(atob(data.icon_data_base64), (c) => c.charCodeAt(0));
      icon_content_type = data.icon_content_type || "application/octet-stream";
    } else if (data.icon_kind === "url" && data.icon_url) {
      const res = await fetch(data.icon_url);
      if (!res.ok) throw new Error(`Gagal ambil icon dari URL (${res.status})`);
      iconBytes = new Uint8Array(await res.arrayBuffer());
      if (iconBytes.byteLength > 8 * 1024 * 1024)
        throw new Error("Icon dari URL lebih dari 8MB.");
      icon_content_type =
        res.headers.get("content-type") || "application/octet-stream";
    }

    if (iconBytes) {
      icon_id = genId();
      const { error: upErr } = await supabaseAdmin.storage
        .from("app-icons")
        .upload(`FGJ01/${icon_id}`, iconBytes, {
          contentType: icon_content_type!,
          upsert: false,
        });
      if (upErr) throw new Error(`Icon upload failed: ${upErr.message}`);
    }

    let apk_id: string | null = null;
    let apk_content_type: string | null = null;
    let apk_size: number | null = null;
    if (data.apk_id) {
      apk_id = data.apk_id;
      apk_content_type =
        data.apk_content_type || "application/vnd.android.package-archive";
      apk_size = data.apk_size ?? null;
    }

    const { error } = await supabaseAdmin.from("apps").insert({
      id,
      app_name: data.app_name,
      description: data.description ?? "",
      download_url: data.download_url ?? "",
      icon_id,
      icon_external_url,
      icon_content_type,
      apk_id,
      apk_content_type,
      apk_size,
    } as never);
    if (error) throw new Error(error.message);

    const versionTrim = (data.version ?? "").trim();
    await setAppMeta(id, {
      version: versionTrim.length > 0 ? versionTrim : null,
      arch: {
        arm64_v8a: !!data.arch?.arm64_v8a,
        armeabi_v7a: !!data.arch?.armeabi_v7a,
        x86: !!data.arch?.x86,
        x86_64: !!data.arch?.x86_64,
      },
      previews: data.previews ?? [],
      apkFilename: data.apk_filename ?? null,
    });

    if (data.is_exclusive) {
      if (!data.exclusive_password || !data.exclusive_password.trim()) {
        throw new Error("Password Exclusive wajib diisi.");
      }
      const enc = new TextEncoder().encode(data.exclusive_password.trim());
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const body = new Blob(
        [JSON.stringify({ enabled: true, hash })],
        { type: "application/json" },
      );
      const { error: metaErr } = await supabaseAdmin.storage
        .from("app-exclusive")
        .upload(`${id}.json`, body, {
          contentType: "application/json",
          upsert: true,
        });
      if (metaErr) throw new Error(`Exclusive meta failed: ${metaErr.message}`);
    }
    return { id };
  });

export const updateAppFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("apps")
      .select(
        "id, icon_id, icon_content_type, apk_id, apk_content_type, apk_size",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row) throw new Error("Aplikasi tidak ditemukan.");

    const patch: Record<string, unknown> = {};
    if (data.app_name !== undefined) patch.app_name = data.app_name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.download_url !== undefined) patch.download_url = data.download_url;

    // Icon handling
    if (data.icon_kind && data.icon_kind !== "keep") {
      // Remove old icon file if any
      if (row.icon_id) {
        await supabaseAdmin.storage
          .from("app-icons")
          .remove([`FGJ01/${row.icon_id}`]);
      }
      let newIconId: string | null = null;
      let newIconType: string | null = null;
      if (data.icon_kind === "upload" && data.icon_data_base64) {
        const bytes = Uint8Array.from(atob(data.icon_data_base64), (c) =>
          c.charCodeAt(0),
        );
        newIconId = genId();
        newIconType = data.icon_content_type || "application/octet-stream";
        const { error } = await supabaseAdmin.storage
          .from("app-icons")
          .upload(`FGJ01/${newIconId}`, bytes, {
            contentType: newIconType,
            upsert: false,
          });
        if (error) throw new Error(`Icon upload failed: ${error.message}`);
      } else if (data.icon_kind === "url" && data.icon_url) {
        const res = await fetch(data.icon_url);
        if (!res.ok) throw new Error(`Gagal ambil icon dari URL (${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > 8 * 1024 * 1024)
          throw new Error("Icon dari URL lebih dari 8MB.");
        newIconType = res.headers.get("content-type") || "application/octet-stream";
        newIconId = genId();
        const { error } = await supabaseAdmin.storage
          .from("app-icons")
          .upload(`FGJ01/${newIconId}`, bytes, {
            contentType: newIconType,
            upsert: false,
          });
        if (error) throw new Error(`Icon upload failed: ${error.message}`);
      }
      patch.icon_id = newIconId;
      patch.icon_content_type = newIconType;
      patch.icon_external_url = null;
    }

    // APK handling
    if (data.apk_action === "remove") {
      if (row.apk_id) {
        await supabaseAdmin.storage
          .from("app-files")
          .remove([`GYPS/${row.apk_id}`]);
      }
      patch.apk_id = null;
      patch.apk_content_type = null;
      patch.apk_size = null;
    } else if (data.apk_action === "replace" && data.apk_id) {
      if (row.apk_id) {
        await supabaseAdmin.storage
          .from("app-files")
          .remove([`GYPS/${row.apk_id}`]);
      }
      patch.apk_id = data.apk_id;
      patch.apk_content_type =
        data.apk_content_type || "application/vnd.android.package-archive";
      patch.apk_size = data.apk_size ?? null;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin
        .from("apps")
        .update(patch as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    // Metadata (version, arch, previews)
    const metaPatch: {
      version?: string | null;
      arch?: ArchFlags;
      previews?: PreviewMeta[];
      apkFilename?: string | null;
    } = {};
    if (data.version !== undefined) {
      const v = (data.version ?? "").trim();
      metaPatch.version = v.length > 0 ? v : null;
    }
    if (data.arch) metaPatch.arch = data.arch;
    if (data.previews) metaPatch.previews = data.previews;
    if (data.apk_action === "remove") metaPatch.apkFilename = null;
    else if (data.apk_action === "replace" && data.apk_filename !== undefined)
      metaPatch.apkFilename = data.apk_filename;
    if (Object.keys(metaPatch).length > 0) await updateAppMeta(data.id, metaPatch);

    return { ok: true };
  });

export const removePreviewFileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ previewId: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.storage
      .from("app-icons")
      .remove([`PREVIEWS/${data.previewId}`]);
    return { ok: true };
  });

export const deleteAppFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row } = await supabaseAdmin
      .from("apps")
      .select("icon_id, apk_id")
      .eq("id", data.id)
      .maybeSingle();
    // Remove previews from storage
    const idx = await readIndex();
    const meta = idx[data.id];
    if (meta?.previews?.length) {
      await supabaseAdmin.storage
        .from("app-icons")
        .remove(meta.previews.map((p) => `PREVIEWS/${p.id}`));
    }
    if (row?.icon_id) {
      await supabaseAdmin.storage.from("app-icons").remove([`FGJ01/${row.icon_id}`]);
    }
    if ((row as { apk_id?: string | null } | null)?.apk_id) {
      await supabaseAdmin.storage
        .from("app-files")
        .remove([`GYPS/${(row as { apk_id: string }).apk_id}`]);
    }
    await supabaseAdmin.storage.from("app-exclusive").remove([`${data.id}.json`]);
    await removeAppMeta(data.id);
    const { error } = await supabaseAdmin.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
