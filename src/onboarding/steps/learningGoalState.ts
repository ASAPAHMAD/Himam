export interface GoalDetailMeta {
  category?: string;
  url?: string;
  /**
   * Set when this goal corresponds to a real catalog Course — enables exact
   * id-based matching in services/courseCatalog.ts instead of fuzzy label
   * text matching. Undefined means either a genuinely custom goal, or a
   * goal saved before this field existed (falls back to fuzzy matching,
   * unchanged behavior — see courseCatalog.ts's isCourseActive()).
   * Deliberately kept inside the existing learningGoalDetails map rather
   * than replacing the learningGoals: string[] model — that's a separate,
   * later, dedicated migration once every consumer prefers courseId.
   */
  courseId?: string;
}

export interface LearningGoalPatch {
  learningGoals: string[];
  learningGoalDetails: Record<string, GoalDetailMeta>;
}

export function buildLearningGoalPatch(params: {
  existingGoals: string[];
  existingDetails: Record<string, GoalDetailMeta> | undefined;
  goal: string;
  meta?: GoalDetailMeta;
  remove?: boolean;
}): LearningGoalPatch {
  const existingDetails = params.existingDetails || {};
  const nextDetails = { ...existingDetails };

  if (params.remove) {
    delete nextDetails[params.goal];
    return {
      learningGoals: params.existingGoals.filter(g => g !== params.goal),
      learningGoalDetails: nextDetails,
    };
  }

  const cleaned = params.goal.trim();
  if (!cleaned || params.existingGoals.includes(cleaned)) {
    return {
      learningGoals: params.existingGoals,
      learningGoalDetails: nextDetails,
    };
  }

  if (params.meta && (params.meta.category || params.meta.url || params.meta.courseId)) {
    nextDetails[cleaned] = params.meta;
  }

  return {
    learningGoals: [...params.existingGoals, cleaned],
    learningGoalDetails: nextDetails,
  };
}
