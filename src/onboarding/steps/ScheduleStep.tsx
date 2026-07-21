import React from 'react';
import { Plus, X, Clock, CalendarDays, Target } from 'lucide-react';
import { Profile, VacationRange, StudyWindow } from '../../models/types';
import { computeDurationMinutes, formatMinutes } from '../../utils/time';

interface StepProps {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleStep({ profile, onChange }: StepProps) {
  const toggleDayWeekA = (day: string) => {
    const has = profile.workingDays.includes(day);
    onChange({ workingDays: has ? profile.workingDays.filter(d => d !== day) : [...profile.workingDays, day] });
  };

  const toggleDayWeekB = (day: string) => {
    const bDays = profile.workingDaysWeekB || [];
    const has = bDays.includes(day);
    onChange({ workingDaysWeekB: has ? bDays.filter(d => d !== day) : [...bDays, day] });
  };

  const addVacation = () => onChange({ vacationRanges: [...profile.vacationRanges, { start: '', end: '' }] });
  
  const updateVacation = (i: number, patch: Partial<VacationRange>) => {
    onChange({ vacationRanges: profile.vacationRanges.map((v, idx) => idx === i ? { ...v, ...patch } : v) });
  };
  
  const removeVacation = (i: number) => onChange({ vacationRanges: profile.vacationRanges.filter((_, idx) => idx !== i) });

  const addWindow = () => {
    onChange({
      studyWindows: [
        ...profile.studyWindows,
        { startTime: '18:00', endTime: '19:00', minutes: 60 }
      ]
    });
  };

  const updateWindow = (i: number, patch: Partial<Pick<StudyWindow, 'label' | 'startTime' | 'endTime'>>) => {
    onChange({
      studyWindows: profile.studyWindows.map((w, idx) => {
        if (idx !== i) return w;
        const updated = { ...w, ...patch };
        return { ...updated, minutes: computeDurationMinutes(updated.startTime, updated.endTime) };
      }),
    });
  };

  const removeWindow = (i: number) => onChange({ studyWindows: profile.studyWindows.filter((_, idx) => idx !== i) });

  const hasCustomExam = (goalName: string): boolean => {
    const currentDetails = profile.learningGoalDetails || {};
    const milestones = currentDetails[goalName]?.milestones || [];
    return milestones.some(m => m.type === 'Exam' || m.type === 'Certification' || m.type === 'Deadline');
  };

  const getCustomExamDate = (goalName: string): string => {
    const currentDetails = profile.learningGoalDetails || {};
    const milestones = currentDetails[goalName]?.milestones || [];
    const found = milestones.find(m => m.type === 'Exam' || m.type === 'Certification' || m.type === 'Deadline');
    return found ? found.date : '';
  };

