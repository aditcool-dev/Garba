# Testing report

See `HEALTH_CHECK.md` for the current detailed results, artifacts, reproduction instructions and limits.

- TypeScript, ESLint and production build passed.
- 27 application tests in 8 files passed, retaining the original email/scoring/feed/swipe tests and adding subscription, defensive-profile/pagination, sample-data, error-boundary and Passed-stack regressions.
- Real local PostgreSQL previously executed migrations 010–012 twice and the cleanup suites. This polish run applied 013 twice and reran status/notification/Vibe/quota, unmatch/RLS/epoch, health/sample/trust/unread/report and Auth Admin ordering checks. The Vibe regression uses actual authenticated SQL calls, including Passed → Vibe and rejecting a fourth persisted same-day Vibe.
- Chromium drove the final production build: **7 mobile-polish groups, 7 follow-up groups, 21 UI checks and 5 auth groups passed**. Coverage includes 40 touch decisions, Undo/Vibe, keyboard, reduced motion/failed-write rollback, native vertical scrolling, rematching and all four Unmatch entry points. Driver expectations were updated for menus, confirmation dialogs, in-flow actions and asynchronous authoritative status refresh. Injected unmatch/missing-feed/stale-send failures are expected negative checks.
- The actual seed/removal script ran twice through emulated Auth Admin/Storage transport backed by PostgreSQL, preserving real fixtures; the emulator models GoTrue's insert-then-app_metadata-update ordering and verifies all 30 remain banned.

Supabase Auth/Realtime/Storage HTTP transport was emulated for authenticated tests; this is not a claim of authenticated live-project verification, actual email delivery or physical-phone performance. A limited read-only anonymous smoke check reached the previously configured live project's public APIs. Untracked copied `.kilo` tests are excluded from application test discovery.

## Mobile polish artifacts and reproduction

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
