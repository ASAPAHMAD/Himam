# Architecture

This document describes how Study Plan is built: the current state, the target state, and the
model we're refactoring toward. It is updated as part of every architectural change — if a PR
changes a data model, a scheduling rule, or a major component boundary, this file changes with it.

This is the technical companion to `PRODUCT_SPEC.md`. `PRODUCT_SPEC.md` defines *what* the product
does and for whom; this document defines *how* it's built to do that. Where the two could drift —
data model shape, scheduling behavior, AI feature list — this document is written to match
`PRODUCT_SPEC.md` exactly, and any product-spec change that affects the model should update both.

Last updated: Phase 1 complete (v0.2.0). §2 below describes the pre-refactor baseline for
historical reference; §3–§6 describe the target that is now implemented — see the file paths
noted throughout (`src/models/`) for where each piece actually lives.

---

## 1. Stack

| Layer      | Choice                                   | Notes |
|------------|-------------------------------------------|-------|
| Build      | Vite 6                                    | unchanged |
| UI         | React 19 + TypeScript                     | unchanged |
| Styling    | Tailwind v4 (`@tailwindcss/vite`)          | unchanged, black/gold theme preserved |
| Animation  | `motion`                                   | unchanged |
| Icons      | `lucide-react`                             | unchanged |
| Server     | Express, single process, serves Vite in dev / static build in prod | unchanged |
| AI         | Google Gemini (`@google/genai`), called only from the server | provider may change later, proxy shape stays |
| Persistence| Browser `localStorage`, single key         | **this changes** — see §4 |

No framework migration is planned. The stack is sound for the target; the problem is entirely in
the data model and a few components, not the tooling.

---

## 2. Current State (baseline, pre-refactor)

This section documents the app as it existed before Phase 1, for reference during migration and
rollback.

- **Two courses are hardcoded as a TypeScript union**: `Lesson.course: 'PL-300' | 'PMI-PBA'`
  (`src/types.ts`). Every consuming component filters on these two literal strings.
- **Content is source code, not data.** `src/data.ts` exports `PL300_SECTIONS` and
  `PMIPBA_SECTIONS` as literal arrays; `ALL_LESSONS` is derived from them at module load. There is
  no UI path that creates, edits, or deletes a course/section/lesson.
- **Lesson IDs are positional**: `` `pl300-s${sectionIndex}-l${lessonIndex}` ``. Reordering content
  in `data.ts` reassigns IDs, orphaning any saved progress tied to the old ID.
- **Scheduling is a fixed date range for a fixed pair of courses**
  (`src/utils/scheduler.ts::getFullSchedule`): hardcoded `startDate`/`endDate` in 2026, a hardcoded
  vacation range, a hardcoded set of "working Thursdays," and a fixed rule that PL-300 fills the
  morning session and PMI-PBA fills the lunch session. This is not parameterized by user schedule.
- **The same date constants are duplicated in `Calendar.tsx`** instead of imported from
  `scheduler.ts` — two sources of truth for the same vacation/working-day rules.
- **Identity is hardcoded into strings**, not data: "Good morning, Ahmad." in `Dashboard.tsx`;
  "Ahmad Alharthi" / "Analyst → Analytics Manager" in the `App.tsx` sidebar; the Gemini coach
  prompt itself embeds "Ahmad, a data analyst in Saudi Arabia... works Sun-Thu, 7:30-8:00 AM."
- **Single global localStorage key** (`ahmad_ledger_v3`) — one user, one browser. No accounts, no
  backend data store.
- **No accessibility attributes** (`aria-*`) anywhere in the component tree.

---

## 3. Target Data Model

Generic entities, replacing the hardcoded union type and static content arrays.

