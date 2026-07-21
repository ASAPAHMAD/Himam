# Deployment Validation Checklist — `save_course_tree` RPC (Milestone 2.3)

**Status: NOT YET RUN.** This checklist is prepared for manual execution against
a real Supabase project once one is available. Nothing here has been executed —
`0004_course_tree_rpc.sql` has only been reviewed for internal consistency
against the existing schema (`0001_identity_persistence.sql`,
`0002_content_ownership.sql`), not run against live Postgres.

Do this checklist **before** `SupabaseSyncTransport` becomes `DefaultSyncEngine`'s
default transport (Milestone 2.5/2.6), and before any application code depends
on `save_course_tree` succeeding.

## Prerequisites

1. Apply the migration: `supabase db push` (or paste `0004_course_tree_rpc.sql`
   into the Supabase SQL editor), on top of `0001`–`0003` already applied.
2. Two test accounts signed up via Supabase Auth (email/password is fine) —
   call them **User A** and **User B**. Note their `auth.users.id` values.
3. A way to run authenticated calls as each user — either the app itself
   signed in as each account, or the Supabase JS client in a Node REPL with
   each user's session token, or `supabase.auth.signInWithPassword(...)`
   followed by `supabase.rpc('save_course_tree', {...})`.
4. A sample payload matching `CourseTreePayload`'s shape (see
   `src/services/sync/transport/cloudRepository.ts`) — one course, one
   section, one lesson is enough for most checks below.

---

## 1. RPC creation

**Goal:** confirm the function exists, is callable, and has the right
security context.

- [ ] `select proname, prosecdef from pg_proc where proname = 'save_course_tree';`
      — confirm the row exists and `prosecdef` is `false` (security **invoker**,
      not definer — this is the specific security property §9 of the proposal
      requires).
- [ ] `select has_function_privilege('authenticated', 'save_course_tree(jsonb)', 'execute');`
      — should return `true` (the `grant execute ... to authenticated` line
      in the migration).
- [ ] Call it once as User A with a minimal valid payload and confirm it
      returns without error.

**Pass criteria:** function exists, runs as invoker, `authenticated` role can
execute it, anonymous role cannot (spot-check: `has_function_privilege('anon', ...)`
should be `false` since no grant was given to `anon`).

---

## 2. RLS enforcement

**Goal:** confirm the function can't do anything the calling user's own RLS
policies wouldn't already allow — i.e. it's a convenience wrapper, not a
privilege escalation.

- [ ] As **User A**, call `save_course_tree` with a payload whose course
      `id` is new and whose `course.ownerId` (if included in payload) is
      *not* User A's id, or simply confirm the function ignores any
      caller-supplied owner and always uses `auth.uid()` (per the migration:
      `owner_id` is hardcoded to `auth.uid()` in the insert, never read from
      the payload) — verify the resulting row's `owner_id` really is User A's
      id, not anything else.
- [ ] As **User A**, attempt to call `save_course_tree` with a payload whose
      `course.id` already exists and is owned by **User B**. Expect the
      `on conflict (id) do update` branch to be blocked by the existing
      `"courses: update own"` RLS policy (`owner_id = auth.uid()`) — the call
      should fail (RLS violation), not silently overwrite User B's course.
- [ ] Confirm shared/seeded courses (`owner_id is null`) are still not
      writable by any authenticated user via this RPC — attempt to save a
      course tree reusing one of the seeded course ids from
      `scripts/seedSupabaseContent.ts` and confirm it's rejected (the
      `"courses: update own"` policy requires `owner_id = auth.uid()`, and a
      `null` owner_id never equals a real uuid).

**Pass criteria:** every write inside the function is still gated by the same
per-row RLS policies as if the caller had run the inserts directly. No path
lets a user create, modify, or take ownership of another user's (or shared)
content.

---

## 3. Transaction rollback

**Goal:** confirm a failure partway through the function rolls back the
entire tree, not just the failing row.

- [ ] Construct a payload with a **valid** course + section, but a
      deliberately **invalid** lesson (e.g. `duration: "not-a-number"`, which
      will fail the `(lesson_row->>'duration')::integer` cast) and call the
      RPC as User A.
- [ ] Confirm the call fails with an error (not a partial success).
- [ ] Immediately after, query `select * from public.courses where id = '<that course id>'`
      and `select * from public.sections where course_id = '<that course id>'`
      — **both should return zero rows**. If the course or section row
      persisted despite the lesson failing, the transaction did not roll back
      correctly and this is a blocking issue.

**Pass criteria:** a failure anywhere in the function leaves the database
exactly as it was before the call — no orphaned course or section rows.

---

## 4. Partial write prevention

**Goal:** the specific data-integrity property Milestone 1's audit was about,
now checked at the multi-row/multi-table level instead of the single-record
level.

- [ ] Repeat the transaction-rollback test above (§3) but with multiple
      sections and lessons — one section+lessons valid, a later section's
      lesson invalid. Confirm **none** of the sections or lessons from that
      call persisted, including the ones that would have individually
      succeeded before the failure point.
