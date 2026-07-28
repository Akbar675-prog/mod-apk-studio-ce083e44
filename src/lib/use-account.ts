import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authSupabase } from "@/integrations/auth-supabase/client";
import { myProfileFn } from "./account.functions";

export type MyProfile = Awaited<ReturnType<typeof myProfileFn>>;

export function useSessionUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    authSupabase.auth.getSession().then(({ data }) => {
      if (alive) setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = authSupabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUserId(session?.user.id ?? null);
      if (event === "SIGNED_OUT") qc.clear();
      else qc.invalidateQueries({ queryKey: ["me"] });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);
  return userId;
}

/** Current signed-in account, or null. `loading` while the session resolves. */
export function useAccount() {
  const userId = useSessionUserId();
  const q = useQuery({
    queryKey: ["me", userId],
    queryFn: () => myProfileFn(),
    enabled: !!userId,
    staleTime: 30_000,
  });
  return {
    userId: userId ?? null,
    profile: userId ? (q.data ?? null) : null,
    loading: userId === undefined || (!!userId && q.isLoading),
    refetch: q.refetch,
  };
}

export const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#d7e3c4"/><circle cx="48" cy="38" r="16" fill="#7bb31a"/><path d="M16 88c4-18 17-26 32-26s28 8 32 26z" fill="#7bb31a"/></svg>`,
  );
