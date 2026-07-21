import { StudyPlanState } from './Sync/types';
import { Profile, Milestone } from '../models/types';

export interface MonthlyGoal {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  unit: string;
  xpReward: number;
  completed: boolean;
  icon: string;
}

export interface GamificationState {
  xp: number;
  level: number;
  levelName: string;
  nextLevelName: string | null;
  xpInLevel: number;
  xpNeededForNext: number;
  levelProgressPct: number;
  streak: number;
  bestStreak: number;
  monthlyGoals: MonthlyGoal[];
  completedGoalsCount: number;
  recentAchievements: Array<{
    title: string;
    icon: string;
    desc: string;
    unlocked: boolean;
  }>;
}

export const LEVELS = [
  { min: 0, name: "Analyst Trainee" },
  { min: 1000, name: "Analyst I" },
  { min: 2500, name: "Analyst II" },
  { min: 5000, name: "Senior Analyst" },
  { min: 10000, name: "Lead Analyst" },
  { min: 20000, name: "Analytics Manager" }
];

/**
 * Calculates gamification details including XP, Level, Streaks, Monthly Goals, and Achievements
 */
export function calculateGamification(state: StudyPlanState, profile: Profile, referenceDate: Date = new Date()): GamificationState {
  // 1. Calculate XP and Level Info
  const totalMinStudied = (Object.values(state.studyLog || {}) as number[]).reduce((a, b) => a + b, 0);
  
  // XP from study minutes (10 XP per minute)
  let xp = Math.round(totalMinStudied * 10);
  
  // Bonus XP from completed assignments (50 XP per completed assignment)
  const completedAssignmentsCount = (state.assignments || []).filter(a => a.status === 'Completed').length;
  xp += completedAssignmentsCount * 50;

  // Bonus XP from Wrong Answer Journal entries (20 XP per mistake solved/documented)
  const mistakesCount = state.journal?.length || 0;
  xp += mistakesCount * 20;

  // Find Level Info
  let curLevel = LEVELS[0];
  let nextLevel = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) {
      curLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
    }
  }

  const xpInLevel = xp - curLevel.min;
  const xpNeededForNext = nextLevel ? (nextLevel.min - curLevel.min) : 0;
  const levelProgressPct = nextLevel ? Math.min(100, Math.round((xpInLevel / xpNeededForNext) * 100)) : 100;

  // 2. Streaks
  const streak = state.streak || 0;
  const bestStreak = state.bestStreak || 0;

  // 3. Monthly Goals Calculations
  // Get current year and month (e.g., "2026-07")
  const yearMonthPrefix = referenceDate.toISOString().slice(0, 7);
  const currentMonthName = referenceDate.toLocaleDateString('en-US', { month: 'long' });

  // A. Monthly Goal 1: Consistent Scholar (Study X days this month)
  const monthlyStudyDays = Object.entries(state.studyLog || {})
    .filter(([date, min]) => date.startsWith(yearMonthPrefix) && min > 0)
    .length;
  const targetDays = 10;
  
  // B. Monthly Goal 2: Lesson Sprint (Complete X lessons this month)
  // Check lessons completion date mapped to current month
  const monthlyCompletedLessons = Object.entries(state.completionDates || {})
    .filter(([_, date]) => date.startsWith(yearMonthPrefix))
    .length;
  const targetLessons = 15;

  // C. Monthly Goal 3: Deep Focus Marathon (Log X study minutes this month)
  const monthlyMinutes = Object.entries(state.studyLog || {})
    .filter(([date, _]) => date.startsWith(yearMonthPrefix))
    .reduce((sum, [_, min]) => sum + min, 0);
  const targetMinutes = 300;

  // D. Monthly Goal 4: Assignment Solver (Complete X homeworks/exams/mistakes)
  // Count assignments completed in current month or overall if no date specified
  const targetAssignments = 3;
  const monthlyAssignments = completedAssignmentsCount + Math.floor(mistakesCount / 2); // Mistakes count as partial assignments for gamification credit

  const monthlyGoals: MonthlyGoal[] = [
    {
      id: 'monthly_study_days',
      title: 'Consistent Scholar',
      description: `Study on ${targetDays} separate days in ${currentMonthName}`,
      current: monthlyStudyDays,
      target: targetDays,
      unit: 'days',
      xpReward: 200,
      completed: monthlyStudyDays >= targetDays,
      icon: '📅'
    },
    {
      id: 'monthly_completed_lessons',
      title: 'Lesson Sprint',
      description: `Complete ${targetLessons} lessons in ${currentMonthName}`,
      current: monthlyCompletedLessons,
      target: targetLessons,
      unit: 'lessons',
      xpReward: 350,
      completed: monthlyCompletedLessons >= targetLessons,
      icon: '🚀'
    },
    {
      id: 'monthly_study_minutes',
      title: 'Deep Focus Marathon',
      description: `Accumulate ${targetMinutes} study minutes in ${currentMonthName}`,
      current: monthlyMinutes,
      target: targetMinutes,
      unit: 'mins',
      xpReward: 250,
      completed: monthlyMinutes >= targetMinutes,
      icon: '⏱️'
    },
    {
      id: 'monthly_assignments',
      title: 'Professional Solver',
      description: `Complete ${targetAssignments} tasks, assignments, or mistakes in ${currentMonthName}`,
      current: monthlyAssignments,
      target: targetAssignments,
      unit: 'tasks',
      xpReward: 150,
      completed: monthlyAssignments >= targetAssignments,
      icon: '💪'
    }
  ];

  // Add Monthly Goal completion rewards to total XP!
  let bonusXPFromGoals = 0;
  monthlyGoals.forEach(goal => {
    if (goal.completed) {
      bonusXPFromGoals += goal.xpReward;
    }
  });
  xp += bonusXPFromGoals;

  // Re-calculate Level with the added monthly goal XP
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].min) {
      curLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || null;
    }
  }
  const updatedXpInLevel = xp - curLevel.min;
  const updatedXpNeededForNext = nextLevel ? (nextLevel.min - curLevel.min) : 0;
  const updatedLevelProgressPct = nextLevel ? Math.min(100, Math.round((updatedXpInLevel / updatedXpNeededForNext) * 100)) : 100;

  const completedGoalsCount = monthlyGoals.filter(g => g.completed).length;

  // 4. Highlighted Achievements (locked/unlocked indicators near completion)
  const bookmarksCount = Object.values(state.bookmarks || {}).filter(Boolean).length;
  const totalDone = Object.values(state.completedLessons || {}).filter(Boolean).length;
  const totalHours = totalMinStudied / 60;

  const achievementsList = [
    { title: "First Lesson", icon: "🏅", desc: "Mark your first lesson complete", unlocked: totalDone > 0 },
    { title: "Syllabus Master", icon: "📚", desc: "Complete 25 lessons total", unlocked: totalDone >= 25 },
    { title: "Perfect Start", icon: "⚡", desc: "Log a 3-day study streak", unlocked: bestStreak >= 3 },
    { title: "7-Day Streak", icon: "🔥", desc: "Hold a 7-day study streak", unlocked: bestStreak >= 7 },
    { title: "Syllabus Curator", icon: "📌", desc: "Bookmark 3 lessons to revisit", unlocked: bookmarksCount >= 3 },
    { title: "Mistake Historian", icon: "📔", desc: "Document your first mistake in Wrong Answers", unlocked: mistakesCount >= 1 }
  ];

  return {
    xp,
    level: LEVELS.indexOf(curLevel),
    levelName: curLevel.name,
    nextLevelName: nextLevel ? nextLevel.name : null,
    xpInLevel: updatedXpInLevel,
    xpNeededForNext: updatedXpNeededForNext,
    levelProgressPct: updatedLevelProgressPct,
    streak,
    bestStreak,
    monthlyGoals,
    completedGoalsCount,
    recentAchievements: achievementsList
  };
}

/**
 * Returns a small motivational message based on gamification stats
 */
export function getGamificationMotivation(stats: GamificationState): string {
  if (stats.completedGoalsCount === stats.monthlyGoals.length) {
    return "Amazing! You have cleared all of your monthly learning goals. You're operating at elite efficiency.";
  }
  if (stats.streak >= 5) {
    return `Incredible! A ${stats.streak}-day streak is elite behavior. Show up again today to lock in your next milestone!`;
  }
  if (stats.completedGoalsCount > 0) {
    return `You've completed ${stats.completedGoalsCount} monthly goal${stats.completedGoalsCount > 1 ? 's' : ''}! Keep pushing to sweep the board.`;
  }
  return "Set a small target today. 15 minutes of study builds the streak that transforms your career.";
}
