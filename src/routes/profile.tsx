import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, AtSign, User, Image as ImageIcon, Upload, BadgeCheck, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { authSupabase } from "@/integrations/auth-supabase/client";
import { DEFAULT_AVATAR, useAccount } from "@/lib/use-account";
import {
  changeNameFn,
  changeUsernameFn,
  setAvatarUrlFn,
  uploadAvatarFn,
} from "@/lib/account.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profil Saya - Galileo Mod APK" },
      { name: "description", content: "Kelola profil GMA kamu: ganti nama, username, dan foto profil, serta ajukan centang biru." },
      { property: "og:title", content: "Profil Saya - Galileo Mod APK" },
      { property: "og:description", content: "Kelola nama, username, dan foto profil akun GMA kamu." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, loading, userId, refetch } = useAccount();

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/login" });
  }, [loading, userId, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mt-20 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const cooldownLeft = profile.username_changed_at
    ? Math.max(
        0,
        Math.ceil((Date.parse(profile.username_changed_at) + 7 * 86400000 - Date.now()) / 86400000),
      )
    : 0;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await authSupabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

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
                {profile.verified && <VerifiedBadge className="size-6 shrink-0" />}
              </div>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-surface-variant px-3 py-1 text-xs">
                  <b>{profile.followers.toLocaleString("id-ID")}</b> {t("pengikut")}
                </span>
                <span className="rounded-full bg-surface-variant px-3 py-1 text-xs">
                  <b>{profile.following.toLocaleString("id-ID")}</b> {t("mengikuti")}
                </span>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-3 px-1 text-xs text-muted-foreground">
          {t("Profil publik kamu:")}{" "}
          <Link
            to="/users/$id/profile"
            params={{ id: String(profile.user_no) }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            /users/{profile.user_no}/profile <ExternalLink className="size-3" />
          </Link>
        </p>

        <EditName current={profile.name} remaining={5 - profile.name_changes_today} onDone={refetch} />
        <EditUsername current={profile.username} cooldownLeft={cooldownLeft} onDone={refetch} />
        <EditAvatar onDone={refetch} />

        <section className="m3-shadow-1 mt-4 rounded-3xl bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <BadgeCheck className="size-5" /> {t("Centang biru")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.verified
              ? t("Akun kamu sudah terverifikasi.")
              : t("Ajukan permintaan verifikasi ke owner.")}
          </p>
          {!profile.verified && (
            <Link
              to="/get-verified"
              className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              {t("Ajukan verifikasi")}
            </Link>
          )}
        </section>

        <button
          onClick={signOut}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-3 text-sm font-medium hover:bg-accent"
        >
          <LogOut className="size-4" /> {t("Keluar")}
        </button>
      </main>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="m3-shadow-1 mt-4 rounded-3xl bg-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Msg({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p className="mt-2 text-sm text-destructive">{error}</p>;
  if (ok) return <p className="mt-2 text-sm text-primary">{ok}</p>;
  return null;
}

const inputCls =
  "w-full rounded-2xl bg-surface-variant px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60";

function EditName({ current, remaining, onDone }: { current: string; remaining: number; onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card title={t("Nama akun")} icon={<User className="size-5" />}>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Sisa penggantian hari ini:")} {Math.max(0, remaining)}/5
      </p>
      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputCls} />
        <button
          disabled={busy || remaining <= 0}
          onClick={async () => {
            setBusy(true); setError(null); setOk(null);
            try {
              await changeNameFn({ data: { name } });
              setOk(t("Nama diperbarui."));
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal.");
            } finally { setBusy(false); }
          }}
          className={btnCls}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("Simpan")}
        </button>
      </div>
      <Msg error={error} ok={ok} />
    </Card>
  );
}

function EditUsername({ current, cooldownLeft, onDone }: { current: string; cooldownLeft: number; onDone: () => void }) {
  const t = useT();
  const [username, setUsername] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <Card title={t("Username")} icon={<AtSign className="size-5" />}>
      <p className="mt-1 text-sm text-muted-foreground">
        {cooldownLeft > 0
          ? `${t("Bisa diganti lagi dalam")} ${cooldownLeft} ${t("hari")}.`
          : t("Setelah diganti, kamu harus menunggu 7 hari untuk mengganti lagi.")}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          maxLength={20}
          disabled={cooldownLeft > 0}
          className={inputCls}
        />
        <button
          disabled={busy || cooldownLeft > 0}
          onClick={async () => {
            setBusy(true); setError(null); setOk(null);
            try {
              await changeUsernameFn({ data: { username } });
              setOk(t("Username diperbarui."));
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal.");
            } finally { setBusy(false); }
          }}
          className={btnCls}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} {t("Simpan")}
        </button>
      </div>
      <Msg error={error} ok={ok} />
    </Card>
  );
}

function EditAvatar({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true); setError(null); setOk(null);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      await uploadAvatarFn({ data: { base64: btoa(bin), contentType: file.type || "image/png" } });
      setOk(t("Foto profil diperbarui."));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal upload.");
    } finally { setBusy(false); }
  }

  return (
    <Card title={t("Foto profil")} icon={<ImageIcon className="size-5" />}>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Upload gambar atau tempel URL gambar. Semua foto disimpan di galileouserscontent.visora.my.id.")}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
        <button
          disabled={busy || !url}
          onClick={async () => {
            setBusy(true); setError(null); setOk(null);
            try {
              await setAvatarUrlFn({ data: { url } });
              setOk(t("Foto profil diperbarui."));
              setUrl("");
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Gagal.");
            } finally { setBusy(false); }
          }}
          className={btnCls}
        >
          {t("Pakai URL")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {t("Upload dari perangkat")}
      </button>
      <Msg error={error} ok={ok} />
    </Card>
  );
}
