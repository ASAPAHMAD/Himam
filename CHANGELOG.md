# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Every major change lands with an entry here,
alongside any needed update to `ARCHITECTURE.md` and `ROADMAP.md`.

## Versioning

This project uses [Semantic Versioning](https://semver.org/). Given the project is pre-1.0 and
growing in scope from a personal tool into a general product, versions track roadmap phases
rather than individual releases, per the scheme below. `[Unreleased]` accumulates changes for the
phase currently in progress; it's renamed to the numbered version once that phase is complete —
not on every commit.

| Version | Phase |
|---|---|
| v0.1.0 | Original personal study planner (PL-300/PMI-PBA, pre-refactor) |
| v0.2.0 | Generic architecture (Phase 1) |
| v0.3.0 | Identity & Persistence Layer — Supabase auth + per-user database (reordered ahead of onboarding, per explicit direction) |
| v0.4.0 | Personalization Engine — user onboarding, Profile-driven personalization (Phase 2) — COMPLETE |
| v0.5.0 | Multi-course support / course CRUD (Phase 3–4) |
| v0.6.0 | AI study planner (part of Phase 3) |
| v0.7.0 | Full cloud sync (offline queueing, multi-device conflict resolution) — deliberately deferred out of v0.3.0, see ARCHITECTURE.md §8 |
| v1.0.0 | First public release |

## [Unreleased]

### Changed — user-reported fixes
- **Rebrand (low-risk pass from `HIMAM_BRANDING_CHECKLIST.md`, now executed on request)**:
  `index.html` title, `metadata.json` name/description (also fixed the stale "Gemini AI coaching"
  text — bonus finding from the checklist), `package.json` name, sidebar header (now "Himam همم"),
  sidebar tagline (was "PL-300 & PMI-PBA Tracker", now "Certification & Career Planner" — more
  accurate now that the platform isn't tied to just those two certs), and the remaining literal
  "Study Plan"/"Study Planner" UI copy in `AuthScreen.tsx`, `StudyCenter.tsx`, `Calendar.tsx`.
  Deliberately NOT touched: `Ahmad`/`PL-300`/`PMI-PBA` as lesson-id prefixes or the legacy course
  union type — those still need the migration-backed pass the checklist recommended, not a
  find-and-replace.
- **`StudyWindow` is now time-based, not a manually-typed duration**: gained `startTime`/`endTime`
  ("HH:MM"); `minutes` is now always derived from them via the new
  `src/utils/time.ts::computeDurationMinutes()`, never entered directly — `ScheduleStep.tsx`'s
  duration input became two `<input type="time">` pickers with the computed duration shown
  read-only next to them. No database migration needed (`study_windows` is a `jsonb` column, so
  the new shape is just a different JSON structure in an existing column). `DEFAULT_PROFILE`'s
  windows updated to real clock times (7:00–7:45, 12:00–12:45) matching the existing 45/45-minute
  totals. `scripts/verifyTimeUtils.ts` (new, 9/9 checks) — including a real bug it caught before
  shipping: an empty/malformed time string produced `undefined` after `.split(':').map(Number)`,
  which the original `Number.isNaN()` guard didn't catch (`undefined` isn't `NaN`), so invalid
  input could have silently produced a nonsensical duration instead of failing safely to 0.

### Verification
- `scripts/verifyTimeUtils.ts` (new, 9/9 checks, one real bug caught — see above).
- All 5 prior verification scripts still pass. `tsc --noEmit` clean, `vite build` succeeds.

## [0.4.0] — Personalization Engine (Phase 2 complete)

Product name confirmed: **Himam (همم)** — see `HIMAM_BRANDING_CHECKLIST.md` for the full audit
(no renaming performed yet).

### Added
- **Onboarding state foundation**: `Profile.onboardingCompleted` (single source of truth) +
  `Profile.onboardingStep` (a named `OnboardingStep`, not a positional index — resumable across
  app closes). `models/profileMigration.ts` bumped to schema v2, carefully distinguishing
  brand-new profiles from existing pre-feature profiles (grandfathered as complete, not
  retroactively interrupted) from genuinely mid-onboarding profiles (resume at their exact saved
  step). `supabase/migrations/0003_onboarding_tracking.sql` mirrors this for cloud profiles.
  `scripts/verifyOnboardingMigration.ts`: 8/8 checks.
- **Shared onboarding/Preferences form layer** (`src/onboarding/`): `validation.ts` (one set of
  rules, used identically by both contexts) and 5 step components (`IdentityStep`, `CareerStep`,
  `CertificationStep`, `ScheduleStep`, `LearningStyleStep`) — each a plain `(profile, onChange)`
  form fragment with no knowledge of whether it's inside a wizard or a settings page.
- **`src/components/Onboarding.tsx`**: guided 5-step wizard using the shared components, gated by
  `validateStep()` before advancing, persisting `onboardingStep` after every step (not just at
  the end) so closing the app mid-flow is safe. Wired into `App.tsx` right after the auth gate,
  triggered by `!profile.onboardingCompleted` — applies identically whether local-only or signed
  in, per explicit direction that this field is the single source of truth.
- **`src/components/Preferences.tsx`**: the editable-anytime counterpart, same step components
  and validation, no wizard chrome — every section visible at once, edits apply immediately
  through the same write-through path the rest of the app already uses. Deliberately styled as a
  continuation of the profile (avatar/name header) rather than a disconnected settings list, per
  explicit direction. Reciprocal navigation links added between `Preferences` and
  `AccountSettings` so the auth-vs-personalization boundary between them doesn't require detouring
  through the dashboard to cross.
- Simple in-memory per-IP rate limiter on `server.ts`'s `/api/coach` (10 requests/minute) —
  deliberately minimal per approved scope, with a flagged caveat about `req.ip` accuracy behind a
  reverse proxy.
- `HIMAM_BRANDING_CHECKLIST.md`: full audit of every remaining "Study Plan"/"The Ledger"/"Ahmad"/
  "PL-300"/"PMI-PBA" reference, classified into 5 categories, with a recommended rename sequencing.
  No renaming performed — this is a planning document only.

### Changed
- **Resolved the salary-model deferral** flagged twice since Phase 1.5: `Roadmap.tsx` and
  `Dashboard.tsx` switched from the legacy 3-tier `state.salary` (current/mid/target) to
  `profile.currentSalary`/`targetSalary` (2 fields, matching `PRODUCT_SPEC.md` — the "mid" tier
  was never in the approved spec). This is a real, visible UI change (three salary values become
  two), flagged explicitly rather than folded in silently. The AI coach prompt now includes salary
  context when present — the "AI request the user explicitly triggers" the spec permits salary to
  be sent to.
- `Roadmap.tsx` takes a new `onUpdateProfile` prop (salary edits now go through Profile, not
  `StudyPlanState`).

### Known gaps, not oversights
- Onboarding's certification step deliberately does not collect an exam date — `Course.examDate`
  belongs to a real `Course` entity, which doesn't exist per-user until Phase 4's Course CRUD.
  Adding a temporary Profile-level field to fill this gap now would be exactly the kind of
  undefined-scope addition this project has consistently avoided.
- Rate limiting is per-IP and in-memory — resets on server restart, and multiple server instances
  would each track independently. Good enough for "stop one client from hammering a paid API,"
  not a production-grade system.

### Verification
- `scripts/verifyOnboardingMigration.ts` (new, 8/8 checks) — see Added above.
- Fixed a stale hardcoded schema-version assertion in `scripts/verifyStorageMigration.ts` (was
  checking `=== 1`, now references `CURRENT_PROFILE_SCHEMA_VERSION` so it can't go stale again
  next time the version bumps).
- All 4 prior verification scripts (migration/scheduler/storage/cloud persistence) still pass.
- `tsc --noEmit` clean, `vite build` succeeds after every commit in this phase.

## [0.3.0] — Identity & Persistence Layer (Phase 1.5 complete) — FINALIZED

### Finalization addendum — content ownership forward-compatibility
Approved before finalizing: a minimal, additive schema change so future user-created content
(Custom Courses, Custom Sections, Custom Lessons, Personal Learning Paths, AI-Generated Courses,
Imported Courses from Microsoft Learn/Udemy/Coursera/YouTube/PDFs/etc.) needs **no database
redesign** when it ships, while shared platform content stays the unchanged default.
- `supabase/migrations/0002_content_ownership.sql`: added `courses.owner_id` (nullable uuid,
  indexed) — `NULL` = shared (every course today), a user id = that user's own course. Ownership
  lives once, on the course; `sections`/`lessons` derive visibility/write access from their parent
  course via RLS `exists` joins rather than each carrying a redundant ownership field. SELECT
  policies rewritten to be ownership-aware (`owner_id is null or owner_id = auth.uid()` —
  today identical in effect to the old blanket "authenticated read," since no course has an owner
  yet). Dormant owner-scoped insert/update/delete policies added for `courses`/`sections`/
  `lessons` — no app code calls them yet (Course CRUD is still Phase 4), but the RLS work that
  would otherwise block that phase is already done.
- `src/models/types.ts`: `CourseMode` extended with `'imported'`; `Course.ownerId?: string` added
  (undefined = shared, mirroring the DB column's `NULL`).
- `ARCHITECTURE.md` §8.2/§8.3 rewritten to describe the ownership model as designed-in from the
  start, not a "will need a migration later" caveat.
- `scripts/seedSupabaseContent.ts`: added a comment clarifying `owner_id` is intentionally left
  unset (defaults to shared) — this script only ever creates platform content.
- Verified zero behavior change: `tsc --noEmit` clean, `vite build` succeeds (bundle size
  unchanged — no new dependencies, no new components), all 4 verification scripts still pass.

### Added
- **Auth, ported from the existing independently-built branch, as-is** (`src/lib/supabase.ts`,
  `src/auth/AuthProvider.tsx`, `src/components/AuthScreen.tsx`): email sign up/in, forgot/reset
  password, Google + Apple OAuth, PKCE code exchange, magic-link hash session restore, auth state
  subscription. All three files needed no adaptation — self-contained, no coupling to the app's
  data model. `src/vite-env.d.ts` added (was missing — needed for `import.meta.env` typing).
- **Database schema** (`supabase/migrations/0001_identity_persistence.sql`): `profiles` (mirrors
  `Profile` exactly, + `avatar_url`), shared `courses`/`sections`/`lessons` (authenticated-read
  only — see `ARCHITECTURE.md` §8.2 for why content stays shared, not per-user, until Phase 4's
  course CRUD exists), and `user_progress` (the actual per-user RLS ownership boundary). Plus an
  `avatars` storage bucket with owner-scoped upload/update/delete policies and public read.
  `scripts/seedSupabaseContent.ts` pushes `buildCoursesFromLegacyData()` (the same content
  `legacyBridge.ts` already serves locally) into the shared tables via the service-role key.
  `supabase/functions/delete-account/index.ts` ported as-is — token-freshness check, removes
  avatar files, deletes the `auth.users` row (`profiles`/`user_progress` cascade automatically).
- **Cloud persistence** (`src/models/cloudPersistence.ts`): `loadCloudProfile`/`saveCloudProfile`,
  `loadCloudProgress`/`saveCloudProgress` (bulk upsert — deliberately not incremental, see the
  file's header on the approved simplicity trade-off), `hasCloudProfile` (first-login detection),
  `migrateLocalToCloud` (one-time local→cloud push). Every function no-ops when Supabase isn't
  configured. `migrateLegacy.ts` gained `userProgressToLegacyState()`, the missing inverse of
  `legacyStateToUserProgress()` — merges cloud-loaded progress back into the legacy
  `StudyPlanState` shape every existing component still reads, without touching non-progress
  fields (streak/salary/journal/studyLog).

### Changed
- **AI provider swapped Gemini → OpenAI** (approved decision) in `server.ts`'s `/api/coach`
  (`gpt-5-mini`, confirmed current via search rather than assumed) and `package.json`.
- **`src/components/AccountSettings.tsx`** adapted (not ported as-is) to read/write the generic
  `Profile` model instead of Supabase Auth `user_metadata` — name/timezone/avatar now have one
  home (`profiles` table via the app's normal write-through), not two disconnected ones.
  Email/password/linked-identity/account-deletion stayed untouched — those are genuinely Auth
  concerns, not Profile.
- **`src/App.tsx` + `src/main.tsx`**: full integration, closing out Phase 1.5.
  `main.tsx` wraps the app in `AuthProvider`. `App.tsx`: auth gating (loading screen → `AuthScreen`
  → app, only when `configured`), a load-on-login/migrate-on-first-login effect (fires once per
  real sign-in transition, not on every render — dependency is `[user?.id]`), and two debounced
  (1.2s) write-through effects mirroring `state`/`profile` changes to Supabase once sync has
  fully settled. New "Account" tab (only shown when `configured`) renders the adapted
  `AccountSettings`; a sign-out control appears in the sidebar footer when signed in.
  **Verified by construction, not just by testing**, that the `!configured` (no Supabase env vars)
  path is unchanged from Phase 1: every new render branch and cloud-persistence call is gated on
  `configured`/`Boolean(supabase)`, which is `false` whenever `VITE_SUPABASE_URL`/
  `VITE_SUPABASE_PUBLISHABLE_KEY` aren't set — so an unconfigured app produces the exact same JSX
  tree as before, nothing added or removed. `tsc --noEmit` clean, `vite build` succeeds.

### Bugs caught before shipping (by the verification scripts, not in production)
- `lib/supabase.ts` accessed `import.meta.env` unguarded — crashed any script/tool loading a module
  that imports it outside Vite's runtime (including this phase's own verification script). Fixed
  with optional chaining; the running app was never affected (Vite always provides this), but
  tooling now works too.
- Two false-alarm test failures in `scripts/verifyCloudPersistence.ts` from comparing
  `JSON.stringify()` output directly (order-sensitive) instead of a proper deep-equality check —
  fixed in the test, not the app code.

### Known limitations (approved scope boundary, not oversights)
- No offline queueing, no multi-device conflict resolution (last-write-wins, silently), no team
  features. See `ARCHITECTURE.md` §8 and `ROADMAP.md`'s Phase 1.5 "Explicitly NOT in this phase."
- Community Hub tabled pending its own scoping pass against `PRODUCT_SPEC.md`.
- Production JS bundle grew ~319KB → ~556KB from bundling `@supabase/supabase-js` into the main
  entry. Real cost of a real SDK, not a bug — code-splitting it behind a dynamic `import()` is a
  reasonable follow-up, logged in `ROADMAP.md` rather than done here to keep this phase's scope to
  what was approved.

### Verification
- `scripts/verifyCloudPersistence.ts` (new, 13/13 checks): profile and progress mapping round-trip
  correctly through the DB row shape in both directions, including edge cases (missing avatar →
  null → undefined, non-"completed" statuses, non-"High" priorities), and non-progress legacy
  fields (streak/salary/studyLog) survive a full legacy→cloud→legacy round-trip untouched.
- All 3 Phase 1 verification scripts (migration/scheduler/storage) still pass — zero regressions.
- `tsc --noEmit` clean and `vite build` succeeds after every commit in this phase.

## [0.2.0] — Generic architecture (Phase 1 complete)

### Added
- Semantic versioning adopted (see table above). `package.json` bumped to `0.1.0` to represent the
  baseline this phase is diffing against.
- `src/models/` — generic `Course`, `Section`, `Lesson`, `Profile`, `Resource`, `Attachment`,
  `PracticeQuestion`, `UserProgress` types and a stable ID generator, added alongside the legacy
  model. (Phase 1, task 1)
- `src/models/migrateLegacy.ts` — one-time migration converting `PL300_SECTIONS`/
  `PMIPBA_SECTIONS` into generic `Course`/`Section`/`Lesson` entities, and legacy
  `StudyPlanState` into `UserProgress`. Legacy lesson ids are reused verbatim as the new
  `Lesson.id` (not regenerated), so existing progress dictionary keys need no remapping.
  `scripts/verifyMigration.ts` confirms: exact lesson-count and id-set parity against
  `ALL_LESSONS` (180/180, 0 missing, 0 invented) and lossless round-trip of `completedLessons`
  through `UserProgress`. (Phase 1, task 3)
- `src/models/schedulingEngine.ts` — generic, parameterized scheduling engine replacing the fixed
  2026/two-course logic in `src/utils/scheduler.ts` (not yet deleted — see Known Gaps below).
  Provides `generateSchedule` (working days by name, holidays, vacation ranges, N study windows,
  N courses), `detectMissedLessons` / `rescheduleMissed` (automatic forward-rescheduling), and
  `proposeRevisionDates` (+3/+7 day spaced revision suggestions). `scripts/verifyScheduler.ts`:
  8/8 checks pass, including that the new engine schedules all 180 migrated legacy lessons
  exactly once under a configuration equivalent to the legacy constants. (Phase 1, scheduling
  engine tasks)
- `src/models/legacyBridge.ts` + `src/models/defaultProfile.ts` — transitional adapter exposing
  the generic `Course` model to components while `App.tsx`'s root state is still legacy
  `StudyPlanState` (documented in the file header as an interim layer, not final architecture);
  and the single seed `Profile` object consolidating what were previously several independent
  "Ahmad" string literals.
- `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`, `PRODUCT_SPEC.md` — project documentation
  (audit, target architecture, phased roadmap, product definition). `PRODUCT_SPEC.md` approved.

### Changed
- **`src/components/Statistics.tsx`** migrated off `ALL_LESSONS.filter(l => l.course === 'PL-300')`
  onto the generic `Course`/`Lesson` model via `src/models/legacyBridge.ts`. Overall totals
  (`totalLessons`, `totalDone`, `overallPercentage`) are now a generic reduce over all migrated
  courses — this scales automatically if a third course is ever added, unlike the old
  two-variable-addition version. The two named "PL-300 Course Syllabus Completion" /
  "PMI-PBA Loaded Lessons Completion" progress bars are unchanged visually (same labels, same
  numbers) — per this phase's UI-freeze requirement, a fully generic N-course render is Phase 4
  scope, not this pass. Dropped 4 unused variables (`plTotalMin`/`plDoneMin`/`pbiTotalMin`/
  `pbiDoneMin`) that were computed but never rendered in the original file.
  Verified: `tsc --noEmit` clean, `vite build` succeeds, CSS output byte-identical (confirms no
  markup/class changes), numeric equivalence guaranteed by construction since migrated lesson ids
  are identical to legacy ids (proven in the migration verification above).
- `ARCHITECTURE.md`: expanded the target data model to match `PRODUCT_SPEC.md` — added `Resource`,
  `Attachment`, `PracticeQuestion` types; added `description`, `resources`, `attachments`,
  `practiceQuestions`, cached `aiSummary`/`aiExplanation` to `Lesson`; added
  `currentSalary`/`targetSalary`/`certifications`/`holidays` to `Profile`; changed
  `UserProgress.completedLessons` (boolean) to a 4-state `lessonStatus`, and `priority` from
  boolean to graded (Low/Normal/High); expanded the scheduling engine spec to explicitly require
  holidays, missed-session detection, automatic rescheduling, and engine-generated revision
  sessions.
- `ROADMAP.md`: Phase 1 and Phase 4 task lists updated to include the new types, the
  status/priority model change, and resource/attachment/practice-question CRUD; removed the
  standalone "not yet scoped" list in favor of pointing at `PRODUCT_SPEC.md` → Non-Goals as the
  single source of truth. Checkboxes updated as each Phase 1 task completes.
- **`src/App.tsx`**: added a second, independent `profile: Profile` state (seeded from
  `models/defaultProfile.ts`, persisted at a new `study_plan_profile_v1` localStorage key,
  deliberately separate from the legacy `ahmad_ledger_v3` key so this step can't touch existing
  saved progress). Sidebar footer name now reads `profile.name` instead of a literal string.
- **`src/components/Roadmap.tsx`**: takes a new `profile` prop; "Ahmad's baseline expertise
  foundation" is now `` `${profile.name}'s baseline expertise foundation` ``.
  **Deliberately NOT migrated in this commit**: the salary block still reads/writes legacy
  `state.salary` (current/mid/target — 3 tiers). The approved `Profile` model has only
  `currentSalary`/`targetSalary` (2 fields, no "mid" tier) — see flagged trade-off discussion
  before this commit. Migrating it now would mean either dropping the mid-tier input (a UI
  change, against this phase's rules) or silently adding an unapproved third Profile field.
  Left as-is, with an inline code comment, for a deliberate Phase 2 decision instead.
  Verified: `tsc --noEmit` clean, `vite build` succeeds, CSS output byte-identical.
- **`src/components/Achievements.tsx`** migrated off `ALL_LESSONS`/`l.course === 'PL-300'` and off
  the positional `sectionIndex` field (which the generic `Lesson` type doesn't have — see
  ARCHITECTURE.md §2). The "DAX Master" and "BA Analyst" badge checks now look up lessons by
  section *name* (`lessonsInSectionNamed()`) instead of a numeric index, with an explicit
  `.length > 0 &&` guard so a future content rename can't make an empty-array `.every()` silently
  report "unlocked". Verified via an ad-hoc script that both section lookups return the exact
  same 17/17 lesson id sets as the old `sectionIndex`-based filter. Badge copy/labels unchanged.
  `tsc`/`vite build` clean, CSS output byte-identical.

- **`src/components/WrongAnswerJournal.tsx`**: verified only, no logic changes. Confirmed by
  inspection to have zero course/name hardcoding already — `topic` is a free-text field the user
  types themselves. Added a header comment documenting this verification so a future contributor
  doesn't wonder why this file is untouched while its 6 siblings were rewritten.
- **`src/components/Dashboard.tsx`** (the AI-integrated component) migrated off
  `ALL_LESSONS`/`l.course === 'PL-300'` onto `computeCourseProgress()`/`allLegacyLessons()` via
  `src/models/legacyBridge.ts`. Takes a new `profile` prop. All three remaining "Ahmad" hardcodes
  fixed: the greeting (`profile.name.split(' ')[0]`, pixel-identical since `profile.name` =
  "Ahmad Alharthi"), the footer strip (`profile.name` / `` `Study Path → ${profile.targetJob}` ``,
  the latter evaluating to the exact original "Analytics Manager" string), and — the one that
  wasn't just UI copy — the **full Gemini coach prompt**, which previously hand-wrote "Ahmad, a
  data analyst in Saudi Arabia... PL-300 and PMI-PBA... works Sun-Thu 7:30-8:00 AM" directly into
  the request payload sent to the AI. That prompt is now built entirely from `profile.name`,
  `profile.currentJob`, `profile.country`, `profile.certifications`, `profile.workingDays`, and
  `profile.studyWindows` — this one was a real behavior change (the exact wording of an AI
  request, not rendered UI), so the UI-freeze rule doesn't apply to it, unlike the two display
  strings.
  **Deferred, consistent with earlier decisions**: the hardcoded Aug 16/Aug 25 pace-status dates
  (same class of debt as `Statistics.tsx`'s burn-down chart) and the legacy 3-tier `state.salary`
  read in the "Career Vision" line (same Profile-model mismatch flagged in the Roadmap.tsx
  commit) — both left as-is with inline comments explaining why.
  Verified: `tsc --noEmit` clean, `vite build` succeeds, and a `className`-string diff of this
  commit shows zero new or removed classes (only text content and the coach-prompt string
  logic changed).

- **Full scheduler cutover** (the item flagged as highest-risk in Phase 1, executed per explicit
  approval to accept that risk): `StudyCenter.tsx` and `Calendar.tsx` now import scheduling from
  `src/models/legacyScheduleAdapter.ts` instead of `src/utils/scheduler.ts`, which is **deleted**.
  `Calendar.tsx`'s duplicated `leaveStart`/`leaveEnd`/`workingThursdays`/milestone-date constants
  (the "duplicated logic" audit finding in `ARCHITECTURE.md` §2) are gone — every day's
  `isLeave`/`isWeekend`/`isOffThursday`/`isPMIMilestone`/`isPLMilestone` now comes from the single
  schedule object instead of being independently recomputed.
  **Permanent record of the pre-cutover parity check** (the verification script itself,
  `scripts/verifyScheduleAdapter.ts`, has been retired since its comparison target —
  `utils/scheduler.ts` — no longer exists to compare against): a field-by-field diff of the old
  scheduler's output against the new adapter's, across 5 fixtures (empty state, two different
  partial-completion states, one course fully done, everything done), found and fixed one real
  behavioral difference — the legacy scheduler places the *entire syllabus* on the calendar
  regardless of completion status (completion is a UI-only overlay never read by the old
  scheduling function), while the new engine by design skips completed lessons. The adapter
  schedules against an empty progress object to reproduce the legacy placement exactly, rather
  than activating the engine's "skip completed" behavior as a silent side effect of an
  architecture-only phase. After that fix: **10/10 checks passed — all 77 generated days matched
  exactly (isWorkable, isWeekend, isLeave, isOffThursday, isPMIMilestone, isPLMilestone,
  estimated times, and morning/lunch session lesson-id sets) across all 5 fixtures.**
  Also verified post-cutover: `tsc --noEmit` clean, `vite build` succeeds, and a `className`-string
  diff of the entire cutover (`Calendar.tsx` + `StudyCenter.tsx` + `App.tsx`) shows the exact same
  set of classes before and after — zero visual change.
- Supporting model changes for the cutover: `Profile.extraWorkingDays` (new field — the inverse of
  `holidays`; a normally non-working day that IS workable, needed to reproduce the legacy
  scheduler's 4 specific "working Thursday" exceptions, closing the gap flagged earlier in this
  log). `schedulingEngine.ts`'s `groupScheduleByWeek` genericized so the new engine and the legacy
  adapter share one implementation instead of two copies. `migrateLegacy.ts`'s courses now carry
  real `examDate` values (Aug 25 / Aug 16) instead of `null` — these were previously duplicated
  literal date strings across `Dashboard.tsx`, `Statistics.tsx`, and the old `Calendar.tsx`; now
  one source of truth. `defaultProfile.ts` tuned to the scheduler's *actual* 45/45-minute session
  budget (not the 30/20 example figures in the original onboarding walkthrough — that mismatch
  between stated intent and actual code predates this refactor and is flagged, not silently
  changed).
- **Versioned localStorage migration**, closing out Phase 1: `src/models/localStorageMigration.ts`
  is a generic, reusable `migrateVersioned<T>()` helper — walks a saved blob forward through a
  numbered chain of documented migration steps rather than the previous pattern of 13 unexplained
  `parsedState.x = parsedState.x || {}` lines in `App.tsx` with no way to tell "new user" apart
  from "old blob genuinely missing a field." `studyPlanStateMigration.ts` and
  `profileMigration.ts` are the concrete v0→v1 migrations for each of the two localStorage keys.
  `App.tsx`'s two load sites now each call one `loadX(raw)` function.
  **Real bug the regression script caught before this was marked done**: the first implementation
  special-cased "no saved data" to skip the migration chain entirely, which meant a brand-new
  user's PMI-PBA Section 0 seed step never ran. Fixed so "no saved data" now flows through the
  exact same chain as a real migrated blob, starting from an empty version-0 object.
  `scripts/verifyStorageMigration.ts`: 17/17 checks pass — fresh-user seeding, exact preservation
  of a realistic saved blob's completion/streak/salary/studyLog/journal/notes data across
  migration, no double-seeding for already-migrated users, idempotency (migrating an already-
  current blob twice is a no-op), and null/corrupt-JSON handling.

### Known Gaps (flagged, not silently dropped)
- ~~The legacy scheduler had a one-off exception...~~ **Resolved** in the scheduler cutover above
  via `Profile.extraWorkingDays`.
- `Statistics.tsx`'s burn-down chart and `Dashboard.tsx`'s pace-status calculation still hardcode
  July 14 / Aug 25 / Aug 16 2026 literals for their own display-only date math, rather than reading
  `Course.examDate` (now populated — see above). The scheduler itself no longer has this problem;
  these two remaining display calculations are lower-risk, presentation-only holdouts, now
  genuinely easy to fix since the data they'd need already exists, but still out of scope for this
  commit to keep it reviewable. Worth a small follow-up.
- **Tooling observation, not a code defect**: comparing built CSS output byte-for-byte across
  commits turned out to be an unreliable regression signal — a pre-existing `sm:inline` utility
  used only in the untouched `StudyCenter.tsx` intermittently appears/disappears in the compiled
  CSS across otherwise-identical builds, apparently a Tailwind v4 Vite-plugin content-scan
  nondeterminism unrelated to any change in this refactor. From the Roadmap.tsx commit onward,
  regressions are verified by diffing `className` strings directly instead of trusting the CSS
  file hash.

### Notes
- All 7 components migrated/verified (`Statistics.tsx`, `Achievements.tsx`, `Roadmap.tsx`,
  `Dashboard.tsx`, `StudyCenter.tsx`, `Calendar.tsx` rewritten; `WrongAnswerJournal.tsx` verified
  already-generic) — 7/7. Phase 1 is complete; see ROADMAP.md.

---

## [0.1.0] — Original personal study planner (baseline)

Snapshot of the app as received, for reference:

- Personal tracker hardcoded to two certifications: PL-300 (Microsoft Power BI) and PMI-PBA.
- Fixed 2026 study calendar (specific vacation dates, specific working Thursdays) baked into
  `utils/scheduler.ts` and duplicated in `Calendar.tsx`.
- Dashboard, Calendar, Statistics, Achievements, Roadmap, Study Center, Wrong Answer Journal —
  all functional, black/gold themed, XP/level gamification system.
- Single-user, single-browser `localStorage` persistence (`ahmad_ledger_v3`).
- Gemini-powered AI coach on the Dashboard only, proxied server-side via Express (`/api/coach`) —
  API key never exposed client-side.
- No course/lesson CRUD UI; content lives in `src/data.ts` as static arrays.
