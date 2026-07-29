import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Download, CalendarDays, Users, Lock, Loader2, Gem, Cpu, Tag, Sparkles, Images, Clock } from "lucide-react";
import {
  getAppFn,
  incrementDownloadFn,
  getApkDownloadUrlFn,
} from "@/lib/apps.functions";
import { archLabel, versionLabel } from "@/lib/metadata.functions";
import { verifyExclusiveFn } from "@/lib/exclusive.functions";
import { PressButton } from "@/components/Pressable";

const WHATSAPP_REDIRECT =
  "https://whatsapp.com/channel/0029VbDY5dR29753oLbbVc1c";

const appQuery = (id: string) =>
  queryOptions({
    queryKey: ["app", id],
    queryFn: async () => {
      const app = await getAppFn({ data: { id } });
      if (!app) throw notFound();
      return app;
    },
  });

export const Route = createFileRoute("/apps/$id")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(appQuery(params.id)),
  component: AppDetail,
  head: ({ loaderData }) => {
    const app = loaderData as
      | (Awaited<ReturnType<typeof getAppFn>> & object)
      | undefined
      | null;
    if (!app) {
      return {
        meta: [
          { title: "Aplikasi — Galileo Mod APK" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const title = `${app.App_name} APK v${versionLabel(app.Version)} · Galileo Mod APK`;
    const desc = (app.Description || `Download ${app.App_name} APK gratis di Galileo Mod APK.`).slice(0, 155);
    const icon = app.App_icon || "";
    const meta = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `/apps/${app.ID}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: desc },
    ];
    if (icon) {
      meta.push({ property: "og:image", content: icon });
      meta.push({ name: "twitter:image", content: icon });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: `/apps/${app.ID}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: app.App_name,
            description: app.Description || undefined,
            operatingSystem: "Android",
            applicationCategory: "MobileApplication",
            softwareVersion: app.Version || undefined,
            image: icon || undefined,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          }),
        },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Gagal memuat: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8">
      <h1 className="font-display text-2xl">Aplikasi tidak ditemukan</h1>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Kembali
      </Link>
    </div>
  ),
});

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "-";
  }
}

