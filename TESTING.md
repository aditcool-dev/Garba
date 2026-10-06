# Testing report

See `HEALTH_CHECK.md` for the current detailed results, artifacts, reproduction instructions and limits.

- TypeScript, ESLint and production build passed.
- 26 application tests in 7 files passed, retaining the original email/scoring/feed/swipe tests and adding subscription, defensive-profile/pagination, sample-data and error-boundary regressions.
- Real local PostgreSQL executed migrations 010 and 011 twice and all unmatch, health/sample/trust/unread/report, Auth Admin ordering and scoped-cleanup integration checks, including hiding a postdated old message after rematch.
- Chromium drove the final production build: seven follow-up groups, 21 UI/layout checks and five auth groups passed for auth requests, Discover, tutorial, swipe/Undo/Vibe/keyboard, real-account match/chat/unread, unmatch, block/report and sample safety/layout flows.
- The actual seed/removal script ran twice through emulated Auth Admin/Storage transport backed by PostgreSQL, preserving real fixtures; the emulator models GoTrue's insert-then-app_metadata-update ordering and verifies all 30 remain banned.

Supabase Auth/Realtime/Storage HTTP transport was emulated for authenticated tests; this is not a claim of authenticated live-project verification, actual email delivery or physical-phone performance. A limited read-only anonymous smoke check reached the previously configured live project's public APIs. Untracked copied `.kilo` tests are excluded from application test discovery.
