# Roadmap

Tracks phase status for the transformation from personal PL-300/PMI-PBA tracker into a generic
multi-course study platform. Scope and sequencing per `ARCHITECTURE.md` and the Phase 0 audit.
Feature scope for each phase is defined by `PRODUCT_SPEC.md`; this document tracks execution of
that scope, not the scope itself — if a task here and `PRODUCT_SPEC.md` disagree,
`PRODUCT_SPEC.md` wins and this file gets corrected.

Status legend: `☐` not started · `◐` in progress · `☑` done

---

## Phase 0 — Audit (complete)

- ☑ Full codebase review (7 components, types, data, scheduler, server, config)
- ☑ Strengths / weaknesses / risks documented
- ☑ Target architecture proposed and approved
- ☑ `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md` created
- ☑ `PRODUCT_SPEC.md` created; `ARCHITECTURE.md` and `ROADMAP.md` revised for alignment with it
- ☐ Product spec approved by product owner (pending — no implementation until this is checked)

## Phase 1 — Architecture Refactor

Goal: generic Course/Section/Lesson model + real scheduling engine, with the app working
identically to today from the user's point of view (same data, same UI, nothing visibly new yet).

- ☑ Add new generic types (`Course`, `Section`, `Lesson`, `Profile`, `Resource`, `Attachment`,
      `PracticeQuestion`) alongside existing types (`src/models/`)
- ☐ Change `UserProgress.completedLessons` (boolean) to `lessonStatus` (4-state enum: not
      started / in progress / completed / skipped) and `priority` (boolean) to graded (Low/Normal/High)
- ☑ Write one-time migration: `PL300_SECTIONS`/`PMIPBA_SECTIONS` → generic model, with stable
      UUIDs, without losing any existing user progress (`src/models/migrateLegacy.ts`, verified
      by `scripts/verifyMigration.ts` — see CHANGELOG)
- ☑ Rebuild scheduling engine as a parameterized module (`src/models/schedulingEngine.ts`):
      arbitrary courses, arbitrary date range, arbitrary study windows, working days by name,
      holidays, vacation ranges — verified in `scripts/verifyScheduler.ts` (8/8 checks pass,
      including exact parity on total-lessons-scheduled against the full legacy 180-lesson set)
- ☑ Add missed-session detection (`detectMissedLessons`) and automatic forward-rescheduling
      (`rescheduleMissed`) to the engine
- ☑ Add engine-generated revision date proposals (`proposeRevisionDates`) on lesson completion
- ☑ Delete duplicated date constants in `Calendar.tsx`; consume the shared engine — done, full
      cutover executed (approved risk acceptance). `utils/scheduler.ts` deleted entirely;
      `Calendar.tsx`'s `leaveStart`/`leaveEnd`/`workingThursdays`/milestone-date duplication is
      gone. See CHANGELOG.md for the pre-cutover parity verification (10/10 checks, 77/77 days
      matched across 5 fixtures) and the one real behavioral difference it caught and fixed.
- ☑ Migrate components off `l.course === 'PL-300'` checks, in order of coupling (lowest risk first):
  - ☑ `Statistics.tsx`
  - ☑ `Achievements.tsx`
  - ☑ `Roadmap.tsx`
  - ☑ `WrongAnswerJournal.tsx` (no course-specific logic expected, verify only)
  - ☑ `Dashboard.tsx`
  - ☑ `StudyCenter.tsx`
  - ☑ `Calendar.tsx`
- ☑ Move hardcoded "Ahmad" strings into a `Profile` object (sidebar, dashboard greeting, AI prompt)
      — done: `Profile` wired into `App.tsx`, `Roadmap.tsx`, and `Dashboard.tsx` (greeting, footer
      strip, and the full Gemini coach prompt now build entirely from `profile.*`).
- ☑ Add `schemaVersion` + explicit migration function for localStorage (replace silent
      `field || {}` patching in `App.tsx`) — done: `src/models/localStorageMigration.ts` (generic
      versioned-chain helper) + `studyPlanStateMigration.ts` + `profileMigration.ts` (concrete
      migrations for each localStorage key). Both `App.tsx` load sites now call a single
      `loadX(raw)` function instead of inline patching.
- ☑ Regression pass: confirm existing completion/streak/journal data survives migration unchanged
      — `scripts/verifyStorageMigration.ts`, 17/17 checks pass, including a real bug the script
      itself caught: brand-new users were bypassing the migration chain (and its seeding step)
      entirely — fixed before this was marked done (see CHANGELOG.md).

