import type { User } from "@supabase/supabase-js";
import { isAllowedEmail } from "./domain";

export function isEligibleAccount(account: User | null): account is User & { email: string } {
  return !!account?.email_confirmed_at && isAllowedEmail(account.email || "") && account.app_metadata?.is_sample !== true;
}

export const AUTH_ERRORS = {
  expired: "Your sign-in session expired. Please try again in the same browser where you started sign-in.",
  cancelled: "Google sign-in was cancelled. You can try again when you’re ready.",
  callback: "This sign-in link is invalid or incomplete. Please try again.",
  network: "We couldn’t finish verifying your sign-in. Check your connection and try again.",
  unavailable: "Sign-in is temporarily unavailable. Please try again later.",
  college: "Only verified @bmsce.ac.in accounts can use GarbaMate.",
  profile: "You’re signed in, but we couldn’t load your GarbaMate profile. Please retry to continue.",
} as const;
export type AuthErrorReason = keyof typeof AUTH_ERRORS;

export function authErrorReason(error: unknown): AuthErrorReason {
  const value = error as { code?: string; name?: string; status?: number; message?: string } | null;
  if (value?.status === 0 || (value?.status && value.status >= 500) || /fetch|network|retryable/i.test(`${value?.name} ${value?.message}`)) return "network";
  if (/pkce|verifier|flow_state|expired|invalid_grant|otp_expired/i.test(`${value?.code} ${value?.message}`)) return "expired";
  if (value?.code === "access_denied") return "cancelled";
  return "callback";
}

export function accountDestination(onboardingComplete: boolean): "/discover" | "/onboarding" {
  return onboardingComplete ? "/discover" : "/onboarding";
}

export function validateAge(value: string): { age: number; error: null } | { age: null; error: string } {
  if (!/^\d+$/.test(value)) return { age: null, error: value === "" ? "Please enter your age." : "Enter a valid age using numbers only." };
  const age = Number(value);
  if (!Number.isInteger(age) || age > 2147483647) return { age: null, error: "Enter a valid age." };
  if (age < 18) return { age: null, error: "You must be 18 or older to use GarbaMate." };
  return { age, error: null };
}
