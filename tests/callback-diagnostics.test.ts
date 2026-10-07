import { afterEach, describe, expect, it, vi } from "vitest";
import { callbackErrorFields, createCallbackDiagnostics, AUTH_CALLBACK_VERSION } from "../lib/supabase/callback-diagnostics";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const diagnostics = () => createCallbackDiagnostics({ headers: new Headers({ "x-cloud-trace-context": "b95576cee56992abc6f57a38b495812e/123;o=1", cookie: "private-cookie", authorization: "Bearer private-token" }) });

describe("callback diagnostics without credential disclosure or transport changes", () => {
  it("is opt-in and emits a version marker without a diagnostic fetch or logs by default", () => {
    vi.stubEnv("GARBA_AUTH_DIAGNOSTICS", "0");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = diagnostics(); debug.stage("AUTH_CALLBACK_ENTERED"); debug.configuration();
    const headers = new Headers(); debug.responseHeaders(headers);
    expect(debug.fetch).toBeUndefined(); expect(log).not.toHaveBeenCalled();
    expect(headers.get("X-GarbaMate-Auth-Version")).toBeNull();
    expect(headers.get("X-GarbaMate-Auth-Request")).toBeNull();
  });
  it("records actual HTTP status/timing and passes request options and response stream through unchanged", async () => {
    vi.stubEnv("GARBA_AUTH_DIAGNOSTICS", "1"); vi.stubEnv("K_REVISION", "bmsce-club-00024-brj");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = Response.json({ message: "private-response-value" }, { status: 400 });
    const fetch = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetch);
    const debug = diagnostics();
    const url = "https://fixture.supabase.co/auth/v1/token?grant_type=pkce&code=private-oauth-code";
    const options = { method: "POST", headers: { apikey: "private-key" }, body: JSON.stringify({ auth_code: "private-oauth-code", code_verifier: "private-verifier" }) };
    expect(await debug.fetch!(url, options)).toBe(response);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(url, options);
    expect(await response.json()).toEqual({ message: "private-response-value" });
    const lines = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(lines[1]).toMatchObject({ event: "AUTH_CALLBACK_HTTP_HEADERS", endpoint: "auth_token", httpStatus: 400, requestId: "b95576cee56992abc6f57a38b495812e", revision: "bmsce-club-00024-brj" });
    expect(lines[3]).toMatchObject({ event: "AUTH_CALLBACK_HTTP_JSON_FINISHED", endpoint: "auth_token" });
    expect(JSON.stringify(lines)).not.toContain("private-");
    expect(JSON.stringify(lines)).not.toContain("supabase.co");
  });
  it("reports the observed transport cause before Auth wraps it, without logging its message/body or retrying", async () => {
    vi.stubEnv("GARBA_AUTH_DIAGNOSTICS", "1");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = new TypeError("request contained private-oauth-code", { cause: Object.assign(new Error("private-cookie"), { code: "ECONNRESET" }) });
    const fetch = vi.fn().mockRejectedValue(error); vi.stubGlobal("fetch", fetch);
    await expect(diagnostics().fetch!("https://fixture.supabase.co/auth/v1/token", { method: "POST" })).rejects.toBe(error);
    expect(fetch).toHaveBeenCalledOnce();
    const lines = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(lines[1]).toMatchObject({ event: "AUTH_CALLBACK_HTTP_FAILED", errorName: "TypeError", causeCode: "ECONNRESET" });
    expect(JSON.stringify(lines)).not.toContain("private-");
    expect(callbackErrorFields({ name: "private-user", code: "private-token", message: "private-password", stack: "private-jwt" })).toMatchObject({ errorName: "unclassified", errorCode: null });
  });
  it("distinguishes a response-body failure after HTTP 200 headers without consuming or leaking it", async () => {
    vi.stubEnv("GARBA_AUTH_DIAGNOSTICS", "1");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = new TypeError("private-response-token", { cause: Object.assign(new Error("private-response-token"), { code: "UND_ERR_SOCKET" }) });
    const response = new Response(new ReadableStream({ pull(controller) { controller.error(error); } }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const result = await diagnostics().fetch!("https://fixture.supabase.co/auth/v1/token");
    expect(result.bodyUsed).toBe(false);
    await expect(result.json()).rejects.toBe(error);
    const lines = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(lines[1]).toMatchObject({ event: "AUTH_CALLBACK_HTTP_HEADERS", httpStatus: 200 });
    expect(lines[3]).toMatchObject({ event: "AUTH_CALLBACK_HTTP_JSON_FAILED", causeCode: "UND_ERR_SOCKET" });
    expect(JSON.stringify(lines)).not.toContain("private-");
  });
  it("audits environment formatting/presence as flags, never actual configuration/key values", () => {
    vi.stubEnv("GARBA_AUTH_DIAGNOSTICS", "1");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " http://localhost:3000 ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", '"https://private-project.supabase.co"');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_secret_private-configuration-value");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    diagnostics().configuration();
    const lines = log.mock.calls.map(([line]) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ setting: "NEXT_PUBLIC_SITE_URL", compiled_whitespace: true, compiled_loopback: true });
    expect(lines[1]).toMatchObject({ setting: "NEXT_PUBLIC_SUPABASE_URL", compiled_quoted: true, compiled_http: false });
    expect(lines[2]).toMatchObject({ setting: "NEXT_PUBLIC_SUPABASE_ANON_KEY", compiled_privileged: true });
    expect(JSON.stringify(lines)).not.toContain("private-");
    expect(JSON.stringify(lines)).not.toContain("sb_secret_");
  });
});
