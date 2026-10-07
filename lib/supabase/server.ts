import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from "./config";

// Request-scoped: never share a server client/session between visitors.
// Route handlers and middleware must propagate every setAll cookie to the
// response, including verifier deletion and chunked/refreshed session cookies.
export function createAuthServerClient(cookies: CookieMethodsServer) {
  if (!isSupabaseConfigured()) return null;
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), { cookies });
}

export function authRequestOrigin(request: { url: string; headers: Headers }): string {
  const original = new URL(request.url);
  let site: URL | null = null;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
    if (["http:", "https:"].includes(configured.protocol)) site = configured;
  } catch { /* Direct-host development needs no canonical URL. */ }
  const host = request.headers.get("host") || original.host;
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  // Trust a proxy's public host only when it matches the configured app or
  // the actual Host header. Never switch origins based on arbitrary headers.
  const publicHost = forwarded && (forwarded === site?.host || forwarded === host) ? forwarded : host;
  if (/[\\/@?#\s]/.test(publicHost)) return original.origin;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = publicHost === site?.host ? site.protocol : forwardedProtocol === "https" ? "https:" : original.protocol;
  return new URL(`${protocol}//${publicHost}`).origin;
}