```ts
interface Profile {
  id: string;
  name: string;
  avatarUrl?: string;          // added v0.3.0, for Supabase Storage-hosted avatars (§8)
  country: string;
  timezone: string;
  careerGoal: string;
  currentJob: string;
  targetJob: string;
  currentSalary: string;
  targetSalary: string;
  certifications: string[];    // target certifications/courses driving this profile, e.g. ["PL-300", "PMP"]
  workingDays: string[];       // e.g. ["Sun","Mon","Tue","Wed","Thu"]
  vacationRanges: { start: string; end: string }[];
  holidays: string[];          // discrete non-working dates, distinct from vacation ranges
  extraWorkingDays: string[];  // added during the Phase 1 scheduler cutover — inverse of holidays,
                                // a normally non-working day that IS workable (see §4)
  studyWindows: { label: string; minutes: number }[]; // e.g. morning/lunch/evening/weekend
  learningStyle: 'Video' | 'Reading' | 'Practice' | 'Mixed';
}

interface Course {
  id: string;
  name: string;
  mode: 'ai' | 'manual';
  color: string;
  examDate: string | null;
  createdAt: string;
}

interface Section {
  id: string;
  courseId: string;
  name: string;
  order: number;
}

interface Lesson {
  id: string;            // stable UUID — never positional
  sectionId: string;
  title: string;
  description: string;
  type: 'video' | 'reading' | 'practice' | 'quiz' | 'revision' | 'flashcards' | 'lab' | 'assignment';
  duration: number;       // minutes
  difficulty: 'Easy' | 'Medium' | 'Hard';  // intrinsic content difficulty, set at creation/AI-generation time
  scheduledDate: string | null;
  resources: Resource[];
  attachments: Attachment[];
  practiceQuestions: PracticeQuestion[];
  aiSummary?: string;      // cached last AI-generated summary, regenerable on demand
  aiExplanation?: string;  // cached last AI-generated explanation, regenerable on demand
}

// Status, priority, personal difficulty rating, bookmark, notes, and revision date are
// per-user progress against a lesson, not properties of the lesson's content — they live in
// UserProgress below, keyed by lesson id, same as today.
type LessonStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

interface Resource {
  id: string;
  type: 'youtube' | 'microsoft_learn' | 'udemy' | 'coursera' | 'pdf' | 'book' | 'article' | 'github' | 'lab' | 'custom_url';
  title: string;
  url?: string;   // required for link-based types; omitted for e.g. physical books
}

interface Attachment {
  id: string;
  name: string;
  url: string;    // Phase 1–4: external URL only; local file upload is not in V1 scope (see PRODUCT_SPEC.md Non-Goals)
}

interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

// Per-lesson user progress keeps the existing keyed-dictionary shape —
// this part of the old model was already correct and is not being redesigned.
interface UserProgress {
  lessonStatus: Record<string, LessonStatus>;   // replaces the old boolean-only completedLessons
  bookmarks: Record<string, boolean>;
  difficultyRating: Record<string, number>;     // user's own personal difficulty flag (1–3), distinct from Lesson.difficulty
  priority: Record<string, 'Low' | 'Normal' | 'High'>;  // was boolean; product spec needs graded priority
  revisionDates: Record<string, string>;
  notes: Record<string, string>;
  completionDates: Record<string, string>;
  completionTimes: Record<string, string>;
}
```

Why keep `UserProgress` as keyed dictionaries: it's already normalized by lesson ID, already
survives arbitrary numbers of lessons, and every existing component already reads/writes it that
way. The only prerequisite is that `Lesson.id` becomes a stable UUID instead of a positional
string, so dictionary keys don't silently orphan.

---

## 4. Scheduling Engine (target)

Replaces `getFullSchedule()`'s fixed 2026/two-course logic with a function parameterized by:

- a `Profile` (working days, vacation ranges, holidays, study windows)
- an arbitrary list of `Course` + `Lesson[]` (any count, not exactly two)
- a date range to generate (today → exam date, or today → N days)

Output shape (`ScheduledDay[]`, `ScheduledWeek[]`) stays the same as today so `StudyCenter.tsx`
and `Calendar.tsx` need surgery, not replacement, on the consuming side. `Calendar.tsx`'s
duplicated local date constants are deleted; it imports everything from the engine.

Lesson-to-slot assignment generalizes from "PL-300 → morning, PMI-PBA → lunch" to: distribute
each course's remaining lessons across the user's defined study windows in priority order
(exam date proximity, then course order), filling each window up to its minute budget.

The engine must also cover, per the product spec:

- **Holidays**: discrete non-working dates (`Profile.holidays`), distinct from `vacationRanges`
  (a contiguous block) — both are excluded from workable days the same way.
