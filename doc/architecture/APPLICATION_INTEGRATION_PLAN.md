# Application Integration Plan — Milestone 2.6

Status: **PLANNING ONLY — no application code changed yet.** For review before
integration begins. Grounded in the actual current wiring of `App.tsx`,
`MyLearning.tsx`, and `AuthProvider.tsx` (not a generic integration template).

---

## 0. What "integration" actually means here

Milestones 2.1–2.5 built a complete, tested `SyncEngine` (queue, IndexedDB
persistence, transport/repository abstraction, per-field profile diffing,
backoff/retry, events, scheduler, sign-out guard logic) that **nothing in the
app calls**. Integration is the process of giving it real call sites, in the
smallest possible increments, without touching what already works:

- `App.tsx`'s existing debounced `saveCloudProgress`/`saveCloudProfile`
  effects (lines ~176–183) keep running exactly as they do today, unchanged,
  for the whole of this milestone. Cloud Sync is additive alongside them, not
  a replacement — removing the old debounced path is a *future* cleanup,
  explicitly out of scope here (and not safe to do before `SyncEngine` has
  proven itself in production).
- `handleSaveDraft` in `MyLearning.tsx` keeps calling `onUpdateProfile`
  exactly as it does today. A new, separate `engine.enqueue(...)` call sits
  alongside it.
- `AuthProvider.tsx`'s `signOut()` keeps working for anyone with nothing
  pending (the overwhelmingly common case throughout this milestone, since
  `NoopTransport` means nothing ever confirms as synced) — only gains a guard
  for the pending-writes case.

This is the concrete meaning of "keep synchronization infrastructure isolated"
carried one step further: isolated *up to the exact point of the call site*,
never replacing existing logic outright until the final swap.

---

## 1. Lifecycle ownership

**One `SyncEngine` instance per signed-in session, owned by `App.tsx`.**

- Created (via `createSyncEngine()`) inside the existing sign-in effect
  (`App.tsx`, the effect keyed on `[user?.id, configured]`) once
  `cloudSyncState` reaches `'ready'` — the same point the existing
  `saveCloudProgress`/`saveCloudProfile` debounce effects already gate on.
  There's no reason for `SyncEngine` to exist, or hold an IndexedDB
  connection open, for a signed-out/local-only user.
- Held in a `useRef` (not `useState` — the engine instance itself doesn't
  need to trigger re-renders; only its *status* would, if a future UI
  indicator is ever added, via `engine.on(...)`).
- Torn down on sign-out: no explicit "close" method exists on `SyncEngine`
  today (nor does IndexedDB require one — connections are lightweight and
  garbage-collected), so "teardown" here means: stop the `SyncScheduler`
  (see below) and drop the ref, not attempt to synchronously flush
  outstanding IndexedDB entries — that data persists in IndexedDB regardless
  and will be picked up again on the next sign-in to the same account, on
  the same device.
- **Not** a React Context in this milestone. Only three call sites need the
  engine (`MyLearning.tsx`'s `handleSaveDraft`, the profile-write-through
  effect, `AuthProvider.tsx`'s `signOut`), and all three are reachable via
  props from `App.tsx` already — introducing a Context for three call sites
  is unwarranted ceremony. Revisit if a fourth, deeper call site appears.

**`SyncScheduler` ownership mirrors the engine's**: constructed alongside it,
`.start()` called once — but not in this milestone (see §3, Production
Enablement Order). Constructing a `SyncScheduler` against a `NoopTransport`
means every periodic tick calls `drain()`, which calls `transport.send()`,
which always throws — harmless (errors are caught inside `attemptDelivery`),
but pure wasted work. The scheduler is wired in code during 2.6, but its
`.start()` call is gated behind the transport swap (§3, step 6).

---

## 2. Integration sequence (one application area per sub-step)

Each sub-step below is independently reviewable and independently revertable
— exactly the granularity used for 2.1–2.5.

### 2.6.1 — Engine plumbing in `App.tsx` (no call sites yet)
Construct `SyncEngine` in the sign-in effect once `cloudSyncState === 'ready'`;
drop the ref on sign-out. Pass the engine down as a prop to `MyLearning`
(alongside the existing `onUpdateProfile` etc.) and expose it to
`AuthProvider`'s consumer (however that's threaded — likely a prop into the
component that calls `useAuth().signOut`, not into `AuthProvider` itself,
since the engine is a Cloud Sync concern and `AuthProvider` shouldn't import
`services/sync`). **No `enqueue()` calls exist yet.** This step proves the
engine can live in the app's component tree and be created/destroyed on the
sign-in/sign-out cycle without changing any existing behavior — zero-risk,
since nothing calls it yet.

