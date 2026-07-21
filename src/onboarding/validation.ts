/**
 * Shared validation for the 5 profile steps — used identically by the
 * onboarding wizard (gates "Continue") and Preferences (shows inline errors
 * on save). One set of rules, not two, per the explicit instruction that
 * onboarding and Preferences differ only in *context* (guided-first-time vs.
 * editable-after), never in what's considered valid.
 */
import { Profile, OnboardingStep } from '../models/types';

export function validateStep(step: OnboardingStep, profile: Profile): string | null {
  switch (step) {
    case 'identity':
      if (!profile.name.trim()) return 'Enter your name.';
      if (!profile.username || !profile.username.trim()) return 'Enter a username.';
      if (!/^[a-zA-Z0-9_]{3,15}$/.test(profile.username)) {
        return 'Username must be 3-15 characters long and contain only letters, numbers, or underscores.';
      }
      if (!profile.email || !profile.email.trim()) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        return 'Enter a valid email address.';
      }
      if (!profile.country.trim()) return 'Enter your country.';
      if (!profile.timezone.trim()) return 'Select your time zone.';
      return null;
    case 'career':
      if (profile.isStudent) {
        if (!profile.university || !profile.university.trim()) return 'Enter your university or college name.';
        if (!profile.major || !profile.major.trim()) return 'Enter your major or field of study.';
        if (!profile.academicYear || !profile.academicYear.trim()) return 'Select your academic year.';
        if (!profile.currentSemester || !profile.currentSemester.trim()) return 'Select your current academic semester.';
        if (!profile.expectedGraduation || !profile.expectedGraduation.trim()) return 'Enter your expected graduation date.';
        if (!profile.currentGpa || !profile.currentGpa.trim()) return 'Enter your current GPA.';
        if (!profile.targetJob || !profile.targetJob.trim()) return 'Enter your target career or job role.';
      } else {
        if (!profile.currentJob || !profile.currentJob.trim()) return 'Enter your current job.';
        if (!profile.targetJob || !profile.targetJob.trim()) return 'Enter your target job.';
      }
      return null;
    case 'certification':
      if (profile.learningGoals.length === 0) return 'Add at least one learning goal.';
      return null;
    case 'schedule':
      if (profile.biWeeklyEnabled) {
        if (profile.workingDays.length === 0 && (!profile.workingDaysWeekB || profile.workingDaysWeekB.length === 0)) {
          return 'Select at least one working day for either Week A or Week B.';
        }
      } else {
        if (profile.workingDays.length === 0) return 'Select at least one working day.';
      }
      if (profile.studyWindows.length === 0) return 'Add at least one study window.';
      if (profile.studyWindows.some(w => !w.startTime || !w.endTime)) return 'Every study window needs a start and end time.';
      if (profile.studyWindows.some(w => w.minutes <= 0)) return 'Every study window needs a positive duration — check the start and end times.';
      if (profile.vacationRanges && profile.vacationRanges.some(v => !v.start || !v.end)) {
        return 'Every vacation range needs a start and end date.';
      }
      if (profile.learningGoals) {
        for (const goal of profile.learningGoals) {
          const milestones = profile.learningGoalDetails?.[goal]?.milestones || [];
          const examMilestone = milestones.find(m => m.type === 'Exam' || m.type === 'Certification' || m.type === 'Deadline');
          if (examMilestone && !examMilestone.date) {
            return `Please select a target exam date for "${goal}".`;
          }
        }
      }
      return null;
    case 'learning_style':
      if (!profile.learningStyle) return 'Choose a learning style — the AI Coach uses this to tailor its explanations.';
      return null;
    case 'complete':
      return null;
  }
}

export const STEP_ORDER: OnboardingStep[] = ['identity', 'career', 'certification', 'schedule', 'learning_style'];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  identity: 'About you',
  career: 'Career & Academic path',
  certification: 'Learning goals',
  schedule: 'Schedule',
  learning_style: 'Learning style',
  complete: 'Done',
};
