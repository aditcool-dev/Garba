# Hero and Discover UI upgrade (initial pass)

These initial-pass notes are retained as history. The follow-up section below documents the current implementation and latest verification.

## Scope and assumptions

- Application data, authentication, routes, schema/RLS, compatibility scoring, filters, matching rules, and the existing three-Vibe quota are retained. The quota is the existing in-session counter; this UI change does not introduce a new daily quota service.
- “Large” browser text is tested with Chromium's default font size set to **20px**, in addition to the normal 16px. The hero uses container-relative card typography to keep its illustrative preview inside the fixed-aspect-ratio fan.
- Buttons, keyboard shortcuts, details-sheet interest, and gestures use the same imperative `flyOff` handle. A release projects offset by 0.2 seconds of velocity against a 120px threshold. No direction state or removal-driven exit animation is used.
- Vertical scrolling and unrestricted upward touch dragging cannot both own the same touch region. The card uses `pan-y`; a small top grip uses `touch-action: none` for a finger-following upward Vibe drag. Desktop upward dragging, an upward flick at a stationary page-scroll boundary, the Vibe button, and Arrow Up also work. Native vertical page scrolling elsewhere on the card does not send a Vibe.
- Undo covers the latest pass for approximately four seconds. It waits for that pass to finish, restores only that user-pair's changed rows/cache entries, and re-inserts the card from the left. Per-profile mutation promises serialize Undo with subsequent decisions; unrelated decisions are retained.
- Snapshot read failures never block the existing Pass/local-fallback operation. Undo reports an error when a remote UUID pair's pre-pass state could not be captured. Non-UUID local/demo pairs reverse local storage only, matching the existing tables' UUID contract.

## Root causes and fixes

### Landing fan

The old cards combined `min(74vw, 250px)` sizing, ±42% card translations, ±13° rotations, and a fixed-height wrapper. The transformed bounds extended outside the wrapper and were clipped by the page's overflow rules.

The wrapper is now centered with `width: min(100%, 22rem)`, a 3/4 aspect ratio, relative positioning, and inline-size containment. Cards occupy 72% of its width and 76% of its height; offsets, padding, radii, and illustrative content use percentages/container units. Side translations are ±12% of card width (about ±9% of wrapper width) with ±6° rotation. The hero section owns `overflow-x: clip`. The complete transformed fan stays within at least 16px screen padding, including at 320px.

### Discover direction and performance

The old code advanced the index after a mutation and changed `swipeDirection` separately. Although `AnimatePresence` received `custom`, its exit was a plain object reading the old direction, rather than a custom-aware variant. It also reused a parent-level x value and spring-animated removal at a fixed 420px exit distance. This allowed stale direction and overlapping drag/exit control.

Each keyed, memoized `SwipeCard` now owns x/y motion values and its own busy ref. Release direction directly determines the target: ±(viewport width + 200) for Pass/Interested, or -(viewport height + 200) for Vibe. The 0.22-second flight completes before the parent advances and calls the existing mutation. The busy guard also prevents a second pointer drag from interrupting an active flight. Rejected operations restore the optimistic UI.

Rotation, stamp/tint opacity, the Vibe burst, and next-card scale use motion values/transforms. Only transform and opacity animate. Moving cards have no backdrop/filter blur, layout animation, or animated shadow; glow shadows are static layers whose opacity changes. At most three profile cards mount, with transform `will-change` on the top card. Images use unoptimized `next/image` to retain the existing arbitrary URL contract, async decoding, top-card priority, and decoded preloading for the next three image sources.

Card callback props are stable, with the latest quota/mutation callbacks read through refs. Stress testing caught an intermittent parent toast/mutation update recreating callbacks during the next drag; stabilizing those props prevents memoized card renders even when unrelated parent state updates during a gesture. Verification also deliberately clears a toast during a drag.

Framer Motion injects `touch-action: none` for two-axis drag even when the style specifies `pan-y`. A scoped CSS override preserves `pan-y` on the card; only the Vibe grip opts out.

All nine nights now fit a nine-column row without horizontal overflow. The illustrated initial is translucent and in the upper avatar area, away from name/age; the avatar label is removed. Mobile action controls sit above navigation and safe-area insets; card sizing uses `dvh`. Reduced motion uses a 0.12-second fade and omits rotation, tint, burst, and the button pulse.

## Verification actually run

Production build tested in headless Chromium with Playwright/CDP. `scripts/verify-ui.cjs` seeds only isolated browser-context fixtures and intercepts Supabase HTTP/WebSocket traffic; it does not write to the live service.