- **Missed sessions**: a day is "missed" when its scheduled lessons remain incomplete after that
  day has passed. The engine detects this by diffing `scheduledDate < today` against
  `UserProgress.lessonStatus`, not by a separate manual flag.
- **Automatic rescheduling**: missed lessons roll forward into the next available workable
  window(s) rather than silently disappearing from the plan. This changes each affected lesson's
  `scheduledDate`; it does not change `Section`/`Course` membership.
- **Revision sessions**: generated automatically, not just recorded — when a lesson is marked
  complete, the engine proposes a follow-up revision session (a `type: 'revision'` lesson-like
  entry referencing the original) at a spaced interval, placed into a future study window the
  same way a new lesson would be. This turns `UserProgress.revisionDates` from a manually-set
  date into an engine-suggested one the user can accept or move.

---

## 5. Persistence & Multi-User Path

**Now (Phase 1–4):** local-first, single `localStorage` key holding `{ profile, courses, progress }`,
versioned with a `schemaVersion` field and an explicit migration function — no silent
`field || {}` patching like the current code. This is the "unlimited users" groundwork: the app
works fully offline per-browser, and the data shape is already what a backend row would look like.

**Later (post-Phase 5, not yet scoped):** a thin sync layer (e.g. Supabase) mirrors the same
`{ profile, courses, progress }` shape per authenticated user. Because components already read
this shape from a single state object today, adding sync means swapping *where the state comes
from*, not how components consume it.

---

## 6. AI Integration

The existing pattern is correct and is preserved: **the AI provider key lives only on the
server**, called through a single Express proxy endpoint. Today: `/api/coach` → Gemini, used only
by `Dashboard.tsx`. Target: the same proxy pattern, generalized to a small set of endpoints
(generate-plan, explain-concept, summarize-notes, generate-quiz), each taking structured input
(profile + course + lesson data) instead of a hand-written prompt string with "Ahmad" baked in.

Rate limiting / per-user request caps are added at the proxy layer before this is exposed to more
than one person — noted as a risk in the audit, addressed no later than Phase 2.

---

## 7. Accessibility

Not a separate phase. `aria-*` labels, keyboard focus states, and semantic roles are added
incrementally as each component is touched during the refactor, rather than retrofitted at the
end.

---

---

## 8. Identity & Persistence Layer (v0.3.0)

**Scope, explicitly**: authentication + per-user data ownership + Supabase as the source of truth
for an authenticated user's `Profile` and `UserProgress`. This is NOT a general cloud-sync engine —
no offline queueing, no multi-device conflict resolution, no real-time collaboration. Those are
out of scope until a phase that specifically calls for them.

### 8.1 What's being merged in

An existing, working Supabase auth implementation (built independently, on the pre-Phase-1
baseline) is being ported onto this architecture rather than rebuilt: email sign up/in, Google
(and Apple) OAuth, forgot/reset password, session persistence, account settings (name, timezone,
avatar, email/password change, linked identities, account deletion via a server-side edge
function). None of this logic changes — it's relocated and adapted to read/write `Profile`
(`src/models/types.ts`) instead of ad-hoc Supabase `user_metadata` fields.

### 8.2 Database shape

Maps directly onto the existing generic model — no new conceptual entities:

```sql
profiles        -- one row per user (auth.uid()), mirrors Profile exactly, + avatar_url
courses         -- shared by default; owner_id nullable (see below)
sections        -- ownership derived from parent course, not denormalized onto every table
lessons         -- ownership derived from parent course
user_progress   -- (user_id, lesson_id) composite PK: status, bookmark, priority, notes,
                --  revision_date, difficulty_rating, completion_date/time
```

**Content ownership (added in the v0.3.0 forward-compatibility pass, before finalizing)**:
`courses.owner_id` is a single nullable column — `NULL` means shared platform content (every
course today, since Phase 4's course CRUD doesn't exist yet), a real user id means that user's own
course. This is deliberately the *entire* boundary: `sections`/`lessons` don't carry their own
ownership field — visibility and write access are derived from their parent course's `owner_id` via
a join in the RLS policy, so ownership is decided in exactly one place, not duplicated across three
tables.

