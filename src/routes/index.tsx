import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Download, Gem, Sparkles, Clock } from "lucide-react";
import { z } from "zod";
import { listAppsFn, type AppListItem } from "@/lib/apps.functions";
import { versionLabel } from "@/lib/metadata.functions";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/i18n";
import { currentHost, isStatusHost } from "@/lib/status-host";

const appsQuery = queryOptions({
  queryKey: ["apps"],
  queryFn: () => listAppsFn(),
});

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async () => {
    const host = await currentHost();
    if (isStatusHost(host)) throw redirect({ to: "/status" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(appsQuery),
  component: Home,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Gagal memuat: {error.message}</div>
  ),
});

function scoreApp(app: AppListItem, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const name = app.App_name.toLowerCase();
  const desc = (app.Description || "").toLowerCase();
  const ver = (app.Version || "").toLowerCase();
  const id = app.ID.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    if (name === t) score += 100;
    if (name.startsWith(t)) score += 40;
    if (name.includes(t)) score += 20;
    if (desc.includes(t)) score += 5;
    if (ver.includes(t)) score += 8;
    if (id.toLowerCase().includes(t)) score += 3;
  }
  return score;
}

function isNew(iso?: string): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 60 * 60 * 1000; // < 1 hour
}

function Home() {
  const t = useT();
  const { data: apps } = useSuspenseQuery(appsQuery);
  const { q } = Route.useSearch();
  const keyword = (q ?? "").trim().toLowerCase();
  const tokens = keyword ? keyword.split(/\s+/).filter(Boolean) : [];
  const filtered = keyword
    ? apps
        .map((a) => ({ a, s: scoreApp(a, tokens) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.a)
    : apps;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <header className="px-5 pt-8 pb-6 md:px-10 md:pt-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Galileo Mod APK
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight md:text-6xl">
            {t("Katalog aplikasi")}
            <span className="block text-primary">{t("siap di-download.")}</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            {t("Ketuk kartu untuk membuka detail dan mengunduh APK-nya.")}
          </p>
          {keyword && (
            <p className="mt-3 text-sm text-muted-foreground">
              Hasil pencarian untuk{" "}
              <span className="font-semibold text-foreground">"{q}"</span> —{" "}
              {filtered.length} aplikasi
              {" · "}
              <Link to="/" className="text-primary underline">
                Reset
              </Link>
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-32 md:px-10">
        {filtered.length === 0 ? (
          <EmptyState hasSearch={!!keyword} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((app, i) => (
              <AppCard key={app.ID} app={app} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AppCard({ app, index }: { app: AppListItem; index: number }) {
  const t = useT();
  const fresh = isNew(app.Created_at);
  return (
    <Link
      to="/apps/$id"
      params={{ id: app.ID }}
      style={{
        animationDelay: `${Math.min(index * 40, 400)}ms`,
        animationFillMode: "backwards",
      }}
      className="group m3-shadow-1 relative flex animate-fade-in flex-col gap-4 overflow-hidden rounded-3xl bg-card p-5 transition-all duration-200 hover:m3-shadow-2 hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98]"
    >
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
        {fresh && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-950 shadow-md animate-fade-in">
            <Sparkles className="size-3" />
            New
          </span>
        )}
        {app.Coming_soon && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
            <Clock className="size-3" />
            Soon
          </span>
        )}
        {app.Is_exclusive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950 shadow-md">
            <Gem className="size-3" />
            Exclusive
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <IconBox src={app.App_icon} alt={app.App_name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg leading-tight">
            {t(app.App_name)}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {t(app.Description || "Tidak ada deskripsi.")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-secondary-container px-2.5 py-1 text-[11px] font-medium text-on-secondary-container">
            APK
          </span>
          <span className="rounded-full bg-surface-variant px-2.5 py-1 text-[11px] font-mono font-medium text-muted-foreground">
            v{versionLabel(app.Version)}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary-container transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-md">
          <Download className="size-3.5 transition-transform group-hover:translate-y-0.5" />
          Download
        </span>
      </div>
    </Link>
  );
}

function IconBox({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-tertiary-container font-display text-xl text-on-tertiary-container">
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="size-14 shrink-0 rounded-lg object-cover bg-surface-variant"
      loading="lazy"
    />
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="rounded-4xl border border-dashed border-outline bg-surface p-10 text-center">
      <h2 className="font-display text-2xl">
        {hasSearch ? "Tidak ada hasil" : "Belum ada aplikasi"}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {hasSearch
          ? "Coba kata kunci lain, atau reset pencarian."
          : "Mulai isi katalog dengan menambahkan aplikasi pertama."}
      </p>
      <Link
        to="/addapps"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        <Plus className="size-5" /> Tambah aplikasi
      </Link>
    </div>
  );
}
