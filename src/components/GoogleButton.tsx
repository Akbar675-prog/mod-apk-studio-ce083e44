import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authSupabase } from "@/integrations/auth-supabase/client";

export function GoogleButton({
  label,
  onError,
}: {
  label: string;
  onError?: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const { error } = await authSupabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      setBusy(false);
      onError?.(err instanceof Error ? err.message : "Gagal masuk dengan Google.");
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-3 text-sm font-medium transition active:scale-95 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.2-.45-4.7H24v9h12.7c-.55 2.9-2.2 5.4-4.7 7.1l7.3 5.6c4.3-3.9 7.2-9.7 7.2-17z" />
          <path fill="#FBBC05" d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.8-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.6c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.8-3.8-13.7-9.2l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
      )}
      {label}
    </button>
  );
}