import React, { useState, useEffect } from 'react';
import { StudyPlanState, Assignment } from '../services/Sync/types';
import { Profile } from '../models/types';
import { apiFetch } from '../services/apiClient';
import { 
  FileText, Plus, Trash2, Edit, Check, Clock, Brain, Play, Pause, 
  Calendar as CalendarIcon, Flame, BookOpen, AlertCircle, RefreshCw, ChevronDown, CheckCircle2, Award, X
} from 'lucide-react';

interface AssignmentsTrackerProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  profile: Profile;
}

export default function AssignmentsTracker({ state, onUpdateState, profile }: AssignmentsTrackerProps) {
  // Local state variables
  const [assignments, setAssignments] = useState<Assignment[]>(state.assignments || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [customCourse, setCustomCourse] = useState('');
  const [isCustomCourseActive, setIsCustomCourseActive] = useState(false);
  const [type, setType] = useState<'Homework' | 'Quiz' | 'Exam' | 'Project' | 'Other'>('Homework');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Pomodoro Room State
  const [activeTimerAssignment, setActiveTimerAssignment] = useState<Assignment | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(1500); // 25 mins
  const [timerPreset, setTimerPreset] = useState(25); // 25 mins
  const [timerRunning, setTimerRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // AI strategy State
  const [viewingStrategyAssignment, setViewingStrategyAssignment] = useState<Assignment | null>(null);
  const [aiStrategyText, setAiStrategyText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Grade dialog State
  const [completingAssignment, setCompletingAssignment] = useState<Assignment | null>(null);
  const [gradeInput, setGradeInput] = useState('');

  // Synced with App state
  useEffect(() => {
    if (state.assignments) {
      setAssignments(state.assignments);
    }
  }, [state.assignments]);

  // Save assignments back to main state
  const saveAssignments = (updatedList: Assignment[]) => {
    setAssignments(updatedList);
    onUpdateState({
      ...state,
      assignments: updatedList
    });
  };

  // Get course list
  const availableCourses = profile.learningGoals || [];

  // Initialize form for adding
  const handleOpenAdd = () => {
    setTitle('');
    setCourse(availableCourses[0] || '');
    setCustomCourse('');
    setIsCustomCourseActive(availableCourses.length === 0);
    setType('Homework');
    setDueDate(new Date().toISOString().slice(0, 10));
    setDueTime('12:00');
    setDifficulty('Medium');
    setEstimatedHours(3);
    setNotes('');
    setFormError('');
    setEditingAssignment(null);
    setShowAddForm(true);
  };

  // Initialize form for editing
  const handleOpenEdit = (asm: Assignment) => {
    setEditingAssignment(asm);
    setTitle(asm.title);
    if (availableCourses.includes(asm.course)) {
      setCourse(asm.course);
      setCustomCourse('');
      setIsCustomCourseActive(false);
    } else {
      setCourse('__custom__');
      setCustomCourse(asm.course);
      setIsCustomCourseActive(true);
    }
    setType(asm.type);
    setDueDate(asm.dueDate);
    setDueTime(asm.dueTime || '12:00');
    setDifficulty(asm.difficulty);
    setEstimatedHours(asm.estimatedHours);
    setNotes(asm.notes || '');
    setFormError('');
    setShowAddForm(true);
  };

  // Handle Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Please enter a title for the assignment.');
      return;
    }

    const courseValue = isCustomCourseActive ? customCourse.trim() : course;
    if (!courseValue.trim() || courseValue === '__custom__') {
      setFormError('Please select or specify a valid course/learning goal.');
      return;
    }

    if (!dueDate) {
      setFormError('Please select a due date.');
      return;
    }

    if (editingAssignment) {
      // Edit mode
      const updated = assignments.map(a => {
        if (a.id === editingAssignment.id) {
          return {
            ...a,
            title: title.trim(),
            course: courseValue,
            type,
            dueDate,
            dueTime,
            difficulty,
            estimatedHours,
            notes: notes.trim()
          };
        }
        return a;
      });
      saveAssignments(updated);
    } else {
      // Add mode
      const newAsm: Assignment = {
        id: `asm-${Date.now()}`,
        title: title.trim(),
        course: courseValue,
        type,
        dueDate,
        dueTime,
        difficulty,
        estimatedHours,
        status: 'Not Started',
        studyTimeLogged: 0
      };
      if (notes.trim()) newAsm.notes = notes.trim();
      
      saveAssignments([newAsm, ...assignments]);
    }

    setShowAddForm(false);
    setEditingAssignment(null);
  };

  // Handle delete
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      const filtered = assignments.filter(a => a.id !== id);
      saveAssignments(filtered);
    }
  };

  // Toggle completion with optional grade entry
  const handleToggleComplete = (asm: Assignment) => {
    if (asm.status === 'Completed') {
      // Un-complete
      const updated = assignments.map(a => {
        if (a.id === asm.id) {
          const { grade, ...rest } = a;
          return { ...rest, status: 'Not Started' as const };
        }
        return a;
      });
      saveAssignments(updated);
    } else {
      // Open grade dialog first
      setCompletingAssignment(asm);
      setGradeInput('');
    }
  };

  // Confirm completion with grade
  const handleConfirmCompletion = () => {
    if (!completingAssignment) return;
    
    const updated = assignments.map(a => {
      if (a.id === completingAssignment.id) {
        return {
          ...a,
          status: 'Completed' as const,
          grade: gradeInput.trim() || undefined
        };
      }
      return a;
    });

    saveAssignments(updated);
    setCompletingAssignment(null);
  };

  // Start Pomodoro Study session
  const handleStartTimer = (asm: Assignment) => {
    setActiveTimerAssignment(asm);
    setTimerPreset(25);
    setTimerSeconds(1500);
    setTimerRunning(true);
    setIsBreak(false);
    setElapsedMinutes(0);
  };

  // Pomodoro Interval Timer Engine
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerRunning && activeTimerAssignment) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            // Timer expired!
            clearInterval(interval!);
            setTimerRunning(false);
            
            // Increment elapsed minutes
            setElapsedMinutes(m => m + timerPreset);

            // Ring notification sound (visual alert)
            alert(isBreak ? "Break is over! Time to focus." : "Focus session completed! Take a well-deserved break.");
            
            if (!isBreak) {
              // Automatically transition to Break preset
              setIsBreak(true);
              setTimerPreset(5);
              setTimerSeconds(300);
              setTimerRunning(true);
            } else {
              setIsBreak(false);
              setTimerPreset(25);
              setTimerSeconds(1500);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, activeTimerAssignment, isBreak, timerPreset]);

  // Log study time from active Pomodoro
  const handleStopAndLogTime = () => {
    if (!activeTimerAssignment) return;

    // Calculate actual elapsed minutes
    const actualSecondsElapsed = (timerPreset * 60) - timerSeconds;
    const actualMinutesElapsed = Math.max(1, Math.round(actualSecondsElapsed / 60));

    if (actualMinutesElapsed > 0 && !isBreak) {
      // Update specific assignment study log
      const updated = assignments.map(a => {
        if (a.id === activeTimerAssignment.id) {
          return {
            ...a,
            status: 'In Progress' as const,
            studyTimeLogged: (a.studyTimeLogged || 0) + actualMinutesElapsed
          };
        }
        return a;
      });
      saveAssignments(updated);

      // Log into global daily study log
      const todayISO = new Date().toISOString().slice(0, 10);
      const currentStudyLog = { ...state.studyLog };
      currentStudyLog[todayISO] = (currentStudyLog[todayISO] || 0) + actualMinutesElapsed;

      // Update XP & State
      onUpdateState({
        ...state,
        assignments: updated,
        studyLog: currentStudyLog
      });

      alert(`Great job! Logged ${actualMinutesElapsed} minutes of focused study and gained ${actualMinutesElapsed * 10} XP.`);
    }

    // Reset timer state
    setActiveTimerAssignment(null);
    setTimerRunning(false);
    setElapsedMinutes(0);
  };

  // Generate Strategy via Gemini Server-Side route
  const handleGetStrategy = async (asm: Assignment) => {
    setViewingStrategyAssignment(asm);
    setAiLoading(true);
    setAiError('');
    setAiStrategyText('');

    try {
      const response = await apiFetch('/api/assignments/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: asm.title,
          type: asm.type,
          course: asm.course,
          difficulty: asm.difficulty,
          estimatedHours: asm.estimatedHours,
          notes: asm.notes || ''
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate study roadmap');
      }

      setAiStrategyText(data.strategy);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'An error occurred while connecting to the AI Study Coach.');
    } finally {
      setAiLoading(false);
    }
  };

  // Custom Markdown renderer for strategy display
  const renderMarkdownText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith('###')) {
        return <h4 key={idx} className="text-sm font-bold text-[#D4AF37] mt-4 mb-2 uppercase tracking-wide">{trimmed.replace('###', '').trim()}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={idx} className="text-base font-bold text-white mt-5 mb-2 border-b border-white/5 pb-1">{trimmed.replace('##', '').trim()}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={idx} className="text-lg font-serif font-black text-[#D4AF37] mt-6 mb-3">{trimmed.replace('#', '').trim()}</h2>;
      }

      // Bullet points
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        let content = trimmed.substring(1).trim();
        // Bold parsing
        return (
          <li key={idx} className="text-xs text-[#E0E0E6]/90 list-disc list-inside ml-2 py-1 leading-relaxed">
            {parseBoldText(content)}
          </li>
        );
      }

      // Numbered items
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={idx} className="text-xs text-[#E0E0E6]/90 pl-2 py-1 leading-relaxed flex gap-2">
            <span className="font-bold text-[#D4AF37]">{numMatch[1]}.</span>
            <span>{parseBoldText(numMatch[2])}</span>
          </div>
        );
      }

      // Default empty line
      if (!trimmed) return <div key={idx} className="h-2"></div>;

      // Default paragraph
      return <p key={idx} className="text-xs text-[#94949C] leading-relaxed mb-2">{parseBoldText(trimmed)}</p>;
    });
  };

  // Helper to parse double asterisk bold tags in lines
  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-white font-semibold">{part}</strong>;
      }
      return part;
    });
  };

  // Helper: Urgency coloring
  const getUrgencyTextAndColor = (dueDateStr: string, status: string) => {
    if (status === 'Completed') return { text: 'Completed', color: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20' };

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);
    const due = new Date(dueDateStr);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, color: 'text-red-400 bg-red-400/10 border-red-400/20 font-bold animate-pulse' };
    }
    if (diffDays === 0) {
      return { text: 'Due Today', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20 font-bold' };
    }
    if (diffDays === 1) {
      return { text: 'Due Tomorrow', color: 'text-amber-300 bg-amber-300/10 border-amber-300/20' };
    }
    if (diffDays <= 3) {
      return { text: `Due in ${diffDays} days`, color: 'text-yellow-200 bg-yellow-200/5 border-yellow-200/10' };
    }
    return { text: `Due in ${diffDays} days`, color: 'text-[#94949C] bg-white/5 border-white/5' };
  };

  // Helper: Statistics calculations
  const totalDeadlines = assignments.filter(a => a.status !== 'Completed').length;
  const totalHoursPlanned = assignments.filter(a => a.status !== 'Completed').reduce((acc, current) => acc + current.estimatedHours, 0);
  const totalHoursFocused = assignments.reduce((acc, current) => acc + (current.studyTimeLogged || 0), 0) / 60;
  
  const completedAssignments = assignments.filter(a => a.status === 'Completed');
  const gradedAssignments = completedAssignments.filter(a => !!a.grade);
  
  const getAverageGrade = () => {
    if (gradedAssignments.length === 0) return 'N/A';
    // Match letter grades or average out percentages
    let scores: number[] = [];
    let letters: string[] = [];
    
    gradedAssignments.forEach(a => {
      const g = a.grade || '';
      const num = parseInt(g.replace(/[^0-9]/g, ''));
      if (!isNaN(num)) {
        scores.push(num);
      } else if (g.length > 0) {
        letters.push(g.toUpperCase());
      }
    });

    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((acc, x) => acc + x, 0) / scores.length);
      return `${avg}%`;
    }
    if (letters.length > 0) {
      return letters[0]; // Return recent letter
    }
    return 'Completed';
  };

  // Format digital countdown string
  const formatTimeStr = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Custom presets select
  const handleSetPreset = (minutes: number) => {
    setTimerPreset(minutes);
    setTimerSeconds(minutes * 60);
    setTimerRunning(false);
  };

  return (
    <div className="space-y-6" id="homework-hub-root">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#171B24]/40 border border-white/5 p-6 rounded-2xl">
        <div>
          <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#D4AF37]" />
            Homework &amp; Exam Hub
          </h2>
          <p className="text-xs text-[#94949C] mt-1 leading-relaxed">
            Manage course deliverables, schedule focused Pomodoro review blocks, and tap Gemini for personalized academic revision guides.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-black font-semibold text-xs rounded-lg shadow hover:opacity-95 transition-all cursor-pointer active:scale-95"
          id="btn-add-assessment"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Add Deliverable
        </button>
      </div>

      {/* DASHBOARD NUMERICAL STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-red-400/5 border border-red-400/10 text-red-400">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-[#94949C] font-semibold uppercase tracking-wider">Pending Tasks</span>
            <span className="font-mono text-lg font-bold text-white">{totalDeadlines}</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/10 text-[#D4AF37]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-[#94949C] font-semibold uppercase tracking-wider">Est. Prep Hours</span>
            <span className="font-mono text-lg font-bold text-white">{totalHoursPlanned}h</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-[#10B981]/5 border border-[#10B981]/10 text-[#10B981]">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-[#94949C] font-semibold uppercase tracking-wider">Hours Focused</span>
            <span className="font-mono text-lg font-bold text-white">{totalHoursFocused.toFixed(1)}h</span>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-400/5 border border-blue-400/10 text-blue-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="block text-[10px] text-[#94949C] font-semibold uppercase tracking-wider">Average Score</span>
            <span className="font-mono text-lg font-bold text-white">{getAverageGrade()}</span>
          </div>
        </div>
      </div>

      {/* FORM: ADD / EDIT DIALOG CARD */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-[#171B24] border border-[#D4AF37]/20 p-5 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              {editingAssignment ? '✏️ Edit Deliverable' : '📝 New Study Deliverable'}
            </h3>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="p-1 rounded-md text-[#94949C] hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Title / Name</label>
              <input
                type="text"
                placeholder="e.g. Midterm, Lab 3, Term Essay"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all"
              />
            </div>

            {/* Deliverable Type */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
              >
                <option value="Homework">Homework Assignment</option>
                <option value="Quiz">Quiz</option>
                <option value="Exam">Exam / Midterm / Final</option>
                <option value="Project">Project Deliverable</option>
                <option value="Other">Other Assessment</option>
              </select>
            </div>

            {/* Course / Learning Goal Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Associated Course / Learning Goal</label>
              {!isCustomCourseActive ? (
                <div className="flex gap-2">
                  <select
                    value={course}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCourseActive(true);
                      } else {
                        setCourse(e.target.value);
                      }
                    }}
                    className="flex-1 bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                  >
                    {availableCourses.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">+ Enter Custom Course...</option>
                  </select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. CS-310 Algorithms"
                    value={customCourse}
                    onChange={e => setCustomCourse(e.target.value)}
                    className="flex-1 bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                  />
                  {availableCourses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsCustomCourseActive(false)}
                      className="px-2.5 py-2 bg-white/5 border border-white/5 rounded-lg text-[10px] text-[#94949C] hover:text-white hover:bg-white/10 transition-all font-semibold"
                    >
                      Use List
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Est. Preparation Complexity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Easy', 'Medium', 'Hard'] as const).map(diff => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`py-2 border text-xs font-semibold rounded-lg transition-all ${
                      difficulty === diff
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/30'
                        : 'bg-[#11141C] border-white/5 text-[#94949C] hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
              />
            </div>

            {/* Estimated hours */}
            <div className="space-y-1">
              <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Estimated Study Hours Needed</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="1"
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(parseInt(e.target.value))}
                  className="flex-1 accent-[#D4AF37]"
                />
                <span className="font-mono text-xs text-white bg-[#11141C] px-2.5 py-1 rounded border border-white/5 font-bold min-w-[45px] text-center">
                  {estimatedHours}h
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-[10px] text-[#94949C] font-semibold uppercase">Deliverable Notes &amp; Scope Details</label>
            <textarea
              placeholder="List specific chapters, guidelines, topics, or resources for this deliverable..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-white/5 bg-transparent hover:bg-white/5 text-xs font-semibold rounded-lg text-[#94949C] hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-black font-bold text-xs rounded-lg hover:opacity-95 transition-all cursor-pointer"
            >
              {editingAssignment ? 'Update Deliverable' : 'Add Deliverable'}
            </button>
          </div>
        </form>
      )}

      {/* POPUP: GRADE ENTRY MODAL */}
      {completingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#171B24] border border-[#D4AF37]/20 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-[#D4AF37]">
              <Award className="w-5 h-5" />
              <h3 className="font-serif text-sm font-bold text-white">Log Completion Grade</h3>
            </div>
            <p className="text-xs text-[#94949C] leading-relaxed">
              Congratulations on finishing <span className="text-white font-semibold">{completingAssignment.title}</span>! 
              Would you like to log your grade or score?
            </p>
            <input
              type="text"
              placeholder="e.g. A+, 95%, or Pass (Optional)"
              value={gradeInput}
              onChange={e => setGradeInput(e.target.value)}
              className="w-full bg-[#11141C] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#D4AF37] transition-all"
              autoFocus
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setCompletingAssignment(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs text-[#94949C] hover:text-white rounded-lg transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCompletion}
                className="px-5 py-2 bg-[#D4AF37] text-black text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow"
              >
                Log Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MAIN DELIVERABLES LISTS */}
      <div className="space-y-6">
        
        {/* ACTIVE DELIVERABLES */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest flex items-center gap-1.5">
            📌 Upcoming Deliverables ({totalDeadlines})
          </h3>
          {assignments.filter(a => a.status !== 'Completed').length === 0 ? (
            <div className="bg-[#171B24]/20 border border-dashed border-white/5 rounded-2xl p-8 text-center text-xs text-[#55555B]">
              No pending homework, exams, or projects! Click "Add Deliverable" to set one up.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments
                .filter(a => a.status !== 'Completed')
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .map(asm => {
                  const urgency = getUrgencyTextAndColor(asm.dueDate, asm.status);
                  const logMinutes = asm.studyTimeLogged || 0;
                  const percentComplete = Math.min(100, Math.round((logMinutes / (asm.estimatedHours * 60)) * 100));

                  return (
                    <div 
                      key={asm.id}
                      className="bg-[#171B24]/60 hover:bg-[#171B24]/80 border border-white/5 hover:border-[#D4AF37]/10 rounded-xl p-4.5 flex flex-col justify-between space-y-4 transition-all duration-200 group"
                    >
                      <div className="space-y-2">
                        {/* Course & Urgency Tag row */}
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[9.5px] uppercase tracking-wider text-[#D4AF37] font-bold truncate max-w-[65%]">
                            {asm.course}
                          </span>
                          <span className={`text-[8.5px] font-semibold px-2 py-0.5 rounded-full border ${urgency.color}`}>
                            {urgency.text}
                          </span>
                        </div>

                        {/* Title and Notes */}
                        <div>
                          <h4 className="text-sm font-semibold text-white group-hover:text-[#D4AF37] transition-colors leading-tight">
                            {asm.title}
                          </h4>
                          <span className="block text-[8px] font-bold font-mono uppercase text-[#94949C] mt-1.5">
                            {asm.type} &bull; {asm.difficulty} Complexity
                          </span>
                          {asm.notes && (
                            <p className="text-xs text-[#94949C]/80 mt-2 leading-relaxed line-clamp-2 italic">
                              "{asm.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Study hours tracker progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] text-[#94949C] font-semibold">
                          <span>Study Progress</span>
                          <span className="font-mono text-[10px] text-white">
                            {(logMinutes / 60).toFixed(1)}h / {asm.estimatedHours}h
                          </span>
                        </div>
                        <div className="w-full bg-[#11141C] h-1 rounded-full overflow-hidden border border-white/5">
                          <div className="bg-[#D4AF37] h-full" style={{ width: `${percentComplete}%` }}></div>
                        </div>
                      </div>

                      {/* Actions toolbar */}
                      <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-1 gap-2">
                        <div className="flex items-center gap-1.5">
                          {/* Complete toggle checkbox */}
                          <button
                            onClick={() => handleToggleComplete(asm)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-[#10B981]/10 text-[#94949C] hover:text-[#10B981] border border-white/5 hover:border-[#10B981]/20 transition-all cursor-pointer"
                            title="Mark as Completed"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          {/* Focus timer link */}
                          <button
                            onClick={() => handleStartTimer(asm)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-[#D4AF37]/10 text-[#94949C] hover:text-[#D4AF37] border border-white/5 hover:border-[#D4AF37]/20 transition-all cursor-pointer"
                            title="Focus in Pomodoro Room"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>

                          {/* Ask Gemini Coach strategy */}
                          <button
                            onClick={() => handleGetStrategy(asm)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/10 text-[#94949C] hover:text-blue-400 border border-white/5 hover:border-blue-500/20 transition-all cursor-pointer"
                            title="Ask Coach for Custom Study Guide"
                          >
                            <Brain className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Edit & Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(asm)}
                            className="p-1 rounded text-[#94949C] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(asm.id)}
                            className="p-1 rounded text-[#94949C] hover:text-red-400 hover:bg-red-400/5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ACTIVE POMODORO TIMER PANEL */}
        {activeTimerAssignment && (
          <div className="bg-[#0E0F12] border border-[#D4AF37]/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg shadow-black/40">
            {/* Background decor */}
            <div className="absolute right-0 top-0 w-24 h-24 bg-[#D4AF37]/5 rounded-full blur-2xl"></div>

            {/* Title / Meta */}
            <div className="space-y-3.5 text-center md:text-left z-10 max-w-sm">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[8.5px] font-bold tracking-widest uppercase bg-[#D4AF37]/15 text-[#D4AF37] rounded-md border border-[#D4AF37]/20">
                <Flame className="w-3 h-3 animate-bounce" /> 
                {isBreak ? '☕ RESTING BREAK' : '🎯 ACTIVE STUDY FLOW'}
              </span>
              <div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {activeTimerAssignment.title}
                </h3>
                <span className="text-xs text-[#94949C] font-semibold block mt-0.5">
                  {activeTimerAssignment.course}
                </span>
              </div>
              <p className="text-[11px] text-[#94949C] leading-relaxed">
                {isBreak 
                  ? "Stretch your body, drink some water, and relax your eyes for a moment." 
                  : "Work continuously without tabs or notifications. Your study time is logged automatically."}
              </p>
            </div>

            {/* Countdown Clock Face */}
            <div className="flex flex-col items-center justify-center gap-3 z-10">
              <div className="w-36 h-36 rounded-full border-4 border-[#D4AF37]/10 bg-[#171B24] flex flex-col items-center justify-center relative shadow-inner">
                {/* Circular track border colored during active state */}
                <div className={`absolute inset-0 rounded-full border-4 ${timerRunning ? 'border-[#D4AF37] animate-pulse border-t-transparent' : 'border-transparent'}`}></div>
                
                <span className="font-mono text-3xl font-black text-white tracking-widest">
                  {formatTimeStr(timerSeconds)}
                </span>
                <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider mt-1">
                  {isBreak ? 'Break Timer' : 'Focus Slot'}
                </span>
              </div>

              {/* Presets Row */}
              <div className="flex gap-1 bg-[#171B24]/80 p-1 border border-white/5 rounded-lg select-none">
                {[25, 50, 15, 5].map(p => (
                  <button
                    key={p}
                    onClick={() => handleSetPreset(p)}
                    className={`px-2 py-1 text-[9px] font-mono font-bold rounded-md transition-all ${
                      timerPreset === p
                        ? 'bg-[#D4AF37] text-black'
                        : 'text-[#94949C] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {p}m
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Actions Panel */}
            <div className="flex flex-col gap-2.5 w-full md:w-auto z-10">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={`px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    timerRunning
                      ? 'bg-amber-400/10 text-amber-300 border border-amber-400/20 hover:bg-amber-400/20'
                      : 'bg-[#D4AF37] text-black hover:opacity-90'
                  }`}
                >
                  {timerRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Resume
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setTimerSeconds(timerPreset * 60);
                    setTimerRunning(false);
                  }}
                  className="px-5 py-3 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              <button
                onClick={handleStopAndLogTime}
                className="w-full px-5 py-3 bg-red-500/10 text-red-400 border border-red-500/10 hover:border-red-500/20 hover:bg-red-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finish &amp; Log Minutes
              </button>
            </div>
          </div>
        )}

        {/* AI STUDY ROADMAP STRATEGY DRAWER/MODAL */}
        {viewingStrategyAssignment && (
          <div className="bg-[#171B24]/80 border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-400">
                  <Brain className="w-4 h-4 stroke-[2.5]" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-blue-400 font-mono">Gemini AI Study Coach</span>
                </div>
                <h3 className="text-base font-bold font-serif text-white">
                  Custom Revision Guide: {viewingStrategyAssignment.title}
                </h3>
                <span className="block text-[9.5px] text-[#94949C]">
                  {viewingStrategyAssignment.course} &bull; {viewingStrategyAssignment.estimatedHours} Hours Preparation Target
                </span>
              </div>
              <button 
                onClick={() => setViewingStrategyAssignment(null)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[#94949C] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4 text-center select-none">
                <RefreshCw className="w-7 h-7 text-[#D4AF37] animate-spin" />
                <div className="space-y-1">
                  <p className="text-xs text-white font-semibold">Generating Your Study Plan...</p>
                  <p className="text-[10px] text-[#94949C]">Analyzing exam complexity, parsing subject material, and formatting actionable hours blocks.</p>
                </div>
              </div>
            ) : aiError ? (
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Coach Connection Interrupted</span>
                  <p className="text-[#94949C] leading-relaxed">{aiError}</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 overflow-x-auto text-left leading-relaxed max-h-[500px] overflow-y-auto scrollbar-thin">
                <div className="prose prose-invert prose-xs">
                  {renderMarkdownText(aiStrategyText)}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
              <button
                onClick={() => handleGetStrategy(viewingStrategyAssignment)}
                className="px-4 py-2 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white rounded-lg text-xs text-[#94949C] transition-all font-semibold"
                disabled={aiLoading}
              >
                Re-Generate Plan
              </button>
              <button
                onClick={() => setViewingStrategyAssignment(null)}
                className="px-5 py-2 bg-[#D4AF37] text-black text-xs font-bold rounded-lg hover:opacity-90 transition-all"
              >
                Close Plan
              </button>
            </div>
          </div>
        )}

        {/* COMPLETED DELIVERABLES SECTION */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest flex items-center gap-1.5 mt-2">
            ✓ Finished Deliverables ({completedAssignments.length})
          </h3>
          {completedAssignments.length === 0 ? (
            <div className="bg-[#171B24]/20 border border-dashed border-white/5 rounded-2xl p-8 text-center text-xs text-[#55555B]">
              No completed deliverable yet. Finish a task above and mark it complete!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedAssignments
                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                .map(asm => {
                  return (
                    <div 
                      key={asm.id}
                      className="bg-[#171B24]/30 border border-[#10B981]/10 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Checkbox completed icon */}
                        <button
                          onClick={() => handleToggleComplete(asm)}
                          className="p-1 rounded-md bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] hover:bg-red-400/5 hover:text-red-400 hover:border-red-400/10 transition-all cursor-pointer"
                          title="Restore task"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-[#E0E0E6]/90 truncate line-through">
                            {asm.title}
                          </h4>
                          <span className="block text-[8px] font-bold text-[#55555B] truncate">
                            {asm.course} &bull; Graded: {asm.grade || 'No grade entered'}
                          </span>
                        </div>
                      </div>

                      {/* Delete Action button */}
                      <button
                        onClick={() => handleDelete(asm.id)}
                        className="p-1 text-[#55555B] hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
