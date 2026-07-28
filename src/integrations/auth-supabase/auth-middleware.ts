import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createAuthClient } from "./shared";

export const requireAccountAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const AUTH_SUPABASE_URL = process.env.AUTH_SUPABASE_URL;
  const AUTH_SUPABASE_PUBLISHABLE_KEY = process.env.AUTH_SUPABASE_PUBLISHABLE_KEY;

  if (!AUTH_SUPABASE_URL || !AUTH_SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!AUTH_SUPABASE_URL ? ["AUTH_SUPABASE_URL"] : []),
      ...(!AUTH_SUPABASE_PUBLISHABLE_KEY ? ["AUTH_SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing account Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: No account token provided");

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: Invalid account token");

  const accountSupabase = createAuthClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_PUBLISHABLE_KEY, token);
  const { data, error } = await accountSupabase.auth.getUser(token);
  if (error || !data.user?.id) throw new Error("Unauthorized: Invalid account token");

  return next({
    context: {
      supabase: accountSupabase,
      userId: data.user.id,
      user: data.user,
    },
  });
});