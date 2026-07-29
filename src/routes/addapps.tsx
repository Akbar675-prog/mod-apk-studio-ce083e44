import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Upload, Link as LinkIcon, Loader2, Trash2, Package, Lock, X,
  Pencil, Save, Image as ImageIcon, Plus, Clock,
} from "lucide-react";
import {
  createAppFn, updateAppFn, deleteAppFn, listAppsFn, getAppFn,
  createUploadUrlFn, removePreviewFileFn,
  type AppListItem,
} from "@/lib/apps.functions";
import { AppHeader } from "@/components/AppHeader";
import { PressButton } from "@/components/Pressable";

const appsQuery = queryOptions({
  queryKey: ["apps"],
  queryFn: () => listAppsFn(),
});

export const Route = createFileRoute("/addapps")({
  loader: ({ context }) => context.queryClient.ensureQueryData(appsQuery),
  component: AddApps,
});

type IconMode = "upload" | "url" | "none";

type UploadHandle = {
  xhr: XMLHttpRequest;
  promise: Promise<{ id: string; contentType: string; size: number }>;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    file
      .arrayBuffer()
      .then((buf) => {
        let s = "";
        const b = new Uint8Array(buf);
        for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i]);
        resolve(btoa(s));
      })
      .catch(reject);
  });
}

