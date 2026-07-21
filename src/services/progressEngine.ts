import { StudyPlanState } from './Sync/types';
import { CourseWithContent, Profile, Milestone, MilestoneType } from '../models/types';
import { CourseCatalog } from './courseCatalog';

export interface CourseProgressDetail {
  courseId: string;
  courseName: string;
  color: string;
  totalLessons: number;
  completedLessons: number;
  remainingLessons: number;
  totalMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  completionPercentage: number;
}

export interface PacingMetrics {
  status: 'ahead' | 'behind' | 'ontrack';
  actualPercentage: number;
  expectedPercentage: number;
  startDateStr: string;
  targetDateStr: string;
  totalDays: number;
  elapsedDays: number;
}

export interface StreakMetrics {
  currentStreak: number;
  bestStreak: number;
  isStreakBroken: boolean;
}

export interface HeatmapCell {
  dateStr: string;
  minutes: number;
  level: number;
}

export interface WeeklyProgressDay {
  dayName: string;
  dateStr: string;
  minutes: number;
}

export interface MonthlyProgressWeek {
  weekName: string;
  minutes: number;
}

export interface BurndownData {
  startDateStr: string;
  targetDateStr: string;
  totalDays: number;
  daysElapsed: number;
  totalLessons: number;
  cumulativeLessonsCompleted: number[];
}

export interface MilestoneMetric {
  courseId: string;
  courseName: string;
  targetDateStr: string;
  daysRemaining: number;
  isMissed: boolean;
}

export type EstimatedCompletionStatus =
  | 'insufficient_data'
  | 'completed'
  | 'no_pace'
  | 'over_one_year'
  | 'success';

export interface ProgressMetrics {
  overall: {
    completionPercentage: number;
    totalLessons: number;
    completedLessons: number;
    remainingLessons: number;
    totalMinutes: number;
    completedMinutes: number;
    remainingMinutes: number;
    estimatedCompletionDate: Date | null;
    estimatedCompletionStatus: EstimatedCompletionStatus;
  };
  pacing: PacingMetrics;
  streaks: StreakMetrics;
  weeklyProgress: WeeklyProgressDay[];
  monthlyProgress: {
    weeks: MonthlyProgressWeek[];
    trendDailyMinutes: number[];
  };
  consistency: {
    totalMinutesStudied: number;
    totalHoursStudied: number;
    activeStudyDaysCount: number;
    dailyAverageMinutes: number;
    heatmapCells: HeatmapCell[];
  };
  burndown: BurndownData;
  courses: Record<string, CourseProgressDetail>;
  milestones: MilestoneMetric[];
}

/**
 * Calculates domain learning progress metrics based on current study state and active courses.
 * This function is pure, deterministic, and side-effect free.
 *
 * @param state The current legacy/persisted study plan state containing study logs and completions.
 * @param activeCourses List of currently active courses with full section and lesson content.
 * @param referenceDate Optional reference date for calculations (defaults to today).
 */
