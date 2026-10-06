import type { Profile } from "./supabase/types";

// This explicit projection keeps internal flags, auth metadata and legacy fields
// out of profile responses. UUIDs remain internal relationship keys, never labels.
export const PROFILE_FIELDS = "id,first_name,age,gender,branch,year,bio,experience,styles,looking_for,available_nights,interests,partner_preference,photo_path,is_hidden,is_suspended,is_banned,onboarding_complete,has_seen_discover_tutorial,is_verified,created_at,updated_at";
const markers = /demo-|bms-|\b\d[bB][mM]\d{2}[a-zA-Z]{2}\d{3}\b|\bdemo\b/i;
const strings = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string" && !markers.test(v)))] : [];

export function normalizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) || typeof row.first_name !== "string" || !row.first_name.trim() || markers.test(row.first_name) || row.is_demo === true || !Number.isInteger(row.age) || Number(row.age) < 18 || !Number.isInteger(row.year) || Number(row.year) < 1 || Number(row.year) > 4 || !["Woman", "Man", "Non-binary", "Prefer not to say"].includes(String(row.gender))) {
    console.warn("[profiles] skipped invalid/legacy row", { id: typeof row.id === "string" ? row.id : "unknown" });
    return null;
  }
  const text = (key: string, fallback = "") => typeof row[key] === "string" && !markers.test(row[key] as string) ? row[key] as string : fallback;
  const photo = text("photo_path");
  return {
    id: row.id, first_name: row.first_name.trim().slice(0, 40), age: Number(row.age), gender: row.gender as Profile["gender"], year: Number(row.year),
    branch: text("branch", "BMSCE"), bio: text("bio"), experience: text("experience", "Beginner"), partner_preference: text("partner_preference", "Everyone"),
    styles: strings(row.styles), interests: strings(row.interests), looking_for: strings(row.looking_for),
    available_nights: Array.isArray(row.available_nights) ? [...new Set(row.available_nights.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 9))] : [],
    photo_path: photo || null, is_hidden: row.is_hidden === true, is_suspended: row.is_suspended === true, is_banned: row.is_banned === true,
    onboarding_complete: row.onboarding_complete === true, is_demo: false, is_verified: row.is_verified === true && row.is_sample !== true,
    has_seen_discover_tutorial: row.has_seen_discover_tutorial === true, created_at: text("created_at"), updated_at: text("updated_at"),
  };
}

export function normalizeProfiles(rows: unknown): Profile[] {
  return Array.isArray(rows) ? rows.flatMap(row => { const profile = normalizeProfile(row); return profile ? [profile] : []; }) : [];
}
