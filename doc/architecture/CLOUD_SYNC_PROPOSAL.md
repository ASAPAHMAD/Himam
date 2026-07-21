# Cloud Synchronization — Architecture Proposal (Milestone 2)

Status: **DESIGN ONLY — no implementation.** For review before coding starts.
Grounded in the actual repo state as of the Milestone 1 close (`ASAPAHMAD/Study-plan-Google`, `main`).

---

## 0. Why this milestone exists (the gap Milestone 1 exposed)

The audit surfaced something worth stating plainly before any design: **the feature Milestone 1
just hardened — saving an AI-generated/imported/manual course into a permanent record — does not
reach Supabase at all today.**

- `Profile.customCourses` (`src/models/types.ts:138`) is never mapped in `profileToRow`/`rowToProfile`
  (`src/models/cloudPersistence.ts`). It lives in React state + `localStorage[PROFILE_STORE_KEY]` only.
- `Profile.learningGoalDetails` carries an explicit code comment marking it "local-only for now"
  (`cloudPersistence.ts:19‑25`).
- So today, a saved course exists only on the device that created it. Sign in on a second device
  and it's gone.

The good news: **this was anticipated.** `ARCHITECTURE.md §8.2` already added a nullable
`courses.owner_id` column and a full set of dormant, ownership-scoped RLS insert/update/delete
policies in migration `0002_content_ownership.sql`, explicitly so that "Phase 4 course CRUD" (this
is that phase) "simply starts writing `owner_id`... the column, the index, and the RLS policies...
already exist." Nothing about `user_progress` needs to change either, since it already references
lessons by id regardless of who owns the containing course.

This proposal is therefore not "bolt cloud sync onto a finished feature" — it's "finish wiring a
feature whose schema was already built for this, and decide the sync semantics that Phase 1.5
(`ARCHITECTURE.md §8.4`) explicitly deferred": *"no offline queueing, no multi-device conflict
resolution... out of scope until a phase that specifically calls for them."* This is that phase.

---

## 1. Scope & Non-Goals

**In scope:**
- Persisting `customCourses` (and their sections/lessons) to the existing `courses`/`sections`/`lessons`
  tables via `owner_id`, instead of only living in `Profile`/localStorage.
- Persisting `learningGoalDetails` (currently local-only).
- Making the draft→save transaction (Milestone 1) and ongoing progress writes resilient to network
  failure, with the existing rollback scaffold in `handleSaveDraft` (`MyLearning.tsx:394`) finally
  given a real failure mode to guard against.
- Basic offline queueing for the writes that matter (course save, lesson completion, bookmark).
- Deciding — explicitly, not by default — what happens when the same account is open on two
  devices at once.

**Out of scope for this milestone** (flag for a later one if ever needed):
- Real-time collaboration / multiplayer editing of the same course.
- CRDT-based or field-level merge conflict resolution.
- A general-purpose sync engine for arbitrary future entities — this proposal is scoped to the
  entities that exist today (`Profile`, `UserProgress`, `customCourses`/sections/lessons).

---

## 2. Data Model Changes

### 2.1 Custom courses → real rows, not a JSON blob on `profiles`

Two options exist; recommending the second.

**Option A — jsonb column on `profiles`.** Add `custom_courses jsonb` to `profiles`, serialize
`Profile.customCourses` wholesale on every save. Minimal migration, but throws away the ownership
model `0002_content_ownership.sql` already built, and re-introduces exactly the "preserve
draft-shaped IDs into a permanent blob" problem the Milestone 1 audit just fixed one level up —
except now at the whole-course level instead of the lesson level.

**Option B — write into `courses`/`sections`/`lessons` with `owner_id = auth.uid()`.** This is what
the schema was built for. `handleSaveDraft`'s existing finalization logic (course/section/lesson
construction, now with `generateId()` for lesson ids) maps directly onto insert statements against
these three tables instead of (or in addition to, during transition — see §11) appending to
`profile.customCourses`. `CourseCatalog.getAllCourses()` already merges "shared" catalog content
with per-user content in memory (`this.courses` + `this.customCourses`) — the cloud-loaded set just
needs to arrive pre-filtered to `owner_id IS NULL OR owner_id = auth.uid()`, which is exactly what
the existing RLS `select` policy already returns for free.

**Recommendation: Option B.** It uses infrastructure that's already deployed and reviewed, avoids
a second class of "permanent ID" (this time at the course/section level) that would need its own
future audit, and keeps `user_progress`'s lesson-id references meaningful across devices without
a translation layer.

### 2.2 `learningGoalDetails`

