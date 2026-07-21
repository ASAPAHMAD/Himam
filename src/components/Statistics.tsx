import React from 'react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';
import { TrendingUp, BarChart2, Calendar, BookOpen } from 'lucide-react';
import { LEGACY_COURSE_IDS, getLegacyCourseById } from '../models/legacyBridge';
import { calculateProgressMetrics } from '../services/progressEngine';
import { CourseCatalog } from '../services/courseCatalog';

interface StatisticsProps {
  state: StudyPlanState;
  profile: Profile;
}

export default function Statistics({ state, profile }: StatisticsProps) {
  const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
  const customGoals = CourseCatalog.getCustomGoals(profile.learningGoals, profile.learningGoalDetails);

  const hasPL300 = activeCourses.some(c => c.id === 'course-pl300');
  const hasPMIPBA = activeCourses.some(c => c.id === 'course-pmipba');

  // Math metrics — calculated via pure deterministic Progress Engine
  const plCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PL300)!;
  const pbiCourse = getLegacyCourseById(LEGACY_COURSE_IDS.PMIPBA)!;

  const progressMetrics = calculateProgressMetrics(state, activeCourses);

  const plStats = progressMetrics.courses[LEGACY_COURSE_IDS.PL300];
  const pbiStats = progressMetrics.courses[LEGACY_COURSE_IDS.PMIPBA];

  const plTotal = plStats ? plStats.totalLessons : 0;
  const plDone = plStats ? plStats.completedLessons : 0;
  const pbiTotal = pbiStats ? pbiStats.totalLessons : 0;
  const pbiDone = pbiStats ? pbiStats.completedLessons : 0;

  const totalLessons = progressMetrics.overall.totalLessons;
  const totalDone = progressMetrics.overall.completedLessons;
  const overallPercentage = progressMetrics.overall.completionPercentage;

  const totalMinStudied = progressMetrics.consistency.totalMinutesStudied;
  const totalHoursStudied = progressMetrics.consistency.totalHoursStudied.toFixed(1);

  const studyDaysCount = progressMetrics.consistency.activeStudyDaysCount;
  const avgMinutesPerDay = progressMetrics.consistency.dailyAverageMinutes;

  // 90-day heatmap data from Progress Engine
  const heatmapCells = progressMetrics.consistency.heatmapCells.map(c => ({
    dateStr: c.dateStr,
    mins: c.minutes,
    level: c.level,
  }));

  // Monthly trend SVG calculations from Progress Engine data
  const renderMonthlyTrendSvg = () => {
    const vals = progressMetrics.monthlyProgress.trendDailyMinutes;
    const w = 560;
    const h = 100;
    const pad = 6;
    const maxVal = Math.max(30, ...vals);
    const stepX = (w - 2 * pad) / (vals.length - 1 || 1);

    let path = "";
    vals.forEach((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (v / maxVal) * (h - 2 * pad);
      path += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    });

    return { path: path.trim(), width: w, height: h };
  };

  const monthlyTrend = renderMonthlyTrendSvg();

  // Burn-down SVG calculations from Progress Engine data
  const renderBurndownSvg = () => {
    const data = progressMetrics.burndown;
    const w = 560;
    const h = 140;
    const pad = 8;

    // Ideal burn line path
    let idealPath = "";
    for (let i = 0; i <= data.totalDays; i += Math.max(1, Math.round(data.totalDays / 30))) {
      const remainingPct = 1 - i / data.totalDays;
      const remainingCount = data.totalLessons * remainingPct;
      const x = pad + (i / data.totalDays) * (w - 2 * pad);
      const y = pad + (1 - remainingCount / Math.max(1, data.totalLessons)) * (h - 2 * pad);
      idealPath += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }

    // Actual lessons completed cumulative line
    let actualPath = "";
    for (let i = 0; i <= data.daysElapsed; i++) {
      const cumCompleted = data.cumulativeLessonsCompleted[i];
      const remainingCount = Math.max(0, data.totalLessons - cumCompleted);
      const x = pad + (i / data.totalDays) * (w - 2 * pad);
      const y = pad + (1 - remainingCount / Math.max(1, data.totalLessons)) * (h - 2 * pad);
      actualPath += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1) + " ";
    }

    return { idealPath: idealPath.trim(), actualPath: actualPath.trim(), width: w, height: h };
  };

  const burndown = renderBurndownSvg();

  // Weekly study bars from Progress Engine data
  const weeklyBars = (() => {
    const maxMins = Math.max(30, ...progressMetrics.weeklyProgress.map(w => w.minutes));
    return progressMetrics.weeklyProgress.map(w => ({
      name: w.dayName,
      mins: w.minutes,
      pctHeight: (w.minutes / maxMins) * 100,
    }));
  })();

  // Monthly study bars (By week) from Progress Engine data
  const monthlyWeeks = (() => {
    const maxWeekMins = Math.max(30, ...progressMetrics.monthlyProgress.weeks.map(w => w.minutes));
    return progressMetrics.monthlyProgress.weeks.map(w => ({
      name: w.weekName,
      mins: w.minutes,
      pctHeight: (w.minutes / maxWeekMins) * 100,
    }));
  })();

  return (
    <div className="space-y-6" id="statistics-view">
      {/* Cards stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase text-[#94949C] font-bold">Total Hours Studied</span>
          <span className="text-2xl font-mono font-bold text-[#D4AF37] mt-1">{totalHoursStudied}h</span>
          <span className="text-[9.5px] text-[#55555B] mt-0.5">Accumulated duration</span>
        </div>
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase text-[#94949C] font-bold">Overall Progress</span>
          <span className="text-2xl font-mono font-bold text-[#D4AF37] mt-1">{overallPercentage}%</span>
          <span className="text-[9.5px] text-[#55555B] mt-0.5">{totalDone} of {totalLessons} lessons</span>
        </div>
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase text-[#94949C] font-bold">Current Streak</span>
          <span className="text-2xl font-mono font-bold text-[#10B981] mt-1">{state.streak} days</span>
          <span className="text-[9.5px] text-[#55555B] mt-0.5">Best: {state.bestStreak} days</span>
        </div>
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[10px] uppercase text-[#94949C] font-bold">Daily Average</span>
          <span className="text-2xl font-mono font-bold text-[#D4AF37] mt-1">{avgMinutesPerDay}m</span>
          <span className="text-[9.5px] text-[#55555B] mt-0.5">Per active study day</span>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C] flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[#D4AF37]" /> Study Activity Heatmap (Last 90 Days)
        </h3>
        
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 justify-start min-w-[650px]">
            {heatmapCells.map((c, idx) => {
              let cellBg = "bg-[#11141C] border border-white/5";
              if (c.level === 1) cellBg = "bg-[#171B24] border-[#D4AF37]/10";
              else if (c.level === 2) cellBg = "bg-[#2F2414] border-[#D4AF37]/35";
              else if (c.level === 3) cellBg = "bg-[#5C4827] border-[#D4AF37]/50";
              else if (c.level === 4) cellBg = "bg-[#D4AF37] border-white/20";

              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-sm transition-all duration-300 ${cellBg}`}
                  title={`${c.dateStr}: ${c.mins} minutes studied`}
                ></div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#55555B]">
          <span>Less</span>
          <span className="w-3 h-3 rounded-sm bg-[#11141C] border border-white/5"></span>
          <span className="w-3 h-3 rounded-sm bg-[#171B24] border border-[#D4AF37]/10"></span>
          <span className="w-3 h-3 rounded-sm bg-[#2F2414] border border-[#D4AF37]/35"></span>
          <span className="w-3 h-3 rounded-sm bg-[#5C4827] border border-[#D4AF37]/50"></span>
          <span className="w-3 h-3 rounded-sm bg-[#D4AF37]"></span>
          <span>More</span>
        </div>
      </div>

      {/* Graphs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Trend Graph */}
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#D4AF37]" /> Monthly Study Time Trend (Minutes)
          </h3>
          <div className="w-full bg-[#11141C] rounded-lg p-2 border border-white/5">
            {monthlyTrend.path ? (
              <svg viewBox={`0 0 ${monthlyTrend.width} ${monthlyTrend.height}`} className="w-full h-28 block">
                <path
                  d={monthlyTrend.path}
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  className="transition-all duration-500"
                />
              </svg>
            ) : (
              <div className="h-28 flex items-center justify-center text-xs text-[#55555B]">No study activity logged this month yet.</div>
            )}
          </div>
        </div>

        {/* Burndown Graph */}
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C] flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#D4AF37]" /> Certification Pace Burn-down Chart
          </h3>
          <div className="w-full bg-[#11141C] rounded-lg p-2 border border-white/5">
            <svg viewBox={`0 0 ${burndown.width} ${burndown.height}`} className="w-full h-28 block">
              {burndown.idealPath && (
                <path
                  d={burndown.idealPath}
                  fill="none"
                  stroke="#55555B"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
              )}
              {burndown.actualPath && (
                <path
                  d={burndown.actualPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <div className="flex justify-between text-[9px] text-[#55555B] mt-1 px-1">
              <span>July 14 Start</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-[#10B981]"></span> Actual</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 border-t border-[#55555B] border-dashed"></span> Target</span>
              </span>
              <span>Aug 25 Deadline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Column Visualizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly study distribution */}
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C]">Weekly Study Breakdown</h3>
          <div className="flex items-end justify-between h-24 gap-3 bg-[#11141C] border border-white/5 rounded-lg p-4 pt-6">
            {weeklyBars.map((b, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full bg-gradient-to-t from-[#B8932D] to-[#D4AF37] rounded-t-md transition-all duration-500 relative" style={{ height: `${b.pctHeight}%`, minHeight: '4px' }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-semibold text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/5 px-1 py-0.5 rounded z-10 whitespace-nowrap">
                    {b.mins}m
                  </span>
                </div>
                <span className="text-[9px] text-[#55555B] font-medium uppercase">{b.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Breakdown by week */}
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C]">This Month Study Volume</h3>
          <div className="flex items-end justify-between h-24 gap-3 bg-[#11141C] border border-white/5 rounded-lg p-4 pt-6">
            {monthlyWeeks.map((b, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full bg-gradient-to-t from-[#1F2C3F] to-[#3B6290] rounded-t-md transition-all duration-500 relative" style={{ height: `${b.pctHeight}%`, minHeight: '4px' }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-semibold text-[#3B6290] opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/5 px-1 py-0.5 rounded z-10 whitespace-nowrap">
                    {b.mins}m
                  </span>
                </div>
                <span className="text-[9px] text-[#55555B] font-medium uppercase">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Certification Hours */}
      <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C] flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-[#D4AF37]" /> Syllabus Study Contribution
        </h3>
        
        <div className="space-y-4">
          {activeCourses.map(course => {
            const stats = progressMetrics.courses[course.id];
            const total = stats ? stats.totalLessons : 0;
            const done = stats ? stats.completedLessons : 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const label = course.id === 'course-pl300' 
              ? 'PL-300 Course Syllabus Completion' 
              : course.id === 'course-pmipba'
              ? 'PMI-PBA Loaded Lessons Completion'
              : `${course.name.split(':')[0]} Completion`;

            return (
              <div key={course.id}>
                <div className="flex justify-between items-center text-xs text-[#94949C] mb-1.5">
                  <span>{label}</span>
                  <span className="font-mono text-[#D4AF37] font-semibold">{done}/{total} lessons ({pct}%)</span>
                </div>
                <div className="w-full bg-[#11141C] h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] h-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}

          {customGoals.map((cg, index) => (
            <div key={index}>
              <div className="flex justify-between items-center text-xs text-[#94949C] mb-1.5">
                <span>{cg} Study Tracker</span>
                <span className="font-mono text-[#D4AF37] font-semibold">Active Slot</span>
              </div>
              <div className="w-full bg-[#11141C] h-2.5 rounded-full overflow-hidden border border-white/5">
                <div className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] h-full transition-all duration-500" style={{ width: '100%' }}></div>
              </div>
            </div>
          ))}

          {(profile.learningGoals || []).length === 0 && (
            <div className="p-4 text-center text-xs text-[#55555B] bg-[#11141C] border border-white/5 rounded-xl italic">
              No active targets configured. Activate targets in the Study Center library to track your syllabus completion statistics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
