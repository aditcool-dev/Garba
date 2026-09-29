# GarbaMate

Mobile-first BMSCE Navratri partner finder. Built with Next.js, TypeScript, Tailwind, Supabase, Zod, Vitest, and Playwright.

## Local setup

1. `npm install` and copy `.env.example` to `.env.local`.
2. Create a Supabase project, add URL/anon/service-role values, enable Google OAuth and email verification, and set the callback URL to `${NEXT_PUBLIC_SITE_URL}/auth/callback`.
3. Apply `supabase/migrations/001_init.sql` in the Supabase SQL editor. Add a Storage bucket for profile photos with authenticated user-folder policies.
4. `npm run dev`; run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
5. `npm run seed` is intentionally safe/no-op until a local service-role seed implementation is configured. Create the first admin by inserting the auth user UUID into `admin_users` in SQL.

See `DEPLOYMENT.md`, `SECURITY.md`, `TESTING.md`, and `DECISIONS.md`.
