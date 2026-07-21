-- Forward-compatibility pass, approved before finalizing v0.3.0.
-- See ARCHITECTURE.md §8.2 (updated) for the full rationale.
--
-- Goal: shared platform content stays the default (unchanged), while the
-- schema is now ready for user-created/AI-generated/imported courses
-- WITHOUT a future redesign. Nothing in this migration changes current
-- behavior — every existing row's owner_id is NULL (shared), and no app
-- code writes courses/sections/lessons yet (Course CRUD is still Phase 4).
--
-- Apply with: supabase db push

-- ============================================================
-- 1. Ownership: one nullable column is the entire boundary.
--    NULL = shared platform content (today's only case, unchanged).
--    A real auth.users id = that user's own course (Phase 4+).
-- ============================================================
alter table public.courses
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists courses_owner_id_idx on public.courses(owner_id);

-- ============================================================
-- 2. SELECT policies, made ownership-aware.
--    Today this is equivalent to the old "any authenticated user" rule,
--    since every existing course has owner_id = NULL — but it's now
--    correct for the future without needing to be touched again: a
--    user's own courses become visible to them (and, per today's default,
--    to everyone — see note below) the moment owner_id is set, with no
--    schema or policy change required at that point.
-- ============================================================
drop policy if exists "courses: authenticated read" on public.courses;
create policy "courses: read shared or own" on public.courses
  for select using (owner_id is null or owner_id = auth.uid());

-- sections/lessons have no owner_id of their own (ownership lives once, on
-- the course, not denormalized onto every child row) — visibility is
-- derived from whether their parent course is visible.
drop policy if exists "sections: authenticated read" on public.sections;
create policy "sections: read via course visibility" on public.sections
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = sections.course_id
        and (c.owner_id is null or c.owner_id = auth.uid())
    )
  );

drop policy if exists "lessons: authenticated read" on public.lessons;
create policy "lessons: read via course visibility" on public.lessons
  for select using (
    exists (
      select 1 from public.sections s
      join public.courses c on c.id = s.course_id
      where s.id = lessons.section_id
        and (c.owner_id is null or c.owner_id = auth.uid())
    )
  );

-- ============================================================
-- 3. Dormant write policies for owned content.
--    No app code calls these yet (Course CRUD is Phase 4) — adding them
--    now costs nothing and is precisely what avoids a redesign later:
--    when CRUD ships, it needs no new RLS work, just UI and app logic.
--    Shared (owner_id IS NULL) content still has NO client write path —
--    seeding remains a service-role-only operation, unchanged.
-- ============================================================
create policy "courses: insert own" on public.courses
  for insert with check (owner_id = auth.uid());
create policy "courses: update own" on public.courses
  for update using (owner_id = auth.uid());
create policy "courses: delete own" on public.courses
  for delete using (owner_id = auth.uid());

create policy "sections: insert own" on public.sections
  for insert with check (
    exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
  );
create policy "sections: update own" on public.sections
  for update using (
    exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
  );
create policy "sections: delete own" on public.sections
  for delete using (
    exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
  );

create policy "lessons: insert own" on public.lessons
  for insert with check (
    exists (
      select 1 from public.sections s join public.courses c on c.id = s.course_id
      where s.id = section_id and c.owner_id = auth.uid()
    )
  );
create policy "lessons: update own" on public.lessons
  for update using (
    exists (
      select 1 from public.sections s join public.courses c on c.id = s.course_id
      where s.id = section_id and c.owner_id = auth.uid()
    )
  );
create policy "lessons: delete own" on public.lessons
  for delete using (
    exists (
      select 1 from public.sections s join public.courses c on c.id = s.course_id
      where s.id = section_id and c.owner_id = auth.uid()
    )
  );
