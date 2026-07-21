/**
 * AI Context Builder — Phase: AI Coach (first-class feature).
 *
 * Pure, deterministic, side-effect-free composition layer. Builds one
 * serializable snapshot of "everything an AI Coach might need to know"
 * entirely by calling the *existing* generic services — it never
 * recalculates anything progressEngine.ts, schedulingEngine.ts, or
 * courseCatalog.ts already compute, and it never branches on a specific
 * course id or name.
 *
 * This is the seam mentioned in the brief: every current and future AI
 * provider (Google Gemini today; OpenAI/Anthropic later) consumes the same
 * AIContext shape. Swapping providers only changes how the final messages
 * array is sent (see services/aiCoachClient.ts + server.ts) — never how
 * this context is assembled or what it contains.
 *
 * No React here, no fetch here, no provider-specific formatting here.
 */
import { StudyPlanState } from './Sync/types';
import { Profile, CourseWithContent, VacationRange, StudyWindow, LearningStyle, AIMemory, AcademicEvent, InternshipApplication } from '../models/types';
import { CourseCatalog } from './courseCatalog';
import { calculateProgressMetrics, ProgressMetrics } from './progressEngine';
import { legacyStateToUserProgress } from '../models/migrateLegacy';
import { generateSchedule, CourseLessons, ScheduledDay } from '../models/schedulingEngine';
import { getCourseShortLabel, getLessonWithCourse } from '../models/courseDisplay';

export interface AIContextCourseSummary {
  id: string;
  name: string;
  shortLabel: string;
  examDate: string | null;
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
  remainingMinutes: number;
}

export interface AIContextScheduleWindow {
  label: string;
  lessons: { title: string; duration: number; courseShortLabel: string }[];
}

export interface AIContextDay {
  dateStr: string;
  isWorkable: boolean;
  isVacation: boolean;
  totalMinutes: number;
  windows: AIContextScheduleWindow[];
}

export interface AIContextFocusLesson {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: number;
  courseName: string;
  courseShortLabel: string;
}

export interface AIContextKnowledgeDoc {
  id: string;
  fileName: string;
  fileType: string;
  summary?: string;
  fileSize?: string;
}

export interface AIContext {
  learner: {
    name: string;
    currentJob: string;
    targetJob: string;
    country: string;
    careerGoal: string;
    currentSalary: string;
    targetSalary: string;
    isStudent?: boolean;
    university?: string;
    major?: string;
    academicYear?: string;
    currentSemester?: string;
    currentGpa?: string;
    currentCourses?: string;
    expectedGraduation?: string;
    capstoneTopic?: string;
    capstoneStatus?: string;
    capstoneSupervisor?: string;
    capstoneDeadline?: string;
    capstoneDeliverables?: string;
    capstoneMilestones?: string;
    academicEvents?: AcademicEvent[];
    internshipApplications?: InternshipApplication[];
    /** Unset means the learner hasn't chosen one yet (see models/types.ts) —
     * the Coach should not assume a style nobody actually picked. */
    learningStyle?: LearningStyle;
  };
  availability: {
    workingDays: string[];
    studyWindows: StudyWindow[];
    vacationRanges: VacationRange[];
  };
  courses: AIContextCourseSummary[];
  customGoals: string[];
  knowledgeDocs?: AIContextKnowledgeDoc[];
  progress: {
    overallCompletionPercentage: number;
    totalLessonsRemaining: number;
    remainingMinutes: number;
    estimatedCompletionLabel: string;
    pacingStatus: 'ahead' | 'behind' | 'ontrack';
    currentStreak: number;
    bestStreak: number;
    dailyAverageMinutes: number;
  };
  today: AIContextDay;
  upcomingWeek: AIContextDay[];
  focusLesson?: AIContextFocusLesson;
  memories?: { category: string; summary: string; confidence: number; importance: number; source?: string }[];
}

function describeEstimatedCompletion(metrics: ProgressMetrics): string {
  const { estimatedCompletionStatus: status, estimatedCompletionDate: date } = metrics.overall;
  if (status === 'insufficient_data') return 'not enough study history yet to estimate';
  if (status === 'completed') return 'all active courses already completed';
  if (status === 'over_one_year') return 'more than a year away at the current pace';
  if (status === 'no_pace' || !date) return 'unknown — no recent study pace to project from';
  return date.toISOString().slice(0, 10);
}

function summarizeDay(day: ScheduledDay): AIContextDay {
  return {
    dateStr: day.dateStr,
    isWorkable: day.isWorkable,
    isVacation: day.isVacation,
    totalMinutes: day.estimatedDailyMinutes,
    windows: day.windows.map(w => ({
      label: w.label || 'Session',
      lessons: w.lessons.map(l => ({
        title: l.title,
        duration: l.duration,
        // Resolved from the same lesson->course index StudyCenter uses —
        // no per-lesson course-name literal here either.
        courseShortLabel: '', // filled in by caller once course context is known (see buildAIContext)
      })),
    })),
  };
}

export interface BuildAIContextOptions {
  referenceDate?: Date;
  focusLessonId?: string;
  memories?: AIMemory[];
}

