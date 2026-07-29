import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Loader2, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { GoogleButton } from "@/components/GoogleButton";
import { authSupabase } from "@/integrations/auth-supabase/client";
import { registerAccountFn } from "@/lib/account.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Daftar Akun - Galileo Mod APK" },
      { name: "description", content: "Buat akun GMA gratis: pilih nama panggilan, username unik, dan password untuk mulai menggunakan profil." },
      { property: "og:title", content: "Daftar Akun - Galileo Mod APK" },
      { property: "og:description", content: "Buat akun GMA gratis dalam hitungan detik." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const t = useT();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setBusy(true);
    try {
      const { email } = await registerAccountFn({
        data: {
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
        },
      });
      const { error: signInError } = await authSupabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      if (signInError) throw new Error("Akun dibuat, tapi gagal login otomatis. Coba masuk manual.");
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppHeader />
      <main className="mx-auto mt-8 w-full max-w-md px-4">
        <h1 className="font-display text-3xl">{t("Daftar")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Cukup 30 detik. Nama panggilan bebas, username harus unik.")}
        </p>

        <div className="mt-4 flex gap-3 rounded-3xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            {t(
              "Peringatan: jangan gunakan nama asli kamu. Demi keamanan dari pihak berwenang Indonesia, pakai nama panggilan atau alias saja.",
            )}
          </p>
        </div>

        <form onSubmit={onSubmit} className="m3-shadow-1 mt-5 space-y-4 rounded-3xl bg-card p-5">
          <Field label={t("Nama (panggilan / alias)")}>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              minLength={2}
              maxLength={40}
              className={inputCls}
              placeholder="Galileo"
            />
          </Field>
          <Field label={t("Username")}>
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
              required
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_.]+"
              className={inputCls}
              placeholder="galileo_01"
            />
          </Field>
          <Field label={t("Email")}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
              maxLength={255}
              className={inputCls}
              placeholder="kamu@email.com"
            />
          </Field>
          <Field label={t("Password")}>
            <PasswordInput
              value={form.password}
              onChange={(v) => set("password", v)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t("Konfirmasi Password")}>
            <PasswordInput
              value={form.confirm}
              onChange={(v) => set("confirm", v)}
              autoComplete="new-password"
            />
          </Field>

          {error && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t(error)}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {t("Buat akun")}
          </button>

          <GoogleButton label={t("Daftar dengan Google")} onError={setError} />
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("Sudah punya akun?")}{" "}
          <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("Masuk")}
          </Link>
        </p>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl bg-surface-variant px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