Why this avoids a redesign later: when Course CRUD, AI-generated courses, or imported courses
(Microsoft Learn/Udemy/Coursera/YouTube/PDF/etc.) ship, they simply start writing `owner_id` on the
courses they create — the column, the index, and the RLS policies (including dormant owner-scoped
insert/update/delete policies added now but exercised by no code yet) already exist. Nothing about
`user_progress` changes either: it already references lessons by id regardless of who owns the
course containing them.

### 8.3 RLS policy shape

- `profiles`: `user_id = auth.uid()` for select/insert/update. No delete (handled by the
  `delete-account` edge function using the service-role key, which also removes the Supabase Auth
  user itself).
- `user_progress`: `user_id = auth.uid()` for all operations.
- `courses`: `select` allowed when `owner_id is null` (shared) `or owner_id = auth.uid()` (own) —
  today equivalent to "any authenticated user," since no course has an owner yet, but correct
  without changes once one does. Owner-scoped insert/update/delete policies exist and are dormant
  (no app code calls them until Phase 4's Course CRUD ships); shared content still has no
  client-side write path at all — seeding remains service-role-only.
- `sections`/`lessons`: `select`/write policies check visibility/ownership through their parent
  `course_id` (and, for lessons, `section_id` → `course_id`) via an `exists` subquery — not a
  separate ownership field on each table.

### 8.4 Persistence strategy — deliberately simple

- On login: fetch `profiles` + `user_progress` for `auth.uid()`. If no `profiles` row exists yet
  (first login for this account), treat it as a new user — run the one-time "local guest data
  becomes this account's starting data" migration (same *pattern* as the `schemaVersion` local
  migration already built, extended one hop further: local → cloud, once, not ongoing).
- Local React state remains what the UI reads and writes instantly (unchanged optimistic feel).
  Every write that matters (lesson completion, bookmark, note, profile field) also fires an async
  write to the corresponding Supabase table. No debouncing/batching complexity beyond what's
  needed to avoid a write-per-keystroke on text fields.
- No pull-vs-push reconciliation logic: Supabase is simply authoritative once a session exists.
  Signed-out/no-account use is unaffected — the app keeps working exactly as it does today,
  entirely on `localStorage`, matching Phase 1 behavior.
- **Explicitly not handled**: two tabs/devices open at once with conflicting edits. Last write
  wins, silently. This is the flagged, accepted limitation of this phase.

## Changelog of this document

- **Phase 0** — initial version, written from the full-codebase audit, before any refactor code.
- **Phase 0 (revision)** — aligned data model with `PRODUCT_SPEC.md`: added `Resource`,
  `Attachment`, `PracticeQuestion` types; expanded `Lesson` with `description`,
  `resources`/`attachments`/`practiceQuestions`, and cached `aiSummary`/`aiExplanation`; expanded
  `Profile` with `currentSalary`/`targetSalary`/`certifications`/`holidays`; changed
  `UserProgress.completedLessons` (boolean) to `lessonStatus` (4-state enum) and `priority`
  (boolean) to a 3-level graded field; expanded the scheduling engine spec (§4) to explicitly
  cover holidays, missed-session detection, automatic rescheduling, and engine-generated revision
  sessions.
- **v0.3.0 kickoff** — added §8, Identity & Persistence Layer: merges an existing, independently-
  built Supabase auth implementation onto this architecture, adds a database schema (shared
  content tables + per-user `profiles`/`user_progress` with RLS), and a deliberately simple
  write-through persistence strategy. Explicitly scoped OUT: offline sync, multi-device conflict
  resolution, team/shared workspaces, real-time collaboration — see §8.4's flagged limitation.
- **v0.3.0 finalization** — forward-compatibility pass on §8.2/§8.3 before closing the phase:
  added `courses.owner_id` (nullable — `NULL` = shared platform content, unchanged default;
  a user id = that user's own course, Phase 4+). Ownership lives once, on the course; `sections`/
  `lessons` derive visibility/write access from their parent course via RLS joins rather than
  each carrying their own ownership field. Dormant owner-scoped write policies added now so
  Course CRUD / AI-generated / imported courses need no schema change when they ship — only app
  code that starts setting `owner_id`.
