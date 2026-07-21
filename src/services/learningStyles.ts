export type LearningStyleOption = {
  id: string;
  label: string;
  description: string;
};

export const LEARNING_STYLE_OPTIONS: LearningStyleOption[] = [
  { id: 'visual', label: 'Visual', description: 'Prefer diagrams, screenshots, and visual walkthroughs.' },
  { id: 'audio', label: 'Audio', description: 'Prefer podcasts, spoken explanations, and verbal coaching.' },
  { id: 'reading', label: 'Reading', description: 'Prefer structured notes, articles, and written explanations.' },
  { id: 'practice', label: 'Practice', description: 'Prefer hands-on exercises and applied examples.' },
  { id: 'discussion', label: 'Discussion', description: 'Prefer talking through ideas with peers or a coach.' },
  { id: 'spaced-repetition', label: 'Spaced repetition', description: 'Prefer short, repeated review sessions over long cramming blocks.' },
  { id: 'project-based', label: 'Project-based', description: 'Prefer learning through building something real.' },
  { id: 'structured', label: 'Structured', description: 'Prefer a clear plan, checklist, and milestones.' },
  { id: 'reflective', label: 'Reflective', description: 'Prefer journaling, note-taking, and self-checking.' },
  { id: 'collaborative', label: 'Collaborative', description: 'Prefer learning through shared work, feedback, and group study.' },
  { id: 'gamified', label: 'Gamified', description: 'Prefer challenges, streaks, rewards, and small milestones.' },
  { id: 'mixed', label: 'Mixed', description: 'Prefer a balanced blend of explanation and practice.' },
];

export function getLearningStyleOptions(): LearningStyleOption[] {
  return LEARNING_STYLE_OPTIONS;
}

export function normalizeLearningStyle(input: string): string {
  const normalized = input.trim().toLowerCase();
  const match = LEARNING_STYLE_OPTIONS.find(option => option.id === normalized || option.label.toLowerCase() === normalized);
  return match?.label || input.trim();
}
