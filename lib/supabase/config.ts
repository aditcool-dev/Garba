export function getSupabaseUrl(): string { return process.env.NEXT_PUBLIC_SUPABASE_URL || ""; }
export function getSupabaseAnonKey(): string { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; }
export function isSupabaseConfigured(): boolean {
  try { return new URL(getSupabaseUrl()).protocol === "https:" && getSupabaseAnonKey().length > 20; } catch { return false; }
}