function formatCount(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function isNew(iso?: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 60 * 60 * 1000;
}

function AppDetail() {
  const { id } = Route.useParams();
  const { data: app } = useSuspenseQuery(appQuery(id));
  const qc = useQueryClient();
  const getApkUrl = useServerFn(getApkDownloadUrlFn);
  const increment = useMutation({
    mutationFn: () => incrementDownloadFn({ data: { id } }),
    onSuccess: (res) => {
      qc.setQueryData(["app", id], (prev: typeof app | undefined) =>
        prev ? { ...prev, Download_count: res.count } : prev,
      );
    },
  });

  const [gateOpen, setGateOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; contentType: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const previews = app.Previews ?? [];
  const fresh = isNew(app.Created_at);

  async function triggerDownload(directUrl?: string) {
    setDownloading(true);
    try {
      let url = directUrl ?? "";
      if (!url) {
        const res = await getApkUrl({ data: { id } });
        url = res.url ?? "";
      }
      if (!url) throw new Error("Link download tidak tersedia.");
      increment.mutate();
      // Navigate to signed URL — browser handles the download from Supabase CDN.
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal memulai unduhan.");
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  function onDownloadClick() {
    if (app.Coming_soon) return;
    if (app.Is_exclusive) {
      setGateOpen(true);
      return;
    }
    void triggerDownload();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-5 pt-6 md:px-10">
        <Link
          to="/"
          aria-label="Kembali"
          className="inline-flex size-10 items-center justify-center rounded-full bg-surface-variant text-foreground transition-colors hover:bg-primary-container"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm text-muted-foreground">Detail aplikasi</span>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-32 pt-6 md:px-10">
        <div className="m3-shadow-1 rounded-4xl bg-card p-6 md:p-10">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:items-start md:text-left">
            {app.App_icon ? (
              <img
                src={app.App_icon}
                alt={app.App_name}
                className="size-28 rounded-xl bg-surface-variant object-cover md:size-32"
              />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-xl bg-tertiary-container font-display text-4xl text-on-tertiary-container md:size-32">
                {app.App_name.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div className="flex-1">
              <h1 className="font-display text-3xl leading-tight md:text-4xl">
                {app.App_name}
              </h1>
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                ID: {app.ID}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {fresh && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-950 shadow-sm animate-fade-in">
                    <Sparkles className="size-3.5" /> New
                  </span>
                )}
                {app.Coming_soon && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                    <Clock className="size-3.5" /> Coming Soon
                  </span>
                )}
                {app.Is_exclusive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950 shadow-sm">
                    <Gem className="size-3.5" /> Exclusive
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-semibold text-on-secondary-container">
                  <Tag className="size-3.5" /> v{versionLabel(app.Version)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-xs font-semibold text-on-tertiary-container">
                  <Cpu className="size-3.5" /> Arch: {archLabel(app.Arch)}
                </span>
              </div>
              <PressButton
                type="button"
                onClick={onDownloadClick}
                disabled={downloading || !!app.Coming_soon}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                draggable={false}
                style={{
                  WebkitTouchCallout: "none",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:scale-[1.02] disabled:opacity-70"
              >
                {downloading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : app.Coming_soon ? (
                  <Clock className="size-5" />
                ) : app.Is_exclusive ? (
                  <Lock className="size-5" />
                ) : (
                  <Download className="size-5" />
                )}
                {app.Coming_soon
                  ? "Akan Datang"
                  : downloading
                    ? "Memulai..."
                    : "Download APK"}
              </PressButton>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-variant p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diunggah</p>
                <p className="font-semibold">{formatDate(app.Created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-variant p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total install</p>
                <p className="font-semibold">
                  {formatCount(app.Download_count ?? 0)} orang
                </p>
              </div>
            </div>
          </div>

          {previews.length > 0 && (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 font-display text-xl">
                <Images className="size-5" /> Preview
              </h2>
              <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
                {previews.map((p, i) => {
                  const isVideo = (p.contentType || "").startsWith("video/");
                  return (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => setLightbox(p)}
                      style={{
                        animationDelay: `${Math.min(i * 60, 400)}ms`,
                        animationFillMode: "backwards",
                      }}
                      className="m3-shadow-1 relative aspect-[9/16] h-64 shrink-0 snap-start animate-fade-in overflow-hidden rounded-2xl bg-surface-variant transition-transform hover:-translate-y-1 hover:scale-[1.02]"
                    >
                      {isVideo ? (
                        <video
                          src={p.url}
                          className="size-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={p.url}
                          alt={`Preview ${i + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      )}
                      {isVideo && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          Video
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <hr className="my-8 border-border" />

          <section>
            <h2 className="font-display text-xl">Deskripsi</h2>
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
              {app.Description || "Tidak ada deskripsi."}
            </p>
          </section>
        </div>
      </main>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          {(lightbox.contentType || "").startsWith("video/") ? (
            <video
              src={lightbox.url}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightbox.url}
              alt="Preview"
              className="max-h-full max-w-full rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {gateOpen && (
        <PasswordGate
          appId={id}
          appName={app.App_name}
          onClose={() => setGateOpen(false)}
          onSuccess={(url) => {
            setGateOpen(false);
            increment.mutate();
            if (url) void triggerDownload(url);
          }}
        />
      )}
    </div>
  );
}

const ATTEMPTS_KEY_PREFIX = "excl_attempts_";

function PasswordGate({
  appId,
  appName,
  onClose,
  onSuccess,
}: {
  appId: string;
  appName: string;
  onClose: () => void;
  onSuccess: (url: string) => void;
}) {
  const verify = useServerFn(verifyExclusiveFn);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const key = ATTEMPTS_KEY_PREFIX + appId;

  function getAttempts(): number {
    try {
      return parseInt(localStorage.getItem(key) || "0", 10) || 0;
    } catch {
      return 0;
    }
  }
  function setAttempts(n: number) {
    try {
      localStorage.setItem(key, String(n));
    } catch {
      // ignore
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password.trim()) {
      setError("Password wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const res = await verify({
        data: { id: appId, password: password.trim() },
      });
      if (res.ok) {
        setAttempts(0);
        onSuccess(res.url || "");
        return;
      }
      const next = getAttempts() + 1;
      setAttempts(next);
      if (next >= 5) {
        setAttempts(0);
        window.location.href = WHATSAPP_REDIRECT;
        return;
      }
      setError(
        `Password salah. Percobaan ${next}/5. ${5 - next} lagi sebelum diarahkan.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="m3-shadow-2 w-full max-w-sm rounded-3xl bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
            <Lock className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-lg leading-tight">
              Exclusive App
            </h3>
            <p className="text-xs text-muted-foreground">
              Masukkan password untuk mengunduh "{appName}".
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            maxLength={200}
            className="w-full rounded-2xl bg-surface-variant px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-surface-variant px-4 py-2.5 text-sm font-medium hover:bg-primary-container"
            >
              Batal
            </button>
            <PressButton
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Instal
            </PressButton>
          </div>
        </form>
      </div>
    </div>
  );
}
