# Deployment checklist

- **Search/receipt release:** run the entire SQL in `supabase/migrations/014_message_receipts.sql` after migrations 001–013, then deploy/rebuild the frontend. It is idempotent, requires no reseeding, and preserves prior message epochs. The new frontend requires the delivered column, receipt preference, receipt/unread RPCs and idempotent send RPC, so SQL must come first.

- Follow the ordered audit/cleanup/010–013 repair/seeding steps in `HEALTH_CHECK.md` before releasing this frontend. If 010–012 are already applied, this polish requires only `supabase/migrations/013_qualify_vibe_quota.sql` for the existing Vibe SQL ambiguity; no reseeding is needed.
- Configure `NEXT_PUBLIC_SUPABASE_URL`, the public anon/publishable key, and `NEXT_PUBLIC_SITE_URL` on the build host. Rebuild after changing public variables.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the local maintenance process's ignored `.env.samples`; it is not required by the frontend host. The prebuild validator rejects privileged keys in the public anon-key variable.
- Configure Supabase's Auth site/callback URLs and confirmed exact `@bmsce.ac.in` accounts. Assign verified college admins through `admin_users`, not a client passkey.
- `SHOW_SAMPLE_PROFILES` is an authoritative database setting. Samples may be visible but cannot match/chat/notify or count as real admin accounts. The one-line hide switch and removal command are in `HEALTH_CHECK.md`.
- Run typecheck, lint, unit tests and production build. Live email/OAuth, Storage policies and physical-device QA remain deployment checks; local SQL/browser evidence is listed precisely in `HEALTH_CHECK.md`.