- **Hero:** 320, 360, 390, 412, 430, 768, and 1280px, at both 16px and 20px browser default fonts. Asserted document width equals viewport width, every transformed card has at least 16px side clearance, cards stay in the stack's reserved height, and the mobile headline does not overlap. All passed.
- **Gestures:** 20 touch-emulated left passes and 20 right interests. Asserted flight direction, matching local persistence (and remote-fixture mutation for UUID profiles), and at most three mounted cards. Below-threshold release springs back. All passed.
- **Actions:** Pass/Interested/Vibe button flights, rapid triple Pass clicks, upward touch Vibe from the grip, three-Vibe quota, Undo reinsertion and mutation reversal, reciprocal match popup/chat URL, and rejected-operation rollback. Passed against fixtures.
- **Layout:** native vertical touch scrolling starting inside the card, mobile controls clear of the bottom nav, and all nine card/sidebar nights without scrolling. Passed. Desktop/mobile screenshots inspected.
- **React renders:** injected a React DevTools fiber-commit hook, first asserted that it observed mounted card components, then asserted no additional card render work throughout each touch drag. Passed. This is automated DevTools-hook verification, not an interactive React Profiler recording.
- **Performance:** recorded a Chrome DevTools-compatible timeline at **4× CPU throttling**. Final verification measured approximately **59fps**, with a 95th-percentile frame interval of **16.8ms** across **215 active-drag samples**. The trace also includes setup and spring-back; frame statistics cover finger movement only. Earlier whole-interaction samples ranged from 49–56fps when including scrolling/setup work. No card re-renders during the drag. This is not a claim of locked 60fps on a physical phone.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: passed, 24 tests discovered (including the repository's existing copied worktree tests); includes two new gesture-projection regression tests.

Artifacts: `/tmp/omnirush/verification-results.json`, `swipe-4x-trace.json`, `hero-16.png`, `hero-20.png`, `discover-mobile.png`, and `discover-desktop.png`.

To reproduce with Playwright Chromium installed, start the built app on port 3100, then run `node scripts/verify-ui.cjs`. `GARBA_TEST_URL`, `GARBA_CHROME_PATH`, and `GARBA_ARTIFACTS` override the server, executable, and output directory. This environment required locally extracted browser shared libraries via `LD_LIBRARY_PATH`; system dependencies could not be installed with sudo.

## Limits requiring existing backend support or physical devices

- No physical phone, browser chrome/safe-area hardware, or actual vibration was available. Native scrolling and gestures were checked using touch emulation. The environment's missing emoji fonts limit visual inspection of emoji glyphs.
- No authenticated live Supabase session was used. Like/pass/match/Undo were exercised end to end in the browser with mocked backend responses and real local storage.
- Existing `db.likeProfile`/`db.passProfile` suppress remote errors and fall back to local persistence. UI rollback handles errors that propagate; it cannot detect failures intentionally suppressed by that unchanged data layer.
- **Incoming-like Undo limitation:** `passProfile` deletes likes in both directions. Migration 007 permits either participant to delete a like but permits only its sender to insert it. Undo can restore plain passes and prior outgoing likes, but cannot fully recreate a deleted remote incoming like under those policies. The helper attempts restoration and reports errors before deleting the pass or restoring the local card. Complete incoming-interest reversal requires a backend-supported atomic undo operation/policy change, outside the requested UI-only scope. No such schema/auth change was made.
- Remote Undo uses the existing table operations, not a new atomic RPC. Cross-device concurrent writes and partial service failures cannot be made transactional by this UI adapter.

---

# Follow-ups: mobile cost, randomized feed, unmatch, and tutorial

## Remaining lag: what inspection found

The previous direction fix was correct, but the card still had avoidable mobile raster/compositing work:

1. `next/image` was explicitly unoptimized and its preload fetched the original, allowing large downloads and decoded textures.
2. Illustrated cards painted a full-card radial dot pattern, a large blurred ring shadow, a large outer shadow, and multiple overlay gradients.
3. Discover's Vibe button continuously pulsed; notification/nav badges also animated elsewhere in the shell.
4. The fixed bottom nav's `backdrop-filter` sampled moving content underneath, despite blur having been removed from the moving card itself. Desktop panel/notification blur was also unnecessary on Discover.
5. Motion's two-axis recognizer/value pipeline scheduled top-card transforms as well as stamp and stack transforms. The prior CPU-only lab result did not demonstrate the cost on an actual mobile GPU.

These are confirmed code-level costs, not a claim that any single one was measured as the physical phone's definitive bottleneck. No physical phone was available.

### Changes

- Removed dots, large moving-card/ring/glow shadows and the redundant overlay. The card has one static readability gradient; teal/rose edges and stamps use opacity, with compositor hints for opacity layers.
- Disabled ambient CSS animation and background/nav blur on Discover. Root `data-dragging` pauses remaining animation during movement; `data-tutorial` pauses it during the tutorial. Landing styling is retained.
- Top-card layer has `contain: layout paint style`, backface hiding, top-only transform `will-change`, and `translate3d`.
- Used the lightweight pointer-capture/rAF path, keeping `pan-y` native scrolling and the dedicated Vibe grip. No state update or geometry/layout read occurs in pointer movement. WAAPI flies/fades/settles the card; Framer Motion scales the next layer. All actions share the same imperative handle and busy guard.
- Feedback and Undo expiry timers now belong to their own components. Stable card callbacks and deferred/ref-preserving feed updates keep timer/network work from re-rendering a dragged card.
- Added `/discover?debug=fps`: a tiny opt-in overlay, DOM-updated without React renders. It shows current FPS and estimated dropped 60Hz frames; its data attributes expose accumulated moving-card FPS for automated checks.
- Configured bounded responsive optimizer widths and WebP/AVIF. Known photo origins, including Supabase Storage, are optimized; unknown legacy origins/data/blob URLs remain compatible. Next two selected optimized image resources are preloaded with high fetch priority and `decode()`. Promotion waits on the next resource's decode promise. A slow image response can delay promotion after the outgoing card leaves; dragging itself never waits for image decoding.
- A production optimizer request was actually checked: a 1600px source returned an **800×1000 WebP, 18,496 bytes**. Full production browser verification also uses photographic cards and DPR 2, rather than illustrated cards alone.

## Feed session design

The old `shuffleArray` helper was never used: the feed came from profile/database insertion order. Candidate exclusion now happens authoritatively in `discover_feed`, including self, incomplete/hidden/suspended/banned profiles, either-way blocks, sent likes, passes, active matches, and mutual gender preferences.

Server scores use the same compatibility inputs/formula. A per-ID seeded uniform variate supplies `-ln(u)/weight`, with `weight=.35+score/100`, salted by the current authenticated user. The seed is memory-only, regenerated on full load/Shuffle, and travels with each keyset-paginated request. The candidate snapshot is materialized in the existing client architecture; no new route or auth flow was added. One in eight slots mixes lower-third candidates, deterministically and without duplication. Surviving order is frozen through refetch; newly available unmatched profiles enter at a random remaining position. Consumed IDs replace mutable list indices, avoiding skipped cards when exclusions remove earlier rows.

Existing explicit Matches/Passed views remain available, while All is an eligible-candidate feed. Matched state comes from the shared active-match cache, and matched cards offer Unmatch instead of swipe decisions.

## Unmatch consistency and security

`RelationshipsProvider` replaces independent match-state lists on each page. Its active-only cache drives all match marks, lists and counts, with optimistic removal/rollback, Supabase `postgres_changes` subscriptions for both pair positions, cross-tab/local events, and focus refetch. Notification and nav-interest counts refresh with the relationship revision. Remote empty results no longer merge stale local matches back in.

Unmatch controls appear on Matches conversation items and New matches cards, chat header menus (alongside Report/Block), profiles, and Discover's matched view. Confirmation is hosted globally so it survives optimistic list-item removal and can show rollback errors. The other participant gets only “This match is no longer active.”

Migration 008 adds unmatch metadata, tutorial state, and a fresh-chat epoch. `unmatch_user` validates the participant, locks the pair/row, marks it unmatched, and deletes both directions of likes/passes in one transaction. Duplicate participant calls are safe. `like_user` requires fresh mutual likes and reactivates the same canonical row with a new epoch. Direct participant match writes are removed to prevent bypassing that logic.

Messages are retained for evidence. SELECT/INSERT RLS requires an active, unblocked pair and the current chat epoch. An insert trigger locks the match and rejects stale-generation sends, including an old client that arrives after a re-match. UI message queries filter by the epoch and never fall back to old remote-chat cache messages. An open unmatched chat immediately renders “This chat is no longer available.” Admins can review a reported pair's retained evidence through a narrow RPC and report-queue control.

Final review reproduced a block-policy edge case: a direct `blocks` subquery in message RLS could not see a block created by the other participant. Both message policies now use the owner-scoped, security-definer exclusion helper. SQL regression checks keep the match active deliberately and confirm that neither participant can read the blocked chat. Non-admin evidence access is also rejected.

## Tutorial

The nine-step component is dynamically imported only when needed; both render errors and failed lazy chunks have fail-open boundaries. Copy/fake profile data live in `config/discover-tutorial.ts`. The fake Demo Dancer is rendered with the real profile/swipe components but uses local reset callbacks, with no mutation or quota access.

Automatic display requires completed onboarding and a false database flag; display waits for a settled card and no match celebration. Skip/finish persists through `mark_discover_tutorial_seen`, using `auth.uid()` only. A save failure closes the sheet without trapping the user and allows another visit to retry. The header `?` and Settings link replay it. The Settings query is consumed so refreshing does not request another replay.

The sheet has a focus trap, dialog labels, step dots, Back/Next/Skip, arrows/Enter/Esc, horizontal sheet navigation, optional local practice, safe-area padding, and reduced-motion illustrations/fades. Small-card typography is scoped so the decorative initial never overlaps the fake dancer's name. The primary tutorial CTA uses dark text on solid gold rather than low-contrast white on a gold gradient.

Final browser checks caught two timing bugs. Match celebrations no longer close just because their newly created row has not reached the active-match cache yet; an explicit inactive-match event closes them on unmatch. The automatic tutorial's settled-card listener rechecks the session's shown flag, so practice-card cleanup cannot reopen a tutorial that was just skipped. Escape also works while the lazy chunk is loading, and an eight-second loading timeout fails open.

## Verification and deployment

- New unit coverage: reproducible/different seeds, database-order independence, higher-score average priority over 1,000 runs, lower-third exploration, duplicate-free pages, exclusions/mutual preferences, and authoritative UUID-mode selection.
- `tests/unmatch.integration.sql` executes real PostgreSQL RPC/RLS checks, including cleared decisions, status/metadata, hidden old messages, unauthorized/duplicate calls, fresh same-row re-match, stale sends, either-way blocks, tutorial persistence, and retained admin evidence.
- `scripts/verify-followups.cjs` drives the production app with two accounts against those real SQL functions. Supabase transport is emulated; it tests ten refreshes/pagination seeds, Shuffle, Unmatch from Matches/chat/profile/Discover, live removal in B's chat, both users' rediscovery, fresh chat, failure rollback/in-flight sends, tutorial isolation/persistence/accessibility, and 32 throttled photographic swipes with stable surviving order and the FPS meter.
- `scripts/verify-ui.cjs` is adapted to the new feed/RPC contract and retains the earlier hero geometry, gesture direction, Undo, scroll and reduced-motion regressions.
- Artifacts are under `/tmp/omnirush`: `followup-results.json`, `followup-swipe-4x-trace.json`, and tutorial screenshots at 360/390/768/1280px, plus the earlier suite's refreshed `verification-results.json` and `swipe-4x-trace.json`.

### Final results — October 5, 2026

| Check | Result |
| --- | --- |
| TypeScript, ESLint, production build | Passed |
| Vitest | 29 tests in 6 files passed; includes the existing copied worktree tests |
| PostgreSQL integration | Passed: participant authorization, duplicate unmatch, both-direction decision clearing, rediscovery, fresh same-row rematch, hidden old messages, rejected stale sends, either-way blocks, tutorial flag, non-admin denial and retained admin evidence |
| Production follow-up browser suite | All four groups passed: ten independent refresh orders/pagination, Shuffle/two accounts; realtime unmatch from all four entry points/rollback/in-flight send/rematch; tutorial isolation/accessibility/persistence/replay; photographic touch swipes with stable surviving order |
| Photographic performance run | 32 distinct touch swipes, mobile DPR 2, 4× CPU; no card render work during drag; meter reported 60 FPS and 60 accumulated movement FPS (rounded) |
| Full-run dropped-frame estimate | 12 estimated missed 60Hz frames over the meter's whole observation, including setup, network work and transitions; not a claim of zero dropped frames |
| Original UI regression suite | Passed all 14 hero width/font combinations, 20 passes + 20 interests, flight direction, rapid taps, Undo, Vibe/quota, vertical scroll, nav clearance, nine-night rows, reciprocal chat target and failure rollback |
| Original suite's active-drag trace | Approximately 60 FPS, 95th-percentile frame interval 16.7ms, 130 samples at 4× CPU |

The follow-up browser suite executes real SQL through emulated Supabase HTTP/Phoenix transport. Its injected unmatch failure and rejected delayed send are expected negative checks. Tutorial screenshots were inspected, including the 360px layout. A failed flag save and actual lazy-chunk outage were implemented as fail-open paths but were not fault-injected in this suite.

To reproduce the follow-ups, apply `tests/supabase-bootstrap.sql` and migrations 001–009 to a **disposable** local PostgreSQL database named `garba_tests`, build/start the app on port 3100, and run `node scripts/verify-followups.cjs`. The script resets that database's fixtures. `GARBA_PSQL`, `GARBA_PGHOST`, `GARBA_PGPORT`, `GARBA_TEST_DATABASE`, `GARBA_TEST_URL`, `GARBA_CHROME_PATH`, and `GARBA_ARTIFACTS` override the environment. Run `tests/unmatch.integration.sql` separately in an empty disposable migrated database; its fixture IDs overlap the browser fixtures.

**Deployment:** apply migration 008, then 009, with the UI release. The repository changes do not automatically apply migrations to the live service. No deployed credentials/session, live Realtime service, or real phone was available; local SQL execution and an emulated Phoenix transport must not be mistaken for production-service verification.
