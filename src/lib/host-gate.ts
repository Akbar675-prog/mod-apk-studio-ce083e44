/**
 * Subdomain gating: each dedicated host only serves its own page.
 * Everything else on that host answers 404.
 */
import { isDevHost, isStatusHost } from "./status-host";
import { isUserContentHost } from "./user-content";

/** Build/runtime paths that must keep working on every host. */
function isInfraPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_build") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/__l5e") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/node_modules") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest"
  );
}

/** Returns true when the request must be answered with a 404. */
export function isBlockedByHostGate(host: string | null, pathname: string): boolean {
  if (isDevHost(host)) return false;
  if (isInfraPath(pathname)) return false;

  // status.<domain> serves only /status
  if (isStatusHost(host)) {
    // "/" is allowed so the root route can redirect to /status.
    return !(pathname === "/" || pathname === "/status" || pathname === "/status/");
  }

  // galileouserscontent.<domain> serves only avatar/profile-image paths
  if (isUserContentHost(host)) {
    return !pathname.startsWith("/u/p/");
  }

  return false;
}

export function notFoundResponse(): Response {
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 - Tidak ditemukan</title>
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0e1210;color:#e7ece7}
main{text-align:center;padding:2rem}
h1{font-size:4rem;margin:0;letter-spacing:-.04em}
p{opacity:.7;margin:.5rem 0 0}
</style></head><body><main><h1>404</h1><p>Halaman ini tidak tersedia di alamat ini.</p></main></body></html>`;
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
