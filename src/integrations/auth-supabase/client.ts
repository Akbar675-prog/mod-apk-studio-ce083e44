import { createClient } from "@supabase/supabase-js";
import { createAuthSupabaseFetch, type AuthDatabase } from "./shared";

function createAccountClient() {
  const AUTH_SUPABASE_URL = import.meta.env.VITE_AUTH_SUPABASE_URL || process.env.AUTH_SUPABASE_URL;
  const AUTH_SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY || process.env.AUTH_SUPABASE_PUBLISHABLE_KEY;

  if (!AUTH_SUPABASE_URL || !AUTH_SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!AUTH_SUPABASE_URL ? ["AUTH_SUPABASE_URL"] : []),
      ...(!AUTH_SUPABASE_PUBLISHABLE_KEY ? ["AUTH_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing account Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return createClient<AuthDatabase>(AUTH_SUPABASE_URL, AUTH_SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createAuthSupabaseFetch(AUTH_SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let accountClient: ReturnType<typeof createAccountClient> | undefined;

export const authSupabase = new Proxy({} as ReturnType<typeof createAccountClient>, {
  get(_, prop, receiver) {
    if (!accountClient) accountClient = createAccountClient();
    return Reflect.get(accountClient, prop, receiver);
  },
});