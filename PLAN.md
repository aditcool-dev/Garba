# GarbaMate implementation plan

## Architecture

- Next.js App Router with strict TypeScript, Tailwind CSS, lightweight shadcn-style primitives, and Framer Motion where interaction benefits from it.
- Supabase browser/server clients for Auth, Postgres, Storage, and Realtime. Server actions/API routes validate all inputs with Zod.
- Feature folders under `features/` (`auth`, `onboarding`, `discover`, `matches`, `chat`, `safety`, `admin`), shared UI under `components/ui`, configuration under `config`, and pure utilities under `lib`.
- Middleware protects authenticated routes; server-side checks re-check email domain, onboarding state, admin status, and suspended/banned state.
- Mobile-first dark Navratri visual system using CSS variables for midnight navy, magenta, orange, gold, pink, and purple tokens.

## Delivery order

1. Foundation: project setup, env/config, auth/domain helpers, Supabase migration/RLS/RPC scaffolding, route shell, landing/legal pages.
2. Profiles: onboarding wizard, email prefill, photo validation/upload path, profile display/edit/settings.
3. Discovery and matching: scoring, ranked feed, filters, card actions, atomic like RPC, match celebration, matches list.
4. Chat: conversations, starters, message validation, RLS-safe server actions, realtime client subscription, unread state.
5. Safety/admin: report/block/unmatch/delete/hide, legal copy, moderation thresholds, admin metrics/queue/audit log.
6. Polish: reduced-motion transitions, loading/empty/error states, accessibility, responsive/performance QA.
7. Launch docs and demo seed scripts.

## Database overview

Tables: `profiles`, `likes`, `passes`, `matches`, `messages`, `blocks`, `reports`, `admin_users`, and `audit_log`, with UUID keys, timestamps, checks, unique constraints, discovery/chat indexes, and RLS on every table. Public discovery reads use a safe profile view/RPC. `like_user(target, kind)` performs idempotent like insertion, reciprocal detection, canonical match creation, and block/activity checks in one transaction.

## RLS approach

- A helper function reads `auth.uid()`; users can select/update only their own private profile, while a safe display view exposes only approved public columns.
- Likes, passes, blocks, reports, and messages are limited to the authenticated participant/reporter and enforce relationship rules in policies and database functions.
- Matches are visible only to either participant. Message inserts require an active, unblocked match and the sender must be the current user.
- Admin access is based only on `admin_users`, never editable profile data. Admin mutations write `audit_log`.
- Storage object paths are scoped to the authenticated user's folder and file type/size restrictions are documented and enforced at the app boundary plus bucket policies.

## Verification gates

After each phase, run the smallest meaningful checks and do not advance on failures: `npm run typecheck`, `npm run lint`, `npm run build`, and phase-relevant Vitest/Playwright tests. Results and unavailable external Supabase checks will be recorded honestly in `TESTING.md`.
