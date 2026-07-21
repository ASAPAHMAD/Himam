# Himam (همم) Branding Transition Checklist

> **Status update**: the "low-risk, do first" batch from the sequencing section below has been
> executed (see `CHANGELOG.md` [Unreleased]) — `index.html`, `metadata.json`, `package.json`,
> sidebar header/tagline, and remaining "Study Plan"/"Study Planner" UI copy in `AuthScreen.tsx`/
> `StudyCenter.tsx`/`Calendar.tsx`. The deliberate, migration-backed pass (localStorage key,
> lesson-id prefixes) has NOT been done — still needs the same care as any other data migration
> in this project, not a find-and-replace.

Generated as a controlled pre-Phase-2 review, per direction after v0.3.0 finalization. This
document **identifies and classifies** every remaining reference to the old branding — it does
**not** rename anything. Renaming is a separate, future, deliberate pass once this checklist is
reviewed and sequenced.

## Classification legend

| # | Category | Meaning |
|---|---|---|
| 1 | Product branding | User-facing name/tagline — this is what actually needs to change for the rebrand to be real |
| 2 | Placeholder content | Sample/seed values (a name, a career goal) standing in for real user data until Phase 2 onboarding exists |
| 3 | Legacy technical reference | Internal identifiers, variable names, comments describing *why* code is shaped the way it is — renaming risks breaking working migrations/ids for cosmetic reasons |
| 4 | Documentation | Historical record in `ARCHITECTURE.md`/`ROADMAP.md`/`CHANGELOG.md` — describes what was actually built and named at the time |
| 5 | Test data | Fixture values inside verification scripts — arbitrary, just need to stay internally consistent |

---

## "Study Plan" / "study-plan"

| File | Location | Category | Notes |
|---|---|---|---|
| `index.html` | `<title>Study Plan — Ahmad Alharthi</title>` | 1 | Browser tab title — the single most visible rename target |
| `metadata.json` | `"name": "Study Plan"` | 1 | Also see Bonus Finding below — this file's `description` still says "Gemini AI coaching," stale since the OpenAI switch, independent of branding |
| `package.json` | `"name": "study-plan"` | 1 | npm package name — cosmetic only (not published), but should match |
| `src/App.tsx:320` | `Study <span>Plan</span>` sidebar header | 1 | The actual rendered product name in the UI |
| `src/App.tsx:323` | `"PL-300 & PMI-PBA Tracker"` sidebar subtitle | 1 | Tagline — also touches the PL-300/PMI-PBA section below |
| `src/components/AuthScreen.tsx:92` | `"Study Plan"` shown above the sign-in form | 1 | Ported from the auth branch as-is; never updated for this product's name |
| `src/components/StudyCenter.tsx:395` | `"Study Plan & Scheduler"` section header | 1 | UI copy |
| `src/components/Calendar.tsx:280` | `"Study Planner Daily Audit"` | 1 | UI copy |
| `PRODUCT_SPEC.md` | 8 occurrences (title, vision, feature names) | 4 | Documentation — describes the product as named when the spec was approved |
| `ARCHITECTURE.md` | 1 occurrence | 4 | Documentation |
| `src/types.ts`, `src/App.tsx`, `src/models/studyPlanStateMigration.ts`, etc. | `StudyPlanState` (the TypeScript type name) | 3 | **Recommend NOT renaming.** This is a type identifier used in ~15 files; it's descriptive of what the type holds (legacy per-lesson state), not a product-name leak to users. Renaming it is a mechanical, zero-risk-if-done-carefully but wide-blast-radius change — better scheduled as its own small pass, not bundled into the branding pass. Flagged here so it isn't forgotten, not because it needs to happen with the rest.

---

## "The Ledger"

**Finding: zero occurrences in this codebase.** Searched exhaustively (`grep -rn "Ledger"`, case-sensitive and via file content) across all `.ts`/`.tsx`/`.md`/`.json`/`.html` files — nothing matches, not even in comments. "The Ledger" appears to have been an earlier working name used before this codebase reached me, and it never made it into any file in this repo. Nothing to classify or clean up here.