export function calculateProgressMetrics(
  state: StudyPlanState,
  activeCourses: CourseWithContent[],
  referenceDate: Date = new Date()
): ProgressMetrics {
  // 1. Overall & Course Progress Calculations
  let totalLessons = 0;
  let completedLessons = 0;
  let totalMinutes = 0;
  let completedMinutes = 0;

  const coursesMap: Record<string, CourseProgressDetail> = {};

  activeCourses.forEach(course => {
    const lessons = course.sections.flatMap(s => s.lessons);
    const courseTotalLessons = lessons.length;
    const courseCompletedLessons = lessons.filter(l => state.completedLessons[l.id]).length;
    const courseTotalMinutes = lessons.reduce((sum, l) => sum + l.duration, 0);
    const courseCompletedMinutes = lessons
      .filter(l => state.completedLessons[l.id])
      .reduce((sum, l) => sum + l.duration, 0);

    const courseRemainingLessons = courseTotalLessons - courseCompletedLessons;
    const courseRemainingMinutes = courseTotalMinutes - courseCompletedMinutes;
    const courseCompletionPercentage = courseTotalLessons
      ? Math.round((courseCompletedLessons / courseTotalLessons) * 100)
      : 0;

    coursesMap[course.id] = {
      courseId: course.id,
      courseName: course.name,
      color: course.color,
      totalLessons: courseTotalLessons,
      completedLessons: courseCompletedLessons,
      remainingLessons: courseRemainingLessons,
      totalMinutes: courseTotalMinutes,
      completedMinutes: courseCompletedMinutes,
      remainingMinutes: courseRemainingMinutes,
      completionPercentage: courseCompletionPercentage,
    };

    totalLessons += courseTotalLessons;
    completedLessons += courseCompletedLessons;
    totalMinutes += courseTotalMinutes;
    completedMinutes += courseCompletedMinutes;
  });

  const overallPercentage = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const remainingLessons = totalLessons - completedLessons;
  const remainingMinutes = totalMinutes - completedMinutes;

  // 2. Estimated Completion Date (ETA) & Status
  const getEstimatedCompletion = (): { date: Date | null; status: EstimatedCompletionStatus } => {
    const studyDayCount = Object.keys(state.studyLog).length;
    if (studyDayCount < 3) return { date: null, status: 'insufficient_data' };
    if (remainingLessons <= 0) return { date: null, status: 'completed' };

    // Calculate lessons rate over last 14 days
    const last14Days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setDate(referenceDate.getDate() - i);
      last14Days.push(d.toISOString().slice(0, 10));
    }
    const lessonsIn14 = last14Days.reduce((acc, d) => acc + (state.lessonsLog[d] || 0), 0);
    let lessonsPerDay = lessonsIn14 / 14;

    if (lessonsPerDay <= 0) {
      // Fallback to all-time average
      const dates = Object.keys(state.studyLog).sort();
      if (dates.length > 0) {
        const first = new Date(dates[0]);
        const daysSince = Math.max(1, Math.round((referenceDate.getTime() - first.getTime()) / 86400000));
        lessonsPerDay = completedLessons / daysSince;
      }
    }

    if (lessonsPerDay <= 0) return { date: null, status: 'no_pace' };

    const daysNeeded = Math.ceil(remainingLessons / lessonsPerDay);
    if (daysNeeded > 365) return { date: null, status: 'over_one_year' };

    const etaDate = new Date(referenceDate);
    etaDate.setDate(etaDate.getDate() + daysNeeded);
    return { date: etaDate, status: 'success' };
  };

  const estComp = getEstimatedCompletion();

  // 3. Streak Calculations
  const todayStr = referenceDate.toISOString().slice(0, 10);
  const yesterdayStr = (() => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const isStreakBroken = state.lastStudyDate
    ? (state.lastStudyDate !== todayStr && state.lastStudyDate !== yesterdayStr)
    : false;
  const currentStreak = isStreakBroken ? 0 : state.streak;
  const bestStreak = state.bestStreak;

  // 4. Consistency & Heatmap
  const totalMinutesStudied = Object.values(state.studyLog).reduce((sum, val) => sum + val, 0);
  const totalHoursStudied = parseFloat((totalMinutesStudied / 60).toFixed(1));
  const activeStudyDaysCount = Object.keys(state.studyLog).length;
  const dailyAverageMinutes = activeStudyDaysCount ? Math.round(totalMinutesStudied / activeStudyDaysCount) : 0;

  const heatmapCells: HeatmapCell[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const mins = state.studyLog[dateStr] || 0;
    let level = 0;
    if (mins > 0 && mins < 15) level = 1;
    else if (mins >= 15 && mins < 30) level = 2;
    else if (mins >= 30 && mins < 60) level = 3;
    else if (mins >= 60) level = 4;
    heatmapCells.push({ dateStr, minutes: mins, level });
  }

  // 5. Pacing Metrics
  // Deterministic target and start dates based on courses exam dates
  let targetDate = new Date(2026, 7, 25); // August 25, 2026 fallback
  let startDate = new Date(2026, 6, 14);  // July 14, 2026 fallback

  if (activeCourses.length > 0) {
    const examDates = activeCourses
      .map(c => c.examDate)
      .filter((d): d is string => !!d);
    if (examDates.length > 0) {
      examDates.sort();
      const latestExamStr = examDates[examDates.length - 1];
      targetDate = new Date(latestExamStr);

      const hasLegacy = activeCourses.some(c => c.id === 'course-pl300' || c.id === 'course-pmipba');
      if (hasLegacy) {
        startDate = new Date(2026, 6, 14);
      } else {
        // Generic 42-day study buffer
        startDate = new Date(targetDate.getTime() - 42 * 24 * 60 * 60 * 1000);
      }
    }
  }

  const totalDays = Math.max(1, (targetDate.getTime() - startDate.getTime()) / 86400000);
  const elapsedDays = Math.min(totalDays, Math.max(0, (referenceDate.getTime() - startDate.getTime()) / 86400000));
  const expectedPercentage = (elapsedDays / totalDays) * 100;

  let pacingStatus: 'ahead' | 'behind' | 'ontrack' = 'ontrack';
  if (overallPercentage >= expectedPercentage + 5) pacingStatus = 'ahead';
  else if (overallPercentage < expectedPercentage - 8) pacingStatus = 'behind';

  const pacing: PacingMetrics = {
    status: pacingStatus,
    actualPercentage: overallPercentage,
    expectedPercentage,
    startDateStr: startDate.toISOString().slice(0, 10),
    targetDateStr: targetDate.toISOString().slice(0, 10),
    totalDays,
    elapsedDays,
  };

  // 6. Weekly Study Days
  const weeklyProgress: WeeklyProgressDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = state.studyLog[dateStr] || 0;
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    weeklyProgress.push({ dayName, dateStr, minutes });
  }

  // 7. Monthly Study Weeks
  const monthlyWeeks: MonthlyProgressWeek[] = [
    { weekName: 'Wk 1', minutes: 0 },
    { weekName: 'Wk 2', minutes: 0 },
    { weekName: 'Wk 3', minutes: 0 },
    { weekName: 'Wk 4', minutes: 0 },
    { weekName: 'Wk 5', minutes: 0 },
  ];
  Object.entries(state.studyLog).forEach(([dateStr, mins]) => {
    const d = new Date(dateStr + "T00:00:00");
    if (d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear()) {
      const weekIdx = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      monthlyWeeks[weekIdx].minutes += mins;
    }
  });

  // 8. Monthly Trend Daily Values
  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  const trendDailyMinutes: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), d);
    const iso = dateObj.toISOString().slice(0, 10);
    trendDailyMinutes.push(state.studyLog[iso] || 0);
  }

  // 9. Burn-down cumulative lessons log
  const burndownTotalDays = totalDays;
  const burndownDaysElapsed = Math.max(0, Math.min(totalDays, Math.round((referenceDate.getTime() - startDate.getTime()) / 86400000)));
  const cumulativeLessonsCompleted: number[] = [];
  let cumCompleted = 0;

  for (let i = 0; i <= burndownDaysElapsed; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cumCompleted += (state.lessonsLog[iso] || 0);
    cumulativeLessonsCompleted.push(cumCompleted);
  }

  const burndown: BurndownData = {
    startDateStr: startDate.toISOString().slice(0, 10),
    targetDateStr: targetDate.toISOString().slice(0, 10),
    totalDays: burndownTotalDays,
    daysElapsed: burndownDaysElapsed,
    totalLessons,
    cumulativeLessonsCompleted,
  };

  // 10. Upcoming Milestones
  const milestones = activeCourses
    .filter(c => !!c.examDate)
    .map(c => {
      const d = new Date(c.examDate!);
      const todayNoTime = new Date(referenceDate);
      todayNoTime.setHours(0,0,0,0);
      const examNoTime = new Date(d);
      examNoTime.setHours(0,0,0,0);
      const daysRemaining = Math.ceil((examNoTime.getTime() - todayNoTime.getTime()) / 86400000);
      return {
        courseId: c.id,
        courseName: c.name,
        targetDateStr: c.examDate!,
        daysRemaining,
        isMissed: daysRemaining < 0,
      };
    });

  return {
    overall: {
      completionPercentage: overallPercentage,
      totalLessons,
      completedLessons,
      remainingLessons,
      totalMinutes,
      completedMinutes,
      remainingMinutes,
      estimatedCompletionDate: estComp.date,
      estimatedCompletionStatus: estComp.status,
    },
    pacing,
    streaks: {
      currentStreak,
      bestStreak,
      isStreakBroken,
    },
    weeklyProgress,
    monthlyProgress: {
      weeks: monthlyWeeks,
      trendDailyMinutes,
    },
    consistency: {
      totalMinutesStudied,
      totalHoursStudied,
      activeStudyDaysCount,
      dailyAverageMinutes,
      heatmapCells,
    },
    burndown,
    courses: coursesMap,
    milestones,
  };
}

