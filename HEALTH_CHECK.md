# GarbaMate health check and deployment

## Root cause

The production-build reproduction failed with:

```text
cannot add postgres_changes callbacks for
realtime:active-matches:<user> after subscribe().
```

`RelationshipsProvider` and the recently expanded `NotificationTab` both requested the same channel name. Supabase reuses that channel; adding callbacks after its first subscription throws during mounting. `lib/realtime.ts` now gives each owner a unique topic. The unit regression and production browser checks cover simultaneous subscribers. Error references, structured browser/server logging, a global error boundary, and opt-in message details make future failures diagnosable.

This is the reproduced production-mode code failure. A deployment URL and deployment logs were unavailable, so other errors in a particular hosted release cannot be excluded from that evidence alone.

## Sample seeding failure diagnosis

The two suspects were checked separately:

1. **Slot padding was not the live failure.** `scripts/sample-data.ts` already emitted `01` through `30`, and the seed command now independently pads and validates every slot before constructing the address. It refuses anything outside `01`–`30`.
2. **GoTrue Admin metadata ordering is the live failure.** The installed `@supabase/auth-js` `createUser` implementation sends `app_metadata` in the Admin request, but the GoTrue server source at commit `ce9a8eee0cc042be8c7a42981a7ddae631e41d91` creates the `auth.users` row first with default provider metadata, then calls `UpdateAppMetaData` later in the same transaction. The `BEFORE INSERT` trigger therefore sees no `is_sample` marker and raises the BMSCE error before the later Admin update.

Migration `011_auth_admin_sample_contract.sql` addresses that exact order. It permits only `floor-01` through `floor-30` at the insert boundary, immediately sets a far-future `banned_until` when the reserved account is not yet marked, and accepts the subsequent trusted Admin metadata update without unbanning it. A public signup cannot supply `raw_app_meta_data`; fake `user_metadata` is ignored. Non-reserved non-college addresses remain rejected, and a sample marker on a normal address is rejected. GoTrue treats a future `banned_until` as banned, so reserved public signups cannot produce usable sessions.

The local environment did not have the Supabase CLI or Docker (`supabase start` could not be run). The GoTrue source ordering was verified directly, and migration 011 was tested twice against disposable PostgreSQL with a GoTrue-order INSERT→UPDATE contract, reserved-address containment, non-college rejection, real college insertion, sample ban state, and the emulated Admin seed program. Hosted GoTrue sign-in behavior still requires the live-project rerun below.

## Audit findings

| Audit | Finding |
| --- | --- |
| Prior source at `65f0227` | 30 hard-coded profiles: 20 women, 10 men; 30 USN-like `bms-…` IDs; 30 `is_demo=false` flags; 30 stock-person-photo URLs |
| Creation paths | `INITIAL_DEMO_PROFILES` in `lib/supabase/client.ts`, always merged into `getProfiles()` and cached in the browser; guest names also fell back to that catalog |
| Old scripts/migrations | Seed/clear scripts were placeholders; migrations 001–009 create schema/auth profiles, not that 30-profile catalog |
| Old badges/search | Badges were unconditional, including artificial cards; admin search included IDs |
| Initial disposable SQL DB | 180 browser fixtures; zero `is_demo`/prefixed rows. These are **not live counts** |
| Historical live project's public names API | HTTP 200; six visible first-name rows; zero name demo markers; response still included UUID IDs |
| Privileged live audit | Not available: no service-role key or authenticated live session |

The hard-coded catalog, stock photos, fake local login/password store, admin passkey, permissive SQL-copy control, fake security-test results and fake audit entries were removed. Existing browser caches are cleared. Read-only `supabase/audit-health.sql` reports counts, columns, RPC signatures and RLS/policies; `npm run audit:data` also audits Auth users without printing individual emails or USNs.

### What 008/009 create versus this release

