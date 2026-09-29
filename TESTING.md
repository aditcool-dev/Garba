# Testing report

Automated unit coverage includes exact email-domain matching, college-prefix parsing, and compatibility scoring.

Latest local verification:

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run test` — passed (11 tests)
- `npm run build` — passed (14 routes)
- `Invoke-WebRequest http://localhost:3000` — HTTP 200

Real Supabase RLS, concurrency, OAuth, Realtime, Playwright E2E, mobile QA, and Lighthouse require a configured Supabase/Vercel-like environment and are not claimed as verified. Browser automation could not run because the local Playwright Chromium executable is not installed.
