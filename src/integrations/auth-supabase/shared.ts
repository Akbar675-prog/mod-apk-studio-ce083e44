import { createClient } from "@supabase/supabase-js";

export type AuthDatabase = Record<string, never>;

export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createAuthSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function missingAuthEnv(names: string[]): Error {
  return new Error(`Missing account Supabase environment variable(s): ${names.join(", ")}.`);
}

export function createAuthClient(url: string, key: string, token?: string) {
  return createClient<AuthDatabase>(url, key, {
    global: {
      fetch: createAuthSupabaseFetch(key),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}