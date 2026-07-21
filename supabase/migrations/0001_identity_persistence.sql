-- Phase 1.5 — Identity & Persistence Layer
-- See ARCHITECTURE.md §8 for the design rationale (why courses/sections/lessons
-- are shared rather than per-user at this stage, why user_progress carries the
-- per-user ownership boundary, why this is deliberately NOT a sync engine).
--
-- Apply with: supabase db push
-- (or paste into the Supabase SQL editor for a hosted project)

-- ============================================================
-- 1. profiles — one row per authenticated user, mirrors src/models/types.ts Profile
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  country text not null default '',
  timezone text not null default '',
  career_goal text not null default '',
  current_job text not null default '',
  target_job text not null default '',
  current_salary text not null default '',
  target_salary text not null default '',
  certifications text[] not null default '{}',
  working_days text[] not null default '{}',
  vacation_ranges jsonb not null default '[]',   -- [{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }]
  holidays text[] not null default '{}',
  extra_working_days text[] not null default '{}',
  study_windows jsonb not null default '[]',      -- [{ "label": "Morning", "minutes": 45 }]
  learning_style text not null default 'Mixed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);
-- No delete policy: account deletion goes through supabase/functions/delete-account,
-- which uses the service-role key and also removes the auth.users row (cascades here).

-- ============================================================
-- 2. Shared content: courses / sections / lessons
--    NOT per-user. See ARCHITECTURE.md §8.2 for why. Seeded from
--    src/models/migrateLegacy.ts's output, not created by end users (yet —
--    Phase 4 course CRUD will add a user_id column and its own policy here).
-- ============================================================
create table if not exists public.courses (
  id text primary key,
  name text not null,
  mode text not null,           -- 'ai' | 'manual'
  color text not null,
  exam_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.sections (
  id text primary key,
  course_id text not null references public.courses(id) on delete cascade,
  name text not null,
  "order" integer not null default 0
);

create table if not exists public.lessons (
  id text primary key,          -- matches the legacy-derived stable ids exactly (pl300-s0-l0, ...)
  section_id text not null references public.sections(id) on delete cascade,
  title text not null,
  description text not null default '',
  type text not null,           -- LessonType
  duration integer not null,
  difficulty text not null,     -- 'Easy' | 'Medium' | 'Hard'
  scheduled_date date,
  resources jsonb not null default '[]',
  attachments jsonb not null default '[]',
  practice_questions jsonb not null default '[]',
  ai_summary text,
  ai_explanation text
);

alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.lessons enable row level security;

create policy "courses: authenticated read" on public.courses
  for select using (auth.role() = 'authenticated');
create policy "sections: authenticated read" on public.sections
  for select using (auth.role() = 'authenticated');
create policy "lessons: authenticated read" on public.lessons
  for select using (auth.role() = 'authenticated');
-- No insert/update/delete policies for any role but service_role (used only by the
-- seed script) — under RLS, no policy for an operation means no client can do it.

-- ============================================================
-- 3. user_progress — the actual per-user data this phase exists to persist
-- ============================================================
create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started',   -- LessonStatus
  bookmark boolean not null default false,
  difficulty_rating integer,                     -- user's personal 1-3 flag, distinct from lessons.difficulty
  priority text,                                  -- 'Low' | 'Normal' | 'High'
  revision_date date,
  notes text,
  completion_date date,
  completion_time text,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.user_progress enable row level security;

create policy "user_progress: select own" on public.user_progress
  for select using (auth.uid() = user_id);
create policy "user_progress: insert own" on public.user_progress
  for insert with check (auth.uid() = user_id);
create policy "user_progress: update own" on public.user_progress
  for update using (auth.uid() = user_id);
create policy "user_progress: delete own" on public.user_progress
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 4. Avatar storage — referenced by src/components/AccountSettings.tsx
--    (upload path: `${user.id}/avatar.<ext>`)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: owner can upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: owner can update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: owner can delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- ============================================================
-- 5. updated_at bookkeeping
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_progress_set_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();
