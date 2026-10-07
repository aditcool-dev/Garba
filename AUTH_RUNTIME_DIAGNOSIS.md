# Authentication proxy/runtime diagnosis — 7 October 2026

## Evidence gathered before changing application code

The supplied deployment is `https://bmsce-club.ai.studio`, served behind Google Frontend. At approximately 17:49–17:54 UTC, unauthenticated requests returned:

| Request | Status | Observation |
| --- | --- | --- |
| `/` | 200 | ~0.47 seconds; application responded |
| `/discover` | 200 | ~0.44 seconds |
| `/onboarding` | 200 | ~0.38 seconds; client guard subsequently handles authentication |
| `/auth/callback` | 303 | **Incorrect Location:** `http://bmsce-club.ai.studio:8080/auth/error?reason=callback` |
| `/auth/callback?code=diagnostic-invalid` | 303 | Same incorrect HTTP/8080 origin, `reason=expired` |
| `/auth/error?reason=callback` on **HTTPS/443** | 200 | Correct application error page |

Following the callback redirect produced the exact client-side diagnostic:

```text
curl: (28) Connection timed out after 19860 milliseconds
followed-callback status=303
destination=http://bmsce-club.ai.studio:8080/auth/error?reason=callback
```

The raw response-header capture also identifies Google request trace `1f3c3becb540e4094518932ea4270d78` for the no-code callback. This can help locate the corresponding hosting log. Tokens, cookies, public-key values and the user's actual OAuth code are omitted from this report. The supplied authorization code was not exchanged/replayed by the investigation.

**Hosting log access boundary:** no AI Studio/Google Cloud runtime/proxy logs or server environment access are available in the workspace. The GitHub commit has no attached deployment/check-run/status logs. Therefore there is no observed hosted exception stack to quote, and the original authenticated **502 itself was not reproduced** by the anonymous probes. The live, unreachable redirect is a confirmed defect consistent with a gateway/upstream failure during navigation; it is not proof that it is the only cause of the user's original 502. Retain the request time/trace and obtain host logs if any gateway failure remains after deployment.

## Responsible code and reproduction

At commit `aec25f7`, `authRequestOrigin()` in **`lib/supabase/server.ts:19–27`**, used by **`app/auth/callback/route.ts:11`**, chose the origin from internal request/proxy headers. When the public HTTPS scheme/port were not preserved and the configured site did not exactly match `host` including `:8080`, it serialized the upstream HTTP port into an absolute browser redirect. The same resolver was used for legacy root-code redirects in middleware.

Before the application fix, two meaningful SDK tests failed after a **successful** PKCE exchange, verified user lookup and actual profile-completion routing:

```text
new user: expected https://bmsce-club.ai.studio/onboarding
          received http://bmsce-club.ai.studio:8080/onboarding
existing: expected https://bmsce-club.ai.studio/discover
          received http://bmsce-club.ai.studio:8080/discover
```

The unchanged source also reproduced the leaked origin via `npm run start` and a request with `Host: bmsce-club.ai.studio:8080`. This isolates the problem from profile queries, cookie mutation and double code exchange.

## Runtime, environment and framework findings

