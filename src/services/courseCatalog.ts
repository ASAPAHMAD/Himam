import { LEGACY_COURSES, LEGACY_COURSE_IDS } from '../models/legacyBridge';
import { CourseWithContent } from '../models/types';

/** Matches the shape of Profile.learningGoalDetails — kept as a local type
 * here rather than importing Profile, since this service only needs the
 * one field, not the whole Profile shape (avoids a circular-ish coupling
 * back to models/types.ts for something this narrow). */
type LearningGoalDetails = Record<string, { category?: string; url?: string; courseId?: string; milestones?: any[] }> | undefined;

export class CourseCatalogService {
  private static instance: CourseCatalogService;
  private courses: CourseWithContent[];
  private customCourses: CourseWithContent[] = [];

  private constructor() {
    // Initialized with legacy migrated courses for seamless transition
    this.courses = LEGACY_COURSES;
  }

  public static getInstance(): CourseCatalogService {
    if (!CourseCatalogService.instance) {
      CourseCatalogService.instance = new CourseCatalogService();
    }
    return CourseCatalogService.instance;
  }

  /**
   * Registers/updates custom courses created dynamically by the user (AI, manual, imported).
   */
  public setCustomCourses(courses: CourseWithContent[]) {
    this.customCourses = courses || [];
  }

  /**
   * Returns all courses registered in the system (static + custom).
   */
  public getAllCourses(): CourseWithContent[] {
    return [...this.courses, ...this.customCourses];
  }

  /**
   * Retrieves a course by its unique ID.
   */
  public getCourseById(id: string): CourseWithContent | undefined {
    return this.getAllCourses().find(c => c.id === id);
  }

  /**
   * Returns courses that match the user's configured learning goals.
   * `learningGoalDetails` is optional and backward compatible — omitting it
   * (or passing goals that predate this field) falls back to the original
   * fuzzy label-text matching, unchanged.
   */
  public getActiveCourses(learningGoals: string[], learningGoalDetails?: LearningGoalDetails): CourseWithContent[] {
    const active = this.getAllCourses().filter(course => 
      this.isCourseActive(course, learningGoals, learningGoalDetails)
    );

    return active.map(course => {
      // Find matching goal name in learningGoals
      const goalName = learningGoals.find(g => {
        const details = learningGoalDetails?.[g];
        if (details?.courseId === course.id) return true;
        if (!details?.courseId) {
          return this.isCourseActive(course, [g], learningGoalDetails);
        }
        return false;
      });

      if (goalName) {
        const details = learningGoalDetails?.[goalName];
        if (details?.milestones && details.milestones.length > 0) {
          const examMilestone = details.milestones.find((m: any) => 
            m.type === 'Exam' || m.type === 'Certification' || m.type === 'Deadline'
          );
          if (examMilestone && examMilestone.date) {
            return {
              ...course,
              examDate: examMilestone.date,
            };
          }
        }
      }
      return course;
    });
  }

  /**
   * Evaluates if a given course matches any of the user's learning goals.
   *
   * Prefers exact `courseId` matching (from learningGoalDetails) when a goal
   * has one set — see models/types.ts's Profile.learningGoalDetails and
   * ARCHITECTURE.md's learning-goal unification note for why. A goal with an
   * explicit courseId is matched ONLY against that exact course, not also
   * fuzzy-matched against others — otherwise a goal deliberately linked to
   * Course A could accidentally also fuzzy-match Course B's name pattern.
   * Goals without a courseId (including every goal saved before this field
   * existed) fall back to the original fuzzy text matching, unchanged.
   */
  public isCourseActive(course: CourseWithContent, learningGoals: string[], learningGoalDetails?: LearningGoalDetails): boolean {
    const cleanGoals = learningGoals || [];

    const goalsWithCourseId = cleanGoals.filter(g => learningGoalDetails?.[g]?.courseId);
    if (goalsWithCourseId.some(g => learningGoalDetails![g].courseId === course.id)) {
      return true;
    }

    // Only fuzzy-match goals that do NOT have an explicit courseId — a goal
    // pointing at a different course by id shouldn't also get a second,
    // looser chance to match this one by text.
    const fuzzyGoals = cleanGoals.filter(g => !learningGoalDetails?.[g]?.courseId).map(g => g.toUpperCase());
    if (fuzzyGoals.length === 0) return false;

    const courseId = course.id.toUpperCase();
    const courseName = course.name.toUpperCase();

    // Derived standard keys (e.g. "PL300", "PMIPBA")
    const key = courseId.replace('COURSE-', '').replace('_', '').replace('-', '');

    const matchTerms = [
      courseId,
      courseName,
      key,
      // Specific overrides for legacy backward compatibility
      ...(key === 'PL300' ? ['PL-300', 'POWER BI'] : []),
      ...(key === 'PMIPBA' ? ['PMI-PBA', 'BUSINESS ANALYSIS'] : []),
    ];

    return fuzzyGoals.some(goal => 
      matchTerms.some(term => goal.includes(term))
    );
  }

  /**
   * Filters out learning goals that do not match any registered catalog course,
   * returning them as custom targets/goals.
   */
  public getCustomGoals(learningGoals: string[], learningGoalDetails?: LearningGoalDetails): string[] {
    return (learningGoals || []).filter(g => {
      return !this.getAllCourses().some(c => this.isCourseActive(c, [g], learningGoalDetails));
    });
  }
}

export const CourseCatalog = CourseCatalogService.getInstance();
