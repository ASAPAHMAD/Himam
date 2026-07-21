import React, { useState } from 'react';
import { StudyPlanState, Lesson } from '../services/Sync/types';
import { ALL_LESSONS } from '../data';
import { getFullScheduleFromEngine, ScheduledDay } from '../models/legacyScheduleAdapter';
import { Profile } from '../models/types';
import { CourseCatalog } from '../services/courseCatalog';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { 
  Calendar as CalendarIcon, 
  Check, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Play, 
  Clock, 
  Star, 
  Bookmark, 
  Flag, 
  FileText, 
  Coffee, 
  CheckCircle2,
  AlertCircle,
  Sun,
  Sunset,
  Sparkles,
  Download,
  RefreshCw
} from 'lucide-react';

interface CalendarProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  onCompleteLesson: (lessonId: string, duration: number) => void;
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
}

export default function Calendar({ state, onUpdateState, onCompleteLesson, profile, onUpdateProfile }: CalendarProps) {
  const todayISO = new Date().toISOString().slice(0, 10);

  const { session } = useAuth();
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleConnectGoogle = async () => {
    if (!supabase) {
      alert("Supabase is not configured. Google Calendar Sync is disabled.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        redirectTo: window.location.origin + '/auth/callback'
      }
    });
    if (error) {
      alert(`OAuth Connection Error: ${error.message}`);
    }
  };

  const syncToGoogleCalendar = async () => {
    const providerToken = session?.provider_token;
    if (!providerToken) {
      alert("Please connect your Google Account first to authorize calendar write permissions.");
      return;
    }

    setSyncing(true);
    setSyncProgress("Preparing schedule events...");
    
    // Filter workable study days
    const studyDays = fullSchedule.filter(day => day.isWorkable && (day.morningSession.length > 0 || day.lunchSession.length > 0));
    let totalEvents = 0;
    studyDays.forEach(day => {
      totalEvents += day.morningSession.length + day.lunchSession.length;
    });

    if (totalEvents === 0) {
      alert("No study sessions scheduled to sync. Set study days or complete onboarding first.");
      setSyncing(false);
      setSyncProgress(null);
      return;
    }

    let syncedCount = 0;
    try {
      for (const day of studyDays) {
        const lessons = [...day.morningSession, ...day.lunchSession];
        for (let i = 0; i < lessons.length; i++) {
          const lesson = lessons[i];
          const isMorning = i < day.morningSession.length;
          
          const windowIdx = isMorning ? 0 : 1;
          const startTimeStr = profile.studyWindows[windowIdx]?.startTime || (isMorning ? '08:00' : '12:00');
          const endTimeStr = profile.studyWindows[windowIdx]?.endTime || (isMorning ? '10:00' : '14:00');

          const startISO = `${day.dateStr}T${startTimeStr}:00`;
          const endISO = `${day.dateStr}T${endTimeStr}:00`;

          const uid = `studylesson${lesson.id.replace(/[^a-zA-Z0-9]/g, '')}${day.dateStr.replace(/-/g, '')}@himamstudy.com`;

          setSyncProgress(`Pushing event ${syncedCount + 1}/${totalEvents}: ${lesson.title}...`);

          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/import', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              iCalUID: uid,
              summary: `📖 Study Session: ${lesson.title}`,
              description: `Focus lesson: ${lesson.title} (${lesson.duration}m).\nCourse: ${lesson.course} - Section: ${lesson.sectionName}\nLink: ${window.location.origin}/dashboard`,
              start: {
                dateTime: startISO,
                timeZone: profile.timezone || 'UTC'
              },
              end: {
                dateTime: endISO,
                timeZone: profile.timezone || 'UTC'
              }
            })
          });

          if (!response.ok) {
            await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${providerToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                summary: `📖 Study Session: ${lesson.title}`,
                description: `Focus lesson: ${lesson.title} (${lesson.duration}m).\nCourse: ${lesson.course} - Section: ${lesson.sectionName}`,
                start: {
                  dateTime: startISO,
                  timeZone: profile.timezone || 'UTC'
                },
                end: {
                  dateTime: endISO,
                  timeZone: profile.timezone || 'UTC'
                }
              })
            });
          }

          syncedCount++;
        }
      }

      setSyncProgress(`✓ Sync complete! ${totalEvents} study sessions added to your primary Google Calendar.`);
    } catch (err: any) {
      console.error(err);
      setSyncProgress(`✕ Sync failed: ${err.message || "Connection timed out."}`);
    } finally {
      setSyncing(false);
    }
  };

  const exportToICS = () => {
    let icsString = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Himam Study Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n') + '\r\n';

    const studyDays = fullSchedule.filter(day => day.isWorkable && (day.morningSession.length > 0 || day.lunchSession.length > 0));

    studyDays.forEach(day => {
      const lessons = [...day.morningSession, ...day.lunchSession];
      lessons.forEach((lesson, index) => {
        const isMorning = index < day.morningSession.length;
        const windowIdx = isMorning ? 0 : 1;
        const startTimeStr = profile.studyWindows[windowIdx]?.startTime || (isMorning ? '08:00' : '12:00');
        const endTimeStr = profile.studyWindows[windowIdx]?.endTime || (isMorning ? '10:00' : '14:00');

        const dateNoDash = day.dateStr.replace(/-/g, '');
        const startClean = startTimeStr.replace(':', '') + '00';
        const endClean = endTimeStr.replace(':', '') + '00';

        const uid = `study-${lesson.id}-${day.dateStr}@himamstudyplanner.com`;
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        icsString += [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${dateNoDash}T${startClean}`,
          `DTEND:${dateNoDash}T${endClean}`,
          `SUMMARY:📖 Study Session: ${lesson.title}`,
          `DESCRIPTION:Focus and complete lesson: ${lesson.title} (${lesson.duration} mins) of your planner course ${lesson.course}.`,
          'STATUS:CONFIRMED',
          'END:VEVENT'
        ].join('\r\n') + '\r\n';
      });
    });

    icsString += 'END:VCALENDAR';

    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'himam-study-schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active month navigation state (defaults to July 2026 if outside 2026, or current month of 2026)
  const [currentMonthIdx, setCurrentMonthIdx] = useState<number>(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    if (currentYear === 2026) {
      return currentMonth;
    }
    return 6; // Default to July 2026 (index 6)
  });

  // Selected Day state for Modal detail popups
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  
  // Collapse state for active notes in modal list
  const [modalActiveNotesId, setModalActiveNotesId] = useState<string | null>(null);

  // Manual scheduling inputs
  const [newManualTaskTitle, setNewManualTaskTitle] = useState('');
  const [newManualTaskDuration, setNewManualTaskDuration] = useState(30);
  const [manualLessonSelect, setManualLessonSelect] = useState('');

  const handleAddManualTask = (dateStr: string) => {
    if (!newManualTaskTitle.trim()) return;
    const currentManualTasks = profile.manualTasks || {};
    const dayTasks = currentManualTasks[dateStr] || [];
    const newTask = {
      id: `manual-task-${Date.now()}`,
      title: newManualTaskTitle.trim(),
      duration: Number(newManualTaskDuration),
      completed: false
    };
    
    onUpdateProfile({
      ...profile,
      manualTasks: {
        ...currentManualTasks,
        [dateStr]: [...dayTasks, newTask]
      }
    });
    setNewManualTaskTitle('');
  };

  const handleToggleManualTask = (dateStr: string, taskId: string) => {
    const currentManualTasks = profile.manualTasks || {};
    const dayTasks = currentManualTasks[dateStr] || [];
    const updatedTasks = dayTasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    
    onUpdateProfile({
      ...profile,
      manualTasks: {
        ...currentManualTasks,
        [dateStr]: updatedTasks
      }
    });
  };

  const handleRemoveManualTask = (dateStr: string, taskId: string) => {
    const currentManualTasks = profile.manualTasks || {};
    const dayTasks = currentManualTasks[dateStr] || [];
    const updatedTasks = dayTasks.filter(t => t.id !== taskId);
    
    onUpdateProfile({
      ...profile,
      manualTasks: {
        ...currentManualTasks,
        [dateStr]: updatedTasks
      }
    });
  };

  const handlePinSyllabusLesson = (dateStr: string, lessonId: string) => {
    if (!lessonId) return;
    const currentManualLessons = profile.manualLessons || {};
    const dayLessons = currentManualLessons[dateStr] || [];
    if (dayLessons.includes(lessonId)) return; // already pinned
    
    onUpdateProfile({
      ...profile,
      manualLessons: {
        ...currentManualLessons,
        [dateStr]: [...dayLessons, lessonId]
      }
    });
    setManualLessonSelect('');
  };

  const handleUnpinSyllabusLesson = (dateStr: string, lessonId: string) => {
    const currentManualLessons = profile.manualLessons || {};
    const dayLessons = currentManualLessons[dateStr] || [];
    const updatedLessons = dayLessons.filter(id => id !== lessonId);
    
    onUpdateProfile({
      ...profile,
      manualLessons: {
        ...currentManualLessons,
        [dateStr]: updatedLessons
      }
    });
  };

  const months = [
    { year: 2026, month: 0, label: "January 2026", short: "Jan" },
    { year: 2026, month: 1, label: "February 2026", short: "Feb" },
    { year: 2026, month: 2, label: "March 2026", short: "Mar" },
    { year: 2026, month: 3, label: "April 2026", short: "Apr" },
    { year: 2026, month: 4, label: "May 2026", short: "May" },
    { year: 2026, month: 5, label: "June 2026", short: "Jun" },
    { year: 2026, month: 6, label: "July 2026", short: "Jul" },
    { year: 2026, month: 7, label: "August 2026", short: "Aug" },
    { year: 2026, month: 8, label: "September 2026", short: "Sep" },
    { year: 2026, month: 9, label: "October 2026", short: "Oct" },
    { year: 2026, month: 10, label: "November 2026", short: "Nov" },
    { year: 2026, month: 11, label: "December 2026", short: "Dec" }
  ];

  // Retrieve the full master schedule — now computed by the generic
  // schedulingEngine.ts via legacyScheduleAdapter.ts, not a duplicated set
  // of hardcoded date constants (this file used to redeclare leaveStart/
  // leaveEnd/workingThursdays independently of utils/scheduler.ts — see
  // ARCHITECTURE.md §2, "duplicated logic" finding). Every day's isLeave/
  // isWeekend/isOffThursday/isPMIMilestone/isPLMilestone below now reads
  // straight from this single schedule instead of being recomputed locally.
  const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
  const activeCourseShortNames = new Set(activeCourses.map(c => c.id === 'course-pl300' ? 'PL-300' : c.id === 'course-pmipba' ? 'PMI-PBA' : c.name.split(':')[0]));
  const fullSchedule = getFullScheduleFromEngine(profile, state);

  // Gather dates where reviews are scheduled
  const revisionDates = new Set<string>();
  Object.values(state.revisionDates).forEach(dateStr => {
    if (dateStr) revisionDates.add(dateStr);
  });

  // Filter lessons that have revision dates matching a specific date
  const getRevisionsForDate = (dateStr: string) => {
    return ALL_LESSONS.filter(l => state.revisionDates[l.id] === dateStr);
  };

  const handleToggleBookmark = (id: string) => {
    onUpdateState({
      ...state,
      bookmarks: { ...state.bookmarks, [id]: !state.bookmarks[id] }
    });
  };

  const handleTogglePriority = (id: string) => {
    onUpdateState({
      ...state,
      priority: { ...state.priority, [id]: !state.priority[id] }
    });
  };

  const handleSetDifficulty = (id: string, stars: number) => {
    onUpdateState({
      ...state,
      difficulty: { ...state.difficulty, [id]: state.difficulty[id] === stars ? 0 : stars }
    });
  };

  const handleSetReviewDate = (id: string, dateStr: string) => {
    onUpdateState({
      ...state,
      revisionDates: { ...state.revisionDates, [id]: dateStr }
    });
  };

  const handleUpdateNotes = (id: string, text: string) => {
    onUpdateState({
      ...state,
      notes: { ...state.notes, [id]: text }
    });
  };

  const renderMonth = (y: number, m: number, label: string) => {
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const dayCells: React.ReactNode[] = [];

    // Days in Month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, m, d);
      const iso = dateObj.toISOString().slice(0, 10);
      const dow = dateObj.getDay();
      const weekdayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

      // Extract day schedule info from central scheduler — this is now the
      // ONLY source of truth for isLeave/isWeekend/isOffThursday/milestones,
      // rather than a second, independently-computed copy of the same dates.
      const daySchedule = fullSchedule.find(ds => ds.dateStr === iso);
      const inLeave = daySchedule?.isLeave ?? false;
      const isWeekend = daySchedule?.isWeekend ?? (dow === 5 || dow === 6);
      const isThursday = dow === 4;
      const isOffThursday = daySchedule?.isOffThursday ?? isThursday;
      const isWorkThursday = isThursday && !isOffThursday;
      const scheduledCount = daySchedule ? (daySchedule.morningSession.length + daySchedule.lunchSession.length) : 0;
      const scheduledMinutes = daySchedule ? daySchedule.estimatedDailyTime : 0;

      let cellClass = "cal-day relative flex flex-col items-stretch justify-between p-2 rounded-xl text-xs aspect-square border cursor-pointer transition-all duration-200 select-none ";
      
      if (inLeave) {
        cellClass += "bg-[#1C1212] border-[#EF4444]/20 hover:bg-[#251818] hover:border-[#EF4444]/40 text-[#FCA5A5]";
      } else if (isWeekend) {
        cellClass += "bg-[#0B0D12] border-white/5 hover:bg-white/5 hover:border-white/10 text-[#55555B]";
      } else if (isThursday) {
        if (isWorkThursday) {
          cellClass += "bg-[#0D1C13] border-[#10B981]/20 hover:bg-[#122A1B] hover:border-[#10B981]/40 text-[#10B981]";
        } else {
          cellClass += "bg-[#171B24] border-[#D4AF37]/20 hover:bg-[#2A2114] hover:border-[#D4AF37]/40 text-[#D4AF37]";
        }
      } else {
        // Standard Sun-Wed working day
        cellClass += "bg-[#171B24] border-white/5 hover:bg-[#18181F] hover:border-white/10 text-[#E0E0E6]";
      }

      // Milestones — from the schedule (Course.examDate in migrateLegacy.ts),
      // not a literal date-string comparison duplicated in this file.
      const milestoneCourse = activeCourses.find(c => c.examDate === iso);
      const isMilestone = !!milestoneCourse;
      const isToday = iso === todayISO;

      // Special highlight for milestone targets
      if (isMilestone) {
        cellClass += " !bg-[#D4AF37] !border-[#D4AF37] !text-black font-extrabold shadow";
      }

      // Special highlight for today
      if (isToday && !isMilestone) {
        cellClass += " !bg-[#D4AF37] !text-black font-extrabold shadow-[0_0_15px_rgba(197,160,89,0.6)] !border-[#D4AF37]";
      }

      // Check stats for completions on this day
      const loggedCompletedCount = state.lessonsLog[iso] || 0;
      const hasRevision = revisionDates.has(iso);

      dayCells.push(
        <div 
          key={iso} 
          className={cellClass} 
          onClick={() => setSelectedDateStr(iso)}
          id={`calendar-cell-${iso}`}
        >
          {/* Day number & indicators */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col items-start leading-none">
              <span className={`text-[11px] font-bold ${isToday || isMilestone ? 'text-black' : 'text-white'}`}>
                {d}
              </span>
              <span className={`text-[8px] uppercase tracking-wider font-semibold mt-0.5 ${isToday || isMilestone ? 'text-black/60' : 'text-[#94949C]'}`}>
                {weekdayName}
              </span>
            </div>
            
            {/* Quick badges at the top right of the cell */}
            <div className="flex items-center gap-1">
              {loggedCompletedCount > 0 && (
                <span className={`text-[8px] font-bold font-mono px-1 rounded ${isToday ? 'bg-black/20 text-black' : 'bg-[#10B981]/15 text-[#10B981]'}`} title={`${loggedCompletedCount} completed`}>
                  ✓{loggedCompletedCount}
                </span>
              )}
              {hasRevision && (
                <span className={`text-[8px] font-extrabold px-1 rounded ${isToday ? 'bg-black/20 text-black' : 'bg-[#D4AF37]/15 text-[#D4AF37]'}`} title="Revision Scheduled">
                  🔄
                </span>
              )}
            </div>
          </div>

          {/* Sched / Milestone text details in the bottom half */}
          <div className="mt-1">
            {isMilestone && milestoneCourse && (
              <span className="block text-[7px] uppercase font-black text-black leading-none truncate text-center bg-black/10 py-0.5 rounded">
                {milestoneCourse.id === 'course-pl300' ? 'PL-300 Exam' : milestoneCourse.id === 'course-pmipba' ? 'PBA Exam' : `${milestoneCourse.name.split(':')[0]} Exam`}
              </span>
            )}
            {!isMilestone && daySchedule && daySchedule.isWorkable && scheduledCount > 0 && (
              <div className="text-[7.5px] font-mono leading-none tracking-tighter text-center flex flex-col gap-0.5 mt-auto">
                <span className={isToday ? 'text-black/80 font-bold' : 'text-[#94949C]'}>
                  {scheduledCount} lessons
                </span>
                <span className={isToday ? 'text-black font-extrabold' : 'text-[#D4AF37] font-bold'}>
                  {scheduledMinutes}m
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={`${y}-${m}`} className="bg-[#171B24]/40 border border-white/5 rounded-2xl p-5 space-y-4 animate-fadeIn">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2">
          {dayCells}
        </div>
      </div>
    );
  };

  // Clickable Day Modal Detail Rendering
  const renderDayModal = () => {
    if (!selectedDateStr) return null;

    let targetDay = fullSchedule.find(d => d.dateStr === selectedDateStr);
    if (!targetDay) {
      const dateObj = new Date(selectedDateStr);
      const dow = dateObj.getDay();
      targetDay = {
        dateStr: selectedDateStr,
        date: dateObj,
        isWorkable: false,
        isWeekend: dow === 5 || dow === 6,
        isLeave: false,
        isOffThursday: dow === 4,
        isPMIMilestone: false,
        isPLMilestone: false,
        plLessons: [],
        pbiLessons: [],
        morningSession: [],
        lunchSession: [],
        estimatedMorningTime: 0,
        estimatedLunchTime: 0,
        estimatedDailyTime: 0,
        manualTasks: profile.manualTasks?.[selectedDateStr] || []
      };
    }

    const isToday = selectedDateStr === todayISO;
    const formattedDate = targetDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    // Calculate metrics
    const total = targetDay.morningSession.length + targetDay.lunchSession.length;
    const completed = [...targetDay.morningSession, ...targetDay.lunchSession].filter(l => state.completedLessons[l.id]).length;
    const remaining = total - completed;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Revision items for this date
    const dailyRevisions = getRevisionsForDate(selectedDateStr);

    return (
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
        id="day-detail-modal"
        onClick={() => setSelectedDateStr(null)}
      >
        <div 
          className="bg-[#11141C] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="bg-[#171B24] px-6 py-5 border-b border-white/5 flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[#D4AF37] font-serif text-sm font-bold">Daily Schedule Audit</span>
                {isToday && (
                  <span className="bg-[#D4AF37] text-black font-mono font-black text-[8px] uppercase px-1.5 py-0.5 rounded tracking-widest shadow-[0_0_10px_rgba(197,160,89,0.3)]">
                    Today
                  </span>
                )}
              </div>
              <h3 className="font-serif text-lg font-bold text-white">{formattedDate}</h3>
              <span className="text-[10px] text-[#94949C] block mt-1 uppercase font-mono tracking-wider font-bold">
                {targetDay.isLeave ? (
                  <span className="text-[#EF4444]">Family Leave Block</span>
                ) : targetDay.isWeekend ? (
                  <span className="text-[#55555B]">Weekend Rest day</span>
                ) : targetDay.isOffThursday ? (
                  <span className="text-[#D4AF37]">Off Thursday</span>
                ) : (
                  <span className="text-[#10B981]">Standard Workday (Study Mode)</span>
                )}
              </span>
            </div>

            {/* Close Button */}
            <button 
              onClick={() => setSelectedDateStr(null)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[#94949C] hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Status overview */}
            {targetDay.isWorkable ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#171B24]/50 border border-white/5 rounded-xl p-4 text-xs">
                {/* Est time */}
                <div className="space-y-1">
                  <span className="text-[#94949C] font-semibold block uppercase text-[10px]">Estimated Study Time</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-sm font-mono font-bold text-white">{targetDay.estimatedDailyTime} min</span>
                  </div>
                </div>

                {/* Progress count */}
                <div className="space-y-1">
                  <span className="text-[#94949C] font-semibold block uppercase text-[10px]">Lessons Checked</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                    <span className="text-sm font-semibold text-white">{completed} / {total} completed</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <span className="text-[#94949C] font-semibold block uppercase text-[10px]">Day Completion</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-[#11141C] h-2 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-[#D4AF37] h-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                    </div>
                    <span className="font-mono font-bold text-[#D4AF37]">{progressPct}%</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Rest block */
              <div className="bg-[#171B24]/30 border border-white/5 rounded-xl p-4 flex gap-3.5 items-start">
                <Coffee className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-white block">No formal lesson assigned today</span>
                  <p className="text-[#94949C] leading-relaxed mt-1">
                    {targetDay.isLeave 
                      ? "This date is booked for your Aramco family leave block. Take time away from the screens to focus entirely on rest and family!"
                      : "A weekend rest block or non-working Thursday. Use this time to rest or catch up on your customized bookmarks or review schedules."
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Custom Day Planner & Overrides card */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    ✏️ Custom Day Planner &amp; Overrides
                  </h4>
                  <p className="text-[10px] text-[#94949C]">Manually configure, override, or add custom tasks for this date.</p>
                </div>
                
                {/* Toggle Workability button */}
                <button
                  onClick={() => {
                    const dateObj = new Date(selectedDateStr);
                    const dow = dateObj.getDay();
                    const isWeekend = dow === 5 || dow === 6;
                    
                    let updatedHolidays = [...(profile.holidays || [])];
                    let updatedExtraWorkingDays = [...(profile.extraWorkingDays || [])];
                    
                    if (targetDay.isWorkable) {
                      if (!updatedHolidays.includes(selectedDateStr)) {
                        updatedHolidays.push(selectedDateStr);
                      }
                      updatedExtraWorkingDays = updatedExtraWorkingDays.filter(d => d !== selectedDateStr);
                    } else {
                      updatedHolidays = updatedHolidays.filter(d => d !== selectedDateStr);
                      if (isWeekend || dow === 4) {
                        if (!updatedExtraWorkingDays.includes(selectedDateStr)) {
                          updatedExtraWorkingDays.push(selectedDateStr);
                        }
                      }
                    }
                    
                    onUpdateProfile({
                      ...profile,
                      holidays: updatedHolidays,
                      extraWorkingDays: updatedExtraWorkingDays
                    });
                  }}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                    targetDay.isWorkable 
                      ? 'border-[#EF4444]/20 bg-[#EF4444]/5 text-[#EF4444] hover:bg-[#EF4444]/10' 
                      : 'border-[#10B981]/20 bg-[#10B981]/5 text-[#10B981] hover:bg-[#10B981]/10'
                  }`}
                >
                  {targetDay.isWorkable ? 'Mark as Rest Day' : 'Mark as Study Day'}
                </button>
              </div>

              {/* Add Custom Manual Task */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-[10px] text-[#94949C] uppercase font-bold block">Add Custom Study Task</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Complete DA-100 full mock exam, review M-code guide..."
                    value={newManualTaskTitle}
                    onChange={(e) => setNewManualTaskTitle(e.target.value)}
                    className="flex-1 bg-[#11141C] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddManualTask(selectedDateStr);
                    }}
                  />
                  <select
                    value={newManualTaskDuration}
                    onChange={(e) => setNewManualTaskDuration(Number(e.target.value))}
                    className="bg-[#11141C] border border-white/5 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
                  >
                    <option value={15}>15m</option>
                    <option value={30}>30m</option>
                    <option value={45}>45m</option>
                    <option value={60}>60m</option>
                    <option value={90}>90m</option>
                    <option value={120}>120m</option>
                  </select>
                  <button
                    onClick={() => handleAddManualTask(selectedDateStr)}
                    className="px-3 py-1.5 bg-[#D4AF37] text-black font-bold rounded-lg text-xs hover:bg-[#b08e4f] transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Manually Pin Syllabus Lesson */}
              <div className="space-y-2">
                <span className="text-[10px] text-[#94949C] uppercase font-bold block">Pin Syllabus Lesson Manually</span>
                <select
                  value={manualLessonSelect}
                  onChange={(e) => {
                    handlePinSyllabusLesson(selectedDateStr, e.target.value);
                  }}
                  className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]/40"
                >
                  <option value="">Select a syllabus lesson to pin to this date...</option>
                  {ALL_LESSONS.filter(l => activeCourseShortNames.has(l.course) && !state.completedLessons[l.id]).map(lesson => (
                    <option key={lesson.id} value={lesson.id}>
                      [{lesson.course}] {lesson.title} ({lesson.duration}m)
                    </option>
                  ))}
                </select>
              </div>

              {/* Display manual tasks and pinned syllabus lessons */}
              {((targetDay.manualTasks && targetDay.manualTasks.length > 0) || (profile.manualLessons?.[selectedDateStr]?.length)) ? (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-[#D4AF37] uppercase font-bold block">Current Custom Manual Items</span>
                  <div className="space-y-1.5">
                    {/* Manual tasks */}
                    {targetDay.manualTasks?.map(task => (
                      <div key={task.id} className="flex items-center justify-between bg-[#11141C]/80 p-2.5 rounded-lg border border-white/5 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleManualTask(selectedDateStr, task.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              task.completed ? 'bg-[#10B981] border-[#10B981] text-black' : 'border-[#55555B] hover:border-[#D4AF37]'
                            }`}
                          >
                            {task.completed && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                          </button>
                          <span className={`${task.completed ? 'text-[#55555B] line-through' : 'text-white font-medium'}`}>
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#94949C] bg-[#171B24] px-1.5 py-0.5 rounded border border-white/5">{task.duration}m</span>
                          <button
                            onClick={() => handleRemoveManualTask(selectedDateStr, task.id)}
                            className="text-red-400 hover:text-red-300 text-xs px-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Manually pinned lessons */}
                    {profile.manualLessons?.[selectedDateStr]?.map(lessonId => {
                      const lesson = ALL_LESSONS.find(l => l.id === lessonId);
                      if (!lesson) return null;
                      const isCompleted = !!state.completedLessons[lessonId];
                      return (
                        <div key={lessonId} className="flex items-center justify-between bg-[#171B24]/40 p-2.5 rounded-lg border border-[#D4AF37]/10 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 rounded text-[8px] font-bold uppercase">Pinned Syllabus</span>
                            <span className={`${isCompleted ? 'text-[#55555B] line-through' : 'text-white font-medium'}`}>
                              {lesson.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#94949C] bg-[#171B24] px-1.5 py-0.5 rounded border border-white/5">{lesson.duration}m</span>
                            <button
                              onClick={() => handleUnpinSyllabusLesson(selectedDateStr, lessonId)}
                              className="text-[#D4AF37] hover:text-white text-xs px-1"
                              title="Unpin from this date"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Scheduled Sessions (Only for workable days) */}
            {targetDay.isWorkable && (
              <div className="space-y-5">
                {/* Morning Session (PL-300) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-[#D4AF37]" /> {profile.studyWindows?.[0]?.label || 'Morning'} Session ({profile.studyWindows?.[0]?.startTime || '07:00'} – {profile.studyWindows?.[0]?.endTime || '07:45'})
                    </h4>
                    <span className="text-[10px] font-mono text-[#94949C]">{targetDay.estimatedMorningTime} mins</span>
                  </div>

                  <div className="space-y-2">
                    {targetDay.morningSession.length === 0 ? (
                      <div className="text-center py-4 bg-[#171B24]/20 border border-white/5 rounded-xl text-xs text-[#55555B] italic">
                        No lessons scheduled for this session.
                      </div>
                    ) : (
                      targetDay.morningSession.map(lesson => (
                        <ModalLessonRow key={lesson.id} lesson={lesson} />
                      ))
                    )}
                  </div>
                </div>

                {/* Lunch Session (PMI-PBA) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#3B82F6] flex items-center gap-1.5">
                      <Sunset className="w-4 h-4 text-[#3B82F6]" /> {profile.studyWindows?.[1]?.label || 'Lunch'} Session ({profile.studyWindows?.[1]?.startTime || '12:00'} – {profile.studyWindows?.[1]?.endTime || '12:45'})
                    </h4>
                    <span className="text-[10px] font-mono text-[#94949C]">{targetDay.estimatedLunchTime} mins</span>
                  </div>

                  <div className="space-y-2">
                    {targetDay.lunchSession.length === 0 ? (
                      <div className="text-center py-4 bg-[#171B24]/20 border border-white/5 rounded-xl text-xs text-[#55555B] italic">
                        No lessons scheduled for this session.
                      </div>
                    ) : (
                      targetDay.lunchSession.map(lesson => (
                        <ModalLessonRow key={lesson.id} lesson={lesson} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled Reviews on this date */}
            {dailyRevisions.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-white/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1.5">
                  🔄 Active Review Items Due
                </h4>
                <div className="space-y-2">
                  {dailyRevisions.map(lesson => (
                    <div key={lesson.id} className="bg-[#10B981]/5 border border-[#10B981]/25 rounded-xl p-3 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-white block">{lesson.title}</span>
                        <span className="text-[10px] text-[#94949C]">{lesson.course} · {lesson.sectionName}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.course + " " + lesson.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-[#171B24] border border-white/5 rounded text-[#D4AF37] hover:bg-[#171B24] transition-colors"
                        >
                          Review Now
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Helper Row for Lesson Card Inside Modal
  const ModalLessonRow = ({ lesson }: { lesson: Lesson; key?: string }) => {
    const isCompleted = !!state.completedLessons[lesson.id];
    const isBookmarked = !!state.bookmarks[lesson.id];
    const isPriority = !!state.priority[lesson.id];
    const difficultyStars = state.difficulty[lesson.id] || 0;
    const notesText = state.notes[lesson.id] || '';
    const reviewDate = state.revisionDates[lesson.id] || '';

    return (
      <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-3.5 space-y-2">
        <div className="flex items-start gap-3 justify-between">
          {/* Checkbox and title */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => onCompleteLesson(lesson.id, lesson.duration)}
              className={`w-4.5 h-4.5 rounded flex items-center justify-center flex-shrink-0 transition-colors mt-0.5 ${
                isCompleted ? 'bg-[#10B981] text-black' : 'border border-[#55555B] hover:border-[#D4AF37]'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3px]" />
            </button>
            
            <div className="min-w-0">
              <span className={`text-xs font-semibold leading-tight block ${isCompleted ? 'text-[#55555B] line-through' : 'text-white'}`}>
                {lesson.title}
              </span>
              <span className="text-[9.5px] text-[#94949C]">{lesson.sectionName}</span>
            </div>
          </div>

          {/* Quick Stats (Duration & Video Search) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-mono text-[#94949C] bg-[#11141C] border border-white/5 px-1.5 py-0.5 rounded">
              {lesson.duration}m
            </span>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(lesson.course + " " + lesson.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded bg-[#11141C] border border-white/5 text-[#D4AF37] hover:bg-white/5 transition-all"
              title="Open video study link"
            >
              <Play className="w-3 h-3 fill-current" />
            </a>
          </div>
        </div>

        {/* Mini Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/5 text-[11px]">
          {/* Stars */}
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map(stars => (
              <button
                key={stars}
                onClick={() => handleSetDifficulty(lesson.id, stars)}
                className={`p-0.5 transition-colors ${
                  difficultyStars >= stars ? 'text-[#D4AF37]' : 'text-white/10 hover:text-white/20'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
              </button>
            ))}
          </div>

          {/* Actions & Notes Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleTogglePriority(lesson.id)}
              className={`p-1 rounded hover:bg-white/5 ${isPriority ? 'text-[#EF4444]' : 'text-[#55555B]'}`}
            >
              <Flag className="w-3 h-3 fill-current" />
            </button>

            <button
              onClick={() => handleToggleBookmark(lesson.id)}
              className={`p-1 rounded hover:bg-white/5 ${isBookmarked ? 'text-[#D4AF37]' : 'text-[#55555B]'}`}
            >
              <Bookmark className="w-3 h-3 fill-current" />
            </button>

            {/* Notes Expand */}
            <button
              onClick={() => setModalActiveNotesId(modalActiveNotesId === lesson.id ? null : lesson.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] border font-bold transition-all ${
                notesText.trim() ? 'border-[#D4AF37]/40 text-[#D4AF37]' : 'border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              Notes
            </button>
          </div>
        </div>

        {/* Modal local notes text editor drawer */}
        {modalActiveNotesId === lesson.id && (
          <div className="bg-[#11141C] border border-white/5 rounded-lg p-2.5 space-y-1 mt-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-[#94949C] uppercase">Study Notes</span>
              <span className="text-[8px] text-[#D4AF37] font-mono font-bold">✓ Auto-saved</span>
            </div>
            <textarea
              placeholder="Record formula logs or topics..."
              value={notesText}
              onChange={(e) => handleUpdateNotes(lesson.id, e.target.value)}
              className="w-full bg-[#171B24] border border-white/5 rounded p-2 text-xs text-white placeholder-[#55555B] h-14 focus:outline-none focus:border-[#D4AF37]/40 resize-y"
            />
          </div>
        )}
      </div>
    );
  };

  const activeMonth = months[currentMonthIdx];

  return (
    <div className="space-y-6" id="calendar-view">
      {/* Calendar Header with Controls */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-white mb-2 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#D4AF37]" /> Study Pacing Calendar
          </h2>
          <p className="text-xs text-[#94949C] leading-relaxed max-w-xl">
            Displays your study days, leave periods, and target milestones. Click any cell to audit study schedules, complete lessons, and write notes.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 self-stretch sm:self-auto">
          {/* Mode Segmented Toggle */}
          <div className="flex bg-[#171B24] p-1 rounded-lg border border-white/5 text-[11px] font-semibold self-stretch sm:self-auto">
            <button
              onClick={() => onUpdateProfile({ ...profile, scheduleMode: 'automated' })}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                (profile.scheduleMode || 'automated') === 'automated'
                  ? 'bg-[#D4AF37] text-black font-extrabold shadow'
                  : 'text-[#94949C] hover:text-white'
              }`}
            >
              🤖 Automated AI
            </button>
            <button
              onClick={() => onUpdateProfile({ ...profile, scheduleMode: 'manual' })}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                profile.scheduleMode === 'manual'
                  ? 'bg-[#D4AF37] text-black font-extrabold shadow'
                  : 'text-[#94949C] hover:text-white'
              }`}
            >
              ✏️ Manual Planner
            </button>
          </div>

          {/* Month Navigation Control */}
          <div className="flex flex-wrap items-center gap-1 bg-[#171B24] p-1 rounded-xl border border-white/5 w-full sm:w-auto justify-center sm:justify-start">
            {months.map((m, idx) => (
              <button
                key={m.label}
                onClick={() => setCurrentMonthIdx(idx)}
                className={`px-2 py-1 rounded-md transition-all text-[11px] font-bold flex items-center justify-center ${
                  currentMonthIdx === idx
                    ? 'bg-[#D4AF37] text-black font-extrabold shadow'
                    : 'text-[#94949C] hover:text-white hover:bg-white/5'
                }`}
              >
                {m.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Integration Dashboard */}
      <div className="bg-gradient-to-r from-[#110D0A] to-[#11141C] border border-white/5 rounded-xl p-5 space-y-4" id="calendar-sync-hub">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> 7. Calendar Integration & Sync
            </h3>
            <p className="text-xs text-[#94949C]">
              Sync study sessions with your external personal calendars automatically to build structured routines.
            </p>
          </div>
          
          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Google Calendar Link */}
            {session?.provider_token ? (
              <button
                onClick={syncToGoogleCalendar}
                disabled={syncing}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-white/5 bg-[#171B24] text-[#D4AF37] hover:bg-[#171B24] disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Google Calendar'}
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 bg-[#171B24] border border-white/5 text-white hover:bg-white/5"
              >
                <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-white/10 rounded font-bold text-white mr-0.5">G</span>
                Connect Google Calendar
              </button>
            )}

            {/* Outlook / Apple ics */}
            <button
              onClick={exportToICS}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 bg-[#171B24] border border-white/5 text-white hover:bg-white/5"
              title="Download iCal file compatible with Outlook and Apple Calendar"
            >
              <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
              Export Outlook / Apple (iCal)
            </button>
          </div>
        </div>

        {/* Sync Status Feedback */}
        {syncProgress && (
          <div className={`p-3 rounded-lg text-xs border ${
            syncProgress.startsWith('✕') 
              ? 'bg-red-950/20 border-red-500/20 text-red-200' 
              : syncProgress.startsWith('✓') 
                ? 'bg-green-950/20 border-green-500/20 text-green-200' 
                : 'bg-[#171B24] border-white/5 text-[#94949C]'
          } flex items-center gap-2.5`}>
            {!syncProgress.startsWith('✓') && !syncProgress.startsWith('✕') && (
              <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-ping flex-shrink-0" />
            )}
            <span className="font-medium">{syncProgress}</span>
          </div>
        )}
      </div>

      {/* Legend Block */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 flex flex-wrap gap-x-5 gap-y-2.5 text-[10.5px] text-[#94949C]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-md bg-[#171B24] border border-white/5"></span>
          <span>Standard Study Day (Sun-Wed)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-md bg-[#0D1C13] border border-[#10B981]/20"></span>
          <span>Working Thursday</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-md bg-[#171B24] border border-[#D4AF37]/20"></span>
          <span>Off Thursday</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-md bg-[#1C1212] border border-[#EF4444]/20"></span>
          <span>Family Leave Block</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-md bg-[#D4AF37] border border-[#D4AF37]"></span>
          <span>Current Day / Milestone Target</span>
        </div>
      </div>

      {/* Main Single Month Render */}
      <div className="space-y-4">
        {renderMonth(activeMonth.year, activeMonth.month, activeMonth.label)}
      </div>

      {/* Suggested Session Recs */}
      <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" /> Suggested Study Itinerary (Recalculated Live)
        </h3>
        <p className="text-[11.5px] text-[#94949C] leading-relaxed">
          This customized plan maps out your next 5 sequential study days by scanning what material you have left to complete and dividing them cleanly into study sessions.
        </p>

        <div className="divide-y divide-white/5 border-t border-white/5">
          {fullSchedule
            .filter(d => d.isWorkable && d.date >= new Date(new Date().setHours(0,0,0,0)))
            .slice(0, 5)
            .map((day, idx) => {
              const getCourseBadge = (lessonId: string) => {
                const course = CourseCatalog.getAllCourses().find(c => 
                  c.sections.some(s => s.lessons.some(l => l.id === lessonId))
                );
                if (!course) return "GOAL";
                if (course.id === 'course-pl300') return "PL-300";
                if (course.id === 'course-pmipba') return "PMI-PBA";
                return course.name.split(':')[0];
              };

              const sessions = [
                { lessons: day.morningSession, colorClass: "text-[#D4AF37] bg-[#171B24] border-[#D4AF37]/10" },
                { lessons: day.lunchSession, colorClass: "text-[#3B82F6] bg-[#0D1821] border-[#3B82F6]/10" },
              ].filter(s => s.lessons.length > 0);

              if (sessions.length === 0) return null;

              return (
                <div key={idx} className="py-4 flex flex-col sm:flex-row justify-between items-start text-xs gap-3">
                  <div className="min-w-[150px] text-white font-bold flex flex-col">
                    <span>{day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="text-[10px] text-[#D4AF37] font-mono mt-0.5">Study Day #{idx + 1}</span>
                  </div>
                  <div className="flex-1 space-y-1.5 text-[#94949C]">
                    {sessions.map((s, sIdx) => {
                      const firstLesson = s.lessons[0];
                      const badge = getCourseBadge(firstLesson.id);
                      const titles = s.lessons.map(l => l.title);
                      return (
                        <div key={sIdx} className="flex items-start gap-1.5">
                          <span className={`font-bold uppercase tracking-wider text-[9px] border px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${s.colorClass}`}>
                            {badge}
                          </span>
                          <span className="text-[#E0E0E6] font-medium leading-relaxed">{titles.join(', ')}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="font-mono text-[#55555B] bg-[#11141C] border border-white/5 px-2 py-1 rounded text-[10.5px] font-bold h-7 flex items-center">
                    {day.estimatedDailyTime} min
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Mock Exam card info */}
      {activeCourses.some(c => c.id === 'course-pl300') && (
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex items-start gap-4">
          <div className="p-2 bg-[#171B24] border border-[#D4AF37]/20 rounded-lg text-[#D4AF37] flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">PL-300 Practice Test Block Plan</h4>
            <p className="text-xs text-[#94949C] leading-relaxed">
              {state.completedLessons["pl300-s6-l4"] ? (
                <span className="text-[#10B981] font-semibold">✓ Practice Test 1 (DA-100 Mock Exam) is completed in full. Excellent simulation preparation!</span>
              ) : (
                <span>Practice Test 1 requires a dedicated, uninterrupted 100-minute block (not standard 30-minute morning study). Keep this in mind when scheduling an off Thursday or weekend block in mid-August.</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Clickable Day Detail Modal Popup */}
      {renderDayModal()}
    </div>
  );
}
