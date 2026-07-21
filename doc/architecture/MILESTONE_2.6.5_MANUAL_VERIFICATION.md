# Milestone 2.6.5 — Manual Verification Guide

Status: **CHECKPOINT — no code in this milestone.** Walk through every scenario
below with `NoopTransport` still in place and the scheduler still disabled
(both unchanged since 2.6.1). This is the last checkpoint before the live
Supabase validation checklist (`supabase/VALIDATION_CHECKLIST_0004.md`) and
the transport swap (2.6.6/2.6.7).

## Prerequisites

1. Run the app locally (`npm run dev`) with Supabase configured (`.env` /
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` set) and at least one
   real test account you can sign in with.
2. Open your browser's DevTools → **Application** tab (Chrome/Edge) or
   **Storage** tab (Firefox) → **IndexedDB** → `himam-sync-outbox` →
   `entries`. This is where every queued Cloud Sync entry lives — you'll be
   checking this object store throughout.
3. Keep the **Console** tab visible too — `NoopTransport` and store-failure
   handling both log via `console.error`, and that's your confirmation signal
   in several scenarios below.

Each scenario has: **Steps**, **Expected result**, and **How to verify**.
Check each one off before moving to the live validation checklist.

---

## 1. Sign in / out with no pending changes

**Steps**
1. Sign in with a test account that has no unsynced local edits.
2. Immediately sign out again (any of: sidebar nav "Logout", profile-card
   footer "Log Out", mobile header "Log Out", Preferences' sign-out, or
   Account Settings' "Sign out").

**Expected result:** Sign-out completes immediately — no dialog appears at
all. This confirms the guard is a no-op in the common case and hasn't
introduced any friction for the overwhelming majority of sign-outs.

**How to verify:** No `SignOutGuardDialog` renders; you're returned to the
signed-out/auth screen exactly as before this milestone existed.

- [ ] Confirmed — instant sign-out, no dialog.

---

## 2. Save a course and confirm an outbox entry is created

**Steps**
1. Sign in.
2. Go to Academy → My Learning → create/save an AI-generated, imported, or
   manual course (whichever flow you'd normally use).
3. Immediately check IndexedDB → `himam-sync-outbox` → `entries`.

**Expected result:** Exactly one new entry appears, with:
- `entityType: "course_save"`
- `payload.course.id` matching the course you just saved
- `payload.sections` and `payload.lessons` populated with the full tree
- `attempts: 0`, no `lastError` yet (nothing has tried to deliver it)

**How to verify:** The course itself should also appear normally in your
Academy view — local save behavior is completely unchanged. The outbox entry
is the new, additional thing to confirm.

- [ ] Confirmed — course saved locally as before, and exactly one
      `course_save` entry appeared in `himam-sync-outbox`.

---

## 3. Edit profile fields and confirm `profile_field` entries are queued

**Steps**
1. While signed in, go to Preferences (or Account Settings) and change a
   couple of tracked fields — e.g. `timezone` and `careerGoal` — in the same
   sitting.
2. Wait at least 1.2 seconds (the existing debounce) after your last edit.
3. Check IndexedDB → `himam-sync-outbox` → `entries`.

**Expected result:** One `profile_field` entry per **changed** field — not
one entry for the whole profile, and not entries for fields you didn't touch.
Each entry's `payload.column` should match the DB column for that field (e.g.
`timezone`, `career_goal` — note the snake_case), and `payload.value` should
match what you set.

**How to verify:** Count the new entries against exactly how many fields you
changed. If you only changed 2 fields, you should see exactly 2 new
`profile_field` entries, not more.

- [ ] Confirmed — one `profile_field` entry per changed field, correct
      column names and values.

**Also confirm:** if you sign in fresh (or right after the local→cloud
migration on first login) and *don't* touch anything, no `profile_field`
entries should appear — that's the "no baseline yet, observe-only" behavior
from 2.6.3, not a bug.

- [ ] Confirmed — no spurious entries right after a fresh sign-in with no
      edits made.

---

## 4. Verify the sign-out guard appears when pending work exists

**Steps**
1. With at least one queued entry still sitting in `himam-sync-outbox` (from
   scenario 2 or 3 — don't clear it), attempt to sign out from any entry
   point (sidebar, profile card, mobile header, Preferences, Account
   Settings).

**Expected result:** The `SignOutGuardDialog` appears instead of signing out
immediately, showing the current pending count and three buttons: **Sync
Now**, **Leave Anyway**, **Cancel**.

**How to verify:** You should still be signed in after this step — the
dialog blocks, it doesn't sign you out on its own.

- [ ] Confirmed — dialog appears with the correct pending count, from every
      entry point you test.

---

## 5. Verify "Leave Anyway" signs out

**Steps**
1. With the dialog open (from scenario 4), click **Leave Anyway**.

**Expected result:** You're signed out immediately, despite the pending
entries. Nothing is silently discarded — the entries remain in
`himam-sync-outbox` (IndexedDB persists independently of your auth session).

**How to verify:** You land on the signed-out/auth screen. Re-open IndexedDB
→ `himam-sync-outbox` → `entries` — the same entries from before are still
there, untouched.

- [ ] Confirmed — sign-out completes, entries remain queued (not deleted).

---

## 6. Verify "Cancel" aborts sign-out

**Steps**
1. Trigger the dialog again (repeat scenario 4 — sign back in first if you
   left in scenario 5, then re-create a pending entry via scenario 2 or 3).
2. Click **Cancel**.

**Expected result:** The dialog closes, you remain signed in, nothing
happens — no sign-out, no change to the outbox.

**How to verify:** You're still on the same screen you were on before
attempting to sign out; the app is fully usable.

- [ ] Confirmed — dialog closes, sign-out is aborted, session is untouched.

---

## 7. Verify the outbox persists after restarting the app

**Steps**
1. With at least one pending entry in `himam-sync-outbox`, fully close the
   browser tab (or the whole browser) — don't just navigate away.
2. Reopen the app and sign back in with the same account, same device.
3. Check IndexedDB → `himam-sync-outbox` → `entries`.

**Expected result:** The same entries are still there, exactly as they were
— IndexedDB survives the tab/browser closing (unlike the pre-Cloud-Sync
debounced save, which explicitly could lose an in-flight write on close).

**How to verify:** Compare entry `id`s before closing and after reopening —
they should be identical, not regenerated or duplicated.

- [ ] Confirmed — entries survive a full close-and-reopen cycle, byte-for-byte.

---

## 8. Verify behavior with `NoopTransport` still active

**Steps**
1. With at least one pending entry, open the dialog (scenario 4) and click
   **Sync Now**.
2. Watch the Console tab and the dialog's pending count.
3. Check the entry in IndexedDB afterward.

**Expected result:**
- The dialog shows a brief "Syncing…" state, then the pending count stays
  the same (or updates but doesn't reach zero) — "Sync Now" cannot succeed
  yet, by design.
- The Console logs an error containing **"Milestone 2.3"** — that's
  `NoopTransport`'s explicit rejection message, confirming this is the
  expected placeholder failure, not a real bug.
- The entry's `attempts` count increments by 1, and `lastError` now contains
  that same message.
- The entry is **not** deleted — nothing is silently lost.
- The dialog remains open, still offering all three choices (you didn't get
  stuck — "Leave Anyway" and "Cancel" both still work from here).

**How to verify:** Re-check IndexedDB after clicking "Sync Now" — `attempts`
should have gone from its previous value to `+1`, and `lastError` should be
populated with the `NoopTransport` message.

- [ ] Confirmed — "Sync Now" fails safely, logs the expected placeholder
      error, increments `attempts`, and never deletes the entry.

---

## Sign-off

| # | Scenario | Result |
|---|---|---|
| 1 | Sign in/out, nothing pending | ☐ Pass ☐ Fail |
| 2 | Course save → outbox entry | ☐ Pass ☐ Fail |
| 3 | Profile edits → per-field entries | ☐ Pass ☐ Fail |
| 4 | Guard appears when pending | ☐ Pass ☐ Fail |
| 5 | Leave Anyway signs out | ☐ Pass ☐ Fail |
| 6 | Cancel aborts sign-out | ☐ Pass ☐ Fail |
| 7 | Outbox persists across restart | ☐ Pass ☐ Fail |
| 8 | NoopTransport fails safely | ☐ Pass ☐ Fail |

Once every row above is checked off, proceed to **Milestone 2.6.6 — Live
Supabase Validation Checklist** (`supabase/VALIDATION_CHECKLIST_0004.md`),
and only after that passes in full, **Milestone 2.6.7 — Transport Swap**
(replacing `NoopTransport` with `SupabaseSyncTransport` and starting
`SyncScheduler` for the first time), per
`APPLICATION_INTEGRATION_PLAN.md` §3.