## Phase 1 — COMPLETE

All tasks above are done. `v0.2.0` cut (see CHANGELOG.md). Every one of the 7 components no
longer contains a hardcoded `l.course === 'PL-300'` check; the scheduling engine is generic and
verified against the legacy engine it replaced; `utils/scheduler.ts` is deleted; identity is a
`Profile` object, not scattered string literals; localStorage is versioned. Two small, explicitly
flagged items remain for a future pass (not blocking): `Profile.currentSalary`/`targetSalary` vs.
the legacy 3-tier `state.salary` (Roadmap.tsx / Dashboard.tsx), and `Statistics.tsx`'s /
`Dashboard.tsx`'s own display-only date literals now that `Course.examDate` exists to replace
them with.

## Phase 1.5 — Identity & Persistence Layer (v0.3.0) — FINALIZED

Goal, precisely as approved: merge an existing, working Supabase auth implementation onto this
architecture, and give `Profile`/`UserProgress` a real per-user database home. **Not** a cloud-sync
engine — see Non-Goals below, which are as much a part of this phase's definition as the tasks are.

**Finalization addendum**: before closing this phase, a minimal forward-compatibility pass added
`courses.owner_id` (nullable — shared by default, ready for user-owned/AI-generated/imported
content without a future redesign). See `CHANGELOG.md` [0.3.0]'s finalization addendum and
`ARCHITECTURE.md` §8.2 for the full design.

- ☑ Port existing auth code (built independently on the pre-Phase-1 baseline, being merged in as-is
      per explicit instruction not to lose any of it): email sign up/in, Google + Apple OAuth,
      forgot/reset password, session persistence
- ☑ Adapt `AccountSettings` to read/write the generic `Profile` model (`src/models/types.ts`)
      instead of ad-hoc Supabase `user_metadata` fields — one source of truth, not two
- ☑ Switch AI provider from Gemini to OpenAI (approved decision) in `server.ts`'s `/api/coach`
      and `package.json`
- ☑ Supabase schema: `profiles`, shared `courses`/`sections`/`lessons`, `user_progress` — see
      `ARCHITECTURE.md` §8.2 for why content tables are shared, not per-user, at this stage
- ☑ Row Level Security: per-user ownership on `profiles`/`user_progress`; authenticated-read-only
      on shared content tables
- ☑ Write-through persistence: local state stays the optimistic UI source; writes also go to
      Supabase; one-time local→cloud migration on first login (same pattern as the existing
      `schemaVersion` local migration, extended one hop)
- ☑ Gate the app behind auth (`AuthProvider` + protected routes), matching existing behavior
- ☑ Regression pass: confirm the app still works fully signed-out / offline of Supabase (Phase 1
      behavior preserved for anyone not using an account) — verified by construction: every
      auth-gated render path and cloud-persistence call is wrapped in `configured` /
      `Boolean(supabase)`, which is `false` whenever `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`
      aren't set, so the app renders exactly the Phase 1 JSX tree with nothing added or removed

### Explicitly NOT in this phase (approved scope boundary)
- Offline synchronization / queued writes
- Multi-device conflict resolution (last-write-wins is the accepted behavior)
- Team collaboration, shared workspaces, real-time collaborative editing
- Community Hub (tabled — see conversation log; needs its own scoping pass against `PRODUCT_SPEC.md`)

### Follow-up worth doing, not blocking (flagged, not silently ignored)
- Production JS bundle grew from ~319KB to ~556KB after wiring in `@supabase/supabase-js`
  (a real, legitimate size increase from a real SDK, not a bug) — code-splitting the
  auth/persistence bundle behind a dynamic `import()` would help first-paint time for the
  `!configured` (no-Supabase) case especially, since that path never needs any of it.

## Phase 2 — Personalization Engine (formerly "User Onboarding" — same scope, broader framing:
the onboarding flow is this phase's first deliverable, feeding the Profile that the rest of the
app already personalizes around — dashboard greeting, AI coach prompt, career roadmap, scheduling)
— COMPLETE

