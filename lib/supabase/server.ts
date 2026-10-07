import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey, isSupabaseConfigured } from "./config";

// Request-scoped: never share a server client/session between visitors.
// Route handlers and middleware must propagate every setAll cookie to the
// response, including verifier deletion and chunked/refreshed session cookies.
export function createAuthServerClient(cookies: CookieMethodsServer, diagnosticFetch?: typeof fetch) {
  if (!isSupabaseConfigured()) return null;
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), { cookies, ...(diagnosticFetch ? { global: { fetch: diagnosticFetch } } : {}) });
}
