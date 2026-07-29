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