Small, per-goal metadata (`category`, `url`, `courseId`, `milestones`). Add a
`learning_goal_details jsonb` column to `profiles` (the follow-up migration the code comment in
`cloudPersistence.ts:24` already anticipates) — this one's genuinely fine as a jsonb blob; it's
denormalized per-user config, not shared/owned content with its own identity lifecycle.

### 2.3 Schema diff (illustrative, not final SQL)

```sql
-- profiles: small, low-risk addition
alter table public.profiles
  add column if not exists learning_goal_details jsonb not null default '{}';

-- courses/sections/lessons: no new columns needed — owner_id, RLS, and indexes
-- already exist from 0002_content_ownership.sql. This milestone is the first
-- app code to actually exercise the dormant insert/update/delete policies.

-- (see save_course_tree() RPC in §6 — the transaction boundary for the
-- 3-table write, not a new persisted entity of its own)
```

**Amendment (adopted):** no server-side outbox table. Reviewer feedback correctly identifies the
outbox as a client concern, not a database one: a write that never reached Supabase because the
device was offline has nothing meaningful to persist server-side. If the device fails permanently
before draining (lost/wiped), the missing writes are unrecoverable either way — a server-side
outbox wouldn't help, since nothing ever arrived there in the first place. The offline queue lives
entirely in IndexedDB, on-device (§3).

---

## 3. Offline-First Behavior

Today's model (`ARCHITECTURE.md §8.4`) is "local state is instant, cloud write fires async,
in-flight write lost on close" — acceptable for Phase 1.5's stated risk tolerance, not for a
milestone explicitly about sync.

