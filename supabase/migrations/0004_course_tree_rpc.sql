-- Milestone 2.3 — Supabase Course Synchronization: the RPC side.
--
-- IMPORTANT: written and reviewed alongside SupabaseCloudRepository, but NOT
-- applied against any live database in this environment (no Supabase
-- credentials available here). Apply with `supabase db push` (or paste into
-- the Supabase SQL editor) before SupabaseCloudRepository.saveCourseTree()
-- will succeed against a real project.
--
-- Why this exists: CLOUD_SYNC_PROPOSAL.md §6 calls for wrapping a course's
-- course+sections+lessons insert in a single Postgres transaction rather than
-- three sequential client-side inserts, since that's the one place a real
-- DB-level transaction is both possible and warranted (a network round trip
-- itself can never be part of a client-side rollback). A Postgres function
-- body is transactional by default — this whole function either fully
-- commits or fully rolls back.
--
-- security invoker (the default, stated explicitly): this function runs with
-- the CALLING user's privileges, so it does NOT bypass RLS. Every insert/
-- update below is still evaluated against the existing per-row policies from
-- 0002_content_ownership.sql (owner_id = auth.uid()) exactly as if the
-- caller had issued these statements directly. Per the approved architecture
-- (§9 Security Considerations): "the RPC must run as the calling user, not
-- security definer with elevated privilege... a convenience wrapper for
-- atomicity, not a privilege escalation."

create or replace function public.save_course_tree(payload jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  course_row jsonb := payload->'course';
  section_row jsonb;
  lesson_row jsonb;
begin
  insert into public.courses (id, name, mode, color, exam_date, owner_id, created_at)
  values (
    course_row->>'id',
    course_row->>'name',
    course_row->>'mode',
    course_row->>'color',
    nullif(course_row->>'examDate', '')::date,
    auth.uid(),
    coalesce((course_row->>'createdAt')::timestamptz, now())
  )
  on conflict (id) do update set
    name = excluded.name,
    mode = excluded.mode,
    color = excluded.color,
    exam_date = excluded.exam_date;
    -- owner_id is intentionally never updated on conflict: a course's owner
    -- doesn't change after creation, and the "update own" RLS policy already
    -- prevents anyone but the owner from reaching this branch regardless.

  for section_row in select * from jsonb_array_elements(coalesce(payload->'sections', '[]'::jsonb))
  loop
    insert into public.sections (id, course_id, name, "order")
    values (
      section_row->>'id',
      section_row->>'courseId',
      section_row->>'name',
      coalesce((section_row->>'order')::integer, 0)
    )
    on conflict (id) do update set
      name = excluded.name,
      "order" = excluded."order";
  end loop;

  for lesson_row in select * from jsonb_array_elements(coalesce(payload->'lessons', '[]'::jsonb))
  loop
    insert into public.lessons (
      id, section_id, title, description, type, duration, difficulty,
      scheduled_date, resources, attachments, practice_questions,
      ai_summary, ai_explanation
    )
    values (
      lesson_row->>'id',
      lesson_row->>'sectionId',
      lesson_row->>'title',
      coalesce(lesson_row->>'description', ''),
      lesson_row->>'type',
      (lesson_row->>'duration')::integer,
      lesson_row->>'difficulty',
      nullif(lesson_row->>'scheduledDate', '')::date,
      coalesce(lesson_row->'resources', '[]'::jsonb),
      coalesce(lesson_row->'attachments', '[]'::jsonb),
      coalesce(lesson_row->'practiceQuestions', '[]'::jsonb),
      lesson_row->>'aiSummary',
      lesson_row->>'aiExplanation'
    )
    on conflict (id) do update set
      title = excluded.title,
      description = excluded.description,
      type = excluded.type,
      duration = excluded.duration,
      difficulty = excluded.difficulty,
      scheduled_date = excluded.scheduled_date,
      resources = excluded.resources,
      attachments = excluded.attachments,
      practice_questions = excluded.practice_questions,
      ai_summary = excluded.ai_summary,
      ai_explanation = excluded.ai_explanation;
  end loop;
end;
$$;

grant execute on function public.save_course_tree(jsonb) to authenticated;