---

## "Ahmad"

| File | Location | Category | Notes |
|---|---|---|---|
| `index.html` | `<title>Study Plan — Ahmad Alharthi</title>` | 1 | Bundled with the "Study Plan" rename above |
| `src/models/defaultProfile.ts:22` | `name: 'Ahmad Alharthi'` | 2 | This is the seed `Profile` value used until Phase 2 onboarding exists — see the file's own header comment explaining why a placeholder is needed at all right now. Naturally resolved by Phase 2, not something to hand-edit now. |
| `src/models/defaultProfile.ts:7` | Comment: `"...literal 'Ahmad' string hardcoded..."` | 4 | Comment describing the Phase 1 audit finding this file fixed — historical, accurate, not user-facing |
| `src/App.tsx:23` | `STORE_KEY = "ahmad_ledger_v3"` | 3 | **The localStorage key literal.** This is where "Ledger" actually survives, as part of a key string, not a display name. Renaming this key would NOT preserve existing users' saved data unless paired with a migration step (read the old key once, write to the new one) — this is a real, if small, migration task, not a find-and-replace. Recommend sequencing this deliberately, likely alongside whatever Phase 2/3 work next touches `App.tsx`'s storage layer, not as a casual rename. |
| `ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md` | Various (audit findings, commit summaries) | 4 | Documentation — accurately describes what was found/fixed at the time |

---

## "PL-300" / "PMI-PBA"

By far the largest category, because this is genuinely real, working content — Microsoft's actual
Power BI certification and PMI's actual Business Analysis certification — not placeholder text.
Renaming these means one of two very different things depending on the file, and the checklist
splits accordingly:

### Product branding / UI copy — safe to change, no data risk

| File | Location(s) | Category | Notes |
|---|---|---|---|
| `src/components/Dashboard.tsx` | Lines 167, 171, 270–271, 311, 337, 342, 381–382, 384, 387, 400, 409 (labels, AI coach prompt text, pace-status copy) | 1 | All rendered/generated text referencing these two certs by name |
| `src/components/StudyCenter.tsx` | Lines 395, 398, 692, 735, 738, 776, 779 (section headers, empty-state text) | 1 | UI copy |
| `src/components/Calendar.tsx` | Lines 217, 363, 375, 385, 397, 652, 658, 678 (badges, session labels) | 1 | UI copy |
| `src/components/Achievements.tsx` | Lines 49–52 (badge titles: "PL-300 Halfway," "100% PMI-PBA," etc.) | 1 | Badge *copy* — the *unlock logic* underneath (§ below) is different |
| `src/components/Statistics.tsx` | Lines 357, 367 (progress bar labels) | 1 | UI copy — kept as literal strings on purpose during Phase 1 (see `ARCHITECTURE.md` §3 note on the two-course UI freeze); still just copy |
| `src/components/Roadmap.tsx` | Lines 15–16 (career step titles) | 1 | UI copy |
| `src/models/migrateLegacy.ts:34–35` | `name: 'PL-300: Microsoft Power BI Data Analyst'`, `name: 'PMI-PBA: Business Analysis'` | 1 | These are the actual `Course.name` values shown throughout the app — same rename as the UI copy above, just sourced from one place |

### Legacy technical reference — do not rename without a data-migration plan

