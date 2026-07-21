/**
 * Default/seed Profile.
 *
 * Before Phase 2 (User Onboarding) exists, the app has no UI to collect a
 * Profile from the user — but App.tsx's state needs *a* Profile object now,
 * because components are being migrated to read `profile.name` etc. instead
 * of a literal "Ahmad" string hardcoded in each file individually.
 *
 * This is the ONE place that value now lives. Previously it was duplicated
 * (with drift risk) across App.tsx's sidebar, Dashboard.tsx's greeting,
 * Roadmap.tsx's career-step copy, and the Gemini coach prompt in
 * Dashboard.tsx (see ARCHITECTURE.md §2, "Identity is hardcoded into strings").
 *
 * Phase 2 replaces this constant with real onboarding-collected data,
 * persisted the same way. Nothing that reads `profile.*` needs to change
 * when that happens — only where the Profile value comes from changes.
 */
import { Profile } from './types';

export const DEFAULT_PROFILE: Profile = {
  id: 'local-user',
  name: '',
  username: '',
  email: '',
  country: '',
  timezone: '',
  language: typeof navigator !== 'undefined' && (navigator.languages || [navigator.language]).some(l => l.toLowerCase().startsWith('ar')) ? 'ar' : 'en',
  careerGoal: '',
  currentJob: '',
  targetJob: '',
  currentSalary: '',
  targetSalary: '',
  isStudent: false,
  university: '',
  major: '',
  academicYear: '',
  currentSemester: '',
  currentGpa: '',
  currentCourses: '',
  expectedGraduation: '',
  internshipApps: 0,
  internshipInterviews: 0,
  internshipOffers: 0,
  internshipApplications: [],
  capstoneTopic: '',
  capstoneStatus: 'not_started',
  capstoneSupervisor: '',
  capstoneDeadline: '',
  capstoneDeliverables: '',
  capstoneMilestones: '',
  academicEvents: [],
  courseProgress: {},
  learningGoals: [],
  learningGoalDetails: {},
  workingDays: [],
  extraWorkingDays: [],
  vacationRanges: [],
  holidays: [],
  studyWindows: [],
  onboardingCompleted: false,
  onboardingStep: 'identity',
  dailyGoalMinutes: 30,
};