- Installed/locked: **Next 15.5.27**, **React/React DOM 19.3.0**, **@supabase/ssr 0.7.0**, **@supabase/supabase-js 2.117.2**, **Node 22.23.3** locally. The installed Supabase JS packages require Node >=22; the actual hosted Node version remains uninspectable.
- Exact `npm run build` with the shell's environment succeeded. All three expected public variables were **missing locally**, so its validator warned that auth/data operations were unavailable. This was not represented as the deployed environment. A second production build with explicitly named, test-only public fixture URL/key succeeded for authenticated runtime verification.
- `npm run start` started, listened on `PORT=3101`, and served the isolated routes. Its existing standalone-output warning is not a crash: the full workspace runtime responded. A minimal standalone artifact must use `.next/standalone/server.js` and include static assets; no new output/deployment architecture change was made.
- The public deployed browser bundles contain **one HTTPS, non-loopback Supabase project URL and one anon-role JWT key**; no service-role/secret key was observed. Values were not printed. This confirms public bundle configuration only, not the server's environment or an authenticated API request. `NEXT_PUBLIC_SITE_URL`, server variables, quote/whitespace mistakes and stale build-host values cannot be authoritatively checked without hosting access.
- This server client takes a request-specific cookie adapter. There is **no `cookies()` call from `next/headers`** in this flow, so Next.js 15's asynchronous `cookies()` API is not being used incorrectly. RequestCookies are read/mutated in route-handler/middleware contexts; every SDK `setAll` cookie is propagated to the writable response, including session chunks and verifier deletion. No cookies are written during Server Component rendering.
- The callback remains the sole `exchangeCodeForSession()` owner. The middleware matcher excludes `/auth/callback`; ordinary root/public page requests have no redirect-to-self logic or browser-only APIs in middleware/server-client code. Successful local refresh and proxy auth tests execute the real adapters and Edge middleware runtime.

## Narrow fix

1. The callback now sends **303 with a relative `Location`** such as `/discover`, `/onboarding` or `/auth/error?reason=…`, preserving the existing SDK response cookies and no-store headers. Relative Location is valid HTTP, resolved by the browser against the exact public origin where the callback arrived. It cannot leak internal Host/port or depend on an old canonical site setting.
2. Remove the unused guessed-origin resolver. Do not hardcode the AI Studio domain.
3. Legacy `/?code=…` and root OAuth errors are **internally rewritten** to the same callback handler before React mounts. Next middleware redirects require absolute URLs; rewriting avoids another browser-facing/internal-origin leak while keeping exactly one code-exchange owner.
4. Unexpected thrown middleware-refresh failures now produce a redacted structured log (route/name/code/status), instead of the prior empty catch. No auth/profile check is bypassed.

No UI, database schema/data, providers or AuthProvider/AuthGate behavior was changed for this repair.

## Verification and deployment boundary

- **61 tests / 12 files**, lint, typecheck and production build pass.
- `scripts/verify-auth-flow.cjs` passes **14 groups directly and 14 through an HTTPS reverse proxy**, starting the application with **`npm run start`**. The proxy deliberately forwards `Host: proxy-upstream.invalid:8080`, `X-Forwarded-Host` with the same upstream host and `X-Forwarded-Proto: http`, and does **not** rewrite outgoing Location headers. Browser requests remain on the public HTTPS test origin throughout.
- Both modes verify anonymous `/`, direct routes, new-user onboarding, existing-user Discover, exactly one S256 exchange, numeric age 22, refresh, profile retry/errors, direct/client navigation, persistent mobile Chromium restart, legacy-root valid OAuth and invalid callback handling. All captured application responses are below HTTP 500; every Location is same-origin-relative; no browser runtime error or redirect loop occurs.
- The browser suite runs actual Next middleware/route handling, Supabase SDK cookie/PKCE logic and existing PostgreSQL/RLS in a disposable `_tests` DB. Google/GoTrue HTTP is emulated. Actual hosted BMSCE Google consent/login and physical-phone Chrome are not verified.
- Final local logs/artifacts: `/tmp/omnirush/auth-flow/` and `/tmp/omnirush/auth-flow-proxy/`. `TESTING.md` contains commands. Diagnosis HTTP captures remain outside the repository; cookies/secrets are not committed.
- The workspace fix is **not yet deployed**. Rebuild/redeploy this change, then verify the live callback Location has no `http://…:8080` and complete fresh BMSCE sign-in. Supabase's exact application callback allowlist remains `https://bmsce-club.ai.studio/auth/callback`; its Google provider callback remains Supabase's separate `/auth/v1/callback`. Keep `NEXT_PUBLIC_SITE_URL=https://bmsce-club.ai.studio` on the host, although relative callback navigation no longer depends on reconstructing it.
