/**
 * Versioned migration for Profile (PROFILE_STORE_KEY in App.tsx).
 *
 * Given the same explicit versioning treatment as StudyPlanState from day
 * one — this is where migration logic goes instead of another ad-hoc
 * `{...DEFAULT_PROFILE, ...saved}` spread that silently drops any
 * explanation of what changed between saves.
 */
import { Profile, OnboardingStep } from './types';
import { DEFAULT_PROFILE } from './defaultProfile';
import { migrateVersioned, MigrationStep, Versioned } from './localStorageMigration';

export const CURRENT_PROFILE_SCHEMA_VERSION = 10;

const steps: MigrationStep<Profile & Versioned>[] = [
  {
    fromVersion: 0,
    description: 'Initial version — merge any saved fields over the current DEFAULT_PROFILE shape.',
    migrate: (data: any) => ({ ...DEFAULT_PROFILE, ...data }),
  },
  {
    fromVersion: 1,
    description:
      'Added onboardingCompleted/onboardingStep (Phase 2). This step alone cannot tell a ' +
      'genuinely brand-new profile apart from a real v1 profile that already existed before ' +
      'this field did — both look identical by the time they reach this step (see ' +
      'localStorageMigration.ts: even "no saved data" flows through the full chain). ' +
      'loadProfile() below resolves that ambiguity using the ORIGINAL raw input, before any ' +
      'migration ran — this step just guarantees the fields exist with a safe default.',
    migrate: (data: any) => ({
      ...data,
      onboardingCompleted: typeof data.onboardingCompleted === 'boolean' ? data.onboardingCompleted : false,
      onboardingStep: (data.onboardingStep as OnboardingStep) || 'identity',
    }),
  },
  {
    fromVersion: 2,
    description: 'Renamed certifications to learningGoals for flexible targets (languages, degrees, skills, etc).',
    migrate: (data: any) => {
      const learningGoals = data.learningGoals || data.certifications || [];
      const { certifications, ...rest } = data;
      return { ...rest, learningGoals };
    }
  },
  {
    fromVersion: 3,
    description:
      'Added learningGoalDetails (optional per-goal category + course link metadata). ' +
      'Existing profiles have no entries for goals added before this field existed — an ' +
      'empty object is the correct, lossless default (every reader already treats a missing ' +
      'key as "no category, no link", not an error).',
    migrate: (data: any) => ({
      ...data,
      learningGoalDetails: data.learningGoalDetails || {},
    }),
  },
  {
    fromVersion: 4,
    description: 'Added dailyGoalMinutes to track target daily study minutes.',
    migrate: (data: any) => ({
      ...data,
      dailyGoalMinutes: typeof data.dailyGoalMinutes === 'number' ? data.dailyGoalMinutes : 30,
    }),
  },
  {
    fromVersion: 5,
    description: 'Added student-specific tracking fields: isStudent, university, major, and academicYear.',
    migrate: (data: any) => ({
      ...data,
      isStudent: typeof data.isStudent === 'boolean' ? data.isStudent : false,
      university: data.university || '',
      major: data.major || '',
      academicYear: data.academicYear || '',
    }),
  },
  {
    fromVersion: 6,
    description: 'Added advanced student fields: semester-aware planning, GPA, courses, graduation target, internship metrics, and capstone tracking.',
    migrate: (data: any) => ({
      ...data,
      currentSemester: data.currentSemester || '',
      currentGpa: data.currentGpa || '',
      currentCourses: data.currentCourses || '',
      expectedGraduation: data.expectedGraduation || '',
      internshipApps: typeof data.internshipApps === 'number' ? data.internshipApps : 0,
      internshipInterviews: typeof data.internshipInterviews === 'number' ? data.internshipInterviews : 0,
      internshipOffers: typeof data.internshipOffers === 'number' ? data.internshipOffers : 0,
      capstoneTopic: data.capstoneTopic || '',
      capstoneStatus: data.capstoneStatus || 'not_started',
    }),
  },
  {
    fromVersion: 7,
    description: 'Added detailed internship lists, expanded capstone tracker fields, academic events calendar, and per-course note-taking structures.',
    migrate: (data: any) => ({
      ...data,
      internshipApplications: data.internshipApplications || [],
      capstoneSupervisor: data.capstoneSupervisor || '',
      capstoneDeadline: data.capstoneDeadline || '',
      capstoneDeliverables: data.capstoneDeliverables || '',
      capstoneMilestones: data.capstoneMilestones || '',
      academicEvents: data.academicEvents || [],
      courseProgress: data.courseProgress || {},
    }),
  },
  {
    fromVersion: 8,
    description: 'Added email address configuration field.',
    migrate: (data: any) => ({
      ...data,
      email: data.email || '',
    }),
  },
  {
    fromVersion: 9,
    description: 'Added user language preference with browser auto-detection fallback.',
    migrate: (data: any) => ({
      ...data,
      language: data.language || (typeof navigator !== 'undefined' && (navigator.languages || [navigator.language]).some(l => l.toLowerCase().startsWith('ar')) ? 'ar' : 'en'),
    }),
  },
];

export function loadProfile(raw: any): Profile & Versioned {
  const migrated = migrateVersioned<Profile & Versioned>(
    raw,
    CURRENT_PROFILE_SCHEMA_VERSION,
    steps,
    () => DEFAULT_PROFILE as Profile & Versioned,
  );

  // Brand-new profile (nothing was ever saved): the default of
  // onboardingCompleted=false / onboardingStep='identity' from the step
  // above is exactly right — show the wizard from the start.
  if (raw === null || raw === undefined) {
    return migrated;
  }

  // A real, previously-saved profile whose raw data has no onboarding fields
  // at all is, by definition, from before this feature existed — grandfather
  // it as already complete rather than retroactively interrupting someone
  // who's been using the app since Phase 1.5 with a wizard that didn't exist
  // when they started. Anyone whose raw data DOES have onboardingCompleted
  // explicitly set (true, or false because they're genuinely mid-flow) keeps
  // exactly that value and step — this is what makes onboarding resumable.
  if (typeof raw.onboardingCompleted !== 'boolean') {
    return { ...migrated, onboardingCompleted: true, onboardingStep: 'complete' };
  }

  return migrated;
}
