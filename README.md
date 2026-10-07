# GarbaMate

Mobile-first BMSCE Navratri partner finder. Built with Next.js, TypeScript, Tailwind, Supabase, Zod, Vitest, and Playwright.

## Local setup

1. `npm ci` and configure the public variables from `.env.example` in `.env.local`.
2. Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Enable Google OAuth and email verification, and set the callback URL to `${NEXT_PUBLIC_SITE_URL}/auth/callback`.
3. For a fresh database, apply migrations 001–012 in order. Apply `001_init.sql` only once. For a project already on 008/009, follow `HEALTH_CHECK.md` to audit/clean legacy data and apply idempotent repairs 010, 011 and 012. Add a Storage bucket for real-account photos with authenticated user-folder policies.
4. `npm run dev`; run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`.
5. `npm run seed:samples` creates 30 emoji-only, nonmatching samples through the Auth Admin API. Configure the service-role key only in ignored local `.env.samples`; never expose it on the client. `npm run seed:samples:remove` removes them. Admins must be confirmed college accounts assigned to `admin_users`.

See `HEALTH_CHECK.md` for ordered SQL/commands, actual verification results and limits; also `DEPLOYMENT.md`, `SECURITY.md`, `TESTING.md`, and `DECISIONS.md`.
