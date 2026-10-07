import { getSupabaseAnonKey, getSupabaseUrl } from "./config";

// This marker identifies the deployed diagnostic code, not a claimed Git SHA.
export const AUTH_CALLBACK_VERSION = "callback-trace-v1";
type Fields = Record<string, string | number | boolean | null>;
type Stage =
  | "AUTH_CALLBACK_ENTERED" | "AUTH_CALLBACK_CODE_PRESENT"
  | "AUTH_CALLBACK_CONFIGURATION" | "AUTH_CALLBACK_SUPABASE_CLIENT_CREATED"
  | "AUTH_CALLBACK_EXCHANGE_STARTED" | "AUTH_CALLBACK_EXCHANGE_FINISHED"
  | "AUTH_CALLBACK_HTTP_STARTED" | "AUTH_CALLBACK_HTTP_HEADERS" | "AUTH_CALLBACK_HTTP_FAILED"
  | "AUTH_CALLBACK_HTTP_JSON_STARTED" | "AUTH_CALLBACK_HTTP_JSON_FINISHED" | "AUTH_CALLBACK_HTTP_JSON_FAILED"
  | "AUTH_CALLBACK_SET_COOKIE_HEADER"
  | "AUTH_CALLBACK_COOKIE_WRITE_STARTED" | "AUTH_CALLBACK_COOKIE_WRITE_FINISHED"
  | "AUTH_CALLBACK_GET_USER_STARTED" | "AUTH_CALLBACK_GET_USER_FINISHED"
  | "AUTH_CALLBACK_SIGN_OUT_STARTED" | "AUTH_CALLBACK_SIGN_OUT_FINISHED"
  | "AUTH_CALLBACK_PROFILE_CHECK_STARTED" | "AUTH_CALLBACK_PROFILE_CHECK_FINISHED"
  | "AUTH_CALLBACK_REDIRECT" | "AUTH_CALLBACK_EXCEPTION";

// Only machine classifications are permitted; raw messages/stacks often contain
// request URLs, OAuth codes, credentials or user metadata. Never serialize errors.
const errorNames = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "TimeoutError", "AuthApiError", "AuthUnknownError", "AuthRetryableFetchError", "AuthSessionMissingError", "AuthPKCECodeVerifierMissingError", "AuthInvalidTokenResponseError"]);
const errorCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE", "ERR_INVALID_URL", "ERR_HTTP_INVALID_HEADER_VALUE", "ERR_INVALID_CHAR", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_HEADERS_OVERFLOW", "UND_ERR_ABORTED", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID", "flow_state_not_found", "flow_state_expired", "bad_code_verifier", "pkce_verifier_mismatch", "otp_expired", "invalid_grant", "unexpected_failure", "request_timeout"]);

export function callbackErrorFields(error: unknown): Fields {
  const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; status?: unknown; cause?: unknown } : null;
  const cause = value?.cause && typeof value.cause === "object" ? value.cause as { name?: unknown; code?: unknown } : null;
  const name = (item: unknown) => typeof item === "string" && errorNames.has(item) ? item : "unclassified";
  const code = (item: unknown) => typeof item === "string" && errorCodes.has(item) ? item : null;
  return { errorName: name(value?.name), errorCode: code(value?.code), errorStatus: typeof value?.status === "number" && Number.isFinite(value.status) ? value.status : null, causeName: cause ? name(cause.name) : null, causeCode: code(cause?.code) };
}

export function redactCallbackCookieName(name: string): string {
  const suffix = name.match(/-(auth-token(?:\.\d+|-code-verifier)?)$/)?.[1];
  return suffix ? `sb-<project-ref>-${suffix}` : "redacted-cookie";
}

export function splitSetCookieHeaders(value: string): string[] {
  return value ? value.split(/,\s*(?=[^;,=\s]+=[^;,]*)/) : [];
}

