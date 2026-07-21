/**
 * Explicit, versioned localStorage migration.
 *
 * Replaces the pattern previously in App.tsx:
 *   parsedState.completedLessons = parsedState.completedLessons || {};
 *   parsedState.bookmarks = parsedState.bookmarks || {};
 *   ...(11 more lines like this)...
 * flagged in ARCHITECTURE.md §2 / §5 and ROADMAP.md Phase 1 as a real risk:
 * that pattern has no way to tell "brand new user" apart from "an old saved
 * shape genuinely missing a field due to a bug," and there's no record of
 * what shape a saved blob is actually in.
 *
 * The approach here: every saved blob carries an explicit `schemaVersion`.
 * Loading data walks it forward through a numbered chain of migration
 * functions, one per version bump, each documented with what changed and
 * why. A version with no migration function needed just passes through
 * unchanged (rare, but happens — e.g. purely additive optional fields).
 *
 * This is deliberately generic (`migrateVersioned<T>`) so the same pattern
 * covers both `StudyPlanState` (STORE_KEY) and `Profile` (PROFILE_STORE_KEY)
 * in App.tsx, rather than writing this logic twice.
 */

export interface Versioned {
  schemaVersion: number;
}

export interface MigrationStep<T> {
  /** The version this function migrates FROM. Its output must satisfy `fromVersion + 1`. */
  fromVersion: number;
  description: string;
  migrate: (data: any) => any;
}

/**
 * Walks `raw` forward through `steps` (sorted by fromVersion) until it
 * reaches `currentVersion`, then stamps that version onto the result.
 * `raw` may be `null`/`undefined` (no saved data), an unversioned legacy
 * blob (`schemaVersion` absent, treated as version 0), or already current.
 */
export function migrateVersioned<T extends Versioned>(
  raw: any,
  currentVersion: number,
  steps: MigrationStep<T>[],
  createDefault: () => T,
): T {
  // A brand-new user (no saved data) is NOT special-cased to skip the
  // migration chain — it starts as an empty version-0 object and runs
  // through every step exactly like a real migrated blob would. This
  // matters: migration steps can contain one-time seeding logic (see
  // studyPlanStateMigration.ts's PMI-PBA preDone seed), and a brand-new
  // user needs that seed applied just as much as an old saved blob does.
  // `createDefault()` supplies the base shape for any fields a migration
  // step doesn't itself set.
  let data: any = raw === null || raw === undefined ? {} : raw;
  let version: number = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  const sortedSteps = [...steps].sort((a, b) => a.fromVersion - b.fromVersion);

  while (version < currentVersion) {
    const step = sortedSteps.find(s => s.fromVersion === version);
    if (!step) {
      // No migration registered for this version — nothing else to do but
      // stamp forward. This is the generic-additive-field case, not a bug.
      break;
    }
    data = step.migrate({ ...createDefault(), ...data });
    version += 1;
  }

  return { ...createDefault(), ...data, schemaVersion: currentVersion };
}
