import { NextRequest, NextResponse } from "next/server";
import { authRequestOrigin, createAuthServerClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  // Recover old Supabase Site URL redirects before React/browser Auth mounts.
  // Otherwise URL auto-detection could consume the code ahead of the callback.
  if (request.nextUrl.pathname === "/" && (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error"))) {
    const callback = new URL("/auth/callback", authRequestOrigin(request));
    callback.search = request.nextUrl.search;
    const response = NextResponse.redirect(callback, 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  let response = NextResponse.next({ request });
  const client = createAuthServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: cookies => {
      cookies.forEach(({ name, value }) => request.cookies.set(name, value));
      const previous = response.cookies.getAll();
      response = NextResponse.next({ request });
      previous.forEach(cookie => response.cookies.set(cookie));
      cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  });
  // Refresh and pass cookies to BOTH the downstream request and the browser.
  // The callback itself is excluded: it owns its exchange and cookie response.
  try { if (client) await client.auth.getUser(); } catch { /* Client restoration offers retry after a transport outage. */ }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/onboarding", "/discover", "/matches", "/chat/:path*", "/profile/:path*", "/settings", "/admin"],
};
