# Hero and Discover UI upgrade

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
