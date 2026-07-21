-- Phase 2 kickoff: onboarding tracking on profiles.
-- Mirrors src/models/types.ts Profile.onboardingCompleted/onboardingStep exactly.
-- See models/profileMigration.ts for why local (localStorage) profiles need
-- careful grandfathering logic when this field is introduced — the same
-- concern applies to any existing cloud `profiles` rows: this migration
-- defaults existing rows to onboarding_completed = true, since a row already
-- existing in this table means that user already completed the Phase 1.5
-- migrateLocalToCloud flow (they were already using the app).

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default true,
  add column if not exists onboarding_step text not null default 'complete';

-- New rows going forward should default to NOT completed (the app always
-- passes explicit values on insert via migrateLocalToCloud/saveCloudProfile,
-- but this keeps the column's own default honest for any other insert path).
alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_step set default 'identity';