function rankMemories(memories: AIMemory[], maxCount = 12): AIMemory[] {
  return [...memories]
    .sort((a, b) => {
      const scoreA = a.importance * a.confidence;
      const scoreB = b.importance * b.confidence;
      if (Math.abs(scoreA - scoreB) > 0.01) {
        return scoreB - scoreA;
      }
      const timeA = new Date(a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    })
    .slice(0, maxCount);
}

/**
 * The one function every AI provider integration should call. Given the
 * same Profile + StudyPlanState, always produces the same AIContext —
 * matching the "pure, deterministic" contract of progressEngine.ts and
 * schedulingEngine.ts.
 */
export function buildAIContext(
  profile: Profile,
  state: StudyPlanState,
  options: BuildAIContextOptions = {}
): AIContext {
  const referenceDate = options.referenceDate || new Date();

  const activeCourses: CourseWithContent[] = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
  const customGoals = CourseCatalog.getCustomGoals(profile.learningGoals, profile.learningGoalDetails);
  const metrics = calculateProgressMetrics(state, activeCourses, referenceDate);
  const userProgress = legacyStateToUserProgress(state);

  const courseLessons: CourseLessons[] = activeCourses.map(c => ({
    course: c,
    lessons: c.sections.flatMap(s => s.lessons),
  }));

  // Today + next 7 days, generated by the same generic scheduling engine
  // StudyCenter/Calendar consume (via legacyScheduleAdapter) — used here
  // directly against the generic Course/Lesson model, no legacy shim needed
  // since the Coach doesn't have to match a fixed legacy JSX shape.
  const weekAhead = generateSchedule(profile, courseLessons, userProgress, referenceDate, 7);

  const lessonCourseLabel = (lessonId: string): string => {
    const found = getLessonWithCourse(activeCourses, lessonId);
    return found ? getCourseShortLabel(found.meta.course) : '';
  };

  const attributeDay = (day: ScheduledDay): AIContextDay => {
    const summarized = summarizeDay(day);
    summarized.windows = summarized.windows.map((w, wi) => ({
      ...w,
      lessons: w.lessons.map((l, li) => ({
        ...l,
        courseShortLabel: lessonCourseLabel(day.windows[wi].lessons[li].id),
      })),
    }));
    return summarized;
  };

  const today = attributeDay(weekAhead[0]);
  const upcomingWeek = weekAhead.slice(1).map(attributeDay);

  const courses: AIContextCourseSummary[] = activeCourses.map(course => {
    const stat = metrics.courses[course.id];
    return {
      id: course.id,
      name: course.name,
      shortLabel: getCourseShortLabel(course),
      examDate: course.examDate,
      completedLessons: stat?.completedLessons ?? 0,
      totalLessons: stat?.totalLessons ?? 0,
      completionPercentage: stat?.completionPercentage ?? 0,
      remainingMinutes: stat?.remainingMinutes ?? 0,
    };
  });

  let focusLesson: AIContextFocusLesson | undefined;
  if (options.focusLessonId) {
    // Search the full catalog, not just active courses — a learner may want
    // an explanation for a lesson in a course they haven't activated yet.
    const found = getLessonWithCourse(CourseCatalog.getAllCourses(), options.focusLessonId);
    if (found) {
      focusLesson = {
        id: found.lesson.id,
        title: found.lesson.title,
        description: found.lesson.description,
        type: found.lesson.type,
        duration: found.lesson.duration,
        courseName: found.meta.course.name,
        courseShortLabel: found.meta.shortLabel,
      };
    }
  }

  const context: AIContext = {
    learner: {
      name: profile.name,
      currentJob: profile.currentJob,
      targetJob: profile.targetJob,
      country: profile.country,
      careerGoal: profile.careerGoal,
      currentSalary: profile.currentSalary,
      targetSalary: profile.targetSalary,
      isStudent: profile.isStudent,
      university: profile.university,
      major: profile.major,
      academicYear: profile.academicYear,
      currentSemester: profile.currentSemester,
      currentGpa: profile.currentGpa,
      currentCourses: profile.currentCourses,
      expectedGraduation: profile.expectedGraduation,
      capstoneTopic: profile.capstoneTopic,
      capstoneStatus: profile.capstoneStatus,
      capstoneSupervisor: profile.capstoneSupervisor,
      capstoneDeadline: profile.capstoneDeadline,
      capstoneDeliverables: profile.capstoneDeliverables,
      capstoneMilestones: profile.capstoneMilestones,
      academicEvents: profile.academicEvents,
      internshipApplications: profile.internshipApplications,
      learningStyle: profile.learningStyle,
    },
    availability: {
      workingDays: profile.workingDays,
      studyWindows: profile.studyWindows,
      vacationRanges: profile.vacationRanges,
    },
    courses,
    customGoals,
    knowledgeDocs: (() => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = localStorage.getItem('himam_knowledge_library');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              return parsed.slice(0, 10).map((d: any) => ({
                id: d.id || '',
                fileName: d.fileName || 'Document',
                fileType: d.fileType || 'PDF',
                summary: d.summary || '',
                fileSize: d.fileSize || ''
              }));
            }
          }
        }
      } catch {
        // fallback
      }
      return [];
    })(),
    progress: {
      overallCompletionPercentage: metrics.overall.completionPercentage,
      totalLessonsRemaining: metrics.overall.remainingLessons,
      remainingMinutes: metrics.overall.remainingMinutes,
      estimatedCompletionLabel: describeEstimatedCompletion(metrics),
      pacingStatus: metrics.pacing.status,
      currentStreak: metrics.streaks.currentStreak,
      bestStreak: metrics.streaks.bestStreak,
      dailyAverageMinutes: metrics.consistency.dailyAverageMinutes,
    },
    today,
    upcomingWeek,
    focusLesson,
  };

  if (options.memories && options.memories.length > 0) {
    const ranked = rankMemories(options.memories);
    context.memories = ranked.map(m => ({
      category: m.category,
      summary: m.summary,
      confidence: m.confidence,
      importance: m.importance,
      source: m.source,
    }));
  }

  return context;
}