  const updateGoalMilestone = (goalName: string, date: string) => {
    const currentDetails = profile.learningGoalDetails || {};
    const goalDetails = currentDetails[goalName] || {};
    const currentMilestones = goalDetails.milestones || [];
    
    // Remove existing Exam/Deadline/Certification milestones and replace with the new one
    const filteredMilestones = currentMilestones.filter(m => 
      m.type !== 'Exam' && m.type !== 'Certification' && m.type !== 'Deadline'
    );
    
    const newMilestones = date ? [
      ...filteredMilestones,
      {
        id: `milestone-${Date.now()}`,
        type: 'Exam' as const,
        title: 'Target Exam Date',
        date: date,
        completed: false
      }
    ] : filteredMilestones;
    
    onChange({
      learningGoalDetails: {
        ...currentDetails,
        [goalName]: {
          ...goalDetails,
          milestones: newMilestones
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Study Days selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
            <p className="text-xs font-semibold text-white">Select Study Days</p>
          </div>
          
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!profile.biWeeklyEnabled}
              onChange={() => {
                const isEnabled = !profile.biWeeklyEnabled;
                onChange({
                  biWeeklyEnabled: isEnabled,
                  workingDaysWeekB: isEnabled && !profile.workingDaysWeekB ? [...profile.workingDays] : profile.workingDaysWeekB
                });
              }}
              className="sr-only peer"
            />
            <div className="relative w-7 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-[#94949C] peer-checked:after:bg-[#D4AF37] after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#171B24] peer-checked:border peer-checked:border-[#D4AF37]/30"></div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94949C] peer-checked:text-[#D4AF37]">Bi-weekly</span>
          </label>
        </div>
        <p className="text-[11px] text-[#94949C]">
          {profile.biWeeklyEnabled 
            ? "Configure different schedules for alternating weeks (Week A / Week B) for dynamic study rhythms."
            : "Choose which days of the week you can dedicate to studying."}
        </p>

        {profile.biWeeklyEnabled ? (
          <div className="space-y-4 pt-1">
            {/* Week A */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20">Week A (Current)</span>
                <p className="text-[11px] text-[#94949C]">Your study days for this week.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => {
                  const isActive = profile.workingDays.includes(day);
                  return (
                    <button
                      key={`weeka-${day}`}
                      type="button"
                      onClick={() => toggleDayWeekA(day)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold border transition-all ${
                        isActive
                          ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#55555B] hover:text-white hover:border-white/10'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Week B */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 text-[#94949C] px-2 py-0.5 rounded border border-white/10">Week B (Following)</span>
                <p className="text-[11px] text-[#94949C]">Your study days for next week.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => {
                  const isActive = (profile.workingDaysWeekB || []).includes(day);
                  return (
                    <button
                      key={`weekb-${day}`}
                      type="button"
                      onClick={() => toggleDayWeekB(day)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold border transition-all ${
                        isActive
                          ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#55555B] hover:text-white hover:border-white/10'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {WEEKDAYS.map(day => {
              const isActive = profile.workingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDayWeekA(day)}
                  className={`rounded-lg px-3.5 py-2.5 text-xs font-bold border transition-all ${
                    isActive
                      ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                      : 'bg-[#171B24] border-white/5 text-[#94949C] hover:text-white hover:border-white/10'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Availability Study Windows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#D4AF37]" />
            <p className="text-xs font-semibold text-white">Daily Study Windows</p>
          </div>
          <button
            type="button"
            onClick={addWindow}
            className="text-xs text-[#D4AF37] font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add window
          </button>
        </div>
        <p className="text-[11px] text-[#94949C]">
          Specify your available times. Himam automatically calculates the duration for each session.
        </p>

        {profile.studyWindows.length === 0 && (
          <p className="text-xs text-[#55555B] bg-[#0B0D12] border border-white/5 rounded-lg p-4 text-center">
            No study windows configured. Add at least one window to plan your sessions.
          </p>
        )}

        <div className="space-y-2.5 pt-1">
          {profile.studyWindows.map((w, i) => (
            <div key={i} className="bg-[#171B24] border border-white/5 rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={w.startTime}
                    onChange={e => updateWindow(i, { startTime: e.target.value })}
                    className="rounded-lg bg-[#0B0D12] border border-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]/40"
                  />
                  <span className="text-[#55555B] text-xs font-semibold">to</span>
                  <input
                    type="time"
                    value={w.endTime}
                    onChange={e => updateWindow(i, { endTime: e.target.value })}
                    className="rounded-lg bg-[#0B0D12] border border-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]/40"
                  />
                </div>
                <span className="text-xs text-[#D4AF37] bg-[#171B24] border border-[#D4AF37]/20 px-2 py-1 rounded font-mono font-medium">
                  {formatMinutes(w.minutes)}
                </span>
                <button
                  type="button"
                  onClick={() => removeWindow(i)}
                  aria-label="Remove study window"
                  className="ml-auto p-1 text-[#55555B] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Target Completion & Exams */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <Target className="w-4 h-4 text-[#D4AF37]" />
          <p className="text-xs font-semibold text-white">Target Completion & Exams</p>
        </div>
        <p className="text-[11px] text-[#94949C]">
          Decide whether your goal deadlines are auto-calculated from the syllabus, or if you have a specific target exam / finish date in mind.
        </p>

        {profile.learningGoals.length === 0 ? (
          <p className="text-xs text-[#55555B] bg-[#0B0D12] border border-white/5 rounded-lg p-3 text-center">
            No learning goals selected. Go back to Step 3 to add a goal.
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            {profile.learningGoals.map(goal => {
              const isManual = hasCustomExam(goal);
              const customDate = getCustomExamDate(goal);
              return (
                <div key={goal} className="bg-[#171B24] border border-white/5 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[280px]" title={goal}>{goal}</p>
                      <p className="text-[10px] text-[#94949C] mt-0.5">
                        {isManual ? 'Manual target deadline configured.' : 'Auto-estimated from Step 3 specifications.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateGoalMilestone(goal, '')}
                      className={`rounded-lg px-2.5 py-2 text-[11px] font-bold border transition-all text-center cursor-pointer ${
                        !isManual
                          ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#55555B] hover:text-[#94949C]'
                      }`}
                    >
                      Auto-Calculate
                    </button>
                    <button
                      type="button"
                      onClick={() => updateGoalMilestone(goal, customDate || new Date().toISOString().slice(0, 10))}
                      className={`rounded-lg px-2.5 py-2 text-[11px] font-bold border transition-all text-center cursor-pointer ${
                        isManual
                          ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#55555B] hover:text-[#94949C]'
                      }`}
                    >
                      Set Custom Exam Date
                    </button>
                  </div>

                  {isManual && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[10px] uppercase tracking-wider text-[#55555B] font-semibold">Select Target Exam / Finish Date</label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={e => updateGoalMilestone(goal, e.target.value)}
                        className="w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vacation ranges */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white">Blackout Dates / Vacations</p>
          <button
            type="button"
            onClick={addVacation}
            className="text-xs text-[#D4AF37] font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add vacation
          </button>
        </div>
        <p className="text-[11px] text-[#94949C]">Specify dates where studying should be paused completely.</p>
        
        {profile.vacationRanges.length === 0 && (
          <p className="text-xs text-[#55555B]">No vacation ranges configured.</p>
        )}

        <div className="space-y-2">
          {profile.vacationRanges.map((range, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#171B24] border border-white/5 rounded-xl p-2">
              <input
                type="date"
                value={range.start}
                onChange={e => updateVacation(i, { start: e.target.value })}
                className="flex-1 rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
              />
              <span className="text-[#55555B] text-xs font-semibold">to</span>
              <input
                type="date"
                value={range.end}
                onChange={e => updateVacation(i, { end: e.target.value })}
                className="flex-1 rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
              />
              <button
                type="button"
                onClick={() => removeVacation(i)}
                aria-label="Remove vacation range"
                className="p-1 text-[#55555B] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