### 2.6.2 — Course save integration (`MyLearning.tsx`)
Inside `handleSaveDraft`, after the existing `onUpdateProfile(...)` call
succeeds (unchanged), add `engine.enqueue({ entityType: 'course_save',
payload: { course, sections, lessons } })`. This is the single most important
call site — it's the one the whole Milestone 1 audit was originally about.
Verify manually (dev tools → IndexedDB → `himam-sync-outbox`) that saving a
course produces exactly one queued entry with the right shape.

### 2.6.3 — Profile field integration (`App.tsx`'s profile-write-through effect)
The existing debounced effect (`profileWriteTimer`, keyed on `[profile, user,
configured, cloudSyncState]`) already has the "before" and "after" profile
available across renders via a ref snapshot. Add: keep a
`previousProfileRef`, and on each profile-write effect firing, call
`enqueueProfileChanges(engine, user.id, previousProfileRef.current, profile)`
before updating the ref — alongside, not instead of, the existing
`saveCloudProfile(user.id, profile)` call in the same effect.

### 2.6.4 — Sign-out guard (`AuthProvider.tsx` + new dialog)
Wrap the existing `signOut` implementation: call `evaluateSignOut(engine)`
first. If `'proceed'`, call the existing `supabase.auth.signOut(...)`
unchanged. If `'blockedPendingWrites'`, surface the three-way choice ("Sync
Now" → `attemptSyncThenSignOut`, "Leave Anyway" → proceed regardless, "Cancel"
→ abort) via a new small dialog component — not a change to `AuthProvider`'s
existing success-path behavior for the (currently near-universal, since
`NoopTransport` never confirms) empty-queue case.

### 2.6.5 — Manual verification pass
With 2.6.2–2.6.4 in place and `NoopTransport` still the transport, confirm:
queued entries accumulate correctly in IndexedDB across a real save/profile-
edit session, sign-out correctly blocks when entries are pending, and "Leave
Anyway" correctly proceeds. This step produces no code — it's a checkpoint
before touching the transport at all.

### 2.6.6 — Live Supabase validation checklist (production gate)
Run `supabase/VALIDATION_CHECKLIST_0004.md` in full against a real project —
**not code**, a manual/operational step, owned by you. Nothing in 2.6.7
begins until every row on that checklist is checked off.

### 2.6.7 — Transport swap
Only after 2.6.6 passes: change `DefaultSyncEngine`'s constructed transport
(where `App.tsx` calls `createSyncEngine(...)`, not the class default) from
implicit `NoopTransport` to `new SupabaseSyncTransport()`, and call
`syncScheduler.start()` for the first time. This is the single line that
turns Cloud Sync from "queues locally, never delivers" into "actually
reaches Supabase" — deliberately the very last code change in this
milestone, not bundled with 2.6.2–2.6.4.

### 2.6.8 — End-to-end verification
With the real transport live: save a course, confirm it appears in Supabase
(`courses`/`sections`/`lessons` tables) and on a second device/session for
the same account; edit a profile field, confirm the same; attempt sign-out
with a deliberately offline network, confirm the guard blocks and "Sync Now"
recovers once reconnected.

---

## 3. Production enablement order (the gate sequence, stated plainly)

```
2.6.1  Engine lifecycle wired,  NoopTransport   → safe, inert
2.6.2  Course save enqueues,    NoopTransport   → queues locally only
2.6.3  Profile enqueues,        NoopTransport   → queues locally only
2.6.4  Sign-out guard active,   NoopTransport   → blocks correctly, nothing ever "syncs"
2.6.5  Manual verification                     → checkpoint, no code
2.6.6  Live validation checklist (real Supabase)→ PRODUCTION GATE — must pass in full
2.6.7  Transport swap + scheduler start         → only after 2.6.6 passes
2.6.8  End-to-end verification                  → confirms 2.6.7 actually works
```

`SupabaseSyncTransport` does not become real until step 7, and step 7 does
not happen until step 6 is fully checked off — exactly the order you
specified. Steps 1–5 are deliberately safe to ship and even to leave running
in production for a period before 2.6.6 is scheduled, since `NoopTransport`
guarantees nothing leaves the device early.

---

## 4. What this milestone does not do

- Does not remove `App.tsx`'s existing debounced `saveCloudProgress`/
  `saveCloudProfile` effects — they keep running throughout, and their
  eventual retirement (once `SyncEngine` has proven itself) is a distinct,
  future decision, not part of 2.6.
- Does not add lesson-progress (`lesson_progress`) enqueueing — the
  transport/repository already support it (Milestone 2.3), but no
  milestone plan has asked for that call site yet; flagging it here as an
  open scope question rather than silently including it.
- Does not build a `SyncStatus` UI indicator (spinner, "syncing" badge,
  etc.) — nothing in the roadmap through 2.6 has requested one; the event
  bus and `computeSyncEntryState` exist and are ready for that whenever it's
  asked for.
- Does not touch `DefaultSyncEngine`'s own default transport (the class
  still defaults to `NoopTransport` for anyone constructing it without
  arguments) — only the one call site in `App.tsx` passes a real transport,
  and only from step 7 onward.
