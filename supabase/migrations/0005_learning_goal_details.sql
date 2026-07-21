-- Milestone 2.4 — Profile Synchronization.
--
-- Adds cloud persistence for `Profile.learningGoalDetails`, which
-- `models/cloudPersistence.ts` has explicitly marked "local-only for now"
-- since Phase 1.5. Per CLOUD_SYNC_PROPOSAL.md §2.2: "per-goal metadata...
-- genuinely fine as a jsonb blob; it's denormalized per-user config, not
-- shared/owned content with its own identity lifecycle" — unlike
-- courses/sections/lessons (Option B, first-class rows), this one column
-- addition is the right level of complexity for what it stores.
--
-- Purely additive, zero-downtime: existing rows get the column's default
-- ('{}'), and nothing reads or writes it until Milestone 2.6 (Application
-- Integration) wires the profile-sync path into the app.
--
-- Apply with: supabase db push

alter table public.profiles
  add column if not exists learning_goal_details jsonb not null default '{}';
