import { createAuthClient } from "./shared";

function createAccountAdminClient() {
  const AUTH_SUPABASE_URL = process.env.AUTH_SUPABASE_URL;
  const AUTH_SUPABASE_SERVICE_ROLE_KEY = process.env.AUTH_SUPABASE_SERVICE_ROLE_KEY;

  if (!AUTH_SUPABASE_URL || !AUTH_SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!AUTH_SUPABASE_URL ? ["AUTH_SUPABASE_URL"] : []),
      ...(!AUTH_SUPABASE_SERVICE_ROLE_KEY ? ["AUTH_SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`Missing account Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return createAuthClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_SERVICE_ROLE_KEY);
}

let accountAdminClient: ReturnType<typeof createAccountAdminClient> | undefined;

export const authSupabaseAdmin = new Proxy({} as ReturnType<typeof createAccountAdminClient>, {
  get(_, prop, receiver) {
    if (!accountAdminClient) accountAdminClient = createAccountAdminClient();
    return Reflect.get(accountAdminClient, prop, receiver);
  },
});