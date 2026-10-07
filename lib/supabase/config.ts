export function getSupabaseUrl(): string { return process.env.NEXT_PUBLIC_SUPABASE_URL || ""; }
export function getSupabaseAnonKey(): string { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; }
// Keep this setting identical in the browser and server SSR clients. Supabase
// stores only access/refresh tokens in cookies; the browser keeps the user
// object in its separate user storage. No authentication tokens are put there.
export const SUPABASE_AUTH_COOKIE_OPTIONS = { encode: "tokens-only" as const };
export function isSupabaseConfigured(): boolean {
  try { return new URL(getSupabaseUrl()).protocol === "https:" && getSupabaseAnonKey().length > 20; } catch { return false; }
}
