import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

/** Official verified badge image, shown beside verified account names. */
export const VERIFIED_BADGE_URL =
  "https://galileouserscontent.visora.my.id/u/p/Njc3OTMwM2YtYWM0Zi00ZjQzLTkyMzMtMzUzY2VhZDBiYmZkLzE3ODUyMjgxODE3MzQucG5n";

export function VerifiedBadge({ className = "size-4" }: { className?: string }) {
  return (
    <img
      src={VERIFIED_BADGE_URL}
      alt="Terverifikasi"
      title="Terverifikasi"
      loading="lazy"
      decoding="async"
      className={`inline-block object-contain ${className}`}
    />
  );
}

/** Badge that opens an explainer sheet when tapped. */
export function VerifiedBadgeButton({ className = "size-5" }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={t("Terverifikasi")}
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 rounded-full transition active:scale-90"
      >
        <VerifiedBadge className={className} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl text-center">
          <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-surface-variant">
            <VerifiedBadge className="size-12" />
          </div>
          <h2 className="mt-4 font-display text-2xl">{t("Terverifikasi")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Galileo, perusahaan induk GMA, telah memverifikasi akun ini berdasarkan aktivitasnya di seluruh produk kami serta informasi atau dokumen yang mereka sediakan.",
            )}
          </p>
          <Link
            to="/verified"
            onClick={() => setOpen(false)}
            className="mt-4 text-sm font-semibold text-primary"
          >
            {t("Pelajari selengkapnya tentang akun terverifikasi")}
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
