import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { GET } from "../app/auth/callback/route";
import { middleware } from "../middleware";
import { authRequestOrigin } from "../lib/supabase/server";

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

async function begin() {
  const jar = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const client = createBrowserClient("https://auth-fixture.supabase.co", "fixture-public-key-never-a-secret", {
    isSingleton: false,
    cookies: { getAll: () => [...jar.values()], setAll: values => values.forEach(value => jar.set(value.name, value)) },
  });
  const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://garbamate.example/auth/callback", skipBrowserRedirect: true } });
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
    expect(response.headers.get("location")).toBe(`https://garbamate.example/${value === true ? "discover" : "onboarding"}`);
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
    expect(response.headers.get("location")).toBe("https://garbamate.example/discover");
    expect(requests.filter(r => r.url.searchParams.get("grant_type") === "pkce")).toHaveLength(0);
  });
  it("recovers a valid existing session after an expired exchange", async () => {
    tokenError = true;
    const flow = await begin();
    const response = await GET(request("/auth/callback?code=expired", { ...flow.cookies, "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("https://garbamate.example/discover");
  });
  it.each(["", "?error=access_denied", "?code=missing-verifier"])("handles genuine failure %s without leaking SDK text", async query => {
    const response = await GET(request(`/auth/callback${query}`));
    expect(response.headers.get("location")).toBe(`https://garbamate.example/auth/error?reason=${query.includes("access_denied") ? "cancelled" : query.includes("code=") ? "expired" : "callback"}`);
    expect(requests.some(r => r.url.pathname.endsWith("/profiles"))).toBe(false);
  });
  it("keeps session cookies and reports a profile outage as signed-in, never new-user", async () => {
    profileError = true;
    const response = await GET(request("/auth/callback?code=valid", (await begin()).cookies));
    expect(response.headers.get("location")).toBe("https://garbamate.example/auth/error?reason=profile");
    expect(response.cookies.getAll().some(c => c.name === "sb-auth-fixture-auth-token" && c.value)).toBe(true);
  });
  it("handles Auth transport failure without an unhandled server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Unavailable" }, { status: 503 })));
    const response = await GET(request("/auth/callback", { "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("https://garbamate.example/auth/error?reason=network");
  });
  it.each([
    { ...account, email: "outsider@gmail.com" },
    { ...account, email_confirmed_at: null },
    { ...account, app_metadata: { provider: "google", is_sample: true } },
  ])("denies an ineligible Auth-verified account and clears its local session", async rejected => {
    const fetch = global.fetch;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input).includes("/auth/v1/user") ? Response.json(rejected) : fetch(input, init)));
    const response = await GET(request("/auth/callback", { "sb-auth-fixture-auth-token": cookie(session()) }));
    expect(response.headers.get("location")).toBe("https://garbamate.example/auth/error?reason=college");
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
    expect(response.headers.get("location")).toBe("https://garbamate.example/auth/callback?code=legacy");
    expect(requests).toHaveLength(0);
  });
  it("keeps the browser origin when Next exposes its internal listener host", () => {
    expect(authRequestOrigin({ url: "http://localhost:3101/auth/callback", headers: new Headers({ host: "127.0.0.1:3101" }) })).toBe("http://127.0.0.1:3101");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://garbamate.example");
    expect(authRequestOrigin({ url: "http://localhost:3000/auth/callback", headers: new Headers({ host: "localhost:3000", "x-forwarded-host": "garbamate.example", "x-forwarded-proto": "https" }) })).toBe("https://garbamate.example");
    expect(authRequestOrigin({ url: "https://garbamate.example/auth/callback", headers: new Headers({ host: "garbamate.example", "x-forwarded-host": "attacker.example" }) })).toBe("https://garbamate.example");
  });
});