- ☑ Onboarding trigger/resume mechanism: `Profile.onboardingCompleted` (single source of truth)
      + `Profile.onboardingStep` (named step, not a positional index — resumable across app
      closes). Existing pre-Phase-2 profiles grandfathered as complete, not retroactively
      interrupted — see `models/profileMigration.ts` and `scripts/verifyOnboardingMigration.ts`
      (8/8 checks: brand-new/grandfathered/mid-flow-resume/already-complete/idempotent).
- ☑ Onboarding flow collecting: name, country, timezone, career goal, current job, target job,
      current/target salary, certification/course, working days, vacation, available study time,
      learning style — 5-step wizard (`src/components/Onboarding.tsx`), backed by shared step
      components (`src/onboarding/steps/`) and shared validation (`src/onboarding/validation.ts`)
      — **not yet included: exam date**, deliberately (see `CertificationStep.tsx`'s own comment —
      `Course.examDate` needs a real Course to attach to, which doesn't exist per-user until
      Phase 4's Course CRUD; adding a temporary Profile-level field for this now would be the kind
      of undefined-scope field this project has consistently avoided)
- ☑ Resolve the salary-model deferral (flagged in Phase 1.5): legacy 3-tier `state.salary` dropped
      in favor of `profile.currentSalary`/`targetSalary` (2 fields, matching `PRODUCT_SPEC.md`) —
      `Roadmap.tsx`/`Dashboard.tsx` switched to the two-value framing (a real, visible UI change,
      flagged rather than folded in silently); AI coach prompt now includes salary context when
      present, since this is exactly the "AI request the user explicitly triggers" the spec
      permits salary to be sent to
- ☑ Persist onboarding output into `Profile` (local + cloud write-through, same mechanism already
      built in Phase 1.5 — no new persistence code needed, `Onboarding.tsx` just calls the same
      `onUpdateProfile` every other profile-editing surface uses)
- ☑ "Preferences" settings surface for career/schedule/learning-style fields
      (`src/components/Preferences.tsx`), confirmed separate from `AccountSettings` (which stays
      auth-only: email/password/linked accounts/delete). Reuses the exact same step components and
      validation as `Onboarding.tsx` — the only difference between the two is wizard-with-gating
      vs. all-sections-editable-at-once, per explicit instruction. Reciprocal navigation links
      between the two so a user can move between them without detouring through the dashboard.
- ☑ Add basic rate limiting / abuse guard to the AI proxy before onboarding can trigger AI calls
      (risk flagged in audit §3) — simple in-memory per-IP limiter (10 requests/minute) in
      `server.ts`, with a flagged caveat about `req.ip` behind a reverse proxy (acceptable for this
      phase's "stop a single client from hammering a paid API" goal, not a robust production system)

## Phase 3 — Planning Modes

- ☐ Mode A: AI-generated plan — proxy endpoint takes `Profile` + course input, returns
      sections/lessons/schedule
- ☐ Mode B: Manual plan — CRUD UI for sections/lessons (does not exist today)
- ☐ Mode switch, non-destructive (switching modes doesn't discard existing course data)

## Phase 4 — Course System

- ☐ Course CRUD (create/rename/delete/reorder), unlimited courses
- ☐ Section CRUD
- ☐ Lesson CRUD, with existing per-lesson features (notes, bookmarks, priority, difficulty,
      revision dates) working against the new generic model
- ☐ Resource CRUD on lessons (YouTube, Microsoft Learn, Udemy, Coursera, PDF, book, article,
      GitHub, lab, custom URL — per `PRODUCT_SPEC.md` Resource Types)
- ☐ Attachment support (external URL only, per V1 scope) and Practice Question CRUD on lessons

## Phase 5 — UI/UX

- ☐ Extend black/gold system to multi-course visuals (per-course color/badge, since "PL-300" and
      "PMI-PBA" labels no longer cover the UI)
- ☐ Accessibility pass (aria labels, focus states) across all components touched in Phase 1–4
- ☐ General polish pass toward Notion/Motion/Linear/Todoist-level feel, once the model is generic

---

## Not yet scoped

See `PRODUCT_SPEC.md` → **Non-Goals** for the authoritative, reasoned list of what V1 explicitly
does not include (accounts/auth, cloud sync, team workspaces, mobile apps, offline mode,
notifications, billing, and others). That list is not duplicated here to avoid two sources of
truth that can drift; this roadmap only tracks phases that are in scope. `ARCHITECTURE.md` §5
describes how the local-first data model is kept ready for sync to be added later without a
rewrite, once it's actually scoped.
