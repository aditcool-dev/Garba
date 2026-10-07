import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { GET } from "../app/auth/callback/route";
import { middleware } from "../middleware";

const account = { id: "00000000-0000-4000-8000-000000000001", email: "student.cs24@bmsce.ac.in", email_confirmed_at: "2026-10-07T12:00:00Z", app_metadata: { provider: "google" }, user_metadata: {}, aud: "authenticated" };
const token = (expiry: number) => [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: account.id, exp: expiry, role: "authenticated", aud: "authenticated" })).toString("base64url"), "fixture"].join(".");
const session = (expiry = Math.floor(Date.now() / 1000) + 3600) => ({ access_token: token(expiry), refresh_token: "fixture-refresh", expires_in: 3600, expires_at: expiry, token_type: "bearer", user: account });
const cookie = (value: unknown) => `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
const request = (path: string, cookies: Record<string, string> = {}) => new NextRequest(`https://garbamate.example${path}`, { headers: { cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ") } });
let complete: boolean | null, tokenError: boolean, profileError: boolean;
let requests: Array<{ url: URL; body: Record<string, string> | null }>;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth-fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-public-key-never-a-secret");
  complete = true; tokenError = false; profileError = false; requests = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });
    if (url.pathname.endsWith("/token")) return Response.json(tokenError ? { code: "flow_state_expired", message: "Code expired" } : session(), { status: tokenError ? 400 : 200 });
    if (url.pathname.endsWith("/user")) return Response.json(account);
    if (url.pathname.endsWith("/profiles")) return Response.json(profileError ? { message: "Database unavailable" } : complete === null ? [] : [{ id: account.id, onboarding_complete: complete }], { status: profileError ? 503 : 200, headers: { "Retry-After": "0" } });
    return Response.json({});
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function begin(origin = "https://garbamate.example") {
  const jar = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const client = createBrowserClient("https://auth-fixture.supabase.co", "fixture-public-key-never-a-secret", {
    isSingleton: false,
    cookies: { getAll: () => [...jar.values()], setAll: values => values.forEach(value => jar.set(value.name, value)) },
  });
  const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true } });
  expect(error).toBeNull();
  return { cookies: Object.fromEntries([...jar.values()].map(({ name, value }) => [name, value])), authorize: new URL(data.url!) };
}