function settingSummary(name: string, value: string | undefined): Fields {
  const present = value !== undefined && value !== "";
  const summary: Fields = { present, whitespace: !!value && value !== value.trim(), quoted: !!value && /^["']|["']$/.test(value) };
  if (name.endsWith("URL")) {
    try {
      const url = new URL(value || "");
      Object.assign(summary, { http: ["https:", "http:"].includes(url.protocol), https: url.protocol === "https:", loopback: ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), hasCredentials: !!(url.username || url.password), hasPath: url.pathname !== "/", hasQuery: !!url.search, hasFragment: !!url.hash });
    } catch { summary.http = false; }
  } else if (value) {
    let privileged = value.startsWith("sb_secret_");
    try { privileged ||= JSON.parse(atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role"; } catch { /* Not a legacy JWT. */ }
    Object.assign(summary, { lengthSufficient: value.length > 20, privileged });
  }
  return summary;
}

export function createCallbackDiagnostics(request: { headers: Headers }) {
  const enabled = process.env.GARBA_AUTH_DIAGNOSTICS === "1";
  const started = Date.now();
  const cloudTrace = request.headers.get("x-cloud-trace-context")?.match(/^([0-9a-f]{32})(?:\/|;|$)/)?.[1];
  const requestId = enabled ? cloudTrace || crypto.randomUUID() : null;
  const revision = /^[a-zA-Z0-9._-]{1,120}$/.test(process.env.K_REVISION || "") ? process.env.K_REVISION! : null;
  const stage = (event: Stage, fields: Fields = {}) => {
    if (enabled) console.info(JSON.stringify({ event, version: AUTH_CALLBACK_VERSION, revision, requestId, elapsedMs: Date.now() - started, ...fields }));
  };
  const compiled = { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL: getSupabaseUrl(), NEXT_PUBLIC_SUPABASE_ANON_KEY: getSupabaseAnonKey() };
  const configuration = () => {
    if (!enabled) return;
    for (const [name, value] of Object.entries(compiled)) {
      // Dynamic lookup deliberately distinguishes runtime environment from the
      // NEXT_PUBLIC_* values Next inlined into this build. Log flags, not values.
      const runtime = process.env[name];
      stage("AUTH_CALLBACK_CONFIGURATION", { setting: name, ...Object.fromEntries(Object.entries(settingSummary(name, value)).map(([key, item]) => [`compiled_${key}`, item])), ...Object.fromEntries(Object.entries(settingSummary(name, runtime)).map(([key, item]) => [`runtime_${key}`, item])), runtimeMatchesCompiled: runtime === value });
    }
  };
  const fetchWithDiagnostics: typeof fetch = async (input, init) => {
    const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // Report only a fixed endpoint classification; never log URLs, bodies,
    // headers, response bodies or provider/session/user values.
    let endpoint = "other";
    try {
      const url = new URL(address);
      if (url.pathname.endsWith("/auth/v1/token")) endpoint = "auth_token";
      else if (url.pathname.endsWith("/auth/v1/user")) endpoint = "auth_user";
      else if (url.pathname.endsWith("/auth/v1/logout")) endpoint = "auth_logout";
      else if (url.pathname.endsWith("/rest/v1/profiles")) endpoint = "profiles";
    } catch { /* The original fetch owns URL validation and its error. */ }
    const before = Date.now();
    stage("AUTH_CALLBACK_HTTP_STARTED", { endpoint });
    try {
      const response = await fetch(input, init);
      stage("AUTH_CALLBACK_HTTP_HEADERS", { endpoint, httpStatus: response.status, durationMs: Date.now() - before });
      // Observe the SDK's normal JSON read, too: fetch can return headers while
      // its response body subsequently fails. Never pre-read/clone/log the body.
      const readJson = response.json.bind(response);
      response.json = async () => {
        const reading = Date.now();
        stage("AUTH_CALLBACK_HTTP_JSON_STARTED", { endpoint });
        try {
          const result = await readJson();
          stage("AUTH_CALLBACK_HTTP_JSON_FINISHED", { endpoint, durationMs: Date.now() - reading });
          return result;
        } catch (error) {
          stage("AUTH_CALLBACK_HTTP_JSON_FAILED", { endpoint, durationMs: Date.now() - reading, ...callbackErrorFields(error) });
          throw error;
        }
      };
      return response; // Same stream/response; no extra request, read or retry.
    } catch (error) {
      stage("AUTH_CALLBACK_HTTP_FAILED", { endpoint, durationMs: Date.now() - before, ...callbackErrorFields(error) });
      throw error; // Preserve the original error and existing SDK handling.
    }
  };
  const responseHeaders = (headers: Headers) => {
    if (!enabled) return;
    headers.set("X-GarbaMate-Auth-Version", AUTH_CALLBACK_VERSION);
    if (revision) headers.set("X-GarbaMate-Auth-Revision", revision);
    if (requestId) headers.set("X-GarbaMate-Auth-Request", requestId);
  };
  return { enabled, stage, configuration, fetch: enabled ? fetchWithDiagnostics : undefined, responseHeaders };
}
