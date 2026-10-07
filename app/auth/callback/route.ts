import { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createAuthServerClient } from "@/lib/supabase/server";
import { accountDestination, authErrorReason, isEligibleAccount, type AuthErrorReason } from "@/lib/auth-flow";
import { callbackErrorFields, createCallbackDiagnostics, redactCallbackCookieName, splitSetCookieHeaders } from "@/lib/supabase/callback-diagnostics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const diagnostics = createCallbackDiagnostics(request);
  diagnostics.stage("AUTH_CALLBACK_ENTERED", { nodeVersion: process.version, configuredPort: /^\d{1,5}$/.test(process.env.PORT || "") ? Number(process.env.PORT) : null });
  diagnostics.stage("AUTH_CALLBACK_CODE_PRESENT", { present: !!request.nextUrl.searchParams.get("code") });
  diagnostics.configuration();
  const pendingCookies = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const redirect = (path: string) => {
    // Location permits a relative URI. The browser resolves this against its
    // public HTTPS origin, not the proxy's internal HTTP Host/port (e.g. 8080).
    // Targets below are fixed application paths, never a user-supplied URL.
    const response = new NextResponse(null, { status: 303, headers: { Location: path } });
    pendingCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    diagnostics.responseHeaders(response.headers);
    if (diagnostics.enabled) {
      const encoder = new TextEncoder();
      let headerBytes = 0;
      // Next's Node sendResponse strips this internal duplicate cookie header.
      // The estimate excludes it and does not include host-added headers.
      response.headers.forEach((value, name) => { if (name !== "x-middleware-set-cookie") headerBytes += encoder.encode(`${name}: ${value}\r\n`).byteLength; });
      const setCookie = response.headers.get("set-cookie") || "";
      const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
      const cookieHeaders = typeof getSetCookie === "function" ? getSetCookie.call(response.headers) : splitSetCookieHeaders(setCookie);
      const totalSetCookieBytes = encoder.encode(setCookie).byteLength;
      cookieHeaders.forEach((cookieHeader, index) => {
        const separator = cookieHeader.indexOf(";");
        const equals = cookieHeader.indexOf("=");
        const cookieValue = equals === -1 ? "" : cookieHeader.slice(equals + 1, separator === -1 ? cookieHeader.length : separator);
        diagnostics.stage("AUTH_CALLBACK_SET_COOKIE_HEADER", {
          cookieIndex: index,
          cookieName: redactCallbackCookieName(cookieHeader.slice(0, Math.max(equals, 0))),
          serializedHeaderBytes: encoder.encode(`set-cookie: ${cookieHeader}\r\n`).byteLength,
          cookieValueBytes: encoder.encode(cookieValue).byteLength,
          totalSetCookieBytes,
        });
      });
      diagnostics.stage("AUTH_CALLBACK_REDIRECT", { status: 303, destination: path.split("?")[0], cookieCount: pendingCookies.size, responseHeaderBytesEstimate: headerBytes, setCookieHeaderBytes: totalSetCookieBytes });
    }
    return response;
  };
  const failure = (reason: AuthErrorReason) => redirect(`/auth/error?reason=${reason}`);
  let client: ReturnType<typeof createAuthServerClient>;
  try {
    client = createAuthServerClient({
      getAll: () => request.cookies.getAll(),
      setAll: cookies => {
        diagnostics.stage("AUTH_CALLBACK_COOKIE_WRITE_STARTED", { count: cookies.length });
        cookies.forEach(cookie => {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.set(cookie.name, cookie);
        });
        diagnostics.stage("AUTH_CALLBACK_COOKIE_WRITE_FINISHED", { count: cookies.length });
      },
    }, diagnostics.fetch);
  } catch (error) {
    diagnostics.stage("AUTH_CALLBACK_EXCEPTION", { operation: "client_creation", ...callbackErrorFields(error) });
    throw error; // Diagnostic only: preserve initialization failure for host logs.
  }
  diagnostics.stage("AUTH_CALLBACK_SUPABASE_CLIENT_CREATED", { configured: !!client });
  if (!client) return failure("unavailable");

  const query = request.nextUrl.searchParams;
  let reason: AuthErrorReason = query.get("error") === "access_denied" ? "cancelled" : "callback";
  let authenticated = false;
  try {
    const code = query.get("code");
    if (code && !query.has("error")) {
      // The only code exchange in the app. SSR reads the verifier cookie that
      // createBrowserClient wrote before the Google redirect.
      diagnostics.stage("AUTH_CALLBACK_EXCHANGE_STARTED");
      const { error } = await client.auth.exchangeCodeForSession(code);
      diagnostics.stage("AUTH_CALLBACK_EXCHANGE_FINISHED", { ok: !error, ...(error ? callbackErrorFields(error) : {}) });
      if (error) reason = authErrorReason(error);
    }
    // Verify with Auth, not the user object in an untrusted session cookie.
    // Also recovers a valid session on a replayed/expired callback: do not tell
    // an already-authenticated user that their sign-in failed.
    diagnostics.stage("AUTH_CALLBACK_GET_USER_STARTED");
    const { data, error } = await client.auth.getUser();
    diagnostics.stage("AUTH_CALLBACK_GET_USER_FINISHED", { ok: !error, userAvailable: !!data.user, ...(error ? callbackErrorFields(error) : {}) });
    if (error || !data.user) return failure(error && authErrorReason(error) === "network" ? "network" : reason);
    if (!isEligibleAccount(data.user)) {
      diagnostics.stage("AUTH_CALLBACK_SIGN_OUT_STARTED");
      await client.auth.signOut({ scope: "local" });
      diagnostics.stage("AUTH_CALLBACK_SIGN_OUT_FINISHED");
      return failure("college");
    }
    authenticated = true;
    diagnostics.stage("AUTH_CALLBACK_PROFILE_CHECK_STARTED");
    const { data: profile, error: profileError } = await client.from("profiles").select("id,onboarding_complete").eq("id", data.user.id).maybeSingle();
    diagnostics.stage("AUTH_CALLBACK_PROFILE_CHECK_FINISHED", { ok: !profileError, ...(profileError ? callbackErrorFields(profileError) : {}) });
    if (profileError) return failure("profile");
    // Ignore arbitrary `next` destinations, especially login/callback URLs.
    // The existing profiles table is the single onboarding source of truth.
    return redirect(accountDestination(profile?.onboarding_complete === true));
  } catch (error) {
    diagnostics.stage("AUTH_CALLBACK_EXCEPTION", callbackErrorFields(error));
    return failure(authenticated ? "profile" : authErrorReason(error));
  }
}
