import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useT } from "@/lib/i18n";

const TITLE = "Akun terverifikasi - Galileo Mod APK";
const DESC =
  "Penjelasan lengkap soal centang biru di Galileo Mod APK: apa artinya, cara mendapatkannya, dan kenapa gratis.";

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifiedInfoPage,
});

function VerifiedInfoPage() {
  const t = useT();

  const sections = [
    {
      q: "Apa itu centang biru?",
      a: "Centang biru berarti Galileo, perusahaan induk GMA, sudah memastikan bahwa akun ini asli dan sesuai dengan identitas atau kontribusi yang diklaim.",
    },
    {
      q: "Apakah perlu bayar?",
      a: "Tidak. Centang biru tidak dijual. Kamu hanya butuh izin resmi dari tim Galileo.",
    },
    {
      q: "Bagaimana cara mendapatkannya?",
      a: "Tim kami meninjau aktivitas akun kamu di seluruh produk Galileo, serta informasi atau dokumen yang kamu berikan saat mengajukan verifikasi.",
    },
    {
      q: "Kenapa akun bisa kehilangan centang?",
      a: "Centang bisa dicabut kalau akun melanggar aturan, berganti identitas tanpa pemberitahuan, atau terbukti menyesatkan pengguna lain.",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppHeader />
      <main className="mx-auto mt-6 w-full max-w-2xl px-4">
        <section className="m3-shadow-1 rounded-3xl bg-card p-6 text-center">
          <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-surface-variant">
            <VerifiedBadge className="size-12" />
          </div>
          <h1 className="mt-4 font-display text-3xl">{t("Akun terverifikasi")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Galileo, perusahaan induk GMA, telah memverifikasi akun ini berdasarkan aktivitasnya di seluruh produk kami serta informasi atau dokumen yang mereka sediakan.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["Gratis", "Peninjauan manual", "Bisa dicabut"].map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-surface-variant px-3 py-1 text-xs text-muted-foreground"
              >
                {t(chip)}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-4 space-y-3">
          {sections.map((s) => (
            <article key={s.q} className="m3-shadow-1 rounded-3xl bg-card p-5">
              <h2 className="font-display text-lg">{t(s.q)}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(s.a)}</p>
            </article>
          ))}
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/get-verified"
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {t("Ajukan permintaan")}
          </Link>
          <Link
            to="/"
            className="inline-flex rounded-full border border-input px-5 py-2.5 text-sm font-semibold"
          >
            {t("Kembali ke beranda")}
          </Link>
        </div>
      </main>
    </div>
  );
}
