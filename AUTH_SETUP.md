# GarbaMate authentication and Google branding

## Implemented flow

This is **Next.js 15 App Router**, using `@supabase/ssr` on both sides:

- `lib/supabase/client.ts`: one browser client; the SDK stores the PKCE verifier and persistent session in its standard cookies.
- `lib/supabase/server.ts`: a new server client per request, with `getAll`/`setAll` cookie adapters.
- `app/auth/callback/route.ts`: the only OAuth authorization-code exchange. It attaches every SDK cookie to its redirect, verifies the user through Supabase Auth, then selects the authenticated UUID's existing `profiles.onboarding_complete` flag.
- `middleware.ts`: Next.js 15 session refresh, propagating refreshed cookies to both the downstream request and browser. The callback is deliberately excluded. Old Site URL redirects to `/?code=...` are internally rewritten to the callback before React/browser Auth can consume the code.
- `AuthProvider`/`AuthGate`: validated Supabase user and checked profile determine routing after restoration or auth-state events. No auth query runs inside the SDK's auth-state callback. A loading state prevents onboarding from mounting before the check; request generations discard late results after sign-out/account changes.

```text
Google → Supabase /auth/v1/callback → APP_ORIGIN/auth/callback
       → code exchange + session cookies → verified college user
       → profiles.onboarding_complete
          true                 false / no row
          /discover            /onboarding → save actual UUID → /discover
```

New Auth accounts normally already have an incomplete scaffold profile from the existing `handle_new_user` database trigger. Row existence alone is insufficient: completion must be `true`. If the trigger scaffold's name is an ID-like email local part, onboarding asks for a public name while preserving the other valid draft fields; it does not get stuck behind public-card name validation or display the identifier. A failed profile query is a retry state, never evidence that a user is new. Existing profiles, IDs, providers and database tables are preserved; this repair has **no new SQL migration**. Existing migrations 001–014 must already be applied for this version of the application.

The old callback was a React page. `createBrowserClient` auto-detected its OAuth code and exchanged it during initialization, then the page explicitly exchanged the same code again. The first exchange established the session and consumed the verifier; the second displayed the raw SDK error. Moving exchange ownership to a server route removes that race rather than hiding its error. A valid Auth-verified session also recovers a replayed/expired callback without another sign-in.

The age control starts with `""`, retains raw digits or `""`, uses `inputMode="numeric"`, and converts only during Continue/submission validation. It rejects ages under 18 with the existing message. The database already enforces `age >= 18`. Onboarding no longer reads fake local sessions, invents student IDs or substitutes a default age on submission.

## Required hosted configuration

`APP_ORIGIN` below means the **exact production origin**, currently **`https://bmsce-club.ai.studio`**, provided during the proxy-error investigation. Hosted Google/Supabase dashboards and the build-host environment remain inaccessible; these external settings have **not** been changed or verified. See `AUTH_RUNTIME_DIAGNOSIS.md` for live HTTP evidence and the internal-port redirect repair.

### Build host

```dotenv
NEXT_PUBLIC_SITE_URL=https://bmsce-club.ai.studio
NEXT_PUBLIC_SUPABASE_URL=https://your-project-reference.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-existing-public-anon-or-publishable-key
```

Set these **before building**; rebuild after changes. `NEXT_PUBLIC_SITE_URL` is an origin without a path/query. No Google secret or Supabase service-role key belongs in the public frontend configuration.

Sign-in always uses `location.origin + '/auth/callback'`, so development does not jump to production and lose its verifier cookie. Browser/server clients use the same Supabase project/public key. Callback responses use relative `Location` headers, which the browser resolves against its existing public origin. This remains correct when the proxy exposes only an internal HTTP Host/port to Next; the callback no longer reconstructs or guesses a public origin from proxy headers. Normalize any production hostname aliases **before starting login**, not midway through OAuth.

### Supabase Dashboard → Authentication → URL Configuration

- **Site URL:** `APP_ORIGIN`.
- **Redirect URLs:** exact application callback URLs:
  - `APP_ORIGIN/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/auth/callback` if that development origin is used.
- Add the matching exact callback for another development port only if used. For example, a production-build test server on 3101 needs its own callback when using a hosted Supabase project. Local automated tests use a fixture, not the hosted allowlist.
- Keep confirmed college email verification enabled. The existing database email/trust triggers enforce the exact college domain; Google's `hd=bmsce.ac.in` parameter is only an account-selection hint.
- Under **Sign In / Providers → Google**, preserve the existing Google provider and its Client ID/secret. Copy the **Callback URL shown by Supabase** for the Google Cloud step below.

