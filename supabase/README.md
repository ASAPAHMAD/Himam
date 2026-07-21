# Supabase setup

## 1. Apply the schema
```
supabase db push
```
(or paste `migrations/0001_identity_persistence.sql` into the Supabase SQL editor for a hosted
project). See `ARCHITECTURE.md` §8 for the design rationale.

## 2. Seed shared content (courses/sections/lessons)
```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seedSupabaseContent.ts
```
Run once per environment, after the schema is applied. Safe to re-run (upserts).

## 3. Deploy the delete-account edge function
```
supabase functions deploy delete-account
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Configure the app
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (the anon key — safe to expose
client-side) in `.env`. See `.env.example` at the repo root.

## 5. Enable OAuth providers (optional)
Google/Apple sign-in requires enabling each provider in the Supabase dashboard under
Authentication → Providers, with your own OAuth app credentials. Without this, email/password
auth still works fully — `AuthScreen.tsx` shows a friendly error if a provider isn't enabled.
