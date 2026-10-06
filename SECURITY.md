# Security notes

Supabase RLS is the primary data boundary. Migration 010 replaces legacy app-table policies, derives verification from confirmed college email, protects trust flags, and enforces sample/match/chat restrictions in the database. Clients use explicit profile projections; no sample flags, student identifiers or auth emails are returned with cards. Admin access requires `admin_users` membership.

No local password/session fallback or client admin secret is supported. Service-role credentials belong only in ignored local maintenance environment files, never `NEXT_PUBLIC_*`. A prebuild validator rejects privileged keys in the public anon-key variable. Samples are created by the Admin API and banned from sign-in; their profile likes cannot create matches/chats/notifications.

Real-account photos are compressed/cropped in the browser before upload to their own user-folder path; samples use distinct emoji avatars and upload no files. Live Storage policies still need deployment verification. Legacy demo Storage deletion uses owned-path queues and the Storage API before auth deletion, preserving real users/files. Exact SQL/test/deployment evidence and limits are in `HEALTH_CHECK.md`.
