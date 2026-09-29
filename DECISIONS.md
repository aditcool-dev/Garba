# GarbaMate decisions

## Initial assumptions

- The app uses a current stable Next.js App Router setup with the project package versions pinned in `package.json`.
- Supabase environment variables are optional for the local UI shell so the app can render and run unit tests without credentials; authenticated/data operations fail closed with a friendly message until configured.
- The default festival configuration is a placeholder Navratri start date and 9 nights, isolated in `config/festival.ts` so it can be changed without editing components.
- Email prefix suggestions recognize `cs`, `is`, `ec`, `ee`, `me`, `cv`, `ai`, and `ad`; unknown codes remain blank. `cs` maps to CSE, `is` to ISE, `ec` to ECE, `ee` to EEE, `me` to ME, `cv` to CV, `ai` to AI&ML, and `ad` to AI&DS.
- Academic year prefill treats an admission year as first year in that academic cycle and derives a 1st–4th year suggestion relative to the current academic year; users may always change it.
- Demo data is disabled by default and is available only through explicit seed commands and an environment flag.
- The initial MVP uses server actions and typed Supabase queries rather than a separate API service. Realtime subscriptions are added in the chat phase.
- Where live Supabase credentials or OAuth providers are unavailable in this workspace, the implementation will include migrations, tests, and clear setup instructions rather than claiming external verification.
