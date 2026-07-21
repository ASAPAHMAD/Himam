import React from 'react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';
import { Award, Zap, Trophy, ShieldAlert, Star, Flame } from 'lucide-react';
import { LEGACY_COURSE_IDS, getLegacyCourseById, lessonsInSectionNamed } from '../models/legacyBridge';
import { CourseCatalog } from '../services/courseCatalog';
import { getCourseShortLabel } from '../models/courseDisplay';
import { calculateProgressMetrics } from '../services/progressEngine';
import { calculateGamification } from '../services/gamificationEngine';

interface AchievementsProps {
  state: StudyPlanState;
  profile: Profile;
}

/**
 * Migrated off the hardcoded two-course LEGACY_COURSE_IDS model (Milestone 1
 * of the post-review plan) — was the one component NOT brought in line when
 * Dashboard/StudyCenter/Calendar/Statistics were. A user whose learningGoals
 * don't include PL-300/PMI-PBA used to see 0/0 stats and permanently-locked
 * course badges here; this fixes that.
 *
 * Per-course completion badges (was: 4 hardcoded "PL-300 Halfway"/"100%
 * PL-300"/"PMI-PBA Halfway"/"100% PMI-PBA" entries) are now generated
 * dynamically, one halfway + one 100% badge per *active* course — scales to
 * any number of learning goals, not just the original two.
 *
 * "DAX Master" / "BA Analyst" are deliberately NOT generalized — they're
 * flavor badges tied to a specific section of specific legacy content
 * (there's no equivalent structured section content for a free-text custom
 * goal yet; that's what Course CRUD, the next milestone, will provide). They
 * now only appear when that specific legacy course is one of the learner's
 * active goals, instead of always being present and always locked for
 * anyone who never selected PL-300/PMI-PBA in the first place.
 */
