import { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createAuthServerClient } from "@/lib/supabase/server";
import { accountDestination, authErrorReason, isEligibleAccount, type AuthErrorReason } from "@/lib/auth-flow";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const redirect = (path: string) => {
    // Location permits a relative URI. The browser resolves this against its
    // public HTTPS origin, not the proxy's internal HTTP Host/port (e.g. 8080).
    // Targets below are fixed application paths, never a user-supplied URL.
    const response = new NextResponse(null, { status: 303, headers: { Location: path } });
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const failure = (reason: AuthErrorReason) => redirect(`/auth/error?reason=${reason}`);
  const client = createAuthServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: cookies => cookies.forEach(cookie => {
      request.cookies.set(cookie.name, cookie.value);
      pendingCookies.set(cookie.name, cookie);
    }),
  });
  if (!client) return failure("unavailable");

  const query = request.nextUrl.searchParams;
  let reason: AuthErrorReason = query.get("error") === "access_denied" ? "cancelled" : "callback";
  let authenticated = false;
  try {
    const code = query.get("code");
    if (code && !query.has("error")) {
      // The only code exchange in the app. SSR reads the verifier cookie that
      // createBrowserClient wrote before the Google redirect.
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) reason = authErrorReason(error);
    }
    // Verify with Auth, not the user object in an untrusted session cookie.
    // Also recovers a valid session on a replayed/expired callback: do not tell
    // an already-authenticated user that their sign-in failed.
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return failure(error && authErrorReason(error) === "network" ? "network" : reason);
    if (!isEligibleAccount(data.user)) {
      await client.auth.signOut({ scope: "local" });
      return failure("college");
    }
    authenticated = true;
    const { data: profile, error: profileError } = await client.from("profiles").select("id,onboarding_complete").eq("id", data.user.id).maybeSingle();
    if (profileError) return failure("profile");
    // Ignore arbitrary `next` destinations, especially login/callback URLs.
    // The existing profiles table is the single onboarding source of truth.
    return redirect(accountDestination(profile?.onboarding_complete === true));
  } catch (error) {
    return failure(authenticated ? "profile" : authErrorReason(error));
  }
}