- 008 creates tutorial state, match/chat epoch and unmatch metadata; participant-only unmatch/like/tutorial/block/evidence RPCs; hardened message policies and generation trigger.
- 009 creates `discovery_overlap` and `discover_feed(p_seed text, p_after_key double precision, p_after_id uuid, p_limit integer)`.
- The reproduced crash is **not** an RPC argument or missing-008/009-column failure. Anonymous live probes found `discover_feed`/`discovery_blocked_ids` and appropriately received permission-denied responses; REST accepted the match epoch/unmatch columns. Full authenticated policies were not inspectable remotely.
- The new code additionally needs `is_sample`, trusted `is_verified`, `app_settings`, `get_admin_profiles`, `get_user_notifications`, `mark_chat_read`, and `mark_all_chats_read`. These are **not in 008/009**. Apply **`supabase/migrations/010_health_samples.sql`**, then **`supabase/migrations/011_auth_admin_sample_contract.sql`**, before this frontend. 010 reasserts the old signatures, indexes, grants, RLS, publication and epoch rules; 011 fixes GoTrue Admin `createUser` metadata ordering without weakening the BMSCE rule.
- Profiles are explicitly projected and normalized. Nullable styles/nights/interests/photo fields cannot crash a card. Invalid identity/age/gender/year/name rows are individually logged and skipped. Pagination preserves valid rows if the final row has an unusable cursor. PostgREST columns and RPC JSON do not expose `is_sample`, old demo flags, emails or USN fields. Technical UUID keys remain in relationship requests/routes, never in visible chips or search.

## Run against your Supabase project, in this order

Use Node 22 for local scripts. The service-role key belongs only in your local process, not in the hosting provider's public variables or the browser.

### 1. Configure the local maintenance process

Create an **ignored** `.env.samples` in the project root:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
SHOW_SAMPLE_PROFILES=true
```

Install the locked dependencies:

```bash
npm ci
```

### 2. Audit, then clean up old flagged demo data

In Supabase SQL Editor, run the contents of:

1. **`supabase/audit-health.sql`** — read-only audit; save its count results.
2. **`supabase/cleanup-legacy-demo.sql`** — transactional/idempotent cleanup, before/after counts.

The cleanup only identifies profiles by `is_demo=true`/legacy ID prefixes, or Auth users by trusted admin metadata. It deliberately does not delete real people based on names, ordinary USNs, photos, user-editable tags or email domains.

If it prints owned Storage objects queued, run:

```bash
npm run seed:samples -- --remove-legacy-storage
```

Then run **`supabase/cleanup-legacy-demo.sql` again**. This finalizes auth/profile deletion after the Storage API has removed their files. If no files were queued, auth/profile deletion finishes on the first run. Every stage is retryable; after-counts explicitly show any accounts still deferred. SQL alone cannot safely delete physical Storage files.

### 3. Apply the database repair

You already applied 008 and 009. In SQL Editor run the two new repairs in order:

1. **`supabase/migrations/010_health_samples.sql`**
2. **`supabase/migrations/011_auth_admin_sample_contract.sql`**
3. **`supabase/migrations/012_relationship_status_notifications.sql`**

All three repairs are safe to run twice. Do not rerun the non-idempotent 001 initialization. The repairs remove legacy permissive app-table policies and create the checked policies needed by this release, including admin membership and report review. They do not remove real conversations. Migration 011 is required before `npm run seed:samples` on hosted Supabase; migration 012 is required before the updated Discover/notification client.

Message visibility, unread counts and read receipts require the exact current chat-generation token as well as the timestamp cutoff. Legacy messages with no token are backfilled only when the match is still on its original epoch; unassignable legacy rows from already-reactivated conversations remain retained for admin evidence. A postdated old message cannot reappear in a fresh rematch.

Admins must now be verified college accounts assigned to `admin_users`, for example:

```sql
insert into public.admin_users(user_id)
select id from auth.users where lower(email) = 'YOUR_COLLEGE_EMAIL@bmsce.ac.in'
on conflict (user_id) do nothing;
```

### 4. Seed the replacement samples

```bash
npm run seed:samples
npm run seed:samples
npm run audit:data
```

Before rerunning after the old failure, inspect only the reserved range in SQL Editor:

```sql
select id, email, raw_app_meta_data, banned_until
from auth.users
where lower(email) ~ '^floor-(0[1-9]|[12][0-9]|30)@samples\.garbamate\.invalid$'
order by email;
```

The old `BEFORE INSERT` failure normally rolls back the first create. If an unmarked reserved row remains, do not repurpose it: remove that exact failed-run account through the Supabase Auth dashboard/Admin API, then rerun the seed. The seed intentionally refuses reserved-address collisions without the trusted sample marker.

The second run demonstrates reuse: **30 total**, not 60. There are 20 women and 10 men, ages 18–22, plausible years, varied branches/styles/nights/preferences, friendly bios and 30 distinct emoji avatars. Internal reserved Auth addresses never enter profile API projections. The Admin API marks these accounts as samples and bans sign-in; profile badges are always false. Likes may be saved, but `like_user` exits before mutual matching; database triggers additionally prevent sample matches/messages. Samples are excluded from incoming interests, unread notifications and admin account totals.

### 5. Configure and build the frontend

On the **build host**, set the public variables listed in `.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://YOUR_APP_HOST
```

Configure the Supabase Auth site/redirect URLs to include `https://YOUR_APP_HOST/auth/callback`. There is no hard-coded fallback project/key. Rebuild after changing any `NEXT_PUBLIC_*` value:

