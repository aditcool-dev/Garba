import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  // Recover old Supabase Site URL redirects before React/browser Auth mounts.
  // Otherwise URL auto-detection could consume the code ahead of the callback.
  if (request.nextUrl.pathname === "/" && (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("error"))) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    // Internal rewrite: never expose the proxy's internal origin to a browser.
    // Next's middleware adapter requires absolute redirect URLs; the route
    // handler, rather than middleware, owns the final relative 303 Location.
    const response = NextResponse.rewrite(callback);
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
  try { if (client) await client.auth.getUser(); } catch (error) {
    const failure = error as { name?: string; code?: string; status?: number } | null;
    // Observable transport failure; never log cookies, credentials or the URL's
    // authorization code. Client restoration still verifies Auth and offers retry.
    console.error("[auth middleware] session refresh threw", { route: request.nextUrl.pathname, name: failure?.name, code: failure?.code, status: failure?.status });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/", "/login", "/signup", "/onboarding", "/discover", "/matches", "/chat/:path*", "/profile/:path*", "/settings", "/admin"],
};