describe("SSR OAuth callback with the real Supabase PKCE/cookie clients", () => {
  it.each([false, true, null])("exchanges once, validates user, checks actual profile and routes complete=%s", async value => {
    complete = value;
    const flow = await begin();
    expect(flow.authorize.searchParams.get("code_challenge_method")).toBe("s256");
    const response = await GET(request("/auth/callback?code=google-code&next=/login", flow.cookies));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/${value === true ? "discover" : "onboarding"}`);
    const exchanges = requests.filter(r => r.url.searchParams.get("grant_type") === "pkce");
    expect(exchanges).toHaveLength(1);
    expect(createHash("sha256").update(exchanges[0].body!.code_verifier).digest("base64url")).toBe(flow.authorize.searchParams.get("code_challenge"));
    expect(response.cookies.getAll().some(c => c.name.startsWith("sb-auth-fixture-auth-token") && c.value.startsWith("base64-"))).toBe(true);
    expect(response.cookies.getAll().some(c => c.name.endsWith("code-verifier") && c.value === "")).toBe(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(requests.some(r => r.url.pathname.endsWith("/user"))).toBe(true);
    expect(requests.find(r => r.url.pathname.endsWith("/profiles"))?.url.searchParams.get("id")).toBe(`eq.${account.id}`);
  });
  it("recovers an established session when a replay has no verifier", async () => {
    const response = await GET(request("/auth/callback?code=already-consumed", { "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("/discover");
    expect(requests.filter(r => r.url.searchParams.get("grant_type") === "pkce")).toHaveLength(0);
  });
  it("recovers a valid existing session after an expired exchange", async () => {
    tokenError = true;
    const flow = await begin();
    const response = await GET(request("/auth/callback?code=expired", { ...flow.cookies, "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("/discover");
  });
  it.each(["", "?error=access_denied", "?code=missing-verifier"])("handles genuine failure %s without leaking SDK text", async query => {
    const response = await GET(request(`/auth/callback${query}`));
    expect(response.headers.get("location")).toBe(`/auth/error?reason=${query.includes("access_denied") ? "cancelled" : query.includes("code=") ? "expired" : "callback"}`);
    expect(requests.some(r => r.url.pathname.endsWith("/profiles"))).toBe(false);
  });
  it("keeps session cookies and reports a profile outage as signed-in, never new-user", async () => {
    profileError = true;
    const response = await GET(request("/auth/callback?code=valid", (await begin()).cookies));
    expect(response.headers.get("location")).toBe("/auth/error?reason=profile");
    expect(response.cookies.getAll().some(c => c.name === "sb-auth-fixture-auth-token" && c.value)).toBe(true);
  });
  it("handles Auth transport failure without an unhandled server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Unavailable" }, { status: 503 })));
    const response = await GET(request("/auth/callback", { "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("/auth/error?reason=network");
  });
  it.each([
    { ...account, email: "outsider@gmail.com" },
    { ...account, email_confirmed_at: null },
    { ...account, app_metadata: { provider: "google", is_sample: true } },
  ])("denies an ineligible Auth-verified account and clears its local session", async rejected => {
    const fetch = global.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).includes("/auth/v1/user") ? Response.json(rejected) : fetch(input, init)));
    const response = await GET(request("/auth/callback", { "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("/auth/error?reason=college");
    expect(response.cookies.get("sb-auth-fixture-auth-token")?.value).toBe("");
    expect(requests.some(r => r.url.pathname.endsWith("/profiles"))).toBe(false);
  });
  it("middleware refreshes expired cookies on both the request and response", async () => {
    const response = await middleware(request("/discover", { "sb-auth-fixture-auth-token": cookie(session(Math.floor(Date.now() / 1000) - 60)) }));
    expect(requests.some(r => r.url.searchParams.get("grant_type") === "refresh_token")).toBe(true);
    expect(response.cookies.get("sb-auth-fixture-auth-token")?.value).toBe(cookie(session()));
    expect(response.headers.get("x-middleware-request-cookie")).toContain(cookie(session()));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("forwards legacy Site URL callbacks before a browser client can consume their code", async () => {
    const response = await middleware(request("/?code=legacy"));
    expect(response.headers.get("location")).toBeNull();
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/auth/callback");
    expect(new URL(response.headers.get("x-middleware-rewrite")!).searchParams.get("code")).toBe("legacy");
    expect(requests).toHaveLength(0);
  });
  it("does not trust an obsolete site setting or spoofed forwarded host for callback navigation", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://old-deployment.example:8080");
    const response = await GET(new NextRequest("http://internal:8080/auth/callback", { headers: { host: "internal:8080", "x-forwarded-host": "attacker.example" } }));
    expect(response.headers.get("location")).toBe("/auth/error?reason=callback");
  });
  it.each([false, true])("never redirects the browser to the reverse proxy's HTTP port 8080 (completed=%s)", async value => {
    complete = value;
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const publicOrigin = "https://bmsce-club.ai.studio";
    const flow = await begin(publicOrigin);
    const proxyRequest = new NextRequest("http://bmsce-club.ai.studio:8080/auth/callback?code=fixture-code", {
      headers: { host: "bmsce-club.ai.studio:8080", "x-forwarded-host": "bmsce-club.ai.studio:8080", "x-forwarded-proto": "http", cookie: Object.entries(flow.cookies).map(([name, value]) => `${name}=${value}`).join("; ") },
    });
    const response = await GET(proxyRequest);
    expect(new URL(response.headers.get("location")!, publicOrigin).href).toBe(`${publicOrigin}/${value ? "discover" : "onboarding"}`);
    expect(requests.filter(r => r.url.searchParams.get("grant_type") === "pkce")).toHaveLength(1);
    expect(response.cookies.getAll().some(c => c.name.startsWith("sb-auth-fixture-auth-token") && c.value.startsWith("base64-"))).toBe(true);
  });
});
