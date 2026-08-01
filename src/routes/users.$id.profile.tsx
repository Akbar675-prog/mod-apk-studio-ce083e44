import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { VerifiedBadgeButton } from "@/components/VerifiedBadge";
import { userProfileFn, followStateFn, toggleFollowFn } from "@/lib/account.functions";
import { DEFAULT_AVATAR, useAccount } from "@/lib/use-account";
import { useT } from "@/lib/i18n";

const profileQuery = (userNo: number) =>
  queryOptions({
    queryKey: ["user-profile", userNo],
    queryFn: () => userProfileFn({ data: { userNo } }),
  });

export const Route = createFileRoute("/users/$id/profile")({
  loader: async ({ params, context }) => {
    const userNo = Number(params.id);
    if (!Number.isInteger(userNo) || userNo <= 0) throw notFound();
    const data = await context.queryClient.ensureQueryData(profileQuery(userNo));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} (@${loaderData.username}) - GMA` : "Profil - GMA";
    const description = loaderData
      ? `Profil ${loaderData.name} di Galileo Mod APK dengan ${loaderData.followers} pengikut.`
      : "Profil pengguna Galileo Mod APK.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: UserProfilePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Gagal memuat: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-muted-foreground">Akun tidak ditemukan.</div>,
});

function UserProfilePage() {
  const t = useT();
  const { id } = Route.useParams();
  const userNo = Number(id);
  const { data: profile } = useSuspenseQuery(profileQuery(userNo));
  const { userId } = useAccount();

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppHeader />
      <main className="mx-auto mt-6 w-full max-w-2xl px-4">
        <section className="m3-shadow-1 overflow-hidden rounded-3xl bg-card">
          <div className="h-24 bg-gradient-to-r from-primary/80 via-primary/40 to-surface-variant" />
          <div className="px-5 pb-5">
            <img
              src={profile.avatar_url || DEFAULT_AVATAR}
              alt={`Foto profil ${profile.name}`}
              className="-mt-12 size-24 rounded-full border-4 border-card bg-surface-variant object-cover"
            />
            <div className="mt-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="truncate font-display text-2xl">{profile.name}</h1>
                {profile.verified && <VerifiedBadgeButton className="size-6" />}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <span className="mt-2 inline-flex rounded-full bg-surface-variant px-3 py-1 text-xs text-muted-foreground">
                {t("Anggota ke-")}
                {profile.user_no}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="m3-shadow-1 rounded-3xl bg-card p-5 text-center">
            <p className="font-display text-2xl">{profile.followers.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted-foreground">{t("Pengikut")}</p>
          </div>
          <div className="m3-shadow-1 rounded-3xl bg-card p-5 text-center">
            <p className="font-display text-2xl">{profile.following.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted-foreground">{t("Mengikuti")}</p>
          </div>
        </section>

        <FollowBox userNo={userNo} signedIn={!!userId} />
      </main>
    </div>
  );
}

/** Follow box: hidden when the visitor is the profile owner. */
function FollowBox({ userNo, signedIn }: { userNo: number; signedIn: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ["follow-state", userNo, signedIn],
    queryFn: () => followStateFn({ data: { userNo } }),
    enabled: signedIn,
  });

  if (!signedIn) {
    return (
      <section className="m3-shadow-1 mt-4 rounded-3xl bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">{t("Masuk untuk mengikuti akun ini.")}</p>
        <Link
          to="/login"
          className="mt-3 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          {t("Masuk")}
        </Link>
      </section>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 flex justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Own profile: no follow box at all.
  if (state?.is_self) return null;

  const following = !!state?.is_following;

  return (
    <section className="m3-shadow-1 mt-4 flex items-center justify-between gap-3 rounded-3xl bg-card p-5">
      <p className="text-sm text-muted-foreground">
        {following ? t("Kamu mengikuti akun ini.") : t("Ikuti akun ini untuk mendukungnya.")}
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await toggleFollowFn({ data: { userNo } });
            await qc.invalidateQueries({ queryKey: ["follow-state", userNo] });
            await qc.invalidateQueries({ queryKey: ["user-profile", userNo] });
          } finally {
            setBusy(false);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${
          following
            ? "border border-input bg-background text-foreground hover:bg-accent"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : following ? (
          <UserCheck className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {following ? t("Mengikuti") : t("Ikuti")}
      </button>
    </section>
  );
}