**Proposal:** local state remains the always-available, instantly-written source of truth (no
regression here — signed-out/no-account use is unaffected, matching today's guarantee). The
change is what happens to the *cloud* write when it can't go out immediately, and — per reviewer
feedback — a more precise statement of which side is authoritative when.

**Source of truth — refined.** "Local state is the source of truth" was too loose. The corrected
statement:

| Connectivity | Source of truth | Local's role |
|---|---|---|
| Offline | **Local** | Authoritative — nothing else is reachable |
| Online, synced | **Supabase** | Replica of the last confirmed server state |
| Online, pending writes | **Supabase** (once drained) | Optimistic replica, provisionally ahead |

The practical effect: local state is always what the UI reads/writes instantly (unchanged, no
regression), but once a session is online and synced, Supabase is what's authoritative — a stale
local copy that disagrees with the server after a failed/rejected write should defer to the server,
not be silently treated as still-correct. This distinction matters specifically so a permanently-
rejected write (§6) results in local state reconciling *toward* Supabase, not the reverse.

**Outbox — client-side only, via IndexedDB, owned entirely by a `SyncEngine` service (§5a).** No
server-side table. Every mutating action (course save, lesson complete/bookmark/note, profile field
change) writes synchronously to local state + `localStorage` (unchanged, can't fail), and separately
calls `SyncEngine.enqueue(...)`, which appends to an IndexedDB-backed queue that survives offline
and survives the tab closing — unlike today's "lost on close" debounce. `SyncEngine.drain()` is the
only thing that ever talks to Supabase for these writes; nothing else in the app does directly.

This directly fixes the gap flagged in the Milestone 1 review: `handleSaveDraft`'s rollback branch
currently has nothing to catch, because `onUpdateProfile` can't fail. Under this design, the save
path becomes: commit locally (can't fail) → `SyncEngine.enqueue(...)` (can fail only on IndexedDB
quota, vanishingly rare) → `SyncEngine.drain()` asynchronously, with drain failures visible to the
UI as a "pending sync" state via `SyncEngine.status()`, rather than swallowed to console.

---

## 4. Sync Lifecycle

Extending the existing three states in `App.tsx` (`cloudSyncState`: `idle` / `loading` / `ready`)
with an explicit state machine, owned by `SyncEngine.status()` rather than ad hoc component state:

```
idle → (sign-in) → loading → [first login for account? → migrating] → ready
ready → (mutation while offline) → ready+pendingWrites
ready+pendingWrites → (connection restored) → draining → ready
ready+pendingWrites → (sign-out attempted) → blocked, see §7 ("Sync Now" / "Leave Anyway" / "Cancel")
ready → (sign-out) → idle (outbox empty, confirmed)
```

`loading`/`migrating` map onto the existing `hasCloudProfile` → `loadCloudProfile`+`loadCloudProgress`
(existing user) vs `migrateLocalToCloud` (first login) branch already in `App.tsx:121‑154` — that
logic is sound and doesn't need to change. What's new is `pendingWrites`/`draining`/`blocked`, which
today's code has no concept of at all, and which `SyncEngine` is now the single owner of — `App.tsx`
and components read `SyncEngine.status()`/`.pending()`, they don't reimplement this state machine.

---

## 5. Transaction Boundaries

This is the item the Milestone 1 review flagged directly: `handleSaveDraft`'s try/catch currently
guards only synchronous, in-memory object construction; the actual persistence
(`saveCloudProfile`, 1200ms-debounced, `App.tsx:176‑184`) is completely outside it.

**Proposal:** redraw the transaction boundary around the *outbox enqueue*, not around the network
call itself (network calls are inherently unboundable — you can't roll back a request that's
already in flight to another process). Concretely:

1. `handleSaveDraft` builds the finalized course/sections/lessons (unchanged from Milestone 1,
   now with `generateId()` everywhere).
2. It writes local state (course appears in `customCourses`/local cache) **and** an outbox entry,
   as a single local operation — either both happen or neither does, which is achievable locally
   (no network involved yet) and is a boundary the existing try/catch can actually enforce.
3. The outbox drain is a *separate*, retriable transaction with its own failure handling (§6) —
   it does not roll back step 2. A failed drain means "still pending," never "the save didn't
   happen locally."

This changes what "atomic" means here: atomic now covers *commit-to-local-source-of-truth*, not
*commit-to-cloud*, because a network round trip can never be part of a synchronous rollback anyway.
Cloud delivery becomes eventually-consistent-with-retry instead of pretending to be transactional.

---

## 5a. `SyncEngine` — a dedicated service (adopted addition)

Reviewer feedback identified a real gap: without a named owner, sync logic tends to leak into
`App.tsx` effects and component handlers (which is exactly how today's debounced-write pattern
came to live directly in `App.tsx:167‑184`). This milestone introduces `src/services/syncEngine.ts`
as the *only* thing that talks to the IndexedDB outbox or drains it to Supabase. No component, and
no other service, calls Supabase directly for queued writes.

```ts
interface SyncEngine {
  enqueue(entry: SyncEntry): Promise<void>;   // local outbox write; can't fail except IndexedDB quota
  drain(): Promise<void>;                      // attempt to flush the queue against Supabase
  retry(entryId: string): Promise<void>;       // manual re-attempt of one failed entry
  cancel(entryId: string): Promise<void>;      // discard one queued entry (user-initiated only)
  status(): SyncStatus;                        // 'idle' | 'pendingWrites' | 'draining' | 'blocked'
  pending(): SyncEntry[];                      // what's currently queued, for UI display
  flush(): Promise<void>;                      // drain-and-wait, used by the sign-out guard (§7)
}
```

`App.tsx` and components consume this interface only — they read `status()`/`pending()` for UI
state and call `enqueue()` from mutation handlers (`handleSaveDraft`, `handleCompleteLesson`,
profile field updates), but never construct Supabase calls or IndexedDB transactions themselves.
This keeps the boundary reviewer feedback asked for: **the UI should never know how synchronization
works.**

---

## 6. Failure Recovery

- **Transient network failure**: outbox entry stays queued, `SyncEngine` retries per a configurable
  `SyncPolicy` (see below) rather than a hardcoded threshold. No user-facing error until the policy's
  configured threshold is crossed — brief blips shouldn't alarm anyone.

  ```ts
  interface SyncPolicy {
    retryCount: number;        // e.g. default 3
    retryInterval: number;     // base delay in ms, e.g. default 5000
    backoff: 'fixed' | 'exponential';
    surfaceErrorAfter: { attempts?: number; elapsedMs?: number }; // whichever comes first
  }
  ```

  Shipping with sensible defaults (3 attempts, exponential backoff, surface after 3 attempts *or*
  10 minutes pending) but as configuration `SyncEngine` reads, not a number buried in a retry loop —
  future-proofed if these numbers need tuning without touching the retry logic itself.
- **Permanent failure (validation/RLS rejection)**: distinguish from transient — a 4xx from
  Supabase (e.g. RLS denial from an expired/invalid session) shouldn't retry forever. Surface it
  distinctly ("sync error — sign in again") rather than silently retrying a request that will
  never succeed.
- **Partial multi-row failure** (e.g. course row inserts, one section fails): given Option B's
  three-table write, wrap the insert in a single Postgres transaction via an RPC
  (`supabase.rpc('save_course_tree', {...})`) rather than three sequential client-side inserts —
  this is the one place a real DB-level transaction is both possible and warranted, unlike the
  client-side "transaction" in §5.
- **Rollback UI**: while an outbox entry for a course-save is pending, the course is visibly usable
  locally (no regression vs. today) but flagged with a small "syncing" indicator; if it ultimately
  fails permanently, surface a dismissible notice rather than silently reverting the user's work.

---

## 7. Background Synchronization

- Drain triggers, all routed through `SyncEngine.drain()`: on `online` event, on app
  foreground/focus, on a periodic timer (e.g. every 60s) while `pendingWrites`, and immediately
  after any new `enqueue()` if currently online.
- Drain order: FIFO per entity type is sufficient at this data volume (per the existing
  `saveCloudProgress` comment noting "fine at this data volume, well under 200 lessons") — no
  priority queue needed yet.
- **Sign-out with a non-empty outbox: blocked, not just warned.** Adopted as specified — this is a
  stronger guarantee than the original proposal's passive warning. `signOut({ scope: 'local' })`
  (`AuthProvider.tsx:76`) gains a pre-check against `SyncEngine.pending()`; if non-empty, the sign-out
  flow presents:

  ```
  You have unsynchronized changes.
  Leave anyway?
  [ Sync Now ]   [ Leave Anyway ]   [ Cancel ]
  ```

  "Sync Now" calls `SyncEngine.flush()` (drain-and-wait) before completing sign-out; "Leave Anyway"
  proceeds despite pending writes (explicit, informed data loss — not silent); "Cancel" aborts
  sign-out entirely. Never silently discard queued work.

---

## 8. Conflict Resolution Strategy

Today: none — last-write-wins via `upsert`, explicitly flagged as accepted in `ARCHITECTURE.md
§8.4` ("two tabs/devices open at once with conflicting edits... last write wins, silently").

**Proposal — tiered, not one-size-fits-all:**

- **`user_progress`** (lesson status/bookmark/notes/etc.): keep last-write-wins. This data is
  low-stakes and high-frequency; a real merge strategy would cost more than the problem it solves.
  Add `updated_at`-based "you're viewing slightly stale data" detection only if this becomes a
  reported issue, not preemptively.
- **`courses`/`sections`/`lessons` (owned content)**: also last-write-wins at the row level, but
  since a course-save is a single atomic tree-insert (§6's RPC), a "conflict" here can really only
  mean "created independently on two devices while offline" — not a field-level merge conflict.
  No merge logic needed; each device's independently-created course simply gets its own row once
  both sync (duplicates are a UX question, not a data-integrity one — surfaced to the user to
  discard one, not silently deduplicated by guessing).
- **`profiles`**: last-write-wins, same as today. Profile fields are singular per-user settings,
  not collaboratively edited; no realistic conflict scenario justifies more.

Explicitly **not** proposing operational transforms, CRDTs, or vector clocks — the data shapes here
don't have the collaborative-editing characteristics that justify that complexity, and Phase 1.5's
existing accepted risk tolerance for `user_progress` should carry forward, not be over-engineered
away.

---

## 9. Authentication Integration

Current `AuthProvider` (`src/auth/AuthProvider.tsx`) already handles session restore (OAuth
callback via hash or `code` param, or existing session), auth state change subscription, and
`signOut`. This proposal's only addition: `useAuth()` needs to expose enough for the sync layer to
gate on — it already does (`session`, `user`, `configured`) — plus a hook for the outbox drain to
know when a session has just been refreshed (so a queued write that failed due to an expired token
gets retried with a fresh one rather than marked permanently failed). No structural change to
`AuthProvider` itself is anticipated; this is additive.

---

## 10. Security Considerations

- No server-side outbox table exists to secure (see §3/§5a) — the queue lives client-side in
  IndexedDB, same trust boundary as `localStorage` today. The only new server surface is the
  `learning_goal_details` column (RLS already covers `profiles` as a whole) and the
  `save_course_tree` RPC below.
- The `save_course_tree` RPC (§6) must run as the calling user (not `security definer` with
  elevated privilege) so RLS still gates it — it should be a convenience wrapper for atomicity, not
  a privilege escalation. It needs its own `owner_id = auth.uid()` check inside, mirroring what the
  dormant client-side insert policies in `0002_content_ownership.sql` already encode.
- Outbox payloads may transiently hold not-yet-persisted user content (e.g. an unsaved course) in
  IndexedDB — same trust boundary as `localStorage` today (device-local, not shared), no new
  exposure introduced.
- No new secrets or service-role usage on the client — everything here uses the anon key + RLS,
  consistent with everything else in `src/lib/supabase.ts`.

---

## 11. Migration Strategy

For **existing users** who already have `customCourses` sitting only in cloud `profiles` rows
today (there likely are none yet in production, since this write path doesn't exist, but the
migration should be safe regardless):

1. Ship the schema changes (§2.3) — additive only, no destructive changes, so this is a zero-downtime
   deploy on its own.
2. Ship application code that *writes new courses* to `courses`/`sections`/`lessons` (Option B) but
   *reads* by merging both sources (cloud rows via RLS-filtered `getAllCourses()` **and** any
   still-local-only `profile.customCourses` for users who saved a course before this migration
   shipped) — so nothing already saved locally silently disappears.
3. A one-time background migration (mirroring the existing `migrateLocalToCloud` pattern in
   `cloudPersistence.ts:223`) pushes any lingering `profile.customCourses` into real rows on next
   sign-in, then clears them from `profile.customCourses` once confirmed written — same "not a
   merge, one-time push" philosophy already used for the original local→cloud migration.
4. Only after that dual-read window has been live for a reasonable period should
   `profile.customCourses`-as-source-of-truth be removed from the read path entirely.

This follows the same incremental, backward-compatible pattern already used three times in this
codebase (`localStorageMigration.ts`, `profileMigration.ts`, `studyPlanStateMigration.ts`) — no new
migration philosophy being introduced, just applying the existing one to a new field.

---

## 12. Cross-Device Consistency

Given §8's tiered conflict approach and §4's sync lifecycle. **Realtime deferred (adopted):** this
milestone already has enough moving parts (`SyncEngine`, the outbox, the RPC transaction) — adding
Supabase Realtime subscriptions here would mix a genuinely separate concern (live push updates)
into a milestone that's fundamentally about correctness and durability, not liveness. Realtime
becomes its own **Cloud Sync Phase 2.1**, taken up only after this phase is proven stable.

For this milestone, cross-device refresh is deliberately simple and pull-based:

```
App Launch → Foreground → Manual Refresh
```

- Signing in on a second device triggers the existing `loading` → cloud-authoritative load
  (`App.tsx:132‑139`), now also pulling owned `courses`/`sections`/`lessons` via RLS instead of
  only `profiles`/`user_progress`.
- Returning to foreground (tab/app refocus) re-triggers the same load — cheap, and covers the
  common "switched devices, came back to this one" case without any push infrastructure.
- A manual refresh affordance covers the rest. A course saved on Device A while Device B is open
  simply won't appear on B until one of these three triggers fires — an accepted, explicit
  limitation of this phase, not a silent gap.
- Explicitly **not** proposing a merge UI ("Device A vs Device B, pick one") for anything in this
  milestone's scope — per §8, the entities here don't have conflicts that need adjudicating, only
  independent creations that need to both show up, once a refresh trigger runs.

---

## Summary of what this proposal does *not* do

- Does not touch `user_progress`'s existing (accepted) last-write-wins behavior.
- Does not introduce CRDTs, OT, or vector clocks.
- Does not change `AuthProvider`'s structure.
- Does not implement real-time multi-user collaboration on a single course.
- Does not add a server-side outbox table — the queue is IndexedDB, client-side, owned by `SyncEngine`.
- Does not implement Supabase Realtime in this milestone — deferred to Cloud Sync Phase 2.1.
- Does not write any code — this is the design for review before Milestone 2 implementation begins.

---

## Decisions (resolved during review)

| # | Question | Resolution |
|---|---|---|
| 1 | Option A (jsonb) vs Option B (first-class rows) | **Option B** — custom courses, sections, and lessons are first-class entities under `owner_id`, not a jsonb blob. |
| 2 | Server-side outbox table vs client-only | **Client-only**, via IndexedDB behind `SyncEngine`. No `sync_outbox` table. |
| 3 | Realtime cross-device sync | **Deferred to Cloud Sync Phase 2.1.** This milestone ships launch/foreground/manual-refresh only. |
| 4 | Retry threshold before surfacing an error | **Configurable via `SyncPolicy`** (`retryCount`, `retryInterval`, `backoff`, `surfaceErrorAfter`), not hardcoded — ships with sensible defaults, tunable without touching retry logic. |
| 5 | Block sign-out on pending writes? | **Yes — blocked**, with an explicit "Sync Now / Leave Anyway / Cancel" choice. Never silently discarded. |
| 6 | Dedicated sync service? | **Adopted** — `SyncEngine` (§5a) is the sole owner of the outbox and all Supabase writes for queued mutations. Components and `App.tsx` never talk to Supabase or IndexedDB directly for these. |

**Architecture approved as amended. Ready to begin Milestone 2 implementation on your go-ahead.**
