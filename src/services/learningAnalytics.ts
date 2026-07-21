import { StudyPlanState } from './Sync/types';
import { CourseWithContent, AIMemory } from '../models/types';
import { calculateProgressMetrics } from './progressEngine';

export interface TopicMastery {
  topicId: string;
  topic: string;
  score: number; // 0-100 mastery score
  lessonsTotal: number;
  lessonsCompleted: number;
  quizSuccessRate: number | null; // null if no quiz attempts
}

export interface LearningAnalytics {
  studyConsistency: number; // 0-100 score based on study frequency
  completionVelocity: number; // average lessons completed per week
  averageSessionLength: number; // average minutes per study session
  weeklyStudyMinutes: number; // minutes studied in the last 7 days
  weeklyStudyMinutesTrend: number; // percentage change in minutes from previous week
  completionVelocityTrend: number; // percentage change in lessons completed from previous week
  revisionRate: number; // % of completed lessons that have been revised
  burnoutRisk: number; // 0-100 based on consecutive heavy days and late night study
  confidenceScore: number; // 0-100 derived from streak, consistency, pacing, and quizzes
  masteryByTopic: TopicMastery[];
}

/**
 * Deterministic learning analytics engine.
 * Takes raw application data and turns it into reliable learning signals.
 */
export function calculateLearningAnalytics(
  state: StudyPlanState,
  activeCourses: CourseWithContent[],
  memories: AIMemory[] = []
): LearningAnalytics {
  const referenceDate = new Date();
  const todayStr = referenceDate.toISOString().slice(0, 10);

  // 1. Weekly Study Minutes (Last 7 days vs previous 7 days)
  let weeklyStudyMinutes = 0;
  let previousWeeklyStudyMinutes = 0;
  
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    last7Days.push(dateStr);
    weeklyStudyMinutes += state.studyLog?.[dateStr] || 0;
  }

  for (let i = 13; i >= 7; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    previousWeeklyStudyMinutes += state.studyLog?.[dateStr] || 0;
  }

  const weeklyStudyMinutesTrend = previousWeeklyStudyMinutes === 0
    ? (weeklyStudyMinutes > 0 ? 100 : 0)
    : Math.round(((weeklyStudyMinutes - previousWeeklyStudyMinutes) / previousWeeklyStudyMinutes) * 100);

  // 2. Study Consistency (0-100)
  // Look at the past 28 days.
  const last28Days: string[] = [];
  let activeStudyDaysCountLast28 = 0;
  for (let i = 27; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    last28Days.push(dateStr);
    if ((state.studyLog?.[dateStr] || 0) > 0) {
      activeStudyDaysCountLast28++;
    }
  }
  // If user studies ~3 days a week, that's decent. 12 days in 28 is the threshold for a high score.
  let studyConsistency = Math.round((activeStudyDaysCountLast28 / 12) * 100);
  // Add a bonus for active streak
  if (state.streak > 0) {
    studyConsistency += state.streak * 4;
  }
  studyConsistency = Math.min(100, Math.max(0, studyConsistency));

  // 3. Completion Velocity & Completed Lessons Trend
  let completionVelocity = 0;
  let completionsInLast7Days = 0;
  let completionsInDays8To14 = 0;
  let completionsInLast14Days = 0;
  
  const last7DaysForCompletions: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    last7DaysForCompletions.push(d.toISOString().slice(0, 10));
  }

  const last14Days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setDate(referenceDate.getDate() - i);
    last14Days.push(d.toISOString().slice(0, 10));
  }

  const completionDatesObj = state.completionDates || {};
  const totalCompletedLessons = Object.keys(state.completedLessons || {}).filter(id => state.completedLessons[id]).length;

  Object.entries(completionDatesObj).forEach(([_, dateStr]) => {
    if (last7DaysForCompletions.includes(dateStr)) {
      completionsInLast7Days++;
    } else if (last14Days.includes(dateStr)) {
      completionsInDays8To14++;
    }
    
    if (last14Days.includes(dateStr)) {
      completionsInLast14Days++;
    }
  });

  const completionVelocityTrend = completionsInDays8To14 === 0
    ? (completionsInLast7Days > 0 ? 100 : 0)
    : Math.round(((completionsInLast7Days - completionsInDays8To14) / completionsInDays8To14) * 100);

  if (completionsInLast14Days > 0) {
    completionVelocity = parseFloat((completionsInLast14Days / 2).toFixed(1)); // division by 2 weeks
  } else if (totalCompletedLessons > 0) {
    // Fallback to average since first logged date
    const logDates = Object.keys(state.studyLog || {}).sort();
    if (logDates.length > 0) {
      const firstDate = new Date(logDates[0]);
      const diffMs = Math.abs(referenceDate.getTime() - firstDate.getTime());
      const weeksDiff = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7)));
      completionVelocity = parseFloat((totalCompletedLessons / weeksDiff).toFixed(1));
    } else {
      completionVelocity = 0;
    }
  }

  // 4. Average Session Length
  const studyLogEntries = Object.entries(state.studyLog || {});
  const totalMinutes = studyLogEntries.reduce((sum, [_, mins]) => sum + mins, 0);
  const activeDaysCount = studyLogEntries.filter(([_, mins]) => mins > 0).length;
  const averageSessionLength = activeDaysCount ? Math.round(totalMinutes / activeDaysCount) : 0;

  // 5. Revision Rate
  const completedLessonIds = Object.keys(state.completedLessons || {}).filter(id => state.completedLessons[id]);
  const completedCount = completedLessonIds.length;
  let revisedCount = 0;
  completedLessonIds.forEach(id => {
    if (state.revisionDates?.[id]) {
      revisedCount++;
    }
  });
  const revisionRate = completedCount ? Math.round((revisedCount / completedCount) * 100) : 0;

  // 6. Burnout Risk (0-100)
  let burnoutRisk = 10;
  // Heavy study sessions in the last week (more than 90 mins in a single day is heavy, >120 is very heavy)
  let heavyDays = 0;
  let lateNightStudy = false;

  last7Days.forEach(dateStr => {
    const mins = state.studyLog?.[dateStr] || 0;
    if (mins > 120) {
      heavyDays += 2;
    } else if (mins > 90) {
      heavyDays += 1;
    }
  });

  // Check if late night study occurs in completionTimes (e.g., "11:24 PM", "01:15 AM")
  const completionTimesObj = state.completionTimes || {};
  Object.values(completionTimesObj).forEach((timeStr) => {
    if (timeStr.includes('PM')) {
      const hour = parseInt(timeStr.split(':')[0], 10);
      if (hour >= 9 && hour < 12) lateNightStudy = true;
    } else if (timeStr.includes('AM')) {
      const hour = parseInt(timeStr.split(':')[0], 10);
      if (hour >= 12 || hour <= 4) lateNightStudy = true;
    }
  });

  burnoutRisk += heavyDays * 15;
  if (lateNightStudy) burnoutRisk += 15;
  if (averageSessionLength > 80) burnoutRisk += 10;
  // If the user has a memory mentioning stress or fatigue, increase risk
  const hasStressMemory = memories.some(m => 
    m.summary.toLowerCase().includes('fatigue') || 
    m.summary.toLowerCase().includes('stress') || 
    m.summary.toLowerCase().includes('burnout') ||
    m.summary.toLowerCase().includes('tired')
  );
  if (hasStressMemory) burnoutRisk += 20;

  burnoutRisk = Math.min(95, Math.max(5, burnoutRisk));

  // 7. Topic Mastery Calculations
  const progressMetrics = calculateProgressMetrics(state, activeCourses);
  const masteryByTopic: TopicMastery[] = [];

  activeCourses.forEach(course => {
    course.sections.forEach(section => {
      const topicLessons = section.lessons || [];
      const lessonsTotal = topicLessons.length;
      if (lessonsTotal === 0) return;

      const lessonsCompleted = topicLessons.filter(l => state.completedLessons[l.id]).length;

      // Filter quiz attempts for questions belonging to lessons in this topic/section
      const lessonIds = topicLessons.map(l => l.id);
      const sectionAttempts = (state.quizAttempts || []).filter(att => lessonIds.includes(att.lessonId));

      let quizSuccessRate: number | null = null;
      if (sectionAttempts.length > 0) {
        const correctCount = sectionAttempts.filter(att => att.correct).length;
        quizSuccessRate = Math.round((correctCount / sectionAttempts.length) * 100);
      }

      // Calculate score: 70% completed progress, 30% quiz results if available
      let score = 0;
      const progressScore = (lessonsCompleted / lessonsTotal) * 100;
      if (quizSuccessRate !== null) {
        score = Math.round(progressScore * 0.7 + quizSuccessRate * 0.3);
      } else {
        score = Math.round(progressScore);
      }

      masteryByTopic.push({
        topicId: section.id,
        topic: `${course.name} - ${section.name}`,
        score,
        lessonsTotal,
        lessonsCompleted,
        quizSuccessRate,
      });
    });
  });

  // 8. Confidence Score (0-100)
  let confidenceScore = Math.round(studyConsistency * 0.4 + completionVelocity * 8 + (state.streak || 0) * 3);
  
  // Adjust based on Pacing
  if (progressMetrics.pacing?.status === 'ahead') {
    confidenceScore += 15;
  } else if (progressMetrics.pacing?.status === 'behind') {
    confidenceScore -= 15;
  }

  // Adjust based on Quiz performance if they exist
  const attempts = state.quizAttempts || [];
  if (attempts.length > 0) {
    const correctCount = attempts.filter(att => att.correct).length;
    const overallSuccessRate = (correctCount / attempts.length) * 100;
    if (overallSuccessRate > 80) {
      confidenceScore += 10;
    } else if (overallSuccessRate < 50) {
      confidenceScore -= 15;
    }
  }

  confidenceScore = Math.min(100, Math.max(10, confidenceScore));

  return {
    studyConsistency,
    completionVelocity,
    averageSessionLength,
    weeklyStudyMinutes,
    weeklyStudyMinutesTrend,
    completionVelocityTrend,
    revisionRate,
    burnoutRisk,
    confidenceScore,
    masteryByTopic,
  };
}
