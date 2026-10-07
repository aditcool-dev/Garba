# Testing report

## Current tutorial layout repair

- TypeScript, ESLint, production build and all **35 tests in 10 files** pass. The broader `verify-mobile-polish.cjs` suite passes all seven groups, including notifications/filters/action sheets and live Unmatch/Block, after the reusable sheet extension.
- `scripts/verify-tutorial-layout.cjs` passes all nine steps at **360×800, 390×844, 412×915, 768×1024, 1280×800**, plus all nine at **360×640** with reduced motion. Five normal viewport groups include three actual practice states/actions, animated-motion sampling and expanded details. The sixth group verifies short-height scroll fallback, Finish and practice isolation. Header, body and footer bounds never overlap; the instruction is not sticky. Complete card/metadata/nights and visible practice/navigation controls fit at the five standard sizes. Navigation stays within the viewport even at the short stress size; no document/dialog/demo horizontal overflow is present.
- Focus trapping, dropdown arrow behavior, Escape and final Start discovering are exercised. Fixture relationship counts and recorded API requests verify zero tutorial decision/message writes. Browser Auth/HTTP/Phoenix transport is emulated over disposable PostgreSQL. Native phone/browser-chrome/Safari/safe-area behavior is not verified.
- Screenshots and results are at **`/tmp/omnirush/tutorial-layout/`** (`GARBA_TUTORIAL_ARTIFACTS` overrides it). For each standard viewport: `WIDTHxHEIGHT-step-1.png` through `step-9.png`, matching `-dialog.png` crops and an **`WIDTHxHEIGHT-all-steps.png`** contact sheet. Practice and details states have separate PNGs; 360×640 has all nine short-height images. All five contact sheets were visually reviewed. `results.json` records six passing groups.

Use the same disposable database/production-build setup documented below, then run:

```bash
GARBA_TEST_URL=http://127.0.0.1:3101 \
GARBA_CHROME_PATH=/path/to/chromium \
GARBA_PSQL=/path/to/psql \
GARBA_TEST_DATABASE=garba_tests \
node scripts/verify-tutorial-layout.cjs
```

The driver resets its `_tests` database. Run it sequentially with other SQL-backed reset drivers sharing that database. Screenshot contacts use Sharp from the existing Next.js dependency tree. This tutorial repair needs a frontend deployment only; no database migration is required. Older sections record prior releases.

## Current search/receipt release

- `tsc --noEmit`, lint, production build and **35 tests in 10 files pass**, retaining all existing tests. New ranking tests cover requested names, exact words, compatibility, stable alphabetic ties, mixed case/diacritics and branch/style/bio matches without identifier/email matches. Status tests cover all tick states, opt-out, retry, monotonic late-response merging and >=4.5:1 cyan/grey contrast on the outgoing gradient.
- Migration `014_message_receipts.sql` ran twice successfully in both disposable SQL/browser databases. `tests/message-receipts.integration.sql` passes real authenticated SQL for recipient-only/idempotent delivered/read acknowledgement, server-side opt-out, private unread clearing, direct-body/status-edit and forged receipt INSERT denial, outsider denial, exact epoch filtering (including an old message postdated to 2099 and denial of legacy null-epoch UUID reuse), quiet blocked/unmatched calls and duplicate-free UUID retry. Existing unmatch, health/sample/trust/unread/report, Auth Admin-ordering and status/Vibe/quota suites also pass.
- The final production build passes **5 dedicated search/receipt groups, 7 mobile-polish groups, 7 follow-up groups, 21 UI/layout checks and 5 auth groups**. The dedicated suite uses two confirmed, non-sample local college fixtures A/B through emulated Supabase Auth/HTTP/Phoenix. It disables three-second message polling to verify live UPDATE-driven ticks. B starts with no app context, then opens Discover (delivered), then visible Chat (read); stored reload and own-preview ticks also pass. Settings opt-out suppresses new read timestamps and B's own blue ticks while clearing B's own unread badge. Hidden/offscreen gating and both pre-save failure and committed-send/lost-ack retry pass without duplicates.
- Search browser verification uses mixed statuses, requested names plus 32 additional prefixes: best 30 first, Load more, stable status-independent relevance, normalized query, exact empty copy and rapid input cancellation. The broader four-viewport suite continues to pass; its unmatched search expectation now correctly retains a searchable New tile while removing its Chat action.
- Expected injected send/unmatch/missing-feed/stale-generation errors are successful negative-path checks. The initial follow-up run exceeded a four-minute harness timeout; the completed run used a longer timeout. Initial UI-driver runs exposed pre-existing fixture/scroll timing assumptions; reloading before the injected prior-like snapshot, waiting for flight settlement and explicitly scrolling above the fixed nav resolve those checks without weakening the assertions.

### SQL and browser reproduction

On fresh disposable `_tests` databases apply `tests/supabase-bootstrap.sql`, then migrations **001–014**. Run SQL suites in a separate database from browser-reset drivers. Build with fixture-only public environment variables and start the production server at port 3101.

