import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { GoogleButton } from "@/components/GoogleButton";
import { authSupabase } from "@/integrations/auth-supabase/client";
import { resolveLoginEmailFn } from "@/lib/account.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login Akun - Galileo Mod APK" },
      { name: "description", content: "Masuk ke akun GMA kamu dengan username atau email untuk mengakses profil dan fitur komunitas." },
      { property: "og:title", content: "Login Akun - Galileo Mod APK" },
      { property: "og:description", content: "Masuk ke akun GMA kamu dengan username atau email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { email } = await resolveLoginEmailFn({ data: { identifier } });
      const { error: signInError } = await authSupabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error("Username/email atau password salah.");
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppHeader />
      <main className="mx-auto mt-8 w-full max-w-md px-4">
        <h1 className="font-display text-3xl">{t("Masuk")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Gunakan username atau email beserta password kamu.")}
        </p>

        <form onSubmit={onSubmit} className="m3-shadow-1 mt-6 space-y-4 rounded-3xl bg-card p-5">
          <Field label={t("Username atau Email")}>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              maxLength={255}
              autoComplete="username"
              className="w-full rounded-2xl bg-surface-variant px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="galileo atau kamu@email.com"
            />
          </Field>
          <Field label={t("Password")}>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
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
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {t("Masuk")}
          </button>

          <GoogleButton label={t("Masuk dengan Google")} onError={setError} />
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {t("Belum punya akun?")}{" "}
          <Link to="/register" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t("Daftar sekarang")}
          </Link>
        </p>
      </main>
    </div>
  );
}

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
