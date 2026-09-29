# Deployment checklist

- Add all `.env.example` values to Vercel; never expose service-role keys as `NEXT_PUBLIC_*`.
- Apply migrations and storage policies in Supabase; configure Google OAuth production redirect URLs.
- Set `ALLOWED_EMAIL_DOMAINS=bmsce.ac.in`, disable demo data, and confirm email verification.
- Configure Vercel `NEXT_PUBLIC_SITE_URL`, run typecheck/lint/build, and rotate keys after any exposure.