```bash
# Real SQL checks (local/disposable database, never a live project):
psql -v ON_ERROR_STOP=1 -d garba_receipt_tests -f tests/message-receipts.integration.sql

# Production-browser verification; transport emulated, SQL real:
GARBA_TEST_URL=http://127.0.0.1:3101 \
GARBA_CHROME_PATH=/path/to/chromium \
GARBA_PSQL=/path/to/psql \
GARBA_TEST_DATABASE=garba_tests \
node scripts/verify-search-receipts.cjs
```

New artifacts: `/tmp/omnirush/search-receipts/results.json` and `sent.png`, `delivered.png`, `read.png`, `chat-list-read.png`, `settings-off.png`, `read-receipts-off.png`, `failed-retry.png`, `search-best-30.png`. Configure `GARBA_RECEIPT_ARTIFACTS` for another output directory. Old `failure.png` files are debugging artifacts, not final success evidence. Run this and the other SQL-backed reset drivers sequentially if they share a database.

No hosted migration, production account operation, hosted Realtime delivery or physical-device/native Safari test was performed. Local Auth/Phoenix HTTP is emulated; PostgreSQL authorization, triggers, RPCs and RLS are real. Older sections below retain earlier release history and its test counts/performance observations.

See `HEALTH_CHECK.md` for the current detailed results, artifacts, reproduction instructions and limits.

- TypeScript, ESLint and production build passed.
- 27 application tests in 8 files passed, retaining the original email/scoring/feed/swipe tests and adding subscription, defensive-profile/pagination, sample-data, error-boundary and Passed-stack regressions.
- Real local PostgreSQL previously executed migrations 010–012 twice and the cleanup suites. This polish run applied 013 twice and reran status/notification/Vibe/quota, unmatch/RLS/epoch, health/sample/trust/unread/report and Auth Admin ordering checks. The Vibe regression uses actual authenticated SQL calls, including Passed → Vibe and rejecting a fourth persisted same-day Vibe.
- Chromium drove the final production build: **7 mobile-polish groups, 7 follow-up groups, 21 UI checks and 5 auth groups passed**. Coverage includes 40 touch decisions, Undo/Vibe, keyboard, reduced motion/failed-write rollback, native vertical scrolling, rematching and all four Unmatch entry points. Driver expectations were updated for menus, confirmation dialogs, in-flow actions and asynchronous authoritative status refresh. Injected unmatch/missing-feed/stale-send failures are expected negative checks.
- The actual seed/removal script ran twice through emulated Auth Admin/Storage transport backed by PostgreSQL, preserving real fixtures; the emulator models GoTrue's insert-then-app_metadata-update ordering and verifies all 30 remain banned.

Supabase Auth/Realtime/Storage HTTP transport was emulated for authenticated tests; this is not a claim of authenticated live-project verification, actual email delivery or physical-phone performance. A limited read-only anonymous smoke check reached the previously configured live project's public APIs. Untracked copied `.kilo` tests are excluded from application test discovery.

## Prior mobile polish artifacts and reproduction

`scripts/verify-mobile-polish.cjs` resets a disposable database whose name must end `_tests`. Apply `tests/supabase-bootstrap.sql` and migrations **001–013** to a fresh database; use a separate disposable database for SQL integration suites. Never point fixture-reset drivers at a live project. Build with test-only public Supabase configuration and run `next start -p 3101` before the browser drivers.

```bash
GARBA_TEST_URL=http://127.0.0.1:3101 \
GARBA_CHROME_PATH=/path/to/chromium \
GARBA_PSQL=/path/to/psql \
GARBA_TEST_DATABASE=garba_tests \
node scripts/verify-mobile-polish.cjs
```

Screenshots/results: **`/tmp/omnirush/mobile-polish/`**, configurable with `GARBA_POLISH_ARTIFACTS`. Each of `360x740`, `390x844`, `768x1024`, `1280x800` has PNGs with suffixes:

`explore`, `sent`, `matched`, `passed`, `actions`, `search`, `notifications`, `explore-empty`, `matches-page`, `chats`, `chat-header`, `profile`, `settings`, `admin`, `filters`, `guide`, `guide-last`.

The driver also captures `360-report-form.png`; `results.json` is the current pass/fail report. Earlier debugging images named `failure.png` are not final success screenshots. Test portraits are generated fixture SVGs, separate from the shipped emoji-only samples.

Assertions cover no document/dialog horizontal overflow, fitted header/tabs/placeholder, 99+ badges, the long name `Shreyas A Chowdary Venkata Subramaniam`, two tile action controls with >=44px targets and edge clearance, >=48px menu rows, empty-state nav clearance, search across every status without UUID/email search, and a New matches carousel excluding conversations with messages. Action checks execute real SQL via emulated HTTP/Phoenix: Vibe → Sent → Pass → Passed → Interested → Sent; report reason/details persistence; confirmation before Unmatch/Block; removal of tiles/chats and live partner-chat closure; View profile navigation.

The final UI trace measured rounded 60 FPS, 16.7ms p95 movement-frame interval across 133 samples at 4× CPU. The separate SQL-backed 32-swipe follow-up run reported 60 drag FPS, 58 overall FPS and 50 estimated missed frames over its whole observation. These are desktop Chromium measurements, not physical-phone performance guarantees. Native iOS/Safari safe-area/browser-chrome behavior remains unverified.