```bash
npm run build
npm run start
```

The prebuild check rejects a service-role JWT or `sb_secret_*` in the public anon-key variable. The service-role key does **not** need to be installed on the frontend host. Older open clients must reload to use the hardened message epoch and new projections.

## Turn samples off later

Hide them with one SQL statement; the setting is enforced by both RLS and the feed:

```sql
update public.app_settings set value = false where key = 'SHOW_SAMPLE_PROFILES';
```

Or remove their Auth users, profiles and cascading decisions through the Admin API:

```bash
npm run seed:samples:remove
```

Removal is idempotent and restricted to the script's marked reserved accounts. Reseeding honors the local `SHOW_SAMPLE_PROFILES` value; keep it `false` if you want reseeding to remain hidden.

## Verification actually performed

All browser tests ran against **`next build` + `next start`**, not the dev server. SQL/RPC/RLS ran in real disposable PostgreSQL; HTTP/Auth Admin/Phoenix transport was emulated. The baseline crash was reproduced before changing the subscription code.

| Check | Result |
| --- | --- |
| `tsc --noEmit`, lint, production build | Passed |
| Application unit/regression suite | 27 tests in 8 files passed; all existing application tests retained; untracked copied `.kilo` worktree tests excluded |
| Error boundary | Structured message/stack/digest/route logged; friendly reference by default; actual message with `debug=1` |
| Discover requests | Seed/cursor continuity, corrupt-final-row cursor recovery, RPC signatures, projections, realtime owners, missing-feed error/retry, invalid/null profile rows checked |
| Auth | Signup/login accept college link requests and reject non-college requests before network calls; rejected password has no local fallback; SQL rejects non-college Auth inserts and untrusted sample signup metadata |
| Tutorial | Onboarding → Discover, once-only flag, replay, finish/Escape, four widths/focus trap/reduced motion, zero like/pass/match writes |
| Feed | Ten differing refresh orders, Shuffle/two accounts, duplicate-free swipes/pages, stable surviving order, no visible old IDs/demo markers/countdown |
| Swipe/actions | 20 left passes + 20 right interests, button direction, rapid taps, Undo/outgoing-like restoration, upward Vibe and quota; main Discover keyboard checks included |
| Real-account fixtures | One canonical mutual match; realtime message visible in the other account; unread count increments and clears when chat opens |
| Unmatch | Matches/chat/profile/Discover actions, failed RPC rollback, delayed send rejected, both rediscover without Matched, fresh empty same-row rematch; old evidence admin-only, including an old message postdated to 2099 |
| Block/report | Either-way block hides chat/feed and denies message writes; browser report appears in admin; samples absent from admin |
| Samples | Emoji-only/no verified badge; sample like creates no match/chat/notification even with a preexisting reciprocal test like; direct sample match insertion denied; hide switch works |
| Seeding/removal | Actual maintenance program run through emulated Admin API twice each; stable 30 IDs, ban reasserted on create and rerun, zero verified samples; real fixtures preserved |
| Cleanup/Storage | Transaction run twice; scoped relationships removed; real user/files preserved; auth deletion deferred; API removes only queued files; final SQL deletes demo auth/profile |
| Layout | Discover at 360/390/768/1280px has no document horizontal overflow; mobile action/nav clearance and native scrolling; hero at 320–1280px and 16/20px text has no clipping/overlap |
| Status/notification transitions | Real disposable PostgreSQL covered new → sent → incoming notification → pass dismissal with retained incoming like → interest/rematch, status precedence and notification RPCs; browser UI covered the grid action contract and responsive/reduced-motion flows |
| Security | All local public app tables have RLS enabled; sample/trust edits, unauthorized match/evidence writes denied; current source/browser bundles searched for service keys/admin passkeys; secret-key prebuild rejection exercised |