- [ ] Confirm there's no interim state visible to a concurrent reader: while
      the failing call is in flight (if you can arrange a slow network or a
      deliberately large payload to create a window), a second connection
      querying the same course id should see either the old state or nothing
      — never a half-written tree. (Postgres's transaction isolation should
      guarantee this by default — this check confirms the RPC doesn't do
      anything unusual like `commit`ing mid-function, which plpgsql function
      bodies can't do anyway, but worth confirming no autonomous transaction
      trickery was introduced.)

**Pass criteria:** "all rows or none" holds even for multi-section,
multi-lesson trees, not just the single-lesson-failure case in §3.

---

## 5. Cross-user access protection

**Goal:** confirm reads, not just writes, respect ownership.

- [ ] As **User A**, save a course tree (owner_id = User A).
- [ ] As **User B**, `select * from public.courses where id = '<User A's course id>'`
      — should return **zero rows** (per `"courses: read shared or own"` from
      `0002_content_ownership.sql`).
- [ ] As **User B**, attempt `save_course_tree` reusing User A's course id
      (attempting an update via the RPC's `on conflict do update` path) —
      should fail, per §2 above.
- [ ] As **User B**, attempt to read User A's sections/lessons directly
      (`select * from public.sections where course_id = '<User A's course id>'`)
      — should also return zero rows, per the join-based visibility policies
      (`"sections: read via course visibility"`, `"lessons: read via course
      visibility"`).
- [ ] Confirm **User A** can still read their own tree in full after User B's
      attempts above — i.e. User B's blocked attempts didn't corrupt or lock
      out User A's access.

**Pass criteria:** User B cannot read, update, or otherwise observe User A's
owned course/section/lesson rows through any path exercised here.

---

## 6. Successful save and retrieval

**Goal:** the basic happy path — confirm the feature actually works
end-to-end, not just that failure modes are safe.

- [ ] As **User A**, call `save_course_tree` with a realistic multi-section,
      multi-lesson payload (mirroring what `handleSaveDraft` in
      `MyLearning.tsx` would eventually construct, once wired up in a later
      milestone).
- [ ] Query back `courses`, `sections`, `lessons` for that course id and
      confirm every field matches what was sent (name, mode, color,
      examDate, section names/order, lesson titles/types/durations/
      resources/attachments/practiceQuestions/aiSummary/aiExplanation).
- [ ] Call `save_course_tree` **again** with the same course id and slightly
      modified content (e.g. a renamed lesson) — confirm the `on conflict do
      update` path updates in place rather than duplicating rows, and that
      `select count(*) from public.lessons where section_id = '<section id>'`
      stays the same after the second call (no duplicate lesson rows).
- [ ] Confirm via `SupabaseCloudRepository.saveCourseTree()` (not just raw
      SQL) that the same payload shape produced by the TypeScript layer
      round-trips correctly — i.e. run this through the actual repository
      class against the real client, not only through the SQL editor.

**Pass criteria:** data saved through the RPC is byte-for-byte retrievable,
and re-saving is idempotent (no duplicate rows, correct in-place updates).

---

## 7. Migration compatibility

**Goal:** confirm `0004_course_tree_rpc.sql` doesn't disturb anything
`0001`–`0003` already established, and applies cleanly on a fresh project.

- [ ] Apply `0001` → `0002` → `0003` → `0004` in order on a **fresh** Supabase
      project (not one that already has 2.3's schema) and confirm all four
      apply without error.
- [ ] Re-run `0004` a second time (`supabase db push` again, or paste it
      again) and confirm it's idempotent — `create or replace function`
      should simply replace itself without error, and `grant execute` should
      not error on being granted twice.
- [ ] Confirm existing Phase 1.5 functionality is unaffected: sign in as an
      existing test user (or a fresh one), confirm `profiles` and
      `user_progress` read/write still work exactly as before (per
      `models/cloudPersistence.ts`) — this migration doesn't touch either
      table, but worth confirming nothing about function creation had a
      side effect on unrelated grants/policies.
- [ ] Confirm the shared/seeded courses (via
      `scripts/seedSupabaseContent.ts`) are still readable by any
      authenticated user after `0004` is applied — this migration doesn't
      touch the `"courses: read shared or own"` policy, but it's worth
      confirming nothing regressed.

**Pass criteria:** clean apply on a fresh project, idempotent re-apply, zero
observable change to Phase 1.5 (`profiles`/`user_progress`) or existing
shared-content read access.

---

## Sign-off

| Section | Result | Notes |
|---|---|---|
| 1. RPC creation | ☐ Pass ☐ Fail | |
| 2. RLS enforcement | ☐ Pass ☐ Fail | |
| 3. Transaction rollback | ☐ Pass ☐ Fail | |
| 4. Partial write prevention | ☐ Pass ☐ Fail | |
| 5. Cross-user access protection | ☐ Pass ☐ Fail | |
| 6. Successful save and retrieval | ☐ Pass ☐ Fail | |
| 7. Migration compatibility | ☐ Pass ☐ Fail | |

`SupabaseSyncTransport` should not become `DefaultSyncEngine`'s default, and
no application code should depend on `save_course_tree` succeeding, until
every row above is checked off against a real project.