| File | Location(s) | Category | Notes |
|---|---|---|---|
| `src/types.ts:5` | `course: 'PL-300' \| 'PMI-PBA'` | 3 | The legacy union type itself — still load-bearing for every one of the 180 `ALL_LESSONS` entries and every component that hasn't been touched since Phase 1 kept it for exact behavioral parity |
| `src/data.ts` | `course: 'PL-300'` / `course: 'PMI-PBA'` (2 assignment lines, ~line 162/175) | 3 | Same — literal values assigned when building `ALL_LESSONS` |
| `src/models/migrateLegacy.ts` | `LEGACY_COURSE_IDS.PL300`/`.PMIPBA` = `'course-pl300'`/`'course-pmipba'`, and the `pl300-sX-lY`/`pmipba-sX-lY` id-generation line (~line 59) | 3 | **These specific strings are lesson IDs.** They're the primary keys tying together `localStorage` progress, the `user_progress` Supabase table, and every completed-lesson checkbox a real user has ever clicked. Changing them is not a rename — it's a data migration with the same care `scripts/verifyMigration.ts` was built for. |
| `src/components/StudyCenter.tsx:41,201,442,736,777` | `courseFilter` type/comparisons (`'ALL' \| 'PL-300' \| 'PMI-PBA'`) | 3 | Drives the syllabus filter UI; tied to the same course identity as above |
| `src/models/legacyBridge.ts`, `legacyScheduleAdapter.ts`, `schedulingEngine.ts` | Comments only | 3/4 | Explain *why* the generic engine was built the way it was (references the old hardcoded rule it replaced) — historically accurate comments, not live logic |
| `src/models/id.ts:4` | Comment referencing the old `pl300-s{i}-l{j}` scheme | 4 | Explains a design decision, doesn't affect behavior |
| `supabase/migrations/0001_identity_persistence.sql` | Comment: `-- matches the legacy-derived stable ids exactly (pl300-s0-l0, ...)` | 4 | Comment only |

### Test data

| File | Notes |
|---|---|
| `scripts/verifyMigration.ts`, `scripts/verifyStorageMigration.ts`, `scripts/verifyCloudPersistence.ts` | Use real `'PL-300'`/`'PMI-PBA'` values and real lesson-id prefixes (`pl300-s0-l0`, etc.) specifically *because* they're verifying against the actual legacy data shape — these should track whatever `src/data.ts`/`migrateLegacy.ts` actually contain, not be renamed independently |

### Documentation

`PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md` all reference PL-300/PMI-PBA
extensively and accurately, as the real content this whole project has been built around. No
action needed — this is the historical/audit record, and `CHANGELOG.md` in particular should
almost certainly keep saying "PL-300" and "PMI-PBA" in its pre-rebrand entries, since that's what
actually happened at each point in time.

---

## Bonus finding (not branding, but adjacent — flagging since I was in these files anyway)

`metadata.json`'s `description` field still reads *"...Gemini AI coaching"* — stale since the
Phase 1.5 switch to OpenAI. Same file, same low-risk edit category as the "Study Plan" → "Himam"
name change, worth doing in the same pass rather than a separate one.

---

## Recommended sequencing for the actual rename (when you're ready — not done here)

1. **Low-risk, do first**: `metadata.json`, `package.json`, `index.html`, `AuthScreen.tsx`,
   `App.tsx` sidebar header/subtitle, `StudyCenter.tsx`/`Calendar.tsx`/`Statistics.tsx`/
   `Roadmap.tsx`/`Achievements.tsx`/`Dashboard.tsx` UI copy, and `migrateLegacy.ts`'s `Course.name`
   values. Pure text changes, zero data-model risk, one focused commit.
2. **Placeholder content**: `defaultProfile.ts`'s `name`/`certifications` — likely moot once Phase
   2 onboarding replaces this seed value with real user input anyway; low priority to touch by
   hand.
3. **Deliberate, separate pass**: the `ahmad_ledger_v3` localStorage key and the `pl300-`/`pmipba-`
   lesson-id prefixes. Both need a real migration step (old key/id → new key/id, preserving
   existing data), the same discipline as every `scripts/verify*.ts` script already built in this
   project — not a find-and-replace. Recommend scheduling this deliberately, verified the same way
   Phase 1's migrations were, whenever it's actually prioritized.
4. **Leave alone**: `StudyPlanState` (TypeScript type name — descriptive, not user-facing, wide
   blast radius for zero user-visible benefit), all documentation files (historical record), and
   test-script fixtures (should track real data shape, not be renamed independently of it).
