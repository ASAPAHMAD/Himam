import React, { useState } from 'react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';
import { BookOpen, Award, Flame, Hourglass, TrendingUp, Sparkles, Plus, ChevronDown, ChevronUp, Check, Trophy, Zap, Star, CheckCircle2, Activity, Brain, Timer, CheckSquare, Heart, ShieldAlert, RefreshCw, GraduationCap, Briefcase, FileText, Minus, User, Calendar, Trash2, Edit3, Search, PlusCircle, X, ChevronRight, Info, ListTodo, ThumbsUp, ThumbsDown, EyeOff, History, Settings, HelpCircle } from 'lucide-react';
import { allLegacyLessons } from '../models/legacyBridge';
import { calculateProgressMetrics } from '../services/progressEngine';
import { CourseCatalog } from '../services/courseCatalog';
import { buildAIContext } from '../services/aiContextBuilder';
import { buildCoachSystemPrompt, buildCoachUserPrompt } from '../services/aiPrompts';
import { sendCoachMessages } from '../services/aiCoachClient';
import { getCourseShortLabel } from '../models/courseDisplay';
import { calculateGamification, getGamificationMotivation } from '../services/gamificationEngine';
import { calculateLearningAnalytics } from '../services/learningAnalytics';
import { loadLocalMemories } from '../models/aiMemories';
import { apiFetch } from '../services/apiClient';

interface DashboardProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  setActiveTab: (tab: string) => void;
  profile: Profile;
  onUpdateProfile?: (newProfile: Profile) => void;
  signOut?: () => Promise<{ error: Error | null }>;
  configured?: boolean;
  onCompleteLesson?: (lessonId: string, duration: number) => void;
}

