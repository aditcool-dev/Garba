# Testing report

See `HEALTH_CHECK.md` for the current detailed results, artifacts, reproduction instructions and limits.

- TypeScript, ESLint and production build passed.
- 27 application tests in 8 files passed, retaining the original email/scoring/feed/swipe tests and adding subscription, defensive-profile/pagination, sample-data, error-boundary and Passed-stack regressions.
- Real local PostgreSQL executed migrations 010–012 twice and all unmatch, health/sample/trust/unread/report, authoritative-status transition, notification-removal, Auth Admin ordering and scoped-cleanup integration checks, including hiding a postdated old message after rematch.
- Chromium drove the final production build: the responsive UI suite passed all hero/layout, 40-decision, Undo/Vibe, keyboard, reduced-motion, reciprocal-match and 4× CPU checks; auth checks passed. The older follow-up driver was updated for the grid/search contract and still has one legacy multi-entry unmatch assertion to rerun after the final driver adaptation.
- The actual seed/removal script ran twice through emulated Auth Admin/Storage transport backed by PostgreSQL, preserving real fixtures; the emulator models GoTrue's insert-then-app_metadata-update ordering and verifies all 30 remain banned.

Supabase Auth/Realtime/Storage HTTP transport was emulated for authenticated tests; this is not a claim of authenticated live-project verification, actual email delivery or physical-phone performance. A limited read-only anonymous smoke check reached the previously configured live project's public APIs. Untracked copied `.kilo` tests are excluded from application test discovery.