export interface GoalPacingDetail {
  goalName: string;
  courseId?: string;
  isCustom: boolean;
  category: string;
  completionPercentage: number;
  estimatedHours: number;
  difficulty: string;
  milestones: {
    id: string;
    type: MilestoneType;
    title?: string;
    date: string;
    completed: boolean;
    daysRemaining: number;
    status: 'completed' | 'behind' | 'approaching' | 'ontrack';
  }[];
  overallStatus: 'ontrack' | 'approaching' | 'behind';
}

export function calculateGoalPacing(
  goalName: string,
  profile: Profile,
  state: StudyPlanState,
  referenceDate: Date = new Date()
): GoalPacingDetail {
  const details = profile.learningGoalDetails?.[goalName];
  const isCustom = !CourseCatalog.getAllCourses().some(c => CourseCatalog.isCourseActive(c, [goalName], profile.learningGoalDetails));
  const category = details?.category || 'Custom';
  const courseId = details?.courseId;

  // 1. Calculate completion percentage
  let completionPercentage = 0;
  let estimatedHours = 120; // default
  let difficulty = 'Intermediate';

  if (!isCustom) {
    const matchedCourse = CourseCatalog.getActiveCourses([goalName], profile.learningGoalDetails)[0];
    if (matchedCourse) {
      const lessons = matchedCourse.sections.flatMap(s => s.lessons);
      const totalLessons = lessons.length;
      const completedLessons = lessons.filter(l => state.completedLessons[l.id]).length;
      completionPercentage = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
      
      estimatedHours = matchedCourse.estimatedHours || 120;
      difficulty = matchedCourse.difficulty || 'Intermediate';
      
      if (!matchedCourse.estimatedHours && !matchedCourse.difficulty) {
        const courseIdNoPrefix = matchedCourse.id.replace('course-', '').toUpperCase();
        if (courseIdNoPrefix === 'PL300') {
          estimatedHours = 120;
          difficulty = 'Intermediate';
        } else if (courseIdNoPrefix === 'PMIPBA') {
          estimatedHours = 140;
          difficulty = 'Advanced';
        }
      }
    }
  } else {
    // Custom goals: check milestone completion percentage
    const milestones = details?.milestones || [];
    const completedMilestones = milestones.filter(m => m.completed).length;
    completionPercentage = milestones.length ? Math.round((completedMilestones / milestones.length) * 100) : 0;
    if (details?.estimatedHours) {
      estimatedHours = details.estimatedHours;
    }
    if (details?.difficulty) {
      difficulty = details.difficulty;
    }
  }

  // 2. Map and score milestones
  const todayNoTime = new Date(referenceDate);
  todayNoTime.setHours(0, 0, 0, 0);

  const mappedMilestones = (details?.milestones || []).map(m => {
    const milestoneDate = new Date(m.date);
    milestoneDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((milestoneDate.getTime() - todayNoTime.getTime()) / 86400000);
    
    let status: 'completed' | 'behind' | 'approaching' | 'ontrack' = 'ontrack';
    if (m.completed) {
      status = 'completed';
    } else if (daysRemaining < 0) {
      status = 'behind';
    } else if (daysRemaining <= 7) {
      status = 'approaching';
    }

    return {
      id: m.id,
      type: m.type,
      title: m.title,
      date: m.date,
      completed: !!m.completed,
      daysRemaining,
      status,
    };
  });

  // 3. Determine overall goal pacing status
  let overallStatus: 'ontrack' | 'approaching' | 'behind' = 'ontrack';

  if (mappedMilestones.some(m => !m.completed && m.status === 'behind')) {
    overallStatus = 'behind';
  } else if (mappedMilestones.some(m => !m.completed && m.status === 'approaching')) {
    overallStatus = 'approaching';
  } else if (!isCustom) {
    const matchedCourse = CourseCatalog.getActiveCourses([goalName], profile.learningGoalDetails)[0];
    if (matchedCourse && matchedCourse.examDate) {
      const d = new Date(matchedCourse.examDate);
      const hasLegacy = matchedCourse.id === 'course-pl300' || matchedCourse.id === 'course-pmipba';
      const startDate = hasLegacy ? new Date(2026, 6, 14) : new Date(d.getTime() - 42 * 24 * 60 * 60 * 1000);
      const totalDays = Math.max(1, (d.getTime() - startDate.getTime()) / 86400000);
      const elapsedDays = Math.min(totalDays, Math.max(0, (referenceDate.getTime() - startDate.getTime()) / 86400000));
      const expectedPercentage = (elapsedDays / totalDays) * 100;

      if (completionPercentage < expectedPercentage - 8) {
        overallStatus = 'behind';
      } else if (completionPercentage < expectedPercentage && (totalDays - elapsedDays) <= 10) {
        overallStatus = 'approaching';
      }
    }
  }

  return {
    goalName,
    courseId,
    isCustom,
    category,
    completionPercentage,
    estimatedHours,
    difficulty,
    milestones: mappedMilestones,
    overallStatus,
  };
}