export default function Achievements({ state, profile }: AchievementsProps) {
  const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
  const progressMetrics = calculateProgressMetrics(state, activeCourses);
  const gamification = calculateGamification(state, profile);

  const totalDone = progressMetrics.overall.completedLessons;
  const totalMin = progressMetrics.consistency.totalMinutesStudied;
  const totalHours = progressMetrics.consistency.totalHoursStudied;

  // One halfway + one 100% badge per active course, generated from real
  // catalog data — not a fixed pair of course names.
  const perCourseBadges = activeCourses.flatMap(course => {
    const stat = progressMetrics.courses[course.id];
    if (!stat || stat.totalLessons === 0) return [];
    const label = getCourseShortLabel(course);
    return [
      { icon: "🎯", title: `${label} Halfway`, desc: `50% of ${label} completed`, unlocked: (stat.completedLessons / stat.totalLessons) >= 0.5 },
      { icon: "🏆", title: `100% ${label}`, desc: `Completed the entire ${label} syllabus`, unlocked: stat.completedLessons === stat.totalLessons },
    ];
  });

  // Legacy content-specific flavor badges — only relevant, and only shown,
  // when that specific course is actually one of the learner's active goals.
  const contentBadges: { icon: string; title: string; desc: string; unlocked: boolean }[] = [];
  const plActive = activeCourses.some(c => c.id === LEGACY_COURSE_IDS.PL300);
  if (plActive) {
    const plCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!;
    const daxLessons = lessonsInSectionNamed(plCourse, 'DAX Calculations');
    const daxDone = daxLessons.length > 0 && daxLessons.every(l => state.completedLessons[l.id]);
    contentBadges.push({ icon: "📊", title: "DAX Master", desc: "Finished Section 8 (DAX Calculations)", unlocked: daxDone });
  }
  const pmiActive = activeCourses.some(c => c.id === LEGACY_COURSE_IDS.PMIPBA);
  if (pmiActive) {
    const pbiCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PMIPBA)!;
    const analysisLessons = lessonsInSectionNamed(pbiCourse, 'Analysis');
    const analysisDone = analysisLessons.length > 0 && analysisLessons.every(l => state.completedLessons[l.id]);
    contentBadges.push({ icon: "📘", title: "BA Analyst", desc: "Completed Ch.07 (Analysis)", unlocked: analysisDone });
  }

  const bookmarksCount = Object.values(state.bookmarks).filter(Boolean).length;
  const xp = gamification.xp;

  const badges = [
    { icon: "🏅", title: "First Lesson", desc: "Mark your first lesson complete", unlocked: totalDone > 0 },
    { icon: "📚", title: "Syllabus Master", desc: "Complete 25 lessons total", unlocked: totalDone >= 25 },
    { icon: "💯", title: "100 Lessons", desc: "Across all active learning goals", unlocked: totalDone >= 100 },
    { icon: "⏱️", title: "First 10 Hours", desc: "Ten hours logged total", unlocked: totalHours >= 10 },
    { icon: "⏱️", title: "50 Hours Studied", desc: "Fifty hours logged total", unlocked: totalHours >= 50 },
    ...contentBadges,
    { icon: "⚡", title: "Perfect Start", desc: "Log a 3-day study streak", unlocked: state.bestStreak >= 3 },
    { icon: "🔥", title: "7-Day Streak", desc: "Hold a 7-day study streak", unlocked: state.bestStreak >= 7 },
    { icon: "🔥", title: "30-Day Streak", desc: "Hold a 30-day study streak", unlocked: state.bestStreak >= 30 },
    ...perCourseBadges,
    { icon: "⭐", title: "Level Up", desc: "Reach Analyst I (1,000 XP total)", unlocked: xp >= 1000 },
    { icon: "🧠", title: "Active Reviewer", desc: "Queue your first lesson for revision", unlocked: Object.keys(state.revisionDates).length > 0 },
    { icon: "📌", title: "Syllabus Curator", desc: "Bookmark 3 lessons to revisit later", unlocked: bookmarksCount >= 3 },
    { icon: "🔖", title: "No Stone Unturned", desc: "Bookmark 5 or more lessons", unlocked: bookmarksCount >= 5 },
    { icon: "📔", title: "Mistake Historian", desc: "Document your first error in the Wrong Answer Journal", unlocked: (state.journal?.length || 0) >= 1 },
    { icon: "🖋️", title: "Deep Thinker", desc: "Write custom study notes for 3 or more lessons", unlocked: Object.keys(state.notes || {}).length >= 3 },
    { icon: "💼", title: "Career Architect", desc: "Write answers for 2 or more Interview Prep questions", unlocked: Object.keys(state.interviewAnswers || {}).length >= 2 },
    { icon: "💪", title: "Hard Core", desc: "Tag 3 or more lessons with High Difficulty", unlocked: Object.values(state.difficulty || {}).filter(v => v === 3).length >= 3 },
  ];

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="space-y-6" id="achievements-view">
      {/* Overview Block */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#D4AF37]" /> Achievement Milestones
          </h2>
          <p className="text-xs text-[#94949C] leading-relaxed max-w-xl">
            Hard work in the dark prepares you for the certifications that shift your career. Earn awards dynamically as your study hours and streaks increase!
          </p>
        </div>
        
        {/* Count */}
        <div className="bg-[#171B24] border border-white/5 rounded-lg p-3 w-full sm:w-auto text-center min-w-[140px]">
          <span className="block text-[10px] text-[#94949C] uppercase font-semibold">Unlocked Awards</span>
          <span className="block text-2xl font-mono font-bold text-[#D4AF37] mt-1">{unlockedCount} / {badges.length}</span>
          <span className="block text-[9px] text-[#55555B] mt-0.5">{Math.round((unlockedCount/badges.length)*100)}% complete</span>
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {badges.map((b, idx) => (
          <div
            key={idx}
            className={`rounded-xl p-4 flex flex-col items-center text-center justify-between border select-none transition-all duration-300 ${
              b.unlocked
                ? "bg-gradient-to-b from-[#171B24] to-[#171B24] border-[#D4AF37]/40 text-[#E0E0E6]"
                : "bg-[#171B24]/40 border-white/5 text-[#55555B] opacity-50 grayscale"
            }`}
          >
            <div className="text-2xl mb-2">{b.icon}</div>
            <div className="space-y-1">
              <span className={`block text-xs font-bold ${b.unlocked ? 'text-[#D4AF37]' : 'text-[#94949C]'}`}>
                {b.title}
              </span>
              <span className="block text-[9.5px] text-[#94949C] leading-tight">
                {b.desc}
              </span>
            </div>
            <div className="mt-3">
              {b.unlocked ? (
                <span className="bg-[#0D1C13] text-[#10B981] border border-[#10B981]/20 rounded px-2 py-0.5 text-[8.5px] uppercase font-bold">
                  Unlocked
                </span>
              ) : (
                <span className="bg-[#11141C] text-[#55555B] border border-white/5 rounded px-2 py-0.5 text-[8.5px] uppercase font-bold">
                  Locked
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Goals Section */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#D4AF37]" /> Monthly Challenges &amp; Active Goals
          </h3>
          <p className="text-xs text-[#94949C] mt-1">
            Dynamic challenges updated every month to test your consistency and study rigor. Each completed challenge grants bonus XP!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gamification.monthlyGoals.map(goal => (
            <div 
              key={goal.id} 
              className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                goal.completed 
                  ? 'bg-[#0D1C13]/10 border-[#10B981]/25' 
                  : 'bg-[#171B24]/50 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{goal.icon}</span>
                  <div>
                    <h4 className={`text-sm font-bold ${goal.completed ? 'text-[#10B981]' : 'text-white'}`}>
                      {goal.title}
                    </h4>
                    <p className="text-xs text-[#94949C] mt-1 leading-relaxed">{goal.description}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  goal.completed 
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25' 
                    : 'bg-white/5 text-[#D4AF37] border border-white/5'
                }`}>
                  +{goal.xpReward} XP
                </span>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className={goal.completed ? 'text-[#10B981]' : 'text-[#94949C]'}>
                    {goal.current} / {goal.target} {goal.unit}
                  </span>
                  <span className={goal.completed ? 'text-[#10B981] font-bold' : 'text-[#55555B]'}>
                    {goal.completed ? '100% Completed' : `${Math.round((goal.current / goal.target) * 100)}%`}
                  </span>
                </div>
                <div className="w-full bg-[#171B24] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${goal.completed ? 'bg-[#10B981]' : 'bg-[#D4AF37]'}`} 
                    style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
