# Security notes

Supabase RLS is the primary data boundary; server actions must still validate with Zod and re-check admin status. Public profile data should use safe display columns only. Photos are scoped to user folders, limited to jpeg/png/webp and 5 MB, and should be EXIF-stripped before upload. Report/block flows are privacy-sensitive. Rotate Supabase keys and OAuth secrets if exposed. The migration includes explicit policies and an atomic matching function; run authenticated RLS tests against a real project before launch.