export default function Dashboard({ state, onUpdateState, setActiveTab, profile, onUpdateProfile, signOut, configured, onCompleteLesson }: DashboardProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'analytics'>('overview');

  // --- AI Intelligence Hub States ---
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelResult, setIntelResult] = useState<any>(null);
  const [intelError, setIntelError] = useState<string | null>(null);

  // Personalization settings: 'proactive' | 'balanced' | 'minimalist'
  const [intelPersonalization, setIntelPersonalization] = useState<'proactive' | 'balanced' | 'minimalist'>(() => {
    return (localStorage.getItem('himam_intel_personalization') as any) || 'balanced';
  });

  // Action status mappings
  const [likedSuggestions, setLikedSuggestions] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('himam_liked_suggestions') || '{}');
    } catch { return {}; }
  });

  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('himam_dismissed_suggestions') || '{}');
    } catch { return {}; }
  });

  const [completedSuggestions, setCompletedSuggestions] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('himam_completed_suggestions') || '{}');
    } catch { return {}; }
  });

  const [insightHistory, setInsightHistory] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('himam_insight_history') || '[]');
    } catch { return []; }
  });

  const [showHistory, setShowHistory] = useState(false);

  const archiveNewSuggestionsToHistory = (data: any) => {
    try {
      const currentHistIds = new Set(insightHistory.map(h => h.originalId || h.id));
      const newEntries: any[] = [];
      const timestamp = new Date().toISOString();

      if (data.priorities) {
        data.priorities.forEach((p: any) => {
          if (!currentHistIds.has(p.id)) {
            newEntries.push({
              id: p.id,
              originalId: p.id,
              type: 'priority',
              text: p.text,
              context: p.context || 'Priority',
              explanation: p.explanation || 'Determined by active coursework progress.',
              timestamp,
              status: 'created'
            });
          }
        });
      }

      if (data.conflicts) {
        data.conflicts.forEach((c: any) => {
          if (!currentHistIds.has(c.id)) {
            newEntries.push({
              id: c.id,
              originalId: c.id,
              type: 'conflict',
              text: `${c.title}: ${c.text}`,
              context: 'Conflict Guard',
              explanation: c.explanation || 'Determined by calendar timeline checks.',
              timestamp,
              status: 'created'
            });
          }
        });
      }

      if (data.opportunities) {
        data.opportunities.forEach((o: any) => {
          if (!currentHistIds.has(o.id)) {
            newEntries.push({
              id: o.id,
              originalId: o.id,
              type: 'opportunity',
              text: `${o.title}: ${o.text}`,
              context: 'Opportunity',
              explanation: o.explanation || 'Synthesized from student profile achievements.',
              timestamp,
              status: 'created'
            });
          }
        });
      }

      if (newEntries.length > 0) {
        const nextHistory = [...newEntries, ...insightHistory];
        setInsightHistory(nextHistory);
        localStorage.setItem('himam_insight_history', JSON.stringify(nextHistory));
      }
    } catch (err) {
      console.error('Error archiving history:', err);
    }
  };

  const fetchIntelligenceSynthesis = async (force: boolean = false) => {
    if (intelLoading) return;
    if (intelResult && !force) return;

    setIntelLoading(true);
    setIntelError(null);

    try {
      let recentDocs: any[] = [];
      try {
        const raw = localStorage.getItem('himam_knowledge_library');
        recentDocs = raw ? JSON.parse(raw) : [];
      } catch {
        recentDocs = [];
      }

      const response = await apiFetch('/api/intelligence/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          profile, 
          state, 
          personalization: intelPersonalization,
          knowledgeDocs: recentDocs.slice(0, 10)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch intelligence synthesis from Himam AI Coach.');
      }

      const data = await response.json();
      setIntelResult(data);
      archiveNewSuggestionsToHistory(data);
    } catch (err: any) {
      console.error(err);
      setIntelError(err.message || 'Could not load proactive synthesis. Please check your network connection.');
    } finally {
      setIntelLoading(false);
    }
  };

  const handleLikeSuggestion = (id: string, text: string, type: string) => {
    const isCurrentlyLiked = !!likedSuggestions[id];
    const updated = { ...likedSuggestions, [id]: !isCurrentlyLiked };
    setLikedSuggestions(updated);
    localStorage.setItem('himam_liked_suggestions', JSON.stringify(updated));

    // Update history entry with liked status
    const newHistoryEntry = {
      id: `${id}-like-${Date.now()}`,
      originalId: id,
      type,
      text,
      timestamp: new Date().toISOString(),
      status: !isCurrentlyLiked ? 'liked' : 'unliked',
    };
    const nextHistory = [newHistoryEntry, ...insightHistory];
    setInsightHistory(nextHistory);
    localStorage.setItem('himam_insight_history', JSON.stringify(nextHistory));
  };

  const handleDismissSuggestion = (id: string, text: string, type: string) => {
    const updated = { ...dismissedSuggestions, [id]: true };
    setDismissedSuggestions(updated);
    localStorage.setItem('himam_dismissed_suggestions', JSON.stringify(updated));

    // Update history
    const newHistoryEntry = {
      id: `${id}-dismiss-${Date.now()}`,
      originalId: id,
      type,
      text,
      timestamp: new Date().toISOString(),
      status: 'dismissed',
    };
    const nextHistory = [newHistoryEntry, ...insightHistory];
    setInsightHistory(nextHistory);
    localStorage.setItem('himam_insight_history', JSON.stringify(nextHistory));
  };

  const handleCompletePriority = (id: string, text: string) => {
    const updated = { ...completedSuggestions, [id]: true };
    setCompletedSuggestions(updated);
    localStorage.setItem('himam_completed_suggestions', JSON.stringify(updated));

    // Update history
    const newHistoryEntry = {
      id: `${id}-complete-${Date.now()}`,
      originalId: id,
      type: 'priority',
      text,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };
    const nextHistory = [newHistoryEntry, ...insightHistory];
    setInsightHistory(nextHistory);
    localStorage.setItem('himam_insight_history', JSON.stringify(nextHistory));
  };

  const handleClearHistory = () => {
    setInsightHistory([]);
    localStorage.removeItem('himam_insight_history');
  };

  const changePersonalization = (mode: 'proactive' | 'balanced' | 'minimalist') => {
    setIntelPersonalization(mode);
    localStorage.setItem('himam_intel_personalization', mode);
  };

  // Run initial synthesis load and auto-refresh on key state changes, and personalization shifts
  React.useEffect(() => {
    fetchIntelligenceSynthesis(false);
  }, [profile.academicEvents?.length, profile.internshipApplications?.length, profile.capstoneTopic, profile.learningGoals?.length, intelPersonalization]);

  // --- Learning Performance & Career Operations States ---
  // Internship CRM
  const [crmOpen, setCrmOpen] = useState(false);
  const [crmSearch, setCrmSearch] = useState('');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [newCompany, setNewCompany] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAppliedDate, setNewAppliedDate] = useState('');
  const [newAppStatus, setNewAppStatus] = useState<'applied' | 'interviewing' | 'offered' | 'rejected'>('applied');
  const [newInterviewDate, setNewInterviewDate] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Capstone Detail Edits
  const [editingCapstone, setEditingCapstone] = useState(false);
  const [capstoneSupervisor, setCapstoneSupervisor] = useState(profile.capstoneSupervisor || '');
  const [capstoneDeadline, setCapstoneDeadline] = useState(profile.capstoneDeadline || '');
  const [capstoneDeliverables, setCapstoneDeliverables] = useState(profile.capstoneDeliverables || '');
  const [capstoneMilestones, setCapstoneMilestones] = useState(profile.capstoneMilestones || '');

  // Academic Calendar
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<'midterm' | 'final' | 'deadline' | 'presentation' | 'internship_start' | 'other'>('midterm');
  const [eventDate, setEventDate] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  // Course Companion (Active/Selected course to see details, take notes, ask AI tutor)
  const [selectedCourseName, setSelectedCourseName] = useState<string | null>(null);
  const [courseNotes, setCourseNotes] = useState('');
  const [courseAssignments, setCourseAssignments] = useState('');
  const [courseExamDates, setCourseExamDates] = useState('');
  const [aiExplainConcept, setAiExplainConcept] = useState('');
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainResult, setAiExplainResult] = useState<string | null>(null);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  // Sync Course Companion inputs with profile when selectedCourseName changes
  React.useEffect(() => {
    if (selectedCourseName) {
      const prog = profile.courseProgress?.[selectedCourseName];
      setCourseNotes(prog?.notes || '');
      setCourseAssignments(prog?.assignments || '');
      setCourseExamDates(prog?.examDates || '');
      setAiExplainConcept('');
      setAiExplainResult(prog?.aiExplanation || null);
      setAiExplainError(null);
    }
  }, [selectedCourseName, profile.courseProgress]);

  // Sync Capstone editing state with profile when they change
  React.useEffect(() => {
    setCapstoneSupervisor(profile.capstoneSupervisor || '');
    setCapstoneDeadline(profile.capstoneDeadline || '');
    setCapstoneDeliverables(profile.capstoneDeliverables || '');
    setCapstoneMilestones(profile.capstoneMilestones || '');
  }, [profile.capstoneSupervisor, profile.capstoneDeadline, profile.capstoneDeliverables, profile.capstoneMilestones]);

  const handleSaveInternshipApp = () => {
    if (!newCompany || !newPosition) return;
    if (!onUpdateProfile) return;

    const apps = [...(profile.internshipApplications || [])];
    if (editingAppId) {
      const idx = apps.findIndex(a => a.id === editingAppId);
      if (idx !== -1) {
        apps[idx] = {
          id: editingAppId,
          company: newCompany,
          position: newPosition,
          location: newLocation,
          appliedDate: newAppliedDate,
          status: newAppStatus,
          interviewDate: newInterviewDate,
          notes: newNotes,
        };
      }
    } else {
      apps.push({
        id: 'app-' + Date.now(),
        company: newCompany,
        position: newPosition,
        location: newLocation,
        appliedDate: newAppliedDate,
        status: newAppStatus,
        interviewDate: newInterviewDate,
        notes: newNotes,
      });
    }

    const appsCount = apps.length;
    const interviewsCount = apps.filter(a => a.status === 'interviewing' || a.status === 'offered').length;
    const offersCount = apps.filter(a => a.status === 'offered').length;

    onUpdateProfile({
      ...profile,
      internshipApplications: apps,
      internshipApps: appsCount,
      internshipInterviews: interviewsCount,
      internshipOffers: offersCount,
    });

    setEditingAppId(null);
    setNewCompany('');
    setNewPosition('');
    setNewLocation('');
    setNewAppliedDate('');
    setNewAppStatus('applied');
    setNewInterviewDate('');
    setNewNotes('');
  };

  const handleDeleteInternshipApp = (id: string) => {
    if (!onUpdateProfile) return;
    const apps = (profile.internshipApplications || []).filter(a => a.id !== id);
    const appsCount = apps.length;
    const interviewsCount = apps.filter(a => a.status === 'interviewing' || a.status === 'offered').length;
    const offersCount = apps.filter(a => a.status === 'offered').length;

    onUpdateProfile({
      ...profile,
      internshipApplications: apps,
      internshipApps: appsCount,
      internshipInterviews: interviewsCount,
      internshipOffers: offersCount,
    });
  };

  const handleEditInternshipAppClick = (app: any) => {
    setEditingAppId(app.id);
    setNewCompany(app.company);
    setNewPosition(app.position);
    setNewLocation(app.location || '');
    setNewAppliedDate(app.appliedDate || '');
    setNewAppStatus(app.status);
    setNewInterviewDate(app.interviewDate || '');
    setNewNotes(app.notes || '');
  };

  const handleSaveCapstone = () => {
    if (!onUpdateProfile) return;
    onUpdateProfile({
      ...profile,
      capstoneSupervisor,
      capstoneDeadline,
      capstoneDeliverables,
      capstoneMilestones,
    });
    setEditingCapstone(false);
  };

  const handleAddAcademicEvent = () => {
    if (!eventTitle || !eventDate) return;
    if (!onUpdateProfile) return;

    const events = [...(profile.academicEvents || [])];
    events.push({
      id: 'event-' + Date.now(),
      title: eventTitle,
      type: eventType,
      date: eventDate,
      notes: eventNotes,
    });

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    onUpdateProfile({
      ...profile,
      academicEvents: events
    });

    setEventTitle('');
    setEventType('midterm');
    setEventDate('');
    setEventNotes('');
  };

  const handleDeleteAcademicEvent = (id: string) => {
    if (!onUpdateProfile) return;
    const events = (profile.academicEvents || []).filter(e => e.id !== id);
    onUpdateProfile({
      ...profile,
      academicEvents: events
    });
  };

  const handleSaveCourseProgress = () => {
    if (!selectedCourseName || !onUpdateProfile) return;

    const existing = { ...(profile.courseProgress || {}) };
    existing[selectedCourseName] = {
      name: selectedCourseName,
      notes: courseNotes,
      assignments: courseAssignments,
      examDates: courseExamDates,
      aiExplanation: aiExplainResult || undefined,
    };

    onUpdateProfile({
      ...profile,
      courseProgress: existing
    });
  };

  const handleExplainConcept = async () => {
    if (!aiExplainConcept.trim() || !selectedCourseName) return;
    setAiExplainLoading(true);
    setAiExplainError(null);
    setAiExplainResult(null);

    try {
      const messages = [
        {
          role: 'system' as const,
          content: "You are an expert academic advisor and university tutor. Your goal is to explain the given academic concept in the context of the specific course clearly, with simple analogies, a short definition, bullet-point key aspects, and a quick self-test question at the end. Use markdown formatting beautifully."
        },
        {
          role: 'user' as const,
          content: `Please explain the concept "${aiExplainConcept}" in the context of the university course "${selectedCourseName}".`
        }
      ];

      const text = await sendCoachMessages(messages);
      setAiExplainResult(text);

      if (onUpdateProfile) {
        const existing = { ...(profile.courseProgress || {}) };
        existing[selectedCourseName] = {
          name: selectedCourseName,
          notes: courseNotes,
          assignments: courseAssignments,
          examDates: courseExamDates,
          aiExplanation: text,
        };
        onUpdateProfile({
          ...profile,
          courseProgress: existing
        });
      }
    } catch (err: any) {
      console.error(err);
      setAiExplainError(err.message || "Failed to generate concept explanation.");
    } finally {
      setAiExplainLoading(false);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
  const customGoals = CourseCatalog.getCustomGoals(profile.learningGoals, profile.learningGoalDetails);

  // Compute Learning Analytics
  const memories = React.useMemo(() => loadLocalMemories(), [state]);
  const analytics = React.useMemo(() => calculateLearningAnalytics(state, activeCourses, memories), [state, activeCourses, memories]);

  // Math metrics — calculated via pure deterministic Progress Engine
  const progressMetrics = calculateProgressMetrics(state, activeCourses);

  // Today's real scheduled content + the week ahead — from the same
  // provider-agnostic context builder the AI Coach uses (buildAIContext was
  // already imported here for the "Ask AI Coach" button below). Not a new
  // call to the scheduler directly — reusing what aiContextBuilder.ts
  // already computes internally, per the "consume existing services only"
  // scope for this milestone.
  const aiContext = buildAIContext(profile, state);

  const gamification = calculateGamification(state, profile);
  const gamificationMotivation = getGamificationMotivation(gamification);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = state.studyLog?.[dateStr] || 0;
    return {
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dateStr,
      studied: minutes > 0,
      minutes
    };
  }).reverse();

  const totalLessons = progressMetrics.overall.totalLessons;
  const totalDone = progressMetrics.overall.completedLessons;
  const overallPercentage = progressMetrics.overall.completionPercentage;

  const totalMinStudied = progressMetrics.consistency.totalMinutesStudied;
  const totalHoursStudied = progressMetrics.consistency.totalHoursStudied.toFixed(1);

  const remainingMin = progressMetrics.overall.remainingMinutes;
  const remainingHours = (remainingMin / 60).toFixed(1);

  const pace = progressMetrics.pacing.status;

  // Streak status
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const isStreakBroken = progressMetrics.streaks.isStreakBroken;

  const getCoachingQuote = () => {
    const daySeed = Math.floor(new Date().setHours(0,0,0,0) / 86400000);
    if (isStreakBroken) {
      const brokenQuotes = [
        "Streak reset. That's data, not a verdict. Start today's count now.",
        "One missed day doesn't undo the ones before it. Begin again.",
        "The old streak is gone. The next one starts the moment you check a box today.",
        "No lecture needed — just open the next lesson and the count starts over.",
        "Progress isn't a straight line. Today's the next point on it."
      ];
      return brokenQuotes[daySeed % brokenQuotes.length];
    }
    if (pace === 'ahead') {
      const aheadQuotes = [
        "You're ahead. Bank the lead — don't spend it by skipping tomorrow.",
        "Ahead of schedule. Good. That's slack for the days leave or family need you more.",
        "Being ahead means when life gets in the way, the plan doesn't break.",
        "You bought yourself margin. Use it for rest, not for stopping.",
        "Ahead of pace — this is exactly the kind of week to keep quiet about and just repeat."
      ];
      return aheadQuotes[daySeed % aheadQuotes.length];
    }
    if (pace === 'behind') {
      const behindQuotes = [
        "You're a little behind pace — not a crisis, just a Tuesday. Pick one lesson and go.",
        "Behind schedule isn't behind for good. Today's 30 minutes still count exactly the same.",
        "The plan bends. The habit doesn't. Show up for the habit today.",
        "Catching up isn't about a big session — it's about not skipping today too.",
        "Nobody at Aramco is grading your pace. They'll grade the certificate. Keep moving."
      ];
      return behindQuotes[daySeed % behindQuotes.length];
    }
    const onTrackQuotes = [
      "Right on pace. Steady is how this actually gets finished.",
      "You're exactly where the plan expected you to be. That's the whole game.",
      "No drama today — just the next lesson, same as yesterday.",
      "This is what consistency looks like from the inside: unremarkable, and working.",
      "On track. Don't overthink it, just continue."
    ];
    return onTrackQuotes[daySeed % onTrackQuotes.length];
  };

  // Rule-based coaching points
  const getSmartCoachingPoints = () => {
    const points: { icon: string; title: string; text: string }[] = [];

    // 1. Overdue revisions
    const overdueCount = allLegacyLessons().filter(l => state.revisionDates[l.id] && state.revisionDates[l.id] <= todayStr).length;
    if (overdueCount > 0) {
      points.push({
        icon: "🔁",
        title: "Revisions Overdue",
        text: `${overdueCount} lesson${overdueCount > 1 ? 's are' : ' is'} due for revision. Clear these before starting new material — they're cheaper to review now than relearn later.`
      });
    }

    // 2. Flags for difficult lessons
    const hardestLessonId = Object.entries(state.difficulty)
      .filter(([id, rating]) => rating === 3 && !state.completedLessons[id])
      .map(([id]) => id)[0];
    const hardestLessonObj = hardestLessonId ? allLegacyLessons().find(l => l.id === hardestLessonId) : null;
    if (hardestLessonObj) {
      points.push({
        icon: "⚠️",
        title: "Tackle Difficulty Flag",
        text: `You flagged "${hardestLessonObj.title}" as high difficulty. Spend 15 minutes reviewing its M Code or logic before moving ahead.`
      });
    }

    // 3. Repeated wrong answers
    const recentWrongTopics: { [topic: string]: number } = {};
    state.journal.forEach(entry => {
      if (entry.topic) {
        const cleaned = entry.topic.trim().toUpperCase();
        recentWrongTopics[cleaned] = (recentWrongTopics[cleaned] || 0) + 1;
      }
    });
    const commonWrongTopic = Object.entries(recentWrongTopics)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])[0];
    if (commonWrongTopic) {
      points.push({
        icon: "🎯",
        title: `Topic Drill: ${commonWrongTopic[0]}`,
        text: `"${commonWrongTopic[0]}" has come up ${commonWrongTopic[1]} times in your Wrong Answer Journal. Let's do a quick deep-dive into this concept today.`
      });
    }

    // 4. Balance check - fully generalized for any registered courses!
    if (activeCourses.length >= 2) {
      const courseProgresses = activeCourses.map(c => {
        const stats = progressMetrics.courses[c.id];
        const pct = stats && stats.totalLessons ? (stats.completedLessons / stats.totalLessons) * 100 : 0;
        return { course: c, pct };
      }).sort((a, b) => a.pct - b.pct);

      const lagging = courseProgresses[0];
      const leading = courseProgresses[courseProgresses.length - 1];

      if (leading.pct - lagging.pct >= 15) {
        const laggingShort = lagging.course.name.split(':')[0];
        const leadingShort = leading.course.name.split(':')[0];
        const sessionLabel = profile.studyWindows?.[0]?.label || 'Morning';
        points.push({
          icon: "⚖️",
          title: "Balancing Pace",
          text: `Your ${leadingShort} is running ahead of ${laggingShort}. Shift tomorrow ${sessionLabel.toLowerCase()}'s focus to ${laggingShort} to maintain a balanced certification pipeline.`
        });
      }
    }

    if (points.length === 0) {
      points.push({
        icon: "✅",
        title: "All Parameters Optimal",
        text: "You are holding a stable, consistent line. No flags triggered. Focus on completing today's scheduled study session."
      });
    }

    return points.slice(0, 3);
  };

  const smartPoints = getSmartCoachingPoints();

  // ETA Calculation from Progress Engine
  const getETA = () => {
    const status = progressMetrics.overall.estimatedCompletionStatus;
    const date = progressMetrics.overall.estimatedCompletionDate;

    if (status === 'insufficient_data') return { label: "Need 3 study days", date: null };
    if (status === 'completed') return { label: "All Completed", date: null };
    if (status === 'over_one_year') return { label: "> 1 year", date: null };
    if (status === 'no_pace' || !date) return { label: "—", date: null };

    return {
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      date
    };
  };

  const eta = getETA();

  // Next target calculations
  const getDaysUntilDeadline = (deadlineStr: string) => {
    const d = new Date(deadlineStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  };

  const getDaysUntilNextMilestone = () => {
    const coursesWithExams = activeCourses.filter(c => c.examDate);
    if (coursesWithExams.length === 0) return null;
    const days = Math.min(...coursesWithExams.map(c => getDaysUntilDeadline(c.examDate!)));
    return days >= 0 ? days : 0;
  };

  const daysToMilestone = getDaysUntilNextMilestone();

  // NOTE: daysToPMI/daysToPL (legacy per-course deadline countdowns) removed —
  // verified dead code (each appeared exactly once, its own declaration,
  // never read in render). Milestones are now surfaced generically below via
  // progressMetrics.milestones, which covers any number of active courses.

  // Call the AI Coach via the shared, provider-agnostic services — this
  // used to build its own ~50-line prompt string inline (duplicating logic
  // now owned by services/aiContextBuilder.ts + services/aiPrompts.ts, and
  // used by the full AI Coach tab). Kept as a single "review my progress"
  // request to preserve this button's existing single-shot behavior; the
  // full multi-turn AI Coach experience lives in its own tab.
  const askAICoach = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiResponse(null);

    try {
      const context = buildAIContext(profile, state);
      const messages = [
        { role: 'system' as const, content: buildCoachSystemPrompt(context) },
        { role: 'user' as const, content: buildCoachUserPrompt('review_progress', context) },
      ];
      const text = await sendCoachMessages(messages);
      setAiResponse(text);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Could not connect to the AI Coach.');
    } finally {
      setAiLoading(false);
    }
  };

  const getFocusCourseName = () => {
    if (activeCourses.length === 0) return profile.learningGoals[0]?.split(':')[0] || 'General';
    const sorted = [...activeCourses].map(c => {
      const stats = progressMetrics.courses[c.id];
      const pct = stats && stats.totalLessons ? (stats.completedLessons / stats.totalLessons) : 0;
      return { course: c, pct };
    }).sort((a, b) => a.pct - b.pct);

    return getCourseShortLabel(sorted[0].course);
  };

  /**
   * "AI Insight" card content — per explicit scope, this does NOT call the
   * AI Coach or any network endpoint. It's a pure, local synthesis of
   * metrics already computed above (progressMetrics.pacing/.milestones,
   * state.streak) into one headline sentence — same "rule-based, zero
   * network calls" pattern as getCoachingQuote()/getSmartCoachingPoints()
   * just above. The live AI Coach (which DOES call the network) stays a
   * separate, explicit, user-triggered action further down this page.
   */
  const getAIInsight = (): string => {
    const nextMilestone = [...progressMetrics.milestones]
      .filter(m => !m.isMissed)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)[0];
    const missedMilestone = progressMetrics.milestones.find(m => m.isMissed);

    if (missedMilestone) {
      return `${missedMilestone.courseName.split(':')[0]}'s target date has passed. Consider setting a new target date, or focus your remaining sessions there first.`;
    }
    if (progressMetrics.pacing.status === 'behind' && nextMilestone) {
      const gap = Math.round(progressMetrics.pacing.expectedPercentage - progressMetrics.pacing.actualPercentage);
      return `You're about ${gap}% behind pace with ${nextMilestone.daysRemaining} days left until ${nextMilestone.courseName.split(':')[0]}'s target date. A few extra sessions this week would close most of that gap.`;
    }
    if (progressMetrics.pacing.status === 'ahead' && nextMilestone) {
      return `You're ahead of pace with ${nextMilestone.daysRemaining} days left until ${nextMilestone.courseName.split(':')[0]}'s target date — comfortable room to keep a steady rhythm.`;
    }
    if (nextMilestone) {
      return `On pace for ${nextMilestone.courseName.split(':')[0]}, ${nextMilestone.daysRemaining} days out. Keep today's session and that holds.`;
    }
    if (state.streak >= 3) {
      return `${state.streak}-day streak going. No target date is set yet for your active goals — adding one in Preferences will let this insight track pace against it.`;
    }
    return `Complete a few sessions to unlock pace and milestone insights here.`;
  };

  const circumference = 2 * Math.PI * 46;

  // Career Capital Metrics and Score calculations (based on Skills acquired, Certifications completed, Roadmap progress, Milestones achieved)
  const totalSkillsCount = Object.keys(state.completedLessons || {}).length;

  const certsCompleted = activeCourses.filter(c => {
    const stats = progressMetrics.courses[c.id];
    return stats && stats.completedLessons === stats.totalLessons && stats.totalLessons > 0;
  }).length;
  const totalCerts = activeCourses.length;

  const roadmapProgress = overallPercentage;

  const achievedMilestones = progressMetrics.milestones.filter(m => !m.isMissed && (progressMetrics.courses[m.courseId]?.completedLessons || 0) > 0).length;
  const totalMilestones = progressMetrics.milestones.length;

  const calculateCareerCapitalScore = () => {
    if (totalLessons === 0) return 0;
    // 1. Roadmap progress (up to 40 points)
    const roadmapPoints = (roadmapProgress / 100) * 40;
    // 2. Skills acquired (up to 30 points, 2 points per completed lesson/skill up to 15 lessons)
    const skillsPoints = Math.min(30, totalSkillsCount * 2);
    // 3. Certifications completed (up to 20 points, proportional to certs done or 10 points per cert)
    const certsPoints = totalCerts > 0 ? (certsCompleted / totalCerts) * 20 : (totalSkillsCount >= 5 ? 15 : 0);
    // 4. Milestones achieved (up to 10 points)
    const milestonePoints = totalMilestones > 0 ? (achievedMilestones / totalMilestones) * 10 : (state.streak >= 2 ? 8 : 0);
    
    // Fallback/Starting bonus for starting onboarding or having active goals
    const baseBonus = (profile.learningGoals || []).length > 0 ? 10 : 0;
    
    return Math.min(100, Math.round(roadmapPoints + skillsPoints + certsPoints + milestonePoints + baseBonus));
  };

  const careerCapitalScore = calculateCareerCapitalScore();

  // Daily Study Goal variables
  const currentTodayStr = new Date().toISOString().slice(0, 10);
  const todayStudyMinutes = state.studyLog?.[currentTodayStr] || 0;
  const dailyGoalMinutes = profile.dailyGoalMinutes || 30;
  const dailyGoalProgressPct = Math.min(100, Math.round((todayStudyMinutes / dailyGoalMinutes) * 100));

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Welcome Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          {(() => {
            const tz = profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            let hour = new Date().getHours();
            try {
              const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                hour12: false,
              }).formatToParts(new Date());
              const hourPart = parts.find(part => part.type === 'hour');
              if (hourPart) {
                hour = parseInt(hourPart.value, 10);
              }
            } catch (e) {
              console.error('Timezone greeting error:', e);
            }
            if (hour < 12 || hour === 24) return 'Good morning';
            if (hour < 17) return 'Good afternoon';
            return 'Good evening';
          })()}, {profile.name ? profile.name.split(' ')[0] : 'Ahmed'} 👋
        </h1>
        <p className="text-sm text-[#8A99AD] font-medium">You're on track and making great progress.</p>
      </div>

      {/* Dashboard Sub-navigation Tabs */}
      <div className="flex border-b border-white/5 gap-6 mt-6 mb-2">
        <button
          onClick={() => setDashboardTab('overview')}
          className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 relative ${
            dashboardTab === 'overview' 
              ? 'border-[#D4AF37] text-white' 
              : 'border-transparent text-[#94949C] hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setDashboardTab('analytics')}
          className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 relative flex items-center gap-1.5 ${
            dashboardTab === 'analytics' 
              ? 'border-[#D4AF37] text-white' 
              : 'border-transparent text-[#94949C] hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#D4AF37]" /> Learning Analytics Engine
        </button>
      </div>

      {dashboardTab === 'overview' && (
        <div className="space-y-6">
          {/* Himam AI Intelligence Hub Hero Card */}
          <div className="bg-[#0A101D] border border-[#1C273E] rounded-2xl p-6 shadow-2xl relative overflow-hidden" id="ai-intelligence-hub">
            {/* Ambient background glows */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              {/* Left Column Text */}
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#101C38] border border-[#1E3A8A] text-[#3B82F6] text-[10px] font-bold tracking-wider uppercase">
                  <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                  <span>AI INTELLIGENCE HUB</span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                  Here's your personalized intelligence for today.
                </h2>
                <p className="text-xs text-[#8A99AD] leading-relaxed">
                  Based on your calendar, courses, and goals, I've identified what matters most right now.
                </p>
              </div>

              {/* Right Column Data Influence Box */}
              <div className="bg-[#070A12]/90 border border-[#1E283D] rounded-xl p-4 min-w-[310px] w-full lg:w-auto backdrop-blur-md space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-[#1E283D] pb-2">
                  <span className="text-[10px] font-bold tracking-wider text-[#3B82F6] uppercase">DATA INFLUENCE</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => fetchIntelligenceSynthesis(true)}
                      disabled={intelLoading}
                      className="text-[10px] text-[#8A99AD] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      title="Refresh synthesis"
                    >
                      <RefreshCw className={`w-3 h-3 ${intelLoading ? 'animate-spin text-[#3B82F6]' : ''}`} />
                    </button>
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse"></span>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs text-[#CBD5E1]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#3B82F6] font-bold mt-0.5">•</span>
                    <span>2 upcoming exams this week (Networking, Database Systems)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3B82F6] font-bold mt-0.5">•</span>
                    <span>1 capstone milestone due in 5 days</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3B82F6] font-bold mt-0.5">•</span>
                    <span>2 internship applications in progress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3B82F6] font-bold mt-0.5">•</span>
                    <span>Study sessions: 6 this week</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#3B82F6] font-bold mt-0.5">•</span>
                    <span>Recent focus: AI Engineer path</span>
                  </li>
                </ul>

                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10.5px] text-[#8A99AD] hover:text-white font-medium flex items-center gap-1 transition-colors pt-1 cursor-pointer"
                >
                  <Info className="w-3 h-3 text-[#3B82F6]" />
                  <span>View details</span>
                </button>
              </div>
            </div>
          </div>

            {/* Personalization Controls & Insight History Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#11141C] border border-white/5 rounded-xl p-4">
              <div className="space-y-1">
                <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-[#D4AF37]" /> Personalization Controls
                </span>
                <p className="text-[10px] text-[#55555B]">Choose how proactive or minimalist the AI Coach should be.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['proactive', 'balanced', 'minimalist'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => changePersonalization(mode)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                      intelPersonalization === mode
                        ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37] shadow-md shadow-[#D4AF37]/5'
                        : 'bg-white/5 border-transparent text-[#94949C] hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
                
                <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block"></div>
                
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                    showHistory
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-white'
                      : 'bg-white/5 border-transparent text-[#94949C] hover:text-white hover:bg-white/10'
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Insight Log ({insightHistory.length})</span>
                </button>
              </div>
            </div>

            {/* Collapse Drawer: Insight history log */}
            {showHistory && (
              <div className="bg-[#11141C] border border-[#D4AF37]/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#D4AF37]" />
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider text-[#E0E0E6] font-bold">Chronological Recommendation History</h4>
                      <p className="text-[9px] text-[#55555B]">Review past strategic insights and track completed actions over time.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="text-[9px] font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 hover:underline cursor-pointer"
                  >
                    Clear Log
                  </button>
                </div>

                {insightHistory.length === 0 ? (
                  <p className="text-[10px] text-[#55555B] text-center py-6">Your recommendation history log is currently empty. Generated priorities and system feedback will appear here chronologically.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                    {insightHistory.map((item: any) => (
                      <div key={item.id} className="p-3 bg-white/[0.01] border border-white/5 rounded-lg flex items-start justify-between gap-3 text-xs hover:border-white/10 transition-all">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-mono uppercase px-1.5 py-0.2 rounded-md ${
                              item.type === 'priority' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' :
                              item.type === 'conflict' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {item.context || item.type}
                            </span>
                            <span className="text-[9px] text-[#55555B]">
                              {new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#E0E0E6] font-medium">{item.text}</p>
                          {item.explanation && (
                            <p className="text-[9.5px] text-[#55555B] italic">🔍 Influenced by: {item.explanation}</p>
                          )}
                        </div>
                        
                        <div>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            item.status === 'liked' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                            item.status === 'dismissed' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-[#94949C]'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {intelLoading && !intelResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 py-4 animate-pulse">
                <div className="space-y-3 col-span-2">
                  <div className="h-3 bg-white/5 rounded w-1/4"></div>
                  <div className="h-28 bg-white/5 rounded"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 bg-white/5 rounded w-1/2"></div>
                  <div className="h-12 bg-white/5 rounded"></div>
                  <div className="h-12 bg-white/5 rounded"></div>
                </div>
              </div>
            ) : intelError ? (
              <div className="p-4 bg-[#1C1212] border border-[#EF4444]/25 rounded-lg flex flex-col items-center text-center gap-2">
                <ShieldAlert className="w-6 h-6 text-[#EF4444]" />
                <p className="text-xs text-[#FCA5A5]">{intelError}</p>
                <button
                  onClick={() => fetchIntelligenceSynthesis(true)}
                  className="mt-1 px-3 py-1 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#EF4444]/20 text-[#FCA5A5] text-[10.5px] rounded font-semibold cursor-pointer"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Row 1: Strategic Context & Weekly Review */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Proactive Synthesis (Span 2) */}
                  <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 flex flex-col justify-between lg:col-span-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-white/[0.02] select-none font-serif text-8xl pointer-events-none">
                      ”
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1.5">
                          <Brain className="w-4 h-4" /> Proactive AI Orchestration
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/10">
                            {intelPersonalization.toUpperCase()} Mode
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[#E0E0E6] leading-relaxed font-medium italic bg-white/[0.01] border border-white/[0.03] p-4 rounded-xl shadow-inner">
                        "{intelResult?.synthesis || "Establishing unified context pipeline... Register your upcoming midterm dates, configure certification targets, or update your career internships tracker to activate custom tactical synthesis."}"
                      </p>
                    </div>

                    {/* Explainability Block */}
                    {intelResult?.synthesisExplanation && (
                      <div className="mt-3 text-[10px] text-[#94949C] bg-white/[0.02] p-2 rounded-lg flex items-center gap-1.5 border border-white/5">
                        <Info className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span><strong>Data Influence:</strong> {intelResult.synthesisExplanation}</span>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-[#55555B]">
                      <span>Interpreting multi-module student profiles</span>
                      <span className="font-mono text-[#D4AF37]/80">Context Score: Unified</span>
                    </div>
                  </div>

                  {/* Weekly Review (Span 1) */}
                  <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <ListTodo className="w-4 h-4" /> Sunday Weekly Review
                      </span>
                      
                      <div className="mt-3.5 space-y-3.5">
                        <div>
                          <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider block mb-1">Completed This Week:</span>
                          <ul className="space-y-1">
                            {(intelResult?.weeklyReview?.thisWeek || [
                              `✔ ${Object.keys(state.completedLessons || {}).length} lessons finished to date`,
                              `✔ Study streak active at ${state.streak} days`,
                              `✔ Capstone dashboard synchronized`
                            ]).map((item: string, idx: number) => (
                              <li key={idx} className="text-[10.5px] text-[#E0E0E6] flex items-start gap-1.5">
                                <span className="text-emerald-400 flex-shrink-0 font-bold">✔</span>
                                <span className="line-clamp-2">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider block mb-1">Priorities for Next Week:</span>
                          <ul className="space-y-1">
                            {(intelResult?.weeklyReview?.nextWeekPriorities || [
                              "Log upcoming exams or milestones in your Schedule",
                              "Select target dates for active study goals",
                              "Complete at least 3 course lessons"
                            ]).map((item: string, idx: number) => (
                              <li key={idx} className="text-[10.5px] text-[#94949C] flex items-start gap-1.5">
                                <span className="text-[#D4AF37] flex-shrink-0 font-bold">○</span>
                                <span className="line-clamp-2">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 text-[9px] text-[#55555B] italic text-right border-t border-white/[0.03]">
                      Auto-generated Sunday
                    </div>
                  </div>
                </div>

                {/* Row 2: Diagnostics & Action */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Column A: Priority Engine */}
                  <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-[#D4AF37]" /> Priority Engine
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] rounded-md font-mono uppercase tracking-wider">Top 3 today</span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const originalPriorities = intelResult?.priorities || [
                          {
                            id: "fallback-prio-1",
                            text: "Register upcoming milestones in your Schedule.",
                            impact: "High",
                            context: "Schedule Sync",
                            explanation: "Influenced by empty registered schedule events database.",
                            influencedBy: ["academicEvents"]
                          },
                          {
                            id: "fallback-prio-2",
                            text: "Spend 10 minutes planning your Capstone thesis advisor outreach.",
                            impact: "High",
                            context: "Capstone Project",
                            explanation: "Influenced by pending supervisor confirmation details.",
                            influencedBy: ["capstoneSupervisor"]
                          },
                          {
                            id: "fallback-prio-3",
                            text: "Submit one additional internship application to build career momentum.",
                            impact: "Medium",
                            context: "Internship CRM",
                            explanation: "Influenced by career goals and active application pipeline logs.",
                            influencedBy: ["internshipApplications"]
                          }
                        ];
                        const activePriorities = originalPriorities.filter((item: any) => !dismissedSuggestions[item.id]);

                        if (activePriorities.length === 0) {
                          return (
                            <div className="p-4 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-lg text-center space-y-1.5 py-6">
                              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-semibold text-[#E0E0E6]">Priority Queue Clear</span>
                                <p className="text-[9px] text-[#55555B]">All prioritized tasks completed or dismissed.</p>
                              </div>
                            </div>
                          );
                        }

                        return activePriorities.map((item: any, idx: number) => {
                          const isLiked = !!likedSuggestions[item.id];
                          const isCompleted = !!completedSuggestions[item.id];
                          return (
                            <div 
                              key={item.id || idx} 
                              className={`p-2.5 bg-white/[0.01] border rounded-lg space-y-2 hover:border-[#D4AF37]/25 transition-all relative group ${
                                isCompleted ? 'border-emerald-500/20 opacity-60 bg-emerald-500/[0.01]' : 'border-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono text-[#55555B] uppercase">{item.context}</span>
                                <span className={`text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                                  item.impact === 'High' ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-white/5 text-[#94949C]'
                                }`}>{item.impact} Impact</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={() => handleCompletePriority(item.id, item.text)}
                                  disabled={isCompleted}
                                  className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                    isCompleted 
                                      ? 'bg-emerald-500 border-emerald-500 text-black' 
                                      : 'border-white/20 hover:border-[#D4AF37]/60'
                                  }`}
                                >
                                  {isCompleted && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                                </button>
                                <p className={`text-[11px] text-[#E0E0E6] font-medium leading-relaxed ${isCompleted ? 'line-through text-[#55555B]' : ''}`}>
                                  {item.text}
                                </p>
                              </div>

                              {/* Explainability Caption */}
                              {item.explanation && (
                                <p className="text-[9px] text-[#55555B] pt-1.5 border-t border-white/[0.03] flex items-center gap-1">
                                  <Info className="w-2.5 h-2.5 text-[#D4AF37]/50" />
                                  <span>{item.explanation}</span>
                                </p>
                              )}

                              {/* Feedback Controls (Visible on hover) */}
                              <div className="flex items-center justify-end gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => handleLikeSuggestion(item.id, item.text, 'priority')}
                                  title="Mark as Helpful"
                                  className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${isLiked ? 'text-emerald-400' : 'text-[#55555B] hover:text-white'}`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(item.id, item.text, 'priority')}
                                  title="Not Relevant"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-red-400 transition-all cursor-pointer"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(item.id, item.text, 'priority')}
                                  title="Dismiss/Hide"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-white transition-all cursor-pointer"
                                >
                                  <EyeOff className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Column B: Goal Conflict & Collision Detector */}
                  <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Conflict Guard
                      </span>
                      <span className="text-[9px] text-[#55555B] font-mono">Predictive collision</span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const originalConflicts = intelResult?.conflicts || [];
                        const activeConflicts = originalConflicts.filter((c: any) => !dismissedSuggestions[c.id]);

                        if (activeConflicts.length === 0) {
                          return (
                            <div className="p-4 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-lg text-center space-y-2 py-6">
                              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto animate-pulse" />
                              <div className="space-y-0.5">
                                <span className="text-xs font-semibold text-[#E0E0E6]">No Conflicts Predicted</span>
                                <p className="text-[10px] text-[#55555B]">All target timelines and study lanes are currently clear.</p>
                              </div>
                            </div>
                          );
                        }

                        return activeConflicts.map((conflict: any, idx: number) => {
                          const isLiked = !!likedSuggestions[conflict.id];
                          return (
                            <div key={conflict.id || idx} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-lg space-y-2.5 relative group hover:border-amber-500/20 transition-all">
                              <div className="space-y-1">
                                <span className="font-semibold text-[11px] text-amber-400 block">{conflict.title}</span>
                                <p className="text-[10px] text-[#E0E0E6] leading-normal">{conflict.text}</p>
                              </div>
                              <div className="p-2 bg-white/5 border border-white/10 rounded-lg space-y-1">
                                <span className="text-[8px] font-mono uppercase text-[#D4AF37] block">AI Suggested Reorganization</span>
                                <p className="text-[10.5px] text-[#94949C] leading-normal">{conflict.suggestion}</p>
                              </div>

                              {/* Explainability Caption */}
                              {conflict.explanation && (
                                <p className="text-[9px] text-[#55555B] pt-1.5 border-t border-white/[0.03] flex items-center gap-1">
                                  <Info className="w-2.5 h-2.5 text-[#D4AF37]/50" />
                                  <span>{conflict.explanation}</span>
                                </p>
                              )}

                              {/* Feedback Controls */}
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => handleLikeSuggestion(conflict.id, conflict.title, 'conflict')}
                                  title="Mark as Helpful"
                                  className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${isLiked ? 'text-emerald-400' : 'text-[#55555B] hover:text-white'}`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(conflict.id, conflict.title, 'conflict')}
                                  title="Not Relevant"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-red-400 transition-all cursor-pointer"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(conflict.id, conflict.title, 'conflict')}
                                  title="Dismiss"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-white transition-all cursor-pointer"
                                >
                                  <EyeOff className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Column C: Opportunity & Catalysts */}
                  <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#D4AF37]" /> Opportunity Catalysts
                      </span>
                      <span className="text-[9px] text-[#55555B] font-mono">Aspirational</span>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const originalOpps = intelResult?.opportunities || [
                          {
                            id: "opp-default-1",
                            title: "GPA Career Acceleration",
                            text: "Your academic standing makes you a highly competitive candidate for early-access technical internships.",
                            type: "career",
                            explanation: "Synthesized from your top university standing.",
                            influencedBy: ["currentGpa"]
                          },
                          {
                            id: "opp-default-2",
                            title: "Study Habit Momentum",
                            text: "Your streak is optimal. You have met prerequisite guidelines to begin studying for AWS Solution Architect.",
                            type: "certification",
                            explanation: "Influenced by completed coursework and active study habits.",
                            influencedBy: ["studyStreak", "completedLessons"]
                          }
                        ];
                        const activeOpps = originalOpps.filter((o: any) => !dismissedSuggestions[o.id]);

                        if (activeOpps.length === 0) {
                          return (
                            <div className="p-4 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-lg text-center space-y-1 py-6">
                              <Zap className="w-5 h-5 text-[#D4AF37] mx-auto opacity-40" />
                              <div className="space-y-0.5">
                                <span className="text-[11px] font-semibold text-[#E0E0E6]">No Opportunities Logged</span>
                                <p className="text-[9px] text-[#55555B]">Check back later as your learning history expands.</p>
                              </div>
                            </div>
                          );
                        }

                        return activeOpps.map((opp: any, idx: number) => {
                          const isLiked = !!likedSuggestions[opp.id];
                          return (
                            <div key={opp.id || idx} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-lg space-y-1.5 relative group hover:border-[#D4AF37]/30 transition-all">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[11px] text-[#E0E0E6]">{opp.title}</span>
                                <span className="text-[8px] uppercase tracking-wider font-mono text-[#D4AF37]">{opp.type}</span>
                              </div>
                              <p className="text-[10px] text-[#94949C] leading-normal">{opp.text}</p>

                              {/* Explainability Caption */}
                              {opp.explanation && (
                                <p className="text-[9px] text-[#55555B] pt-1.5 border-t border-white/[0.03] flex items-center gap-1">
                                  <Info className="w-2.5 h-2.5 text-[#D4AF37]/50" />
                                  <span>{opp.explanation}</span>
                                </p>
                              )}

                              {/* Feedback Controls */}
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() => handleLikeSuggestion(opp.id, opp.title, 'opportunity')}
                                  title="Mark as Helpful"
                                  className={`p-1 rounded hover:bg-white/5 transition-all cursor-pointer ${isLiked ? 'text-emerald-400' : 'text-[#55555B] hover:text-white'}`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(opp.id, opp.title, 'opportunity')}
                                  title="Not Relevant"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-red-400 transition-all cursor-pointer"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDismissSuggestion(opp.id, opp.title, 'opportunity')}
                                  title="Dismiss"
                                  className="p-1 rounded hover:bg-white/5 text-[#55555B] hover:text-white transition-all cursor-pointer"
                                >
                                  <EyeOff className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Row 3: Long-term Predictive Analytics (System Readiness Scales) */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-[#94949C] font-bold flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" /> Long-Term Predictive Readiness Indicators
                    </h4>
                    <p className="text-[9px] text-[#55555B] mt-0.5">Statistical forecast of readiness milestones calculated from real-time module profiles</p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* A. Graduation Readiness */}
                    <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3 hover:scale-[1.01] transition-all duration-300 hover:border-[#D4AF37]/20 cursor-help" title={intelResult?.readiness?.graduation?.reason || "Based on graduation goals, courses logged, and Capstone status."}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#94949C] uppercase font-bold flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-blue-400" /> Graduation
                        </span>
                        <span className="text-xs font-mono font-bold text-blue-400">
                          {intelResult?.readiness?.graduation?.score || 55}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${intelResult?.readiness?.graduation?.score || 55}%` }}
                        />
                      </div>
                      <p className="text-[9.5px] text-[#55555B] leading-normal line-clamp-2">
                        {intelResult?.readiness?.graduation?.reason || "Awaiting Capstone topic confirmation and official semester course registrations."}
                      </p>
                      {intelResult?.readiness?.graduation?.explanation && (
                        <p className="text-[8.5px] text-[#44444A] italic leading-normal border-t border-white/[0.02] pt-1 flex items-center gap-1">
                          <Info className="w-2.5 h-2.5 text-blue-400/50" />
                          <span>{intelResult.readiness.graduation.explanation}</span>
                        </p>
                      )}
                    </div>

                    {/* B. Internship Readiness */}
                    <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3 hover:scale-[1.01] transition-all duration-300 hover:border-[#D4AF37]/20 cursor-help" title={intelResult?.readiness?.internship?.reason || "Calculated from logged applications count, target jobs, and current GPA status."}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#94949C] uppercase font-bold flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-amber-400" /> Internship
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400">
                          {intelResult?.readiness?.internship?.score || 35}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${intelResult?.readiness?.internship?.score || 35}%` }}
                        />
                      </div>
                      <p className="text-[9.5px] text-[#55555B] leading-normal line-clamp-2">
                        {intelResult?.readiness?.internship?.reason || "Early stages. Log your target jobs and submit your first application to initiate pipeline."}
                      </p>
                      {intelResult?.readiness?.internship?.explanation && (
                        <p className="text-[8.5px] text-[#44444A] italic leading-normal border-t border-white/[0.02] pt-1 flex items-center gap-1">
                          <Info className="w-2.5 h-2.5 text-amber-400/50" />
                          <span>{intelResult.readiness.internship.explanation}</span>
                        </p>
                      )}
                    </div>

                    {/* C. Certification Readiness */}
                    <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3 hover:scale-[1.01] transition-all duration-300 hover:border-[#D4AF37]/20 cursor-help" title={intelResult?.readiness?.certification?.reason || "Reflects completed lesson metrics, active habit study streak, and target milestones."}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#94949C] uppercase font-bold flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-emerald-400" /> Certification
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {intelResult?.readiness?.certification?.score || 45}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${intelResult?.readiness?.certification?.score || 45}%` }}
                        />
                      </div>
                      <p className="text-[9.5px] text-[#55555B] leading-normal line-clamp-2">
                        {intelResult?.readiness?.certification?.reason || "Reflecting current daily lesson completion rate. Maintain active habit streaks."}
                      </p>
                      {intelResult?.readiness?.certification?.explanation && (
                        <p className="text-[8.5px] text-[#44444A] italic leading-normal border-t border-white/[0.02] pt-1 flex items-center gap-1">
                          <Info className="w-2.5 h-2.5 text-emerald-400/50" />
                          <span>{intelResult.readiness.certification.explanation}</span>
                        </p>
                      )}
                    </div>

                    {/* D. Full-Time Job Readiness */}
                    <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3 hover:scale-[1.01] transition-all duration-300 hover:border-[#D4AF37]/20 cursor-help" title={intelResult?.readiness?.job?.reason || "Summarizes GPA, capstone milestones progress, certifications completed, and interview practice scores."}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#94949C] uppercase font-bold flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-[#D4AF37]" /> Job Market
                        </span>
                        <span className="text-xs font-mono font-bold text-[#D4AF37]">
                          {intelResult?.readiness?.job?.score || 40}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#D4AF37] rounded-full transition-all duration-500"
                          style={{ width: `${intelResult?.readiness?.job?.score || 40}%` }}
                        />
                      </div>
                      <p className="text-[9.5px] text-[#55555B] leading-normal line-clamp-2">
                        {intelResult?.readiness?.job?.reason || "Performance standing provides a great baseline. Work on project milestones to unlock full market readiness."}
                      </p>
                      {intelResult?.readiness?.job?.explanation && (
                        <p className="text-[8.5px] text-[#44444A] italic leading-normal border-t border-white/[0.02] pt-1 flex items-center gap-1">
                          <Info className="w-2.5 h-2.5 text-[#D4AF37]/50" />
                          <span>{intelResult.readiness.job.explanation}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Gamification & Goals Hub */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4" id="gamification-hub">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[#94949C] font-semibold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#D4AF37]" /> Gamification &amp; Streak Goals
            </h3>
            <p className="text-[10px] text-[#55555B] mt-0.5">{gamificationMotivation}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              Level {gamification.level + 1}
            </span>
            <span className="text-[10px] bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
              {gamification.xp.toLocaleString()} XP Total
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bento Box 1: Level & Streak Flame Row */}
          <div className="lg:col-span-4 bg-[#11141C] border border-white/5 rounded-xl p-4 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider">Level Status</span>
              <div className="mt-2 flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center bg-[#171B24] border border-[#D4AF37]/30 rounded-full shadow-inner flex-shrink-0">
                  <Star className="w-5 h-5 text-[#D4AF37] fill-[#D4AF37]/10" />
                  <span className="absolute text-[10px] font-mono font-bold text-white mt-0.5">{gamification.level + 1}</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{gamification.levelName}</h4>
                  <p className="text-[10px] text-[#55555B]">
                    {gamification.nextLevelName ? `${gamification.xpInLevel.toLocaleString()} / ${gamification.xpNeededForNext.toLocaleString()} XP` : "Max level achieved"}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              {gamification.nextLevelName && (
                <div className="mt-3 space-y-1">
                  <div className="w-full bg-[#171B24] h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] h-full transition-all duration-500" style={{ width: `${gamification.levelProgressPct}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[8px] text-[#55555B] font-medium">
                    <span>Current Tier Progress</span>
                    <span>{gamification.levelProgressPct}% ({gamification.xpNeededForNext - gamification.xpInLevel} XP to {gamification.nextLevelName})</span>
                  </div>
                </div>
              )}
            </div>

            {/* 7-Day Consistency Grid */}
            <div className="border-t border-white/5 pt-3">
              <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider block mb-2">7-Day Consistency Tracker</span>
              <div className="flex justify-between items-center gap-1.5 bg-[#171B24]/50 p-2 rounded-lg border border-white/5">
                {last7Days.map((day, di) => (
                  <div key={di} className="flex flex-col items-center flex-1">
                    <span className="text-[8px] text-[#55555B] font-bold uppercase">{day.dayName}</span>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mt-1 transition-all ${
                      day.studied 
                        ? 'bg-gradient-to-br from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 shadow-[0_0_8px_rgba(197,160,89,0.1)]' 
                        : 'bg-[#171B24] text-[#55555B] border border-white/5'
                    }`} title={`${day.dateStr}: ${day.minutes} mins studied`}>
                      <Flame className={`w-3.5 h-3.5 ${day.studied ? 'text-[#D4AF37] animate-pulse' : 'text-[#333335]'}`} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bento Box 2: Monthly Goals */}
          <div className="lg:col-span-8 bg-[#11141C] border border-white/5 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider">Monthly Milestones &amp; Challenges</span>
                <span className="text-[9px] text-[#55555B] font-mono font-bold">
                  {gamification.completedGoalsCount} of {gamification.monthlyGoals.length} completed
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {gamification.monthlyGoals.map(goal => (
                  <div 
                    key={goal.id} 
                    className={`p-3 rounded-lg border transition-all duration-300 flex flex-col justify-between ${
                      goal.completed 
                        ? 'bg-[#0D1C13]/10 border-[#10B981]/20 shadow-[0_2px_8px_rgba(16,185,129,0.02)]' 
                        : 'bg-[#171B24]/50 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0 mt-0.5">{goal.icon}</span>
                        <div>
                          <h5 className={`text-xs font-bold leading-snug ${goal.completed ? 'text-[#10B981]' : 'text-white'}`}>
                            {goal.title}
                          </h5>
                          <p className="text-[9.5px] text-[#94949C] mt-0.5 leading-tight">{goal.description}</p>
                        </div>
                      </div>
                      <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        goal.completed 
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25' 
                          : 'bg-white/5 text-[#D4AF37] border border-white/5'
                      }`}>
                        +{goal.xpReward} XP
                      </span>
                    </div>

                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className={goal.completed ? 'text-[#10B981]' : 'text-[#94949C]'}>
                          {goal.current} / {goal.target} {goal.unit}
                        </span>
                        <span className={goal.completed ? 'text-[#10B981] font-bold' : 'text-[#55555B]'}>
                          {goal.completed ? '100%' : `${Math.round((goal.current / goal.target) * 100)}%`}
                        </span>
                      </div>
                      <div className="w-full bg-[#171B24] h-1 rounded-full overflow-hidden">
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
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Academic Standing */}
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-xl p-4 space-y-3 hover:border-blue-500/30 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A99AD] font-semibold">Academic Standing</span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              3.72 <span className="text-xs text-[#64748B] font-normal">/ 5.00 GPA</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-emerald-400">Good standing</span>
            </div>
          </div>
        </div>

        {/* Card 2: Study Progress */}
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-xl p-4 space-y-3 hover:border-blue-500/30 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A99AD] font-semibold">Study Progress</span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              72% <span className="text-xs text-[#64748B] font-normal">This Week</span>
            </div>
            <div className="w-full bg-[#182032] h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-blue-500 h-full w-[72%] rounded-full"></div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-emerald-400">On track</span>
            </div>
          </div>
        </div>

        {/* Card 3: Career Readiness */}
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-xl p-4 space-y-3 hover:border-amber-500/30 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A99AD] font-semibold">Career Readiness</span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              68% <span className="text-xs text-[#64748B] font-normal">Overall Score</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-emerald-400">Improving</span>
            </div>
          </div>
        </div>

        {/* Card 4: AI Consistency */}
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-xl p-4 space-y-3 hover:border-purple-500/30 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A99AD] font-semibold">AI Consistency</span>
            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">
              85% <span className="text-xs text-[#64748B] font-normal">7-Day Streak</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-emerald-400">Excellent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Focus — real scheduled content from aiContext.today (the
          same context builder the AI Coach uses), not a fabricated summary
          sentence. Handles the "no schedule" case explicitly. */}
      <div className="bg-[#171B24] border border-white/5 rounded-xl p-5">
        <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold mb-3">Today's Focus</h3>
        {!aiContext.today.isWorkable ? (
          <p className="text-xs text-[#55555B] italic">
            {aiContext.today.isVacation ? "Vacation day — no study session scheduled." : "Not a scheduled working day."}
          </p>
        ) : (profile.studyWindows || []).length === 0 ? (
          <p className="text-xs text-[#55555B] italic">No study schedule set — add study windows in Preferences to see today's session here.</p>
        ) : aiContext.today.windows.every(w => w.lessons.length === 0) ? (
          <p className="text-xs text-[#55555B] italic">A working day, but nothing queued into today's windows yet.</p>
        ) : (
          <div className="space-y-3">
            {aiContext.today.windows.filter(w => w.lessons.length > 0).map((window, wi) => (
              <div key={wi}>
                <span className="text-[10px] uppercase tracking-wide text-[#D4AF37] font-semibold">{window.label}</span>
                <div className="mt-1 space-y-1.5">
                  {window.lessons.map((lesson, li) => (
                    <div key={li} className="flex items-center justify-between text-xs">
                      <span className="text-white truncate">{lesson.courseShortLabel ? `[${lesson.courseShortLabel}] ` : ''}{lesson.title}</span>
                      <span className="text-[#55555B] font-mono ml-2 flex-shrink-0">{lesson.duration}m</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Library & Uploaded Materials Brief */}
      <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10.5px] uppercase tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#D4AF37]" /> Your Knowledge Library & Uploads
            </h3>
            <p className="text-[10px] text-[#55555B] mt-0.5">Documents, PDFs, and notes synthesized by Himam AI</p>
          </div>
          <button
            onClick={() => setActiveTab('learning-library')}
            className="text-[10px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
          >
            Open Library <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {(() => {
          let recentDocs: any[] = [];
          try {
            const raw = localStorage.getItem('himam_knowledge_library');
            recentDocs = raw ? JSON.parse(raw) : [];
          } catch {
            recentDocs = [];
          }

          if (recentDocs.length === 0) {
            return (
              <div className="p-4 bg-[#11141C] border border-white/5 rounded-xl text-center space-y-2">
                <p className="text-xs text-[#94949C]">No documents uploaded yet. Add PDFs, notes, slides, or syllabus files for instant AI summaries and quizzes.</p>
                <button
                  onClick={() => setActiveTab('learning-library')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] font-bold text-xs rounded-lg transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Upload Document to Knowledge Library
                </button>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recentDocs.slice(0, 4).map((doc: any) => (
                  <div key={doc.id} className="p-3 bg-[#11141C] border border-white/5 hover:border-[#D4AF37]/30 rounded-xl flex items-start justify-between gap-2 transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 bg-[#D4AF37]/10 text-[#D4AF37] rounded">
                          {doc.fileType || 'Doc'}
                        </span>
                        <span className="text-[9px] text-[#55555B]">{doc.fileSize}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate" title={doc.fileName}>{doc.fileName}</h4>
                      <p className="text-[10px] text-[#94949C] line-clamp-1 mt-0.5">{doc.summary || 'Indexed by Himam AI'}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick AI actions for uploaded knowledge */}
              <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                <span className="text-[9.5px] font-bold text-[#55555B] uppercase tracking-wider">AI Quick Actions:</span>
                <button
                  onClick={() => setActiveTab('ai-coach')}
                  className="px-2.5 py-1 bg-white/5 hover:bg-[#D4AF37]/10 border border-white/10 hover:border-[#D4AF37]/30 text-xs font-semibold text-[#E0E0E6] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#D4AF37]" /> AI Summary
                </button>
                <button
                  onClick={() => setActiveTab('ai-coach')}
                  className="px-2.5 py-1 bg-white/5 hover:bg-[#D4AF37]/10 border border-white/10 hover:border-[#D4AF37]/30 text-xs font-semibold text-[#E0E0E6] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Brain className="w-3 h-3 text-[#D4AF37]" /> Flashcards
                </button>
                <button
                  onClick={() => setActiveTab('ai-coach')}
                  className="px-2.5 py-1 bg-white/5 hover:bg-[#D4AF37]/10 border border-white/10 hover:border-[#D4AF37]/30 text-xs font-semibold text-[#E0E0E6] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-[#D4AF37]" /> Quiz Me
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Syllabus Chapters Tracker */}
      <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" /> Syllabus Chapters Tracker
            </h3>
            <p className="text-[10px] text-[#55555B] mt-0.5">Chapters completed as you finish their lessons.</p>
          </div>
          <span className="text-[11px] text-[#D4AF37] font-mono font-bold bg-[#D4AF37]/5 border border-[#D4AF37]/10 px-2 py-0.5 rounded">
            {progressMetrics.overall.completedLessons} / {progressMetrics.overall.totalLessons} Lessons
          </span>
        </div>

        {activeCourses.length === 0 ? (
          <p className="text-xs text-[#55555B] italic py-2">
            No active courses tracking progress. Add standard certification courses in the Study Center to unlock syllabus chapters.
          </p>
        ) : (
          <div className="space-y-4">
            {activeCourses.map(course => (
              <div key={course.id} className="space-y-2">
                {activeCourses.length > 1 && (
                  <h4 className="text-[11px] font-bold text-white tracking-wide border-b border-white/5 pb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
                    {course.name}
                  </h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {course.sections.map((section, si) => {
                    const sectionId = `${course.id}-s${si}`;
                    const totalLessons = section.lessons.length;
                    const completedLessonsCount = section.lessons.filter(cl => state.completedLessons[cl.id]).length;
                    const isChapterFinished = totalLessons > 0 && completedLessonsCount === totalLessons;
                    const isChapterStarted = completedLessonsCount > 0;
                    const isExpanded = !!expandedSections[sectionId];

                    return (
                      <div 
                        key={sectionId} 
                        className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          isChapterFinished 
                            ? 'bg-[#0D1C13]/10 border-[#10B981]/15 shadow-[0_2px_8px_rgba(16,185,129,0.02)]' 
                            : isExpanded 
                              ? 'bg-[#171B24] border-white/10 shadow-lg' 
                              : 'bg-[#11141C]/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Chapter Row Header */}
                        <div 
                          onClick={() => toggleSection(sectionId)}
                          className="flex items-center justify-between p-3 cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Checkmark circle or percentage badge */}
                            {isChapterFinished ? (
                              <span className="w-5 h-5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] flex-shrink-0 animate-scaleIn">
                                <Check className="w-3 h-3 stroke-[3.5]" />
                              </span>
                            ) : isChapterStarted ? (
                              <span className="w-5 h-5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-[9px] font-mono font-bold flex-shrink-0">
                                {Math.round((completedLessonsCount / totalLessons) * 100)}%
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex-shrink-0" />
                            )}

                            <div className="min-w-0">
                              <span className={`block text-xs font-semibold truncate leading-snug transition-colors ${
                                isChapterFinished ? 'text-[#10B981] font-medium' : 'text-white'
                              }`}>
                                {section.name}
                              </span>
                              <span className="block text-[10px] text-[#94949C] mt-0.5 font-mono">
                                {completedLessonsCount} / {totalLessons} lessons
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 pl-2">
                            {isChapterFinished && (
                              <span className="text-[8px] bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider scale-90">
                                Chapter Done
                              </span>
                            )}
                            <button className="text-[#94949C] hover:text-white p-1">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Lessons details */}
                        {isExpanded && (
                          <div className="border-t border-white/5 bg-[#11141C] p-2 space-y-1 divide-y divide-white/5 max-h-56 overflow-y-auto custom-scrollbar">
                            {section.lessons.map(lesson => {
                              const isLessonDone = !!state.completedLessons[lesson.id];
                              return (
                                <div 
                                  key={lesson.id} 
                                  className="flex items-center justify-between text-xs py-1.5 px-2 hover:bg-white/5 rounded transition-all"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onCompleteLesson) {
                                          onCompleteLesson(lesson.id, lesson.duration);
                                        } else {
                                          const newlyCompleted = !state.completedLessons[lesson.id];
                                          const updated = { ...state.completedLessons };
                                          if (newlyCompleted) {
                                            updated[lesson.id] = true;
                                          } else {
                                            delete updated[lesson.id];
                                          }
                                          onUpdateState({ ...state, completedLessons: updated });
                                        }
                                      }}
                                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                                        isLessonDone 
                                          ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-sm' 
                                          : 'border-white/20 hover:border-[#D4AF37] text-transparent'
                                      }`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </button>
                                    <span className={`truncate text-[11px] select-none ${
                                      isLessonDone ? 'text-[#55555B] line-through font-medium' : 'text-[#E0E0E6]'
                                    }`}>
                                      {lesson.title}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-[#55555B] font-mono flex-shrink-0 ml-2">
                                    {lesson.duration}m
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestones — progressMetrics.milestones was already fully computed
          (exam/target dates per active course, with daysRemaining/isMissed)
          but had no display anywhere in the app until now. */}
      {progressMetrics.milestones.length > 0 && (
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-5">
          <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold mb-3">Milestones</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {progressMetrics.milestones.map(m => (
              <div key={m.courseId} className={`p-3 rounded-lg border ${m.isMissed ? 'bg-[#1C1212] border-[#EF4444]/20' : 'bg-[#11141C] border-white/5'}`}>
                <span className="block text-xs font-bold text-white truncate">{m.courseName.split(':')[0]}</span>
                <span className={`block text-[11px] mt-0.5 ${m.isMissed ? 'text-[#FCA5A5]' : 'text-[#94949C]'}`}>
                  {m.isMissed ? `Target date passed (was ${m.targetDateStr})` : `${m.daysRemaining} day${m.daysRemaining === 1 ? '' : 's'} until ${m.targetDateStr}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Academic Operations & Internship CRM */}
      {profile.isStudent && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/5 pb-6 mb-2" id="academic-operations-hub">
          {/* 1. Academic Status & Advising Card */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs uppercase tracking-wider text-[#94949C] font-bold flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-[#D4AF37]" /> Performance & Learning Standing
                </h4>
                {profile.expectedGraduation && (
                  <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-1.5 py-0.5 rounded">
                    Grad: {profile.expectedGraduation}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Major & Institution</span>
                  <span className="text-xs font-bold text-white block mt-0.5">{profile.major || 'Field of Study'}</span>
                  <span className="text-[11px] text-[#94949C] block mt-0.5">{profile.university || 'University Name'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2 bg-[#11141C] border border-white/5 rounded-lg">
                    <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Current GPA</span>
                    <span className="text-sm font-mono font-bold text-[#D4AF37] block mt-0.5">{profile.currentGpa || 'Not Set'}</span>
                  </div>
                  <div className="p-2 bg-[#11141C] border border-white/5 rounded-lg">
                    <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Semester</span>
                    <span className="text-xs font-semibold text-white block mt-0.5 truncate" title={profile.currentSemester}>
                      {profile.currentSemester || 'Not Set'}
                    </span>
                  </div>
                </div>

                {profile.currentCourses && (
                  <div className="pt-1">
                    <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block mb-1">Current Courses</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.currentCourses.split(',').map((c, idx) => (
                        <span 
                          key={idx} 
                          onClick={() => {
                            setSelectedCourseName(c.trim());
                          }}
                          className="text-[9.5px] bg-white/5 border border-white/10 hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5 text-[#E0E0E6] px-1.5 py-0.5 rounded font-mono truncate max-w-full cursor-pointer transition-colors"
                          title="Click to open Course Companion"
                        >
                          {c.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
              {/* Launcher Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCalendarOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-[#171B24] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 text-[#D4AF37] text-[10.5px] font-semibold rounded-lg cursor-pointer transition-all"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calendar ({profile.academicEvents?.length || 0})</span>
                </button>
                <button
                  onClick={() => {
                    const firstCourse = profile.currentCourses?.split(',')[0]?.trim();
                    if (firstCourse) {
                      setSelectedCourseName(firstCourse);
                    } else {
                      setSelectedCourseName('');
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/5 border border-white/10 hover:border-white/20 text-[#E0E0E6] text-[10.5px] font-semibold rounded-lg cursor-pointer transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Companion</span>
                </button>
              </div>

              <div>
                <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider block mb-1">Advisor Intelligence Advice</span>
                <p className="text-[11px] text-[#94949C] leading-relaxed italic">
                  {(() => {
                    if (!profile.currentGpa) {
                      return "Add your GPA in Preferences/Roadmap parameters to unlock customized internship, certification, and graduate school advising.";
                    }
                    const gpaNum = parseFloat(profile.currentGpa);
                    const isOutOfFive = profile.currentGpa.includes('/ 5') || profile.currentGpa.includes('/5') || gpaNum > 4.0;
                    const normalizedGpa = isOutOfFive ? (gpaNum / 5) * 4 : gpaNum;

                    if (normalizedGpa >= 3.6) {
                      return `🏆 Stellar academic standing (${profile.currentGpa}). You are exceptionally positioned for top-tier research fellowships, competitive summer internships, and direct PhD programs. Focus on building portfolio-backed project proof.`;
                    } else if (normalizedGpa >= 3.0) {
                      return `📈 Solid GPA profile (${profile.currentGpa}). Strengthen your applications by completing 2+ verified professional certifications in the Academy to prove direct industrial competency.`;
                    } else {
                      return `💡 Strategic recommendation (${profile.currentGpa}). Build a highly visible GitHub project list and write custom portfolios to offset GPA screening in corporate and IT recruiter pipelines.`;
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Internship Application Tracker CRM */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-[#94949C] font-bold mb-3 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#D4AF37]" /> Internship Application Tracker
              </h4>
              <p className="text-[11px] text-[#94949C] leading-relaxed mb-4">
                Track your active recruiting funnel on-the-fly. Keep counts synced to receive smart performance feedback.
              </p>

              <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-4 mb-4">
                {/* Applications Column */}
                <div className="flex flex-col items-center p-2.5 bg-[#11141C] border border-white/5 rounded-xl">
                  <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider text-center">Applied</span>
                  <span className="text-xl font-mono font-bold text-white my-1">{profile.internshipApps || 0}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          onUpdateProfile({
                            ...profile,
                            internshipApps: Math.max(0, (profile.internshipApps || 0) - 1)
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-[#94949C] flex items-center justify-center cursor-pointer hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          onUpdateProfile({
                            ...profile,
                            internshipApps: (profile.internshipApps || 0) + 1
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Interviews Column */}
                <div className="flex flex-col items-center p-2.5 bg-[#11141C] border border-white/5 rounded-xl">
                  <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider text-center">Interviews</span>
                  <span className="text-xl font-mono font-bold text-white my-1">{profile.internshipInterviews || 0}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          onUpdateProfile({
                            ...profile,
                            internshipInterviews: Math.max(0, (profile.internshipInterviews || 0) - 1)
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-[#94949C] flex items-center justify-center cursor-pointer hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          const currentInterviews = profile.internshipInterviews || 0;
                          const currentApps = profile.internshipApps || 0;
                          onUpdateProfile({
                            ...profile,
                            internshipInterviews: currentInterviews + 1,
                            internshipApps: currentApps <= currentInterviews ? currentInterviews + 1 : currentApps
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Offers Column */}
                <div className="flex flex-col items-center p-2.5 bg-[#11141C] border border-white/5 rounded-xl">
                  <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider text-center">Offers</span>
                  <span className="text-xl font-mono font-bold text-emerald-400 my-1">{profile.internshipOffers || 0}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          onUpdateProfile({
                            ...profile,
                            internshipOffers: Math.max(0, (profile.internshipOffers || 0) - 1)
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-[#94949C] flex items-center justify-center cursor-pointer hover:text-white"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (onUpdateProfile) {
                          const currentOffers = profile.internshipOffers || 0;
                          const currentInterviews = profile.internshipInterviews || 0;
                          const currentApps = profile.internshipApps || 0;
                          onUpdateProfile({
                            ...profile,
                            internshipOffers: currentOffers + 1,
                            internshipInterviews: currentInterviews <= currentOffers ? currentOffers + 1 : currentInterviews,
                            internshipApps: currentApps <= currentOffers ? currentOffers + 1 : currentApps
                          });
                        }
                      }}
                      className="w-5 h-5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Conversion Metrics */}
              <div className="grid grid-cols-2 gap-3 text-center text-[10.5px]">
                <div className="bg-[#0B0D12] p-2 rounded-lg border border-white/5">
                  <span className="text-[#94949C] block text-[9px] font-bold uppercase tracking-wider">Callback Rate</span>
                  <span className="font-mono text-sm font-bold text-white block mt-0.5">
                    {profile.internshipApps ? Math.round(((profile.internshipInterviews || 0) / profile.internshipApps) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-[#0B0D12] p-2 rounded-lg border border-white/5">
                  <span className="text-[#94949C] block text-[9px] font-bold uppercase tracking-wider">Offer Success</span>
                  <span className="font-mono text-sm font-bold text-emerald-400 block mt-0.5">
                    {profile.internshipInterviews ? Math.round(((profile.internshipOffers || 0) / profile.internshipInterviews) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
              <button
                onClick={() => setCrmOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-95 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Open Internship CRM ({profile.internshipApplications?.length || 0})</span>
              </button>

              <div className="text-[11px] text-[#94949C] italic">
                {(() => {
                  const apps = profile.internshipApps || 0;
                  const interviews = profile.internshipInterviews || 0;
                  const offers = profile.internshipOffers || 0;

                  if (offers > 0) {
                    return "🎉 Mission accomplished! Leverage your active learning roadmap to acquire critical target skills before your start date.";
                  } else if (interviews > 0) {
                    return "🚀 Interviews scheduled! Consult with our AI Coach or practice mock-interview scenarios in your target curriculum slots.";
                  } else if (apps > 5) {
                    return "📁 Applications are active. Refine your portfolio projects with certification credentials to increase recruiter callback velocity.";
                  } else {
                    return "🎯 Tap the + buttons above to log applications as you submit them, or use the CRM to manage status logs, locations, notes, and dates.";
                  }
                })()}
              </div>
            </div>
          </div>

          {/* 3. Capstone & Thesis Advisor */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-wider text-[#94949C] font-bold flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#D4AF37]" /> Capstone / Thesis Advisor
                </h4>
                <button
                  onClick={() => setEditingCapstone(!editingCapstone)}
                  className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{editingCapstone ? 'View Plan' : 'Edit Plan'}</span>
                </button>
              </div>

              {!editingCapstone ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Project Title / Theme</span>
                    <span className="text-xs font-bold text-white block mt-0.5">{profile.capstoneTopic || 'Not set (e.g. AI-Powered Autonomous Rover)'}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Supervisor</span>
                      <span className="text-xs font-semibold text-[#E0E0E6] block mt-0.5 truncate">{profile.capstoneSupervisor || 'Not Set'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Deadline</span>
                      <span className="text-xs font-mono text-[#D4AF37] block mt-0.5">{profile.capstoneDeadline || 'Not Set'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Development Stage</span>
                    <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#171B24] text-[#D4AF37] border border-[#D4AF37]/25 capitalize">
                      {(profile.capstoneStatus || 'not_started').replace('_', ' ')}
                    </div>
                  </div>

                  {(profile.capstoneDeliverables || profile.capstoneMilestones) && (
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      {profile.capstoneDeliverables && (
                        <div>
                          <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Key Deliverables</span>
                          <p className="text-[10.5px] text-[#94949C] line-clamp-2 mt-0.5 whitespace-pre-line">{profile.capstoneDeliverables}</p>
                        </div>
                      )}
                      {profile.capstoneMilestones && (
                        <div>
                          <span className="text-[9px] text-[#55555B] font-bold uppercase tracking-wider block">Milestones</span>
                          <p className="text-[10.5px] text-[#94949C] line-clamp-2 mt-0.5 whitespace-pre-line">{profile.capstoneMilestones}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-[#11141C]/50 p-3 rounded-lg border border-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Project Topic</label>
                    <input
                      type="text"
                      value={profile.capstoneTopic || ''}
                      onChange={e => {
                        if (onUpdateProfile) {
                          onUpdateProfile({ ...profile, capstoneTopic: e.target.value });
                        }
                      }}
                      placeholder="e.g. AI-Powered Autonomous Rover"
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Supervisor Name</label>
                    <input
                      type="text"
                      value={capstoneSupervisor}
                      onChange={e => setCapstoneSupervisor(e.target.value)}
                      placeholder="e.g. Dr. Sarah Al-Saud"
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Target Deadline</label>
                    <input
                      type="date"
                      value={capstoneDeadline}
                      onChange={e => setCapstoneDeadline(e.target.value)}
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Stage Status</label>
                    <select
                      value={profile.capstoneStatus || 'not_started'}
                      onChange={e => {
                        if (onUpdateProfile) {
                          onUpdateProfile({ ...profile, capstoneStatus: e.target.value });
                        }
                      }}
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="planning">Planning Phase</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Deliverables List</label>
                    <textarea
                      rows={2}
                      value={capstoneDeliverables}
                      onChange={e => setCapstoneDeliverables(e.target.value)}
                      placeholder="List deliverables (e.g., 1. System Spec, 2. Design Doc)"
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-[#55555B] font-bold uppercase tracking-wider block">Target Milestones</label>
                    <textarea
                      rows={2}
                      value={capstoneMilestones}
                      onChange={e => setCapstoneMilestones(e.target.value)}
                      placeholder="Outline deadlines (e.g., Nov 15: Proposal, Feb 1: MVP)"
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveCapstone}
                      className="flex-1 py-1.5 bg-[#D4AF37] hover:bg-[#B8932D] text-black font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Save Details
                    </button>
                    <button
                      onClick={() => setEditingCapstone(false)}
                      className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <span className="text-[9px] text-[#D4AF37] font-bold uppercase tracking-wider block mb-1">Capstone Companion Advice</span>
              <p className="text-[11px] text-[#94949C] leading-relaxed italic">
                {(() => {
                  const status = profile.capstoneStatus || 'not_started';
                  if (status === 'completed') {
                    return "🎓 Masterfully completed! Ensure you package your source repository with a clean README, dynamic architecture diagrams, and publish it on LinkedIn.";
                  } else if (status === 'in_progress') {
                    return "🛠️ Design and iteration in full swing. Align your weekly learning goals with specific coding sprints or experimental test runs.";
                  } else if (status === 'planning') {
                    return "💡 Research and scoping phase. Clearly define your system requirements, gather reference papers, and finalize advisor sign-offs early.";
                  } else {
                    return "📝 Type your project's target topic above to unlock tailored milestones, scoping checklists, and development guidelines.";
                  }
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- Student OS Overlay Modals --- */}

      {/* A. Academic Calendar Modal */}
      {calendarOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171B24] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative flex flex-col gap-4 animate-scaleIn">
            <button 
              onClick={() => setCalendarOpen(false)}
              className="absolute top-4 right-4 text-[#94949C] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Calendar className="text-[#D4AF37] w-5 h-5" />
                <span>Schedule & Deadlines Manager</span>
              </h3>
              <p className="text-xs text-[#94949C] mt-1">Track key exams, project deliverables, and study windows to contextualize AI recommendations.</p>
            </div>

            {/* Add Event Form */}
            <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3">
              <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider block">Add New Schedule Milestone</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-[#55555B] font-bold uppercase">Event Title</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="e.g. Operating Systems Midterm"
                    className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-[#55555B] font-bold uppercase">Event Type</label>
                  <select
                    value={eventType}
                    onChange={e => setEventType(e.target.value as any)}
                    className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                  >
                    <option value="midterm">Midterm Exam</option>
                    <option value="final">Final Exam</option>
                    <option value="deadline">Project Deadline</option>
                    <option value="presentation">Presentation</option>
                    <option value="internship_start">Internship Start</option>
                    <option value="other">Other Event</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-[#55555B] font-bold uppercase">Target Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-[#55555B] font-bold uppercase">Quick Notes</label>
                  <input
                    type="text"
                    value={eventNotes}
                    onChange={e => setEventNotes(e.target.value)}
                    placeholder="e.g. Scope: chapters 1-4"
                    className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                  />
                </div>
              </div>
              <button
                onClick={handleAddAcademicEvent}
                className="w-full py-2 bg-[#D4AF37] hover:bg-[#B8932D] text-black font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                + Schedule Event on Calendar
              </button>
            </div>

            {/* Scheduled Events List */}
            <div className="space-y-2">
              <span className="text-[10px] text-[#55555B] uppercase font-bold tracking-wider block">Upcoming Scheduled Events</span>
              {(profile.academicEvents || []).length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B] italic">
                  No academic events scheduled yet. Add exams or project milestones above to populate your academic scheduler.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {profile.academicEvents?.map(event => {
                    const daysLeft = Math.ceil((new Date(event.date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                    const isUpcoming = daysLeft >= 0;

                    let typeBadgeClass = 'bg-white/5 text-[#E0E0E6] border border-white/10';
                    if (event.type === 'midterm') typeBadgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    if (event.type === 'final') typeBadgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
                    if (event.type === 'deadline') typeBadgeClass = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
                    if (event.type === 'presentation') typeBadgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                    if (event.type === 'internship_start') typeBadgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-[#0B0D12] border border-white/5 rounded-xl hover:border-white/10 transition-all">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[280px]">{event.title}</span>
                            <span className={`text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded capitalize ${typeBadgeClass}`}>
                              {event.type.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-[10.5px]">
                            <span className="font-mono text-[#D4AF37]">{event.date}</span>
                            {event.notes && (
                              <span className="text-[#94949C] truncate max-w-[250px]">— {event.notes}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono font-semibold ${isUpcoming ? 'text-emerald-400' : 'text-[#55555B]'}`}>
                            {isUpcoming ? `${daysLeft}d left` : 'Passed'}
                          </span>
                          <button
                            onClick={() => handleDeleteAcademicEvent(event.id)}
                            className="text-[#55555B] hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B. Course Companion Modal */}
      {selectedCourseName !== null && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171B24] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative flex flex-col gap-4 animate-scaleIn">
            <button 
              onClick={() => setSelectedCourseName(null)}
              className="absolute top-4 right-4 text-[#94949C] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <BookOpen className="text-[#D4AF37] w-5 h-5" />
                <span>University Course Companion</span>
              </h3>
              <p className="text-xs text-[#94949C] mt-1">Track specific class syllabus elements, manage notes, homework assignments, exam coverage, and consult the AI Coach tutor.</p>
            </div>

            {/* Course Selector Dropdown */}
            <div className="space-y-1 bg-[#11141C] p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider">Active Course Under Review</span>
              <select
                value={selectedCourseName}
                onChange={e => setSelectedCourseName(e.target.value)}
                className="bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 min-w-[200px]"
              >
                <option value="">-- Select Current Course --</option>
                {profile.currentCourses?.split(',').map((c, idx) => (
                  <option key={idx} value={c.trim()}>{c.trim()}</option>
                ))}
              </select>
            </div>

            {selectedCourseName === "" ? (
              <div className="text-center py-10 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B] italic">
                Please select an active course to review or configure current courses in your profile parameters.
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white border-b border-white/5 pb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
                  {selectedCourseName} Overview
                </h4>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Notes Area */}
                  <div className="bg-[#0B0D12] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-[180px]">
                    <div className="space-y-1">
                      <span className="text-[9.5px] text-[#55555B] uppercase font-bold tracking-wider flex items-center gap-1"><FileText className="w-3 h-3 text-[#D4AF37]" /> Class Notes & Scribbles</span>
                      <textarea
                        rows={5}
                        value={courseNotes}
                        onChange={e => setCourseNotes(e.target.value)}
                        placeholder="Key concepts, advisor hints, or quick reminders..."
                        className="w-full bg-transparent border-0 text-[11px] text-white focus:outline-none resize-none custom-scrollbar text-xs leading-normal mt-1"
                      />
                    </div>
                    <button
                      onClick={handleSaveCourseProgress}
                      className="w-full py-1 bg-white/5 hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-bold text-[10px] rounded transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Save Notes
                    </button>
                  </div>

                  {/* Assignments Area */}
                  <div className="bg-[#0B0D12] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-[180px]">
                    <div className="space-y-1">
                      <span className="text-[9.5px] text-[#55555B] uppercase font-bold tracking-wider flex items-center gap-1"><ListTodo className="w-3 h-3 text-[#D4AF37]" /> Assignments & Deliverables</span>
                      <textarea
                        rows={5}
                        value={courseAssignments}
                        onChange={e => setCourseAssignments(e.target.value)}
                        placeholder="Homework 2: due Friday, Lab report 3 spec..."
                        className="w-full bg-transparent border-0 text-[11px] text-white focus:outline-none resize-none custom-scrollbar text-xs leading-normal mt-1"
                      />
                    </div>
                    <button
                      onClick={handleSaveCourseProgress}
                      className="w-full py-1 bg-white/5 hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-bold text-[10px] rounded transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Save Homework
                    </button>
                  </div>

                  {/* Exam Dates Area */}
                  <div className="bg-[#0B0D12] border border-white/5 rounded-xl p-3 flex flex-col justify-between h-[180px]">
                    <div className="space-y-1">
                      <span className="text-[9.5px] text-[#55555B] uppercase font-bold tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3 text-[#D4AF37]" /> Exam Dates & Scope</span>
                      <textarea
                        rows={5}
                        value={courseExamDates}
                        onChange={e => setCourseExamDates(e.target.value)}
                        placeholder="Midterm on Oct 14. Covers chapters 1-4. Multiple choice..."
                        className="w-full bg-transparent border-0 text-[11px] text-white focus:outline-none resize-none custom-scrollbar text-xs leading-normal mt-1"
                      />
                    </div>
                    <button
                      onClick={handleSaveCourseProgress}
                      className="w-full py-1 bg-white/5 hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-bold text-[10px] rounded transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Save Exam Scope
                    </button>
                  </div>
                </div>

                {/* AI Tutor explainer */}
                <div className="bg-gradient-to-br from-[#171B24] to-[#16120E] border border-[#D4AF37]/20 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> AI Coach Concept Tutor
                    </span>
                    <span className="text-[9px] text-[#55555B] uppercase font-mono">Integrated Course Assistant</span>
                  </div>

                  <p className="text-xs text-[#94949C]">Type any difficult syllabus topic or theory. The AI Coach will break it down cleanly with simple analogies, a core definition, and a self-test question.</p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiExplainConcept}
                      onChange={e => setAiExplainConcept(e.target.value)}
                      placeholder="e.g. Page Faults, Dijkstra's Algorithm, Calculus Limits..."
                      className="flex-1 bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                    <button
                      onClick={handleExplainConcept}
                      disabled={aiExplainLoading || !aiExplainConcept.trim()}
                      className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white hover:opacity-90 px-4 py-2 text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1"
                    >
                      {aiExplainLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Explaining...</span>
                        </>
                      ) : (
                        <span>Explain with AI</span>
                      )}
                    </button>
                  </div>

                  {aiExplainError && (
                    <div className="p-3 bg-[#1C1212] border border-red-500/25 text-red-400 text-xs rounded-lg">
                      {aiExplainError}
                    </div>
                  )}

                  {aiExplainResult && (
                    <div className="p-4 bg-[#0B0D12] border border-white/5 rounded-lg max-h-[220px] overflow-y-auto custom-scrollbar">
                      <div className="text-xs text-[#E0E0E6] leading-relaxed whitespace-pre-wrap font-sans">{aiExplainResult}</div>
                      <div className="text-[8px] text-[#55555B] uppercase font-mono tracking-wider mt-3 border-t border-white/5 pt-2">
                        Grounded AI Executive Tutor Response
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* C. Internship Application CRM Modal */}
      {crmOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171B24] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 relative flex flex-col gap-4 animate-scaleIn">
            <button 
              onClick={() => setCrmOpen(false)}
              className="absolute top-4 right-4 text-[#94949C] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Briefcase className="text-[#D4AF37] w-5 h-5" />
                <span>Internship Recruitment CRM</span>
              </h3>
              <p className="text-xs text-[#94949C] mt-1">Manage, filter, and track specific details for each internship lead in your dashboard funnel. Keep notes, interview dates, and company specs organized.</p>
            </div>

            {/* Split Screen Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form (5 cols) */}
              <div className="lg:col-span-5 bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3 h-fit">
                <span className="text-[10px] text-[#D4AF37] uppercase font-bold tracking-wider block">
                  {editingAppId ? '✍️ Edit Active Application' : '📥 Log New Application'}
                </span>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Company Name *</label>
                      <input
                        type="text"
                        value={newCompany}
                        onChange={e => setNewCompany(e.target.value)}
                        placeholder="e.g. Google"
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Position / Role *</label>
                      <input
                        type="text"
                        value={newPosition}
                        onChange={e => setNewPosition(e.target.value)}
                        placeholder="e.g. Software Engineer Intern"
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Location</label>
                      <input
                        type="text"
                        value={newLocation}
                        onChange={e => setNewLocation(e.target.value)}
                        placeholder="e.g. Riyadh, KSA"
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Applied Date</label>
                      <input
                        type="date"
                        value={newAppliedDate}
                        onChange={e => setNewAppliedDate(e.target.value)}
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Funnel Status</label>
                      <select
                        value={newAppStatus}
                        onChange={e => setNewAppStatus(e.target.value as any)}
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30"
                      >
                        <option value="applied">Applied</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="offered">Offered</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-[#55555B] font-bold uppercase">Interview Date</label>
                      <input
                        type="date"
                        value={newInterviewDate}
                        onChange={e => setNewInterviewDate(e.target.value)}
                        className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-[#55555B] font-bold uppercase">Recruiter Notes & Contact</label>
                    <textarea
                      rows={2}
                      value={newNotes}
                      onChange={e => setNewNotes(e.target.value)}
                      placeholder="e.g. Spoke to HR Sarah. Technical interview consists of 1 Leetcode medium."
                      className="w-full bg-[#171B24] border border-white/5 text-xs text-white rounded-lg p-2 focus:outline-none focus:border-[#D4AF37]/30 resize-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveInternshipApp}
                      disabled={!newCompany || !newPosition}
                      className="flex-1 py-2 bg-[#D4AF37] hover:bg-[#B8932D] disabled:opacity-40 text-black font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
                    >
                      {editingAppId ? 'Update Lead' : 'Save Application'}
                    </button>
                    {editingAppId && (
                      <button
                        onClick={() => {
                          setEditingAppId(null);
                          setNewCompany('');
                          setNewPosition('');
                          setNewLocation('');
                          setNewAppliedDate('');
                          setNewAppStatus('applied');
                          setNewInterviewDate('');
                          setNewNotes('');
                        }}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: List & Filter (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#55555B] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={crmSearch}
                      onChange={e => setCrmSearch(e.target.value)}
                      placeholder="Search by company or role..."
                      className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg pl-8 pr-2.5 py-2 focus:outline-none focus:border-[#D4AF37]/30"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                  {(() => {
                    const filtered = (profile.internshipApplications || []).filter(app => {
                      const matchStr = `${app.company} ${app.position} ${app.location || ''}`.toLowerCase();
                      return matchStr.includes(crmSearch.toLowerCase());
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-12 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B] italic">
                          No internship applications match your search or have been logged yet. Fill out the recruiter log form to get started.
                        </div>
                      );
                    }

                    return filtered.map(app => {
                      let statusBadge = 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20';
                      if (app.status === 'interviewing') statusBadge = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                      if (app.status === 'offered') statusBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                      if (app.status === 'rejected') statusBadge = 'bg-red-500/10 text-red-400 border border-red-500/20';

                      return (
                        <div key={app.id} className="p-3.5 bg-[#11141C] border border-white/5 rounded-xl hover:border-white/10 transition-all flex flex-col gap-2 relative group">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-white text-xs block">{app.company}</span>
                              <span className="text-[#94949C] text-[11px] block mt-0.5">{app.position}</span>
                            </div>
                            <span className={`text-[9px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${statusBadge}`}>
                              {app.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-[#55555B] mt-1">
                            {app.location && (
                              <span>📍 {app.location}</span>
                            )}
                            {app.appliedDate && (
                              <span>📅 Applied: <span className="font-mono text-[#94949C]">{app.appliedDate}</span></span>
                            )}
                            {app.interviewDate && (
                              <span className="col-span-2 text-[#D4AF37] font-medium">💬 Interview: <span className="font-mono">{app.interviewDate}</span></span>
                            )}
                          </div>

                          {app.notes && (
                            <p className="text-[10.5px] text-[#94949C] bg-[#171B24]/50 p-2 rounded border border-white/5 mt-1 whitespace-pre-line leading-relaxed">
                              {app.notes}
                            </p>
                          )}

                          <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-white/5">
                            <button
                              onClick={() => handleEditInternshipAppClick(app)}
                              className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Details</span>
                            </button>
                            <button
                              onClick={() => handleDeleteInternshipApp(app.id)}
                              className="text-[10px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Rings & Quick Information */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Career Capital & Progress Panel */}
        <div className="md:col-span-6 bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[#94949C] font-bold mb-3 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#D4AF37]" /> Career Capital Hub
            </h3>
            
            {/* Visual Dials/Gauges */}
            <div className="grid grid-cols-3 gap-3 items-center justify-items-center mb-5 border-b border-white/5 pb-4">
              {/* Progress Ring */}
              <div className="text-center">
                <div className="relative flex items-center justify-center">
                  <svg width="76" height="76" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                    <circle
                      cx="55"
                      cy="55"
                      r="46"
                      fill="none"
                      stroke="url(#progressGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - overallPercentage / 100)}
                      transform="rotate(-90 55 55)"
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                    </defs>
                    <text x="55" y="62" textAnchor="middle" className="font-mono text-lg font-bold fill-white">{overallPercentage}%</text>
                  </svg>
                </div>
                <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider mt-1 block">Progress</span>
              </div>

              {/* Career Capital/Readiness Ring */}
              <div className="text-center">
                <div className="relative flex items-center justify-center">
                  <svg width="76" height="76" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                    <circle
                      cx="55"
                      cy="55"
                      r="46"
                      fill="none"
                      stroke="url(#goldGradRing)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - careerCapitalScore / 100)}
                      transform="rotate(-90 55 55)"
                      className="transition-all duration-500 animate-[pulse_3s_infinite]"
                    />
                    <defs>
                      <linearGradient id="goldGradRing" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#B8932D" />
                        <stop offset="100%" stopColor="#D4AF37" />
                      </linearGradient>
                    </defs>
                    <text x="55" y="62" textAnchor="middle" className="font-mono text-lg font-bold fill-[#D4AF37]">{careerCapitalScore}%</text>
                  </svg>
                </div>
                <span className="text-[9px] text-[#D4AF37] uppercase font-bold tracking-wider mt-1 block">Readiness</span>
              </div>

              {/* Daily Learning Goal Progress Ring */}
              <div className="text-center">
                <div className="relative flex items-center justify-center">
                  <svg width="76" height="76" viewBox="0 0 110 110">
                    <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                    <circle
                      cx="55"
                      cy="55"
                      r="46"
                      fill="none"
                      stroke="url(#dailyGoalGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - dailyGoalProgressPct / 100)}
                      transform="rotate(-90 55 55)"
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="dailyGoalGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                    <text x="55" y="62" textAnchor="middle" className="font-mono text-lg font-bold fill-emerald-400">{dailyGoalProgressPct}%</text>
                  </svg>
                </div>
                <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider mt-1 block">Daily Goal</span>
              </div>
            </div>

            {/* Checklist of what it is Based On (Requested verbatim by the user) */}
            <div className="space-y-2">
              <span className="text-[9.5px] uppercase text-[#55555B] font-bold tracking-wider block">Career Capital Criteria</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between text-[10.5px] p-2 bg-[#11141C] border border-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${totalSkillsCount > 0 ? "text-emerald-500" : "text-[#55555B]"}`} />
                    <span className="text-[#E0E0E6] truncate">Skills acquired</span>
                  </div>
                  <span className="font-mono font-bold text-[#D4AF37] ml-1">{totalSkillsCount} verified</span>
                </div>

                <div className="flex items-center justify-between text-[10.5px] p-2 bg-[#11141C] border border-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${certsCompleted > 0 ? "text-emerald-500" : "text-[#55555B]"}`} />
                    <span className="text-[#E0E0E6] truncate">Certs done</span>
                  </div>
                  <span className="font-mono font-bold text-[#D4AF37] ml-1">{certsCompleted}/{totalCerts || 1}</span>
                </div>

                <div className="flex items-center justify-between text-[10.5px] p-2 bg-[#11141C] border border-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${roadmapProgress > 0 ? "text-emerald-500" : "text-[#55555B]"}`} />
                    <span className="text-[#E0E0E6] truncate">Roadmap progress</span>
                  </div>
                  <span className="font-mono font-bold text-[#D4AF37] ml-1">{roadmapProgress}%</span>
                </div>

                <div className="flex items-center justify-between text-[10.5px] p-2 bg-[#11141C] border border-white/5 rounded-lg">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${achievedMilestones > 0 ? "text-emerald-500" : "text-[#55555B]"}`} />
                    <span className="text-[#E0E0E6] truncate">Milestones met</span>
                  </div>
                  <span className="font-mono font-bold text-[#D4AF37] ml-1">{achievedMilestones} met</span>
                </div>
              </div>

              {/* Daily Learning Goal Status Line */}
              <div className="flex items-center justify-between text-[11px] p-2.5 bg-[#0A1612] border border-emerald-500/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${todayStudyMinutes >= dailyGoalMinutes ? "text-emerald-400 animate-bounce" : "text-emerald-500/40"}`} />
                  <div>
                    <span className="font-semibold text-white block leading-tight">Daily Goal: {dailyGoalMinutes}m</span>
                    <span className="text-[9px] text-[#94949C]">Set study time target in Preferences</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 block leading-tight">{todayStudyMinutes}m logged</span>
                  <span className="text-[9px] text-[#55555B]">{todayStudyMinutes >= dailyGoalMinutes ? "Completed! 🎉" : `${Math.max(0, dailyGoalMinutes - todayStudyMinutes)}m left`}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-white/5">
            {activeCourses.map(course => {
              const stats = progressMetrics.courses[course.id];
              const done = stats ? stats.completedLessons : 0;
              const total = stats ? stats.totalLessons : 0;
              return (
                <div key={course.id} className="text-[10px] text-[#94949C] font-mono mt-1 first:mt-0 flex justify-between">
                  <span>{getCourseShortLabel(course)} Modules:</span>
                  <span className="text-[#D4AF37] font-bold">{done}/{total} Done</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weakest / Strongest */}
        <div className="md:col-span-6 bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold mb-3">Topic & Focus Metrics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(profile.learningGoals || []).length === 0 ? (
              <div className="p-4 bg-[#171B24] border border-white/5 rounded-lg col-span-2 text-center text-xs text-[#55555B] italic">
                Activate path tracks or custom targets in the Study Center to view priority and progress focus insights.
              </div>
            ) : (
              <>
                <div className="p-3 bg-[#1C1212] border border-[#EF4444]/20 rounded-lg">
                  <span className="block text-[10px] text-[#EF4444] font-semibold uppercase tracking-wider">Current Focus</span>
                  <span className="block text-sm font-bold text-white mt-1 truncate">
                    {getFocusCourseName()}
                  </span>
                  <span className="text-[11px] text-[#94949C] mt-0.5 block">
                    {activeCourses.length > 0 ? 'Lagging syllabus path tracking active' : 'Target study slots booked'}
                  </span>
                </div>
                <div className="p-3 bg-[#0D1C13] border border-[#10B981]/20 rounded-lg">
                  <span className="block text-[10px] text-[#10B981] font-semibold uppercase tracking-wider">Active Targets</span>
                  <span className="block text-sm font-bold text-white mt-1 truncate">
                    {profile.learningGoals.length} Active
                  </span>
                  <span className="text-[11px] text-[#94949C] mt-0.5 block truncate">
                    {profile.learningGoals.join(', ')}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 text-xs text-[#94949C]">
            {profile.isStudent ? (
              <p>
                <span className="text-white font-medium">Learning & Growth Track:</span>{' '}
                <span className="text-[#D4AF37] font-semibold">{profile.major || 'Field of Study'}</span> at{' '}
                <span className="text-white font-bold">{profile.university || 'University'}</span> ({profile.academicYear || 'Current Year'})
              </p>
            ) : (
              <>
                <span className="text-white font-medium">Career Vision:</span> {profile.currentSalary || profile.targetSalary ? (
                  <>Current Salary <span className="text-[#D4AF37] font-semibold">{profile.currentSalary || 'Not Specified'}</span> → Target <span className="text-white font-bold">{profile.targetSalary || 'Not Specified'}</span></>
                ) : (
                  <span className="text-[#94949C] italic">Configure your current & target salary in Preferences to track career vision metrics.</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI Insight — per explicit scope, computed instantly from metrics
          already on this page (progressMetrics.pacing/.milestones, streak).
          Deliberately labeled and placed apart from the live AI Coach
          section below, which DOES make a network call — this card never
          does. */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> AI Insight
          </h3>
          <span className="text-[9px] text-[#55555B]">Instant · from your current metrics</span>
        </div>
        <p className="text-sm text-[#E0E0E6] leading-relaxed">{getAIInsight()}</p>
      </div>

      {/* Real-time AI Coach */}
      <div className="bg-gradient-to-br from-[#171B24] to-[#11141C] border border-[#D4AF37]/20 rounded-xl p-5 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Coach — Live
          </h3>
          <span className="text-[9px] text-[#55555B]">Secure Server Proxy</span>
        </div>
        <p className="text-xs text-[#94949C] mb-4">
          Click below to request a real-time progress audit from your built-in AI Coach, grounded in your live progress, schedule, and goals.
        </p>

        <button
          onClick={askAICoach}
          disabled={aiLoading}
          className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-90 active:scale-[0.98] transition-all text-white font-bold text-xs rounded-lg py-2.5 px-4 w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiLoading ? "Consulting AI Coach..." : "Ask AI Coach about my current progress"}
        </button>

        <button
          onClick={() => setActiveTab('ai-coach')}
          className="mt-2 w-full text-center text-[10px] text-[#94949C] hover:text-[#D4AF37] transition-colors underline underline-offset-2"
        >
          Open full AI Coach conversation →
        </button>

        {aiLoading && (
          <div className="mt-4 p-4 bg-[#0B0D12] border border-white/5 rounded-lg text-xs text-white">
            Thinking <span className="inline-flex gap-1 animate-pulse"><span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full"></span><span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full"></span><span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full"></span></span>
          </div>
        )}

        {aiResponse && (
          <div className="mt-4 p-4 bg-[#0B0D12] border border-white/5 rounded-lg">
            <div className="text-xs text-white leading-relaxed whitespace-pre-wrap font-sans">{aiResponse}</div>
            <div className="text-[9px] text-[#55555B] mt-3 border-t border-white/5 pt-2">
              AI Coach · Response compiled at {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}

        {aiError && (
          <div className="mt-4 p-4 bg-[#1C1212] border border-[#EF4444]/30 text-xs text-[#FCA5A5] rounded-lg">
            {aiError}
          </div>
        )}
      </div>

      {/* Smart Coach & Current Signal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Smart Coach (Rule-Based) */}
        <div className="bg-[#11141C] border border-white/5 rounded-xl p-5">
          <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold mb-3">Smart Coach Logs</h3>
          <div className="space-y-3">
            {smartPoints.map((pt, i) => (
              <div key={i} className="flex gap-3 text-xs leading-relaxed border-t border-white/5 pt-3 first:border-0 first:pt-0">
                <span className="text-base flex-shrink-0">{pt.icon}</span>
                <div>
                  <span className="block font-semibold text-white">{pt.title}</span>
                  <span className="text-[#94949C] mt-0.5 block">{pt.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Quote / Signal */}
        <div className="bg-[#11141C] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
          <h3 className="text-[10.5px] uppercase tracking-wider text-[#94949C] font-semibold mb-2">Today's Signal</h3>
          <div className="italic text-sm text-[#D4AF37] font-serif leading-relaxed my-auto py-2">
            "{getCoachingQuote()}"
          </div>
          <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center text-[10px] text-[#55555B]">
            <span>{profile.name}</span>
            <span>Study Path → {profile.targetJob}</span>
          </div>
        </div>
      </div>
    </div>
  )}

      {dashboardTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header description */}
          <div className="bg-[#11141C] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-xl" />
            <div className="space-y-1.5">
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#D4AF37]" /> Learning Analytics Control Center
              </h3>
              <p className="text-xs text-[#94949C] leading-relaxed max-w-2xl">
                This dashboard uses advanced mathematical formulas to compute study consistency, lesson velocity, and topic mastery. These metrics reflect your genuine learning signals, completely free of AI hallucinations or conversational noise.
              </p>
            </div>
          </div>

          {/* KPI Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Confidence Score Card */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-[#D4AF37]/20 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider block">Confidence Rating</span>
                  <span className="text-3xl font-bold text-white font-mono">{analytics.confidenceScore}%</span>
                </div>
                <span className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]">
                  <Brain className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <div className="w-full bg-[#11141C] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] h-full" style={{ width: `${analytics.confidenceScore}%` }}></div>
                </div>
                <span className="text-[9px] text-[#55555B] mt-1.5 block leading-tight">Derived from streak, consistency, pacing, and quiz scores.</span>
              </div>
            </div>

            {/* Study Consistency Card */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-[#10B981]/20 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider block">Consistency Index</span>
                  <span className="text-3xl font-bold text-white font-mono">{analytics.studyConsistency}%</span>
                </div>
                <span className="p-2 bg-[#10B981]/10 rounded-lg text-[#10B981]">
                  <CheckSquare className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4">
                <div className="w-full bg-[#11141C] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#10B981] h-full" style={{ width: `${analytics.studyConsistency}%` }}></div>
                </div>
                <span className="text-[9px] text-[#55555B] mt-1.5 block leading-tight">Reflects your study frequency over the past 28 days + streak bonus.</span>
              </div>
            </div>

            {/* Completion Velocity Card */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-blue-500/20 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider block">Lessons / Week</span>
                  <span className="text-3xl font-bold text-white font-mono">{analytics.completionVelocity}</span>
                </div>
                <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-[9px] text-[#55555B] leading-tight">Average completed per week.</span>
                <span className={`text-[10px] font-mono font-bold flex items-center ${analytics.completionVelocityTrend >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {analytics.completionVelocityTrend >= 0 ? '↑' : '↓'} {Math.abs(analytics.completionVelocityTrend)}%
                </span>
              </div>
            </div>

            {/* Weekly Study Minutes Card */}
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-purple-500/20 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#94949C] uppercase font-bold tracking-wider block">Weekly Volume</span>
                  <span className="text-3xl font-bold text-white font-mono">{analytics.weeklyStudyMinutes}m</span>
                </div>
                <span className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <Timer className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-[9px] text-[#55555B] leading-tight">Studied in last 7 days.</span>
                <span className={`text-[10px] font-mono font-bold flex items-center ${analytics.weeklyStudyMinutesTrend >= 0 ? 'text-[#10B981]' : 'text-red-400'}`}>
                  {analytics.weeklyStudyMinutesTrend >= 0 ? '↑' : '↓'} {Math.abs(analytics.weeklyStudyMinutesTrend)}%
                </span>
              </div>
            </div>

          </div>

          {/* Secondary Bento Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Burnout Risk Card */}
            <div className="md:col-span-4 bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-orange-500/20 transition-all duration-300">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Heart className={`w-4 h-4 ${analytics.burnoutRisk > 60 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
                  Burnout Risk Meter
                </h4>
                <p className="text-[11px] text-[#94949C] leading-relaxed mb-4">
                  Monitors intense streaks, double-session days, and late-night study cycles to keep your routine sustainable.
                </p>
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-bold font-mono text-white">{analytics.burnoutRisk}%</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    analytics.burnoutRisk < 30 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                    analytics.burnoutRisk < 65 ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                    'bg-red-950 text-red-400 border border-red-500/20 animate-pulse'
                  }`}>
                    {analytics.burnoutRisk < 30 ? 'Healthy Pace' : analytics.burnoutRisk < 65 ? 'Moderate load' : 'Elevated Risk'}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-[#94949C] leading-snug italic">
                {analytics.burnoutRisk < 30 ? "✓ You are studying at a perfectly healthy, sustainable rhythm. Steady wins the race." :
                 analytics.burnoutRisk < 65 ? "⚠️ Moderate pacing. Be sure to schedule regular rest blocks between long modules." :
                 "🚨 High study density detected! Consider scheduling a resting day to recharge your mental battery."}
              </div>
            </div>

            {/* Revision Rate & Spaced Repetition */}
            <div className="md:col-span-4 bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-indigo-500/20 transition-all duration-300">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <RefreshCw className="w-4 h-4 text-indigo-400" />
                  Spaced Repetition
                </h4>
                <p className="text-[11px] text-[#94949C] leading-relaxed mb-4">
                  Measures the percentage of completed lessons that have been set with a revision date or completed.
                </p>
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-bold font-mono text-white">{analytics.revisionRate}%</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-500/20 rounded uppercase tracking-wider">
                    Retention Index
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-[#94949C] leading-snug">
                {analytics.revisionRate < 25 ? "Reviewing older lessons boosts neural retention. Set review dates inside completed Lesson cards." :
                 "Excellent retention hygiene! Regular active-recall prevents cognitive decay of key data concepts."}
              </div>
            </div>

            {/* Quiz Performance Overview */}
            <div className="md:col-span-4 bg-[#171B24] border border-white/5 rounded-xl p-5 flex flex-col justify-between hover:border-teal-500/20 transition-all duration-300">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Trophy className="w-4 h-4 text-teal-400" />
                  Quiz Metrics
                </h4>
                <p className="text-[11px] text-[#94949C] leading-relaxed mb-4">
                  Analyzes your aggregate success rate and average confidence across adaptive lesson quizzes.
                </p>
                {(() => {
                  const attempts = state.quizAttempts || [];
                  const correctCount = attempts.filter(a => a.correct).length;
                  const total = attempts.length;
                  const successRate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="text-4xl font-bold font-mono text-white">{successRate}%</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-950 text-teal-400 border border-teal-500/20 rounded uppercase tracking-wider">
                          Success Rate
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94949C] block font-mono">
                        {total} questions answered ({correctCount} correct)
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-[#94949C] leading-snug">
                {(state.quizAttempts || []).length === 0 ? "Unlock detailed quiz metrics by taking an Adaptive Quiz inside any active Lesson Card." :
                 "Your quiz performance directly feeds and refines your individual Topic Mastery scores below."}
              </div>
            </div>

          </div>

          {/* Topic Mastery breakdown Section */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-[#D4AF37]" />
                Topic Mastery &amp; Subject Index
              </h4>
              <p className="text-[11px] text-[#94949C] mt-0.5">
                Calculated dynamically based on completed syllabus lessons combined with adaptive quiz accuracy.
              </p>
            </div>

            {analytics.masteryByTopic.length === 0 ? (
              <p className="text-xs text-[#55555B] italic py-4 text-center">
                Complete lessons and quiz attempts to map topic mastery indices here.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.masteryByTopic.map((topic, i) => (
                  <div key={i} className="bg-[#11141C] border border-white/5 p-4 rounded-xl space-y-3 hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-bold text-white block truncate max-w-[250px]" title={topic.topic}>
                          {topic.topic}
                        </span>
                        <span className="text-[10px] text-[#94949C] font-mono block mt-0.5">
                          Progress: {topic.lessonsCompleted} / {topic.lessonsTotal} lessons
                        </span>
                      </div>
                      <span className="text-base font-bold font-mono text-[#D4AF37] bg-[#D4AF37]/5 px-2 py-0.5 border border-[#D4AF37]/10 rounded">
                        {topic.score}%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-[#55555B] font-mono">
                        <span>Mastery score</span>
                        <span>{topic.quizSuccessRate !== null ? `Quiz accuracy: ${topic.quizSuccessRate}%` : 'No quiz data yet'}</span>
                      </div>
                      <div className="w-full bg-[#171B24] h-2 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-[#B8932D] to-[#D4AF37] transition-all duration-500" 
                          style={{ width: `${topic.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