/** Direct signed upload to Supabase Storage via XHR (progress + cancel). */
function signedUploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<{ id: string; contentType: string; size: number }>(
    (resolve, reject) => {
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable)
          onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            id: "",
            contentType: file.type || "application/octet-stream",
            size: file.size,
          });
        } else {
          reject(new Error(`Upload gagal (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Koneksi upload terputus."));
      xhr.onabort = () => reject(new Error("Upload dibatalkan."));
      xhr.send(file);
    },
  );
  return { xhr, promise };
}

function AddApps() {
  const qc = useQueryClient();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 pt-6 md:px-8">
        <Link
          to="/"
          aria-label="Kembali"
          className="inline-flex size-10 items-center justify-center rounded-full bg-surface-variant transition-colors hover:bg-primary-container"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm text-muted-foreground">Kembali</span>
      </div>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-4 md:px-8">
        <h1 className="font-display text-4xl leading-tight md:text-5xl">
          Tambah aplikasi
        </h1>
        <p className="mt-2 text-muted-foreground">
          Isi detail aplikasi, lalu simpan untuk masuk ke katalog.
        </p>

        <AppForm mode="create" onSaved={() => qc.invalidateQueries({ queryKey: ["apps"] })} />

        <ManageAppsSection />
      </main>

      <FormStyles />
    </div>
  );
}

function FormStyles() {
  return (
    <style>{`
      .input {
        margin-top: 0.5rem;
        width: 100%;
        border-radius: 1rem;
        background: var(--color-surface-variant);
        padding: 0.9rem 1rem;
        font-size: 1rem;
        color: var(--color-foreground);
        outline: none;
        border: 2px solid transparent;
        transition: border-color .15s ease, background-color .15s ease;
      }
      .input:focus {
        border-color: var(--color-primary);
        background: var(--color-surface);
      }
    `}</style>
  );
}

function AppForm({
  mode,
  existing,
  onSaved,
  onDone,
}: {
  mode: "create" | "edit";
  existing?: AppListItem;
  onSaved?: () => void;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createApp = useServerFn(createAppFn);
  const updateApp = useServerFn(updateAppFn);
  const createUploadUrl = useServerFn(createUploadUrlFn);
  const removePreviewFile = useServerFn(removePreviewFileFn);

  const [name, setName] = useState(existing?.App_name ?? "");
  const [description, setDescription] = useState(existing?.Description ?? "");
  const [downloadUrl, setDownloadUrl] = useState(existing?.Download_url ?? "");
  const [iconMode, setIconMode] = useState<IconMode | "keep">(mode === "edit" ? "keep" : "upload");
  const [iconUrl, setIconUrl] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [apkAction, setApkAction] = useState<"keep" | "replace" | "remove">("keep");
  const [isExclusive, setIsExclusive] = useState(existing?.Is_exclusive ?? false);
  const [comingSoon, setComingSoon] = useState(existing?.Coming_soon ?? false);
  const [exclusivePassword, setExclusivePassword] = useState("");
  const [version, setVersion] = useState(existing?.Version ?? "");
  const [archArm64V8a, setArchArm64V8a] = useState(existing?.Arch?.arm64_v8a ?? false);
  const [archArmeabiV7a, setArchArmeabiV7a] = useState(existing?.Arch?.armeabi_v7a ?? false);
  const [archX86, setArchX86] = useState(existing?.Arch?.x86 ?? false);
  const [archX86_64, setArchX86_64] = useState(existing?.Arch?.x86_64 ?? false);

  // Preview screenshots: existing kept as-is, plus new files staged for upload
  type ExistingPreview = { url: string; id: string; contentType: string; keep: boolean };
  const [existingPreviews, setExistingPreviews] = useState<ExistingPreview[]>(
    (existing?.Previews ?? []).map((p) => {
      const id = p.url.split("/").pop() ?? "";
      return { url: p.url, id, contentType: p.contentType || "image/jpeg", keep: true };
    }),
  );
  const [newPreviews, setNewPreviews] = useState<File[]>([]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadHandle, setUploadHandle] = useState<UploadHandle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  function onIconFile(file: File | null) {
    setIconFile(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview("");
  }

  function cancelUpload() {
    if (uploadHandle) {
      try { uploadHandle.xhr.abort(); } catch { /* ignore */ }
    }
    setUploadHandle(null);
    setUploadProgress(null);
    setApkFile(null);
    setApkAction(mode === "edit" ? "keep" : "keep");
  }

  async function uploadOne(kind: "apk" | "preview", file: File): Promise<{
    id: string; contentType: string; size: number;
  }> {
    const signed = await createUploadUrl({ data: { kind } });
    const handle = signedUploadWithProgress(signed.signedUrl, file, (pct) =>
      setUploadProgress(pct),
    );
    if (kind === "apk") setUploadHandle(handle);
    try {
      const res = await handle.promise;
      return { id: signed.id, contentType: res.contentType, size: res.size };
    } finally {
      if (kind === "apk") setUploadHandle(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nama aplikasi wajib diisi.");
    if (mode === "create" && !comingSoon && !downloadUrl.trim() && !apkFile)
      return setError("Isi link download, atau upload file .apk.");
    if (mode === "create" && isExclusive && !exclusivePassword.trim())
      return setError("Password Exclusive wajib diisi.");

    setSubmitting(true);
    try {
      // Icon
      let icon_data_base64: string | null = null;
      let icon_content_type: string | null = null;
      if ((iconMode === "upload" || (mode === "create" && iconMode !== "url" && iconMode !== "none"))) {
        if (iconMode === "upload") {
          if (iconFile) {
            if (iconFile.size > 5 * 1024 * 1024) {
              setSubmitting(false);
              return setError("Ukuran icon maksimal 5MB.");
            }
            icon_data_base64 = await fileToBase64(iconFile);
            icon_content_type = iconFile.type || "application/octet-stream";
          } else if (mode === "create") {
            setSubmitting(false);
            return setError("Pilih file icon atau pindah ke tab URL.");
          }
        }
      }

      // APK — direct signed upload
      let apk_id: string | null = null;
      let apk_content_type: string | null = null;
      let apk_size: number | null = null;
      if (apkFile && !comingSoon) {
        if (apkFile.size > 500 * 1024 * 1024) {
          setSubmitting(false);
          return setError("Ukuran .apk maksimal 500MB.");
        }
        const r = await uploadOne("apk", apkFile);
        apk_id = r.id;
        apk_content_type = r.contentType;
        apk_size = r.size;
        setUploadProgress(null);
      }

      // Previews — upload new ones
      const uploadedNewPreviews: { id: string; contentType: string }[] = [];
      for (const f of newPreviews) {
        const isVideo = (f.type || "").startsWith("video/");
        const maxSize = isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
        if (f.size > maxSize) {
          setSubmitting(false);
          return setError(
            `Preview "${f.name}" melebihi ${isVideo ? "50MB (video)" : "8MB (gambar)"}.`,
          );
        }
        const r = await uploadOne("preview", f);
        uploadedNewPreviews.push({ id: r.id, contentType: r.contentType });
      }

      // Determine which existing previews were removed, cleanup storage
      if (mode === "edit") {
        const removed = existingPreviews.filter((p) => !p.keep);
        for (const p of removed) {
          try { await removePreviewFile({ data: { previewId: p.id } }); } catch { /* ignore */ }
        }
      }

      const keptPreviews = existingPreviews
        .filter((p) => p.keep)
        .map((p) => ({ id: p.id, contentType: p.contentType }));
      const allPreviews = [...keptPreviews, ...uploadedNewPreviews];

      if (mode === "create") {
        const { id } = await createApp({
          data: {
            app_name: name.trim(),
            description: description.trim(),
            download_url: comingSoon ? "" : downloadUrl.trim(),
            coming_soon: comingSoon,
            icon_kind: (iconMode === "keep" ? "none" : iconMode) as IconMode,
            icon_url: iconMode === "url" ? iconUrl.trim() : null,
            icon_data_base64,
            icon_content_type,
            apk_id,
            apk_content_type,
            apk_size,
            apk_filename: apkFile?.name ?? null,
            is_exclusive: isExclusive,
            exclusive_password: isExclusive ? exclusivePassword.trim() : null,
            version: version.trim() || null,
            arch: {
              arm64_v8a: archArm64V8a,
              armeabi_v7a: archArmeabiV7a,
              x86: archX86,
              x86_64: archX86_64,
            },
            previews: allPreviews,
          },
        });
        navigate({ to: "/apps/$id", params: { id } });
      } else if (existing) {
        await updateApp({
          data: {
            id: existing.ID,
            app_name: name.trim(),
            description: description.trim(),
            download_url: comingSoon ? "" : downloadUrl.trim(),
            coming_soon: comingSoon,
            icon_kind: iconMode as "keep" | "upload" | "url" | "none",
            icon_url: iconMode === "url" ? iconUrl.trim() : null,
            icon_data_base64,
            icon_content_type,
            apk_action: apkAction,
            apk_id,
            apk_content_type,
            apk_size,
            apk_filename: apkFile?.name ?? null,
            version: version.trim() || null,
            arch: {
              arm64_v8a: archArm64V8a,
              armeabi_v7a: archArmeabiV7a,
              x86: archX86,
              x86_64: archX86_64,
            },
            previews: allPreviews,
          },
        });
        await qc.invalidateQueries({ queryKey: ["apps"] });
        await qc.invalidateQueries({ queryKey: ["app", existing.ID] });
        onSaved?.();
        onDone?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <Card>
        <Label>Nama aplikasi</Label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Neko Reader"
          className="input"
          maxLength={80}
          required
        />
      </Card>

      <Card>
        <Label>Deskripsi</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi singkat aplikasi..."
          rows={5}
          maxLength={2000}
          className="input resize-none"
        />
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label>
              <span className="inline-flex items-center gap-2">
                <Clock className="size-5" /> Coming Soon App
              </span>
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Jika aktif, aplikasi ditandai "Akan Datang" — link download dan file .apk
              dinonaktifkan sampai mode ini dimatikan.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={comingSoon}
            onClick={() =>
              setComingSoon((v) => {
                const next = !v;
                if (next) {
                  setDownloadUrl("");
                  setApkFile(null);
                  setApkAction(mode === "edit" ? "remove" : "keep");
                }
                return next;
              })
            }
            className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              comingSoon ? "bg-primary" : "bg-surface-variant"
            }`}
          >
            <span
              className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                comingSoon ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      <Card>
        <Label>Link download APK</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Opsional jika kamu upload file .apk di bawah.
        </p>
        <input
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
          placeholder={comingSoon ? "Dinonaktifkan (mode Coming Soon)" : "https://..."}
          type="url"
          disabled={comingSoon}
          className="input disabled:cursor-not-allowed disabled:opacity-50"
        />
      </Card>

      <Card className={comingSoon ? "pointer-events-none opacity-50" : undefined}>
        <Label>File .apk (opsional)</Label>
        {mode === "edit" && existing?.Has_apk && apkAction === "keep" && !apkFile && (
          <p className="mt-2 rounded-xl bg-primary-container px-3 py-2 text-xs text-on-primary-container">
            Sudah ada .apk terupload. Pilih file baru untuk mengganti, atau hapus.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Upload langsung ke storage (bypass batas request). Maksimal 500MB.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-surface-variant">
            <Package className="size-8 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary-container px-4 py-2 text-sm font-medium text-on-secondary-container transition-colors hover:bg-secondary hover:text-secondary-foreground">
                <Upload className="size-4" />
                {apkFile ? "Ganti .apk" : "Pilih .apk"}
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setApkFile(f);
                    if (f) setApkAction("replace");
                  }}
                />
              </label>
              {mode === "edit" && existing?.Has_apk && !apkFile && apkAction !== "remove" && (
                <button
                  type="button"
                  onClick={() => setApkAction("remove")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="size-3.5" /> Hapus .apk
                </button>
              )}
              {apkAction === "remove" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  Akan dihapus
                  <button type="button" onClick={() => setApkAction("keep")} className="underline">urungkan</button>
                </span>
              )}
              {(apkFile || uploadProgress !== null) && (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-variant px-3 py-2 text-xs font-medium hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3.5" /> Cancel & pakai link
                </button>
              )}
            </div>
            {apkFile && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {apkFile.name} · {(apkFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            )}
            {uploadProgress !== null && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mengunggah {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <Label>Versi & Arsitektur</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Kosongkan versi jika belum ada, akan ditampilkan sebagai "NaN".
        </p>
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="Contoh: 0.12.3"
          className="input"
          maxLength={40}
        />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "arm64_v8a", label: "arm64-v8a", val: archArm64V8a, set: setArchArm64V8a },
            { k: "armeabi_v7a", label: "armeabi-v7a", val: archArmeabiV7a, set: setArchArmeabiV7a },
            { k: "x86", label: "x86", val: archX86, set: setArchX86 },
            { k: "x86_64", label: "x86_64", val: archX86_64, set: setArchX86_64 },
          ].map((a) => (
            <label
              key={a.k}
              className={`flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-medium transition-all ${
                a.val
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent bg-surface-variant text-muted-foreground hover:bg-surface"
              }`}
            >
              <input
                type="checkbox"
                className="size-4 accent-current"
                checked={a.val}
                onChange={(e) => a.set(e.target.checked)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <Label>
          <span className="inline-flex items-center gap-2">
            <ImageIcon className="size-5" /> Preview (screenshot)
          </span>
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Opsional. Gambar (maks 8MB) atau video pendek (maks 50MB). Total maks 10.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {existingPreviews.map((p) => (
            <div key={p.id} className={`relative size-24 overflow-hidden rounded-xl bg-surface-variant ${!p.keep ? "opacity-30" : ""}`}>
              <img src={p.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() =>
                  setExistingPreviews((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, keep: !x.keep } : x)),
                  )
                }
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label={p.keep ? "Hapus preview" : "Batalkan hapus"}
              >
                {p.keep ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              </button>
            </div>
          ))}
          {newPreviews.map((f, i) => (
            <div key={i} className="relative size-24 overflow-hidden rounded-xl bg-surface-variant ring-2 ring-primary">
              {(f.type || "").startsWith("video/") ? (
                <video src={URL.createObjectURL(f)} className="size-full object-cover" muted />
              ) : (
                <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => setNewPreviews((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Batal"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <label className="inline-flex size-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-outline bg-surface hover:bg-surface-variant">
            <Plus className="size-6 text-muted-foreground" />
            <input
              type="file"
              accept="image/*,video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setNewPreviews((prev) => [...prev, ...files].slice(0, 10));
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </Card>

      {mode === "create" && (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Label>
                <span className="inline-flex items-center gap-2">
                  <Lock className="size-5" /> Exclusive Apps
                </span>
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Jika aktif, user harus memasukkan password sebelum bisa mengunduh.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isExclusive}
              onClick={() => setIsExclusive((v) => !v)}
              className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                isExclusive ? "bg-primary" : "bg-surface-variant"
              }`}
            >
              <span
                className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
                  isExclusive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {isExclusive && (
            <div className="mt-4">
              <input
                value={exclusivePassword}
                onChange={(e) => setExclusivePassword(e.target.value)}
                placeholder="Password download"
                type="text"
                autoComplete="off"
                maxLength={200}
                className="input"
              />
            </div>
          )}
        </Card>
      )}

      <Card>
        <Label>Icon aplikasi</Label>
        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-surface-variant p-1">
          {mode === "edit" && (
            <TabBtn
              active={iconMode === "keep"}
              onClick={() => setIconMode("keep")}
              label="Pertahankan"
            />
          )}
          <TabBtn
            active={iconMode === "upload"}
            onClick={() => setIconMode("upload")}
            icon={<Upload className="size-4" />}
            label="Upload"
          />
          <TabBtn
            active={iconMode === "url"}
            onClick={() => setIconMode("url")}
            icon={<LinkIcon className="size-4" />}
            label="URL"
          />
          <TabBtn
            active={iconMode === "none"}
            onClick={() => setIconMode("none")}
            label="Tanpa icon"
          />
        </div>

        {iconMode === "upload" && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-surface-variant">
              {preview ? (
                <img src={preview} alt="preview" className="size-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">Preview</span>
              )}
            </div>
            <label className="cursor-pointer rounded-full bg-secondary-container px-4 py-2 text-sm font-medium text-on-secondary-container hover:bg-secondary hover:text-secondary-foreground">
              Pilih file
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onIconFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        {iconMode === "url" && (
          <input
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://.../icon.png"
            type="url"
            className="input mt-4"
          />
        )}
      </Card>

      {error && (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <PressButton
          type="submit"
          disabled={submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-5 animate-spin" />}
          {submitting ? (
            "Menyimpan..."
          ) : mode === "edit" ? (
            <><Save className="size-5" /> Simpan perubahan</>
          ) : (
            "Simpan aplikasi"
          )}
        </PressButton>
        {mode === "edit" && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full bg-surface-variant px-6 py-4 text-base font-semibold hover:bg-primary-container"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  );
}

function ManageAppsSection() {
  const { data: apps } = useSuspenseQuery(appsQuery);
  const deleteApp = useServerFn(deleteAppFn);
  const getApp = useServerFn(getAppFn);
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingApp, setEditingApp] = useState<AppListItem | null>(null);

  useEffect(() => {
    if (!editingId) { setEditingApp(null); return; }
    let cancelled = false;
    getApp({ data: { id: editingId } }).then((a) => { if (!cancelled) setEditingApp(a); });
    return () => { cancelled = true; };
  }, [editingId, getApp]);

  async function onDelete(app: AppListItem) {
    if (!confirm(`Hapus "${app.App_name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeletingId(app.ID);
    try {
      await deleteApp({ data: { id: app.ID } });
      await qc.invalidateQueries({ queryKey: ["apps"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl leading-tight md:text-3xl">
        Kelola aplikasi
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Edit atau hapus aplikasi yang sudah ada di katalog.
      </p>

      {apps.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface-variant p-5 text-sm text-muted-foreground">
          Belum ada aplikasi.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {apps.map((app) => (
            <li key={app.ID} className="m3-shadow-1 rounded-2xl bg-card">
              <div className="flex items-center gap-3 p-3 pr-2">
                {app.App_icon ? (
                  <img
                    src={app.App_icon}
                    alt=""
                    className="size-12 shrink-0 rounded-xl bg-surface-variant object-cover"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-container font-display text-lg text-on-tertiary-container">
                    {app.App_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{app.App_name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {app.ID}
                  </p>
                </div>
                <button
                  onClick={() => setEditingId((v) => (v === app.ID ? null : app.ID))}
                  aria-label={`Edit ${app.App_name}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-2 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Pencil className="size-4" />
                  {editingId === app.ID ? "Tutup" : "Edit"}
                </button>
                <button
                  onClick={() => onDelete(app)}
                  disabled={deletingId === app.ID}
                  aria-label={`Hapus ${app.App_name}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  {deletingId === app.ID ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Hapus
                </button>
              </div>
              {editingId === app.ID && (
                <div className="border-t border-border p-4 animate-fade-in">
                  {editingApp && editingApp.ID === app.ID ? (
                    <AppForm
                      mode="edit"
                      existing={editingApp}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Memuat detail…
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`m3-shadow-1 rounded-3xl bg-card p-5 md:p-6 ${className ?? ""}`}>{children}</div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-display text-lg leading-tight">{children}</label>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-surface"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