### Google Auth Platform → Clients → existing Web OAuth client

These are two different callback destinations:

| Setting | Correct URL |
| --- | --- |
| Google **Authorized redirect URIs** | Supabase's callback, normally `https://your-project-reference.supabase.co/auth/v1/callback` |
| Supabase **Redirect URLs** | GarbaMate's callback, `APP_ORIGIN/auth/callback` |
| Google **Authorized JavaScript origins** | `APP_ORIGIN` and the exact local origin(s) used for development, with no path |

Do **not** replace Google's Supabase callback with the app's `/auth/callback`, and do not add `www.` to a Supabase hostname. Google returns to Supabase first; Supabase returns the authorization code to GarbaMate second.

### Google Auth Platform → Branding / Audience / Data Access

The long project domain described during account authorization belongs to **Google's hosted account/consent experience**. App CSS/JavaScript cannot change it. The supplied “Sign-in verification” screenshot is a different screen: the old GarbaMate callback displaying an SDK error.

In the Google Cloud project that owns the **existing OAuth Client ID**:

1. Set **App name** to **GarbaMate**.
2. Set the support email and developer contact to the application's actual contact.
3. Upload the approved GarbaMate application logo in a Google-supported format/size. This repository currently uses a text/emoji identity and contains no approved image-logo asset to upload.
4. Set **Application home page** to `APP_ORIGIN`, **Privacy policy** to `APP_ORIGIN/privacy`, and **Terms of service** to `APP_ORIGIN/terms`.
5. Configure the production site's appropriate **Authorized domain(s)** and verify ownership where Google requires it. For `https://app.example.com`, the registrable authorized domain is normally `example.com`. Use the real owned domain or the hosting platform's supported verification process; do not claim ownership of `supabase.co`.
6. Use `openid`, `userinfo.email`, `userinfo.profile`; the application does not need Drive/Gmail/calendar access. Keep the audience compatible with BMSCE accounts. An Internal audience requires the relevant Workspace organization; a personal/external project generally uses External, with test users while in Testing.
7. Complete Google's applicable **brand verification/publishing** so the approved name/logo can replace the project-domain identity where Google permits. Setting the name locally or merely renaming a Supabase project cannot guarantee that Google shows the brand.

The technically required Supabase redirect URI may remain visible in technical/account details even with approved branding. Keep it correct.

### Custom Supabase Auth domain evaluation

Supabase supports project custom domains on supported plans/add-ons, with provisioned DNS/TLS and updated provider redirect URLs. A domain such as `auth.example.com` can improve the user-facing relationship to the app. Both SSR clients accept a configured HTTPS project URL, so this is feasible as a separately configured rollout, but it is **not currently provisioned or enabled** in this repository.

Do not simply replace the Supabase URL with an unprovisioned hostname. A real rollout must first activate the custom domain through Supabase, use the dashboard's resulting Google callback URI, update the relevant Google/domain settings and public project URL, rebuild, and verify existing sessions. Next's image host allowlist and maintenance/Storage configuration also need to support that host; the current image allowlist includes `*.supabase.co`. SDK storage keys depend on the project hostname, so changing it can require users to sign in again. No custom domain was introduced as part of this repair.

## Error behavior and verification

- Missing verifier/expired code with **no valid session**: “Unable to sign you in,” expiry explanation, **Try Again**.
- Cancelled/invalid callbacks: appropriate readable explanation and **Try Again**.
- Network failure: “Unable to finish sign-in”; no raw SDK/storage instructions or claim that a verified session was lost.
- Verified session plus profile outage: “You’re signed in,” **Retry profile lookup**; keep the session cookie and rerun the authoritative lookup.
- Verified session after a consumed callback: go directly to the correct profile-dependent destination.
- Ineligible/unconfirmed/noncollege/sample accounts: deny and clear the local session; no profile writes.

`TESTING.md` documents automated A/B/C/D coverage and reproduction. Local tests execute the real Supabase SDK's S256 verifier/cookie handling, the production Next server and PostgreSQL/RLS. Google/GoTrue HTTP is emulated. Hosted consent branding, actual BMSCE Google sign-in and physical-phone Chrome must be checked after applying the external settings and deploying this build.
