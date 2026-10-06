# Deployment checklist

- Follow the ordered audit/cleanup/010 repair/seeding steps in `HEALTH_CHECK.md` before releasing this frontend.
- Configure `NEXT_PUBLIC_SUPABASE_URL`, the public anon/publishable key, and `NEXT_PUBLIC_SITE_URL` on the build host. Rebuild after changing public variables.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the local maintenance process's ignored `.env.samples`; it is not required by the frontend host. The prebuild validator rejects privileged keys in the public anon-key variable.
- Configure Supabase's Auth site/callback URLs and confirmed exact `@bmsce.ac.in` accounts. Assign verified college admins through `admin_users`, not a client passkey.
- `SHOW_SAMPLE_PROFILES` is an authoritative database setting. Samples may be visible but cannot match/chat/notify or count as real admin accounts. The one-line hide switch and removal command are in `HEALTH_CHECK.md`.
- Run typecheck, lint, unit tests and production build. Live email/OAuth, Storage policies and physical-device QA remain deployment checks; local SQL/browser evidence is listed precisely in `HEALTH_CHECK.md`.