The final 32-swipe 4×-CPU photographic **real-account test-fixture** run reported rounded 60 movement FPS and no card drag renders, with 29 estimated missed frames over the whole observation. The separate UI trace measured a 16.7ms 95th-percentile movement-frame interval across 128 samples. These test photographs are not part of the shipped sample dataset. No locked-60-FPS phone claim is made.

All three browser drivers passed against the final build: seven follow-up groups, 21 UI/layout checks and five auth groups. An earlier UI run timed out while injecting an Undo fixture before the last authoritative refresh settled; the driver now waits for that refresh and the final rerun passed. Expected injected unmatch/missing-RPC/stale-send errors are successful negative-path checks.

Artifacts: `/tmp/omnirush/followup-results.json`, `verification-results.json`, `auth-health-results.json`, `sample-seeding-results.json`, Chrome traces, tutorial/hero screenshots, and `health-discover-{360,390,768,1280}.png`. The expected injected unmatch failure, missing-RPC response and stale-send rejection appear in test logs.

### Reproduction commands for disposable tests

Apply `tests/supabase-bootstrap.sql` and migrations 001–011 to fresh disposable databases, build with test-only public configuration, and start on port 3101. Do not run fixture-reset drivers against production. `verify-followups.cjs` requires a database name ending `_tests` and resets its Auth fixtures; run SQL integration suites in a separate disposable database.

```bash
npx tsc --noEmit
npm run lint
npm test
node scripts/verify-followups.cjs
node scripts/verify-ui.cjs
node scripts/verify-auth.cjs
node scripts/verify-sample-seeding.cjs
```

The drivers support `GARBA_TEST_URL`, `GARBA_CHROME_PATH`, `GARBA_PSQL` and `GARBA_TEST_DATABASE` as applicable. This environment needed extracted Chromium/PostgreSQL libraries in `LD_LIBRARY_PATH`.

## What was not verified

- Full live profile/Auth/Storage counts or deployed schema/policy catalog: no service-role credentials.
- Authenticated behaviour against your live Supabase project or hosted deployment: no real account session/deployment logs/host environment access. The public anonymous API smoke checks above are the only live checks.
- Actual email delivery, OAuth provider configuration, real password verification, or GoTrue's hosted ban enforcement. Test auth transport verifies UI/session/error contracts; SQL verifies database email/trust rules; seeding tests inspect Admin API ban requests.
- Actual hosted Storage deletion or upload policies. The cleanup/API sequence was verified with owned-path fixtures and emulated Storage responses, not live files.
- Android/iOS hardware, vibration, mobile browser chrome/safe areas and GPU performance. Layout/gestures were touch-emulated in Chromium.
- A real hosted lazy-chunk outage and tutorial flag-save outage were not fault-injected. Existing timeout/error boundaries remain fail-open.

No live records were seeded/deleted and no live migrations were applied by this check. Run the ordered deployment procedure above to ship the database and data changes. The hosted GoTrue Admin create/sign-in path remains the final live verification because this environment could not start Supabase CLI/Docker.
