/**
 * Versioned migration for the legacy StudyPlanState (STORE_KEY in App.tsx).
 *
 * Version 0 = "whatever shape was saved before this file existed" — every
 * blob saved by the app prior to this change has no `schemaVersion` field
 * at all, so `migrateVersioned()` treats that absence as version 0
 * automatically (see localStorageMigration.ts).
 *
 * Version 1 = the shape as of this Phase 1 change: same fields as before,
 * now with an explicit, documented fill-in step instead of 13 unexplained
 * `x = x || default` lines, and the PMI-PBA seed-on-first-load step made an
 * explicit part of the migration chain instead of a separate ad-hoc check.
 */
import { StudyPlanState } from '../services/Sync/types';
import { PMIPBA_SECTIONS } from '../data';
import { migrateVersioned, MigrationStep, Versioned } from './localStorageMigration';

export const CURRENT_STUDY_PLAN_SCHEMA_VERSION = 1;

function defaultStudyPlanState(): StudyPlanState {
  return {
    completedLessons: {},
    bookmarks: {},
    difficulty: {},
    priority: {},
    revisionDates: {},
    salary: { current: "", mid: "", target: "" },
    streak: 0,
    bestStreak: 0,
    lastStudyDate: null,
    studyLog: {},
    lessonsLog: {},
    interviewAnswers: {},
    journal: [],
    notes: {},
    richNotes: {},
    completionDates: {},
    completionTimes: {},
    assignments: [],
    quizAttempts: [],
  } as unknown as StudyPlanState;
}

const steps: MigrationStep<StudyPlanState & Versioned>[] = [
  {
    fromVersion: 0,
    description:
      'Fill in every field a v0 blob might be missing (fields added to the app after that ' +
      'user\'s data was first saved), and run the one-time PMI-PBA Section 0 "preDone" seed ' +
      'if it has not run yet. Explicit and documented, replacing 13 unexplained `x = x || {}` ' +
      'lines that gave no indication of what each field was for or why it might be missing.',
    migrate: (data: any) => {
      // `data` here already has every default field filled in — migrateVersioned()
      // applies createDefault() before calling this step. Only the one-time
      // seed logic is this step's own responsibility.
      const migrated = { ...data };

      if (!migrated._seeded) {
        const preDone = PMIPBA_SECTIONS[0]?.preDone || 0;
        for (let i = 0; i < preDone; i++) {
          migrated.completedLessons[`pmipba-s0-l${i}`] = true;
        }
        migrated._seeded = true;
      }

      return migrated;
    },
  },
];

export function loadStudyPlanState(raw: any): StudyPlanState & Versioned {
  return migrateVersioned<StudyPlanState & Versioned>(
    raw,
    CURRENT_STUDY_PLAN_SCHEMA_VERSION,
    steps,
    () => defaultStudyPlanState() as StudyPlanState & Versioned,
  );
}
