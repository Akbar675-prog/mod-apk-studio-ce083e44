import { createMiddleware } from "@tanstack/react-start";
import { authSupabase } from "./client";

export const attachAccountAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await authSupabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});