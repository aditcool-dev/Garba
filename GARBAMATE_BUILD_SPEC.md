# GarbaMate — Build Spec for a BMSCE Campus Garba Partner App

## 0. How to use this document
You are a senior full-stack engineer, product designer, and security-minded reviewer. Build **GarbaMate**, a mobile-first web app where **BMS College of Engineering (BMSCE) students** find a Garba/Dandiya partner or group for Navratri nights.

Rules:
1. Read this whole file before writing code.
2. Don't ask me questions unless truly blocked. Where the spec is silent, pick a sensible default, record it in `DECISIONS.md`, and continue.
3. Work in the phases in Section 15. Run and verify each phase before starting the next.
4. Navratri is close. **A working, safe, polished MVP beats a large half-finished app.** Build everything marked `[MVP]` first; `[LATER]` items only after the MVP is verified.
5. Never hard-code or commit secrets. Use `.env.example` with placeholders.

## 1. Product
**Name:** GarbaMate. **Tagline:** "Find your Garba partner. Own the night."
**Idea:** BMSCE students create a profile (photo, name, branch/year, Garba experience, style, available nights, what they're looking for), browse others, tap Interested or Pass, and on mutual interest get a **Garba Match** and can chat to plan.
**Tone:** a campus festival partner-finder, **not a dating app**. Copy talks about Garba, Dandiya, festival nights, partners, friends, groups, and meeting safely. No sexualized or overtly romantic language. Visuals: modern campus app with Navratri energy, not a Tinder clone.
**Inclusivity:** users choose their own gender label (Woman / Man / Non-binary / Prefer not to say) and their own partner preference. The app never assumes who should partner with whom.

## 2. Stack (use unless clearly broken)
Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui + Framer Motion; Supabase (Postgres, Auth with Google OAuth, Storage, Realtime); Zod validation on client and server; Vitest (unit) + Playwright (e2e); deploy on Vercel + Supabase.

## 3. Access, identity & privacy (critical)
**3.1 Who can join**
- Only students with a BMSCE email can join. The allowed domain is exactly **`bmsce.ac.in`** (student emails look like `name.cs24@bmsce.ac.in`). **No subdomains.**
- Configure via env `ALLOWED_EMAIL_DOMAINS` (comma-separated), default `bmsce.ac.in`. Matching rule: lowercase and trim the email, take the part after the last `@`, and require it to **equal** an allowed domain exactly. Unit-test with: `adit.cs24@bmsce.ac.in` (allow), `X@BMSCE.AC.IN` (allow), `x@cse.bmsce.ac.in` (reject), `x@evilbmsce.ac.in` (reject), `x@bmsce.ac.in.evil.com` (reject), `x@gmail.com` (reject), and inputs with extra spaces.
- Enforce **server-side** and with a Supabase auth hook or DB trigger on `auth.users`, never only in the UI. For Google sign-in, use the verified email from the provider. The `hd` hint alone is not enough: re-check the email domain after login and deny the session if it fails.
- Also support email+password signup with **email verification** (same domain rule), login, logout, and password reset. Unverified emails cannot reach the app.

**3.2 Age:** require confirmation of **18+** at onboarding. If age < 18, block profile completion with a polite message. Store age as a number, not date of birth.

**3.3 Privacy by default**
- Never expose email, auth IDs, or contact details to other users. No phone numbers or social handles in v1; chat stays in-app.
- Never collect or show exact location. Events, if added later, are named venues only.
- **"Hide my profile"** removes the user from discovery immediately; existing matches and chats stay.
- **Delete account** must really delete: profile, Storage photos, likes, passes, matches, messages, and reports filed by the user (keep a minimal anonymized record of reports *against* users for safety follow-up; state this on the privacy page).
- Add plain-language **Privacy, Terms and Community Guidelines** pages (data collected, who sees it, how to delete; consent checkbox at signup; aligned with India's DPDP Act principles).
- Enforce privacy at the **database level with Row Level Security**, not just in app code.

## 4. Data model & profile
**4.1 Required profile fields:** profile photo; first name (no surname needed); age (18+); gender; branch (config list: CSE, ISE, ECE, EEE, ME, CV, AI&ML, AI&DS, etc.); year (1st–4th); short bio (max 200 chars); Garba experience (Beginner / Intermediate / Advanced / "Just here for the fun 😂"); preferred styles, multi-select (Traditional Garba, Dandiya, Fast Garba, Slow Garba, Bollywood Garba, Any); looking for, multi-select (Garba partner, Dandiya partner, Group, Just friends, Open to anything); available nights Day 1–9; interests from a curated tag list (max 6: traditional outfits, Bollywood music, dance, photography, food, coding, sports, music…).

**4.2 Partner preference `[MVP]`:** users choose who they'd like to see: Everyone / Women / Men / Non-binary (default Everyone). It's a discovery filter and must be **mutual-aware**: show A to B only if B's preference accepts A's gender and A's preference accepts B's. Never shown on public profiles.

**4.3 Festival config:** one file `config/festival.ts` with the Navratri start date and number of nights. Drive the countdown, Day 1–9 labels, and "tonight" logic from it. Don't hard-code dates in components; I will confirm the exact dates.

**4.4 Schema (SQL migrations in `supabase/migrations/`)**: UUID PKs, `created_at`/`updated_at`, integrity enforced in the DB.
- `profiles`: `id` references `auth.users(id)` on delete cascade; fields above; `is_hidden`, `is_suspended`, `is_banned`, `onboarding_complete`, `is_demo`, `last_active_at`.
- `likes`: from_user, to_user, kind (`interested` | `garba_vibe`), unique (from_user, to_user), check from_user <> to_user.
- `passes`: from_user, to_user, unique pair.
- `matches`: user_a, user_b in **canonical order** (user_a < user_b), unique (user_a, user_b), status (active | unmatched).
- `messages`: match_id, sender_id, body (max 1000), created_at, read_at.
- `blocks`: blocker_id, blocked_id, unique pair.
- `reports`: reporter_id, reported_user_id, reason enum (harassment, fake_profile, inappropriate_content, spam, other), description, status (open | reviewing | actioned | dismissed), reviewed_by, reviewed_at, created_at.
- `admin_users`: user_id. Admin status is never derived from anything a user can edit.
- `audit_log`: admin actions (who, what, target, when).
- Indexes: discovery queries, likes(to_user), matches(user_a) and (user_b), messages(match_id, created_at), reports(status), blocks(blocked_id).

**4.5 Atomic matching:** implement liking as a single Postgres function (RPC) `like_user(target, kind)` that validates not-self / not-blocked / target-active, inserts the like idempotently, checks for a reciprocal like, and creates the match in one transaction (canonical ordering + unique constraint so simultaneous likes can't create two matches). Return `{ matched, match_id }`.

## 5. Onboarding `[MVP]`
Users can't reach `/discover` until `onboarding_complete = true`; redirect to `/onboarding`. Six quick steps with a progress bar and saved progress:
1. Photo (square crop, client-side resize/compress, upload to Storage)
2. Basics (name, age, gender, branch, year, bio)
3. Garba preferences (experience, styles, looking for, who to show)
4. Availability (Day 1–9)
5. Interests
6. Preview card, confirm 18+, confirm "this is my own photo", accept guidelines
Finish: "Your Garba profile is ready 🪩" → **[Start Discovering]**.

**5.1 Smart prefill from the college email `[MVP]`**
BMSCE emails follow the pattern `name.<branch><YY>@bmsce.ac.in` (e.g. `cs24` = CS branch, admission year 2024). At onboarding step 2, **suggest** a branch and year from this pattern (e.g. `cs24` → CSE, and year derived from admission year vs. the current academic year). Rules:
- It is only a **pre-filled suggestion the user can change**. Never treat it as verified fact, and never use it for access control.
- If the pattern doesn't parse (lateral entry, different format), leave the fields empty without an error.
- Keep the branch-code map (`cs`, `is`, `ec`, `ee`, `me`, `cv`, `ai`, `ad`, etc.) in a config file, and tell me in `DECISIONS.md` which codes you assumed so I can correct them.
- Never show the email or the raw email prefix to other users.

## 6. Discovery `[MVP]`
Card stack, clearly Garba-themed.
- **Card:** large photo, first name, age, branch + year, experience, preferred styles, available-night chips (highlight overlap with mine), bio, shared interests, match score.
- **Actions:** ❌ Pass · ❤️ Interested · ⭐ "Garba Vibe" (stronger signal, small daily quota, e.g. 3/day, shown in UI) · ↩ Undo `[LATER]`.
- **Interaction:** swipe on mobile (Framer Motion drag with velocity threshold, LIKE/PASS stamps while dragging), tap buttons everywhere, arrow keys on desktop. Usable one-handed.
- **Loading:** server-side ranked, paginated feed (10–20 per batch), prefetch next batch. Exclude: self, hidden/suspended/banned, blocked either way, already liked/passed, existing matches, mutual-preference failures.
- **Filters `[MVP]`:** branch, year, experience, style, available night, looking for, plus the toggle "Show only people available on my nights".

**6.1 Compatibility score** in a pure, unit-tested `lib/scoring.ts`:
```
score = 0.30 * availabilityOverlap   // overlap relative to my nights / Jaccard
      + 0.20 * styleCompatibility    // shared styles; "Any" matches all
      + 0.15 * yearProximity         // same=1, ±1=0.6, else 0.2
      + 0.15 * branchMatch           // same=1, else 0.4
      + 0.10 * interestOverlap
      + 0.10 * lookingForCompat
```
Handle empty sets safely, clamp to 0–100, never factor in gender, appearance, or anything sensitive. Display "🔥 87% Garba match" with a tooltip: "A fun, app-generated score based on nights, styles and interests. Not a judgement of anyone." Add small randomness within score bands so the feed isn't identical every time.

## 7. Match celebration `[MVP]`
Modal: 🎉 **"It's a Garba Match!"** "You and {name} both want to hit the Garba floor." Subtle confetti; buttons **[Say hello 👋]** and **[Keep discovering]**. Respect `prefers-reduced-motion`. Matches page: list with View profile, Chat, Unmatch (with confirm).

## 8. Messaging `[MVP]`
- Only matched, non-blocked, active users can message, **enforced in RLS/DB**.
- Conversation list (last message, time, unread badge); chat screen with timestamps, read/unread, emoji support, realtime via Supabase Realtime.
- Tappable starters: "Which Navratri night are you going?", "Garba or Dandiya?", "Traditional outfit or full Bollywood?", "How many rounds before we're exhausted? 😂".
- Unread badge in the app (browser push is `[LATER]`).
- One-time safety banner in new chats: meet at the official event, with friends, in public; never share OTPs, money, or personal details.
- Length limit, basic rate limiting, Report and Block inside chat. If either side unmatches or blocks, the chat becomes unavailable.

## 9. Security requirements (do not skip)
- **RLS on every table** with explicit policies, and test them: user A can't read B's private fields, read others' chats, like as someone else, or edit another profile.
- Public profile reads go through a **view or RPC returning only safe display columns**.
- Service role key server-side only; anything `NEXT_PUBLIC_` must be safe to expose.
- Zod validation on all server inputs; never render bio/messages as raw HTML.
- Rate-limit likes, messages, reports, signup (simple limiter is fine for MVP).
- Storage: users write only into their own folder; max 5 MB; jpeg/png/webp only; strip EXIF (including GPS).
- Admin routes and actions check `admin_users` **on the server** every time.
- Add security headers (CSP where practical, X-Frame-Options, etc.) and a short `SECURITY.md` (trust model, key rotation).

## 10. Safety & moderation `[MVP]`
- **Report** (harassment, fake profile, inappropriate content, spam, other + optional description) from cards, profiles, and chats. Reporter identity is hidden from the reported user.
- **Block:** disappears from discovery both ways, can't message, matches hidden, can't view each other.
- **Unmatch**, **Hide profile**, **Delete account**.
- **Community guidelines** (shown at onboarding, linked in footer): no explicit or offensive photos, no harassment, no fake identities, no sharing others' info, be respectful, meet safely.
- **Photo moderation:** at minimum, the "my own photo, follows guidelines" checkbox plus admin removal tools. If practical, add automated image moderation behind a swappable `lib/moderation.ts`, switchable by env var, with flagged photos hidden pending review. Disclose any third-party image processing on the Privacy page.
- Auto-hide a profile from discovery after reports from several distinct users (configurable threshold), pending admin review.

## 11. Admin dashboard `[MVP-lite]`
`/admin`, admins only.
- Metrics: total users, active users (7 days), profiles completed, total likes, total matches, open reports.
- Users table: search, view, suspend, ban, unban, remove/replace inappropriate photo or bio.
- Reports queue: details, mark reviewing/actioned/dismissed, act on the user in one click.
- Active matches count/list (metadata only). Admins don't casually read chats; only messages attached to a report are viewable, and that access is logged.
- Every admin action writes to `audit_log`. Document how to create the first admin via SQL, not a hidden route.

## 12. Routes
```
/  /login  /signup  /onboarding  /discover  /profile/[id]
/matches  /chat/[id]  /settings  /reports  /admin
/privacy  /terms  /guidelines
```
Unauthenticated → `/login`. Authenticated with incomplete profile → `/onboarding`. Non-admin at `/admin` → 404. Enforce via middleware **and** server checks.
Mobile bottom nav: 🏠 Discover · ❤️ Matches · 💬 Chats · 👤 Profile. Desktop: side rail or top nav.

## 13. Design
- **Feel:** modern campus social app meets Navratri festival night.
- **Palette:** deep midnight navy base; magenta, orange, gold, pink, purple accents as design tokens; dark by default; WCAG AA text contrast.
- **Motifs:** subtle circular Garba/mandala patterns, Dandiya icons, diya glow as background texture and accents, never low-contrast behind text.
- **Type:** one modern readable sans (e.g. Plus Jakarta Sans or Poppins); optional display face for headings only.
- **Motion (tasteful):** card drag/fly-off, match celebration, soft floating particles on landing, gentle gradient shift, hover/press feedback, page transitions. Respect reduced motion; keep smooth on mid-range phones.
- **Landing:** logo, tagline, hero ("Find your Garba partner at BMSCE. Match. Meet. Garba. Repeat."), **[Create profile]** and **[Explore]**, Navratri countdown (from config), 3-step how-it-works, safety/privacy reassurance, BMSCE reference. The concept must be clear in five seconds.
- **Empty states:**
  - No profiles: "Looks like you've explored everyone nearby 👀 Check back when more BMSCE students join."
  - No matches: "Your Garba partner is still out there 🪩"
  - No chats: "Once you match, your conversations will appear here."
- Every screen has loading (skeleton), empty, and error states; inline form validation; touch targets ≥ 44px.

## 14. Performance & quality
`next/image` with compressed avatars; lazy loading; skeletons; paginated queries; optimistic like/pass with rollback; indexes. Strict TypeScript (no unjustified `any`), ESLint/Prettier clean, feature-based folders (`features/discover`, `features/chat`, `lib/`, `components/ui`), small reusable components, friendly error messages, no secrets or PII in logs. Accessibility: keyboard support, labels on icon buttons, alt text, focus states.

## 15. Build phases (verify each before moving on)
- **Phase 0 – Plan:** one-page `PLAN.md` (architecture, folders, schema overview, RLS approach). Then continue without waiting.
- **Phase 1 – Foundation `[MVP]`:** setup, Tailwind + shadcn, tokens, Supabase, migrations, RLS, auth (Google + email), domain restriction, route guards, landing page.
- **Phase 2 – Profiles `[MVP]`:** onboarding (with email-based prefill), photo pipeline, profile page, edit profile, settings (hide, partner preference).
- **Phase 3 – Discovery & matching `[MVP]`:** feed, scoring, swipe cards, filters, `like_user` RPC, match modal, matches page.
- **Phase 4 – Chat `[MVP]`:** conversations, realtime, unread, starters, badge.
- **Phase 5 – Safety & admin `[MVP]`:** report, block, unmatch, auto-hide, legal pages, admin dashboard, audit log.
- **Phase 6 – Polish:** animations, states, responsive QA, accessibility, performance.
- **Phase 7 – Docs & launch prep:** seed data, README, `.env.example`, deployment guide, `SECURITY.md`, `DECISIONS.md`, `TESTING.md`.
- **`[LATER]`** (only after everything above is verified): undo, event/venue selection, group matching, push notifications, automated image moderation, PWA install prompt.

## 16. Seed / demo data
- `npm run seed` creates ~25 realistic demo BMSCE-style profiles across branches, years, experience levels, styles, availability, and genders (e.g. Aarav, CSE, 3rd year, Intermediate, Traditional Garba, Days 2/4/7; Ananya, ISE, 2nd year, Beginner, Bollywood Garba, Days 2/4/7).
- Use generated/placeholder avatars (initials or illustrated), never real people's photos.
- Every demo row has `is_demo = true`; `npm run seed:clear` removes them. Demo users never appear in production unless an env flag enables them.
- Seed a few likes and one existing match so the demo flow works quickly.
- Demo accounts bypass the email-domain rule only through the seed script (service role), never through the public signup path.

## 17. Testing (you must actually run these)
1. `tsc --noEmit`, `eslint`, and `next build` all pass.
2. Unit tests: email-domain exact-match check (cases in 3.1), email-prefix parser (`adit.cs24@bmsce.ac.in` → CSE, admission 2024; unparseable input → empty), scoring (empty sets, "Any" style, identical profiles), Zod schemas, canonical match ordering.
3. **RLS tests:** can't read others' private data or messages; can't like as someone else; can't message without a match or after a block; non-admin can't reach admin data.
4. E2E (Playwright): a non-BMSCE email is rejected; BMSCE signup → onboarding → discover → like → mutual like creates exactly one match → chat both ways → block removes user from discovery → report shows in admin queue → admin suspends user → suspended user is locked out.
5. Concurrency: two simultaneous mutual likes produce exactly one match.
6. Mobile QA at 360px and 390px plus tablet and desktop: no horizontal scroll, bottom nav and swipe work.
7. Lighthouse mobile targets: Performance ≥ 85, Accessibility ≥ 90.

Report honestly in `TESTING.md`: what passed, what couldn't be tested, known issues. Never claim something works if you didn't run it.

## 18. Deliverables
1. Working Next.js app with all `[MVP]` features
2. `supabase/migrations/*` (schema, indexes, constraints, RLS, RPCs)
3. Seed and clear scripts
4. `README.md` (overview, stack, step-by-step local setup incl. Supabase project, Google OAuth, env vars, migrations, seed, first admin)
5. `.env.example` (placeholders only, including `ALLOWED_EMAIL_DOMAINS=bmsce.ac.in`)
6. `DEPLOYMENT.md` (Vercel + Supabase checklist: env vars, auth redirect URLs, storage rules, domain restriction, disabling demo data, key rotation)
7. `PLAN.md`, `DECISIONS.md`, `SECURITY.md`, `TESTING.md`
8. Final summary: done, deferred, known limitations, exact commands to run

**Definition of done:** a BMSCE student can sign in with their college Google account, build a profile in about two minutes, swipe through ranked partners, match, chat in realtime, and report/block safely; an admin can moderate; all of it works on a phone, with no secrets exposed and RLS verified.