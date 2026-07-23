import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StudyPlanState } from './services/Sync/types';
import { Profile } from './models/types';
import { loadStudyPlanState } from './models/studyPlanStateMigration';
import { loadProfile } from './models/profileMigration';
import { CourseCatalog } from './services/courseCatalog';
import { useAuth } from './auth/AuthProvider';
import AuthScreen from './components/AuthScreen';
import Onboarding from './components/Onboarding';
import {
  hasCloudProfile, loadCloudProfile, loadCloudProgress,
  saveCloudProfile, saveCloudProgress, migrateLocalToCloud,
} from './models/cloudPersistence';
import { legacyStateToUserProgress, userProgressToLegacyState } from './models/migrateLegacy';
import Dashboard from './components/Dashboard';

import { createSyncEngine, SyncScheduler, SupabaseSyncTransport, enqueueProfileChanges, evaluateSignOut, attemptSyncThenSignOut } from './services/Sync';
import SignOutGuardDialog from './components/SignOutGuardDialog';
import AICoach from './components/AICoach';
import FriendsTab from './components/FriendsTab';
import LegalHub from './components/LegalHub';
import Academy from './components/Academy';
import ProgressHub from './components/ProgressHub';
import SettingsHub from './components/SettingsHub';
import IntegratedAICoach from './components/IntegratedAICoach';
import MoreSheet from './components/MoreSheet';
import { 
  LayoutDashboard, 
  BarChart3, 
  Settings, 
  Sparkles, 
  BookOpen, 
  Users, 
  LogOut,
  LogIn,
  Compass,
  Calendar,
  Trophy,
  ClipboardList,
  Target,
  FileText,
  Search,
  Bell,
  Menu,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Brain,
  Radio
} from 'lucide-react';

const STORE_KEY = "ahmad_ledger_v3";
// Separate key, separate concern from STORE_KEY: STORE_KEY holds legacy
// per-lesson StudyPlanState (completedLessons/streak/etc). PROFILE_KEY holds
// the new generic Profile object. Kept as two independent localStorage
// entries for now rather than merging into one — see ARCHITECTURE.md §5 and
// the still-pending ROADMAP.md task "add schemaVersion + explicit migration
// function for localStorage", which is where these two get unified under one
// versioned schema. Splitting them now means this step can't accidentally
// corrupt the existing StudyPlanState data users already have saved.
const PROFILE_STORE_KEY = "study_plan_profile_v1";

const LEVELS = [
  { min: 0, name: "Analyst Trainee" },
  { min: 1000, name: "Analyst I" },
  { min: 2500, name: "Analyst II" },
  { min: 5000, name: "Senior Analyst" },
  { min: 10000, name: "Lead Analyst" },
  { min: 20000, name: "Analytics Manager" }
];

export default function App() {
  const { user, loading: authLoading, configured, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAICoachOpen, setIsAICoachOpen] = useState(true);
  const [studyCenterHighlightedLessonId, setStudyCenterHighlightedLessonId] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [state, setState] = useState<StudyPlanState>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORE_KEY);
    } catch (e) {
      console.error("Local storage error:", e);
    }

    let parsedRaw: any = null;
    if (saved) {
      try {
        parsedRaw = JSON.parse(saved);
      } catch (e) {
        parsedRaw = null; // corrupt JSON is treated the same as "no saved data" — loadStudyPlanState(null) returns a fresh default
      }
    }

    // Explicit, versioned migration (models/studyPlanStateMigration.ts) —
    // replaces the 13-line block of `parsedState.x = parsedState.x || {}`
    // patching and the separate ad-hoc PMI-PBA seed check that used to live
    // here directly. See ARCHITECTURE.md §5 / ROADMAP.md Phase 1.
    return loadStudyPlanState(parsedRaw);
  });

  // Save to LocalStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Could not write to local storage", e);
    }
  }, [state]);

  // Generic Profile object — see PROFILE_STORE_KEY comment above for why this
  // is a second, independent piece of state rather than folded into `state`.
  const [profile, setProfile] = useState<Profile>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(PROFILE_STORE_KEY);
    } catch (e) {
      console.error("Local storage error (profile):", e);
    }
    let parsedRaw: any = null;
    if (saved) {
      try { parsedRaw = JSON.parse(saved); } catch (e) { parsedRaw = null; }
    }
    return loadProfile(parsedRaw);
  });

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error("Could not write profile to local storage", e);
    }
  }, [profile]);

  // Synchronize i18n language with profile language
  useEffect(() => {
    const lang = profile.language || 'en';
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.documentElement.classList.add('rtl-arabic');
    } else {
      document.documentElement.classList.remove('rtl-arabic');
    }
  }, [profile.language, i18n]);

  // Keep profile email in sync with authenticated user email if authenticated
  useEffect(() => {
    if (user?.email && profile.email !== user.email) {
      setProfile(prev => ({ ...prev, email: user.email }));
    }
  }, [user?.email, profile.email]);

  // Sync custom courses with the CourseCatalog singleton
  useEffect(() => {
    CourseCatalog.setCustomCourses(profile.customCourses || []);
  }, [profile.customCourses]);

  // Sync Engine & Scheduler references (Milestone 2.6.1)
  const syncEngineRef = useRef<any>(null);
  const syncSchedulerRef = useRef<any>(null);
  const previousProfileRef = useRef<Profile>(profile);

  // Sign-out Guard dialog state (Milestone 2.6.4)
  const [showSignOutGuard, setShowSignOutGuard] = useState(false);
  const [pendingWritesCount, setPendingWritesCount] = useState(0);

  /**
   * Cloud load / one-time migration on sign-in. Fires exactly once per real
   * sign-in transition (dependency is [user?.id], not [user] — a new object
   * reference on every render would otherwise re-fire this constantly).
   *
   * Per approved scope (ARCHITECTURE.md §8.4): this is deliberately NOT a
   * merge. Either this account already has cloud data (existing user,
   * possibly a new device) and it becomes authoritative, or it doesn't
   * (first login for this account) and local data becomes its starting
   * point, pushed up once. No in-between reconciliation logic.
   */
  useEffect(() => {
    if (!configured || !user) {
      setCloudSyncState('idle');
      return;
    }
    let active = true;
    setCloudSyncState('loading');
    (async () => {
      const alreadyHasCloudData = await hasCloudProfile(user.id);
      if (!active) return;

      if (alreadyHasCloudData) {
        const [cloudProfile, cloudProgress] = await Promise.all([
          loadCloudProfile(user.id),
          loadCloudProgress(user.id),
        ]);
        if (!active) return;
        if (cloudProfile) setProfile(cloudProfile);
        setState(prev => userProgressToLegacyState(cloudProgress, prev));
      } else {
        // First login for this account: local (possibly guest) data becomes
        // this account's starting cloud data.
        await migrateLocalToCloud(user.id, profile, legacyStateToUserProgress(state));
        if (!active) return;
        setProfile(prev => ({ ...prev, id: user.id }));
      }
      if (active) setCloudSyncState('ready');
    })();
    return () => { active = false; };
    // Deliberately excluding `state`/`profile` from deps — this effect must
    // run once per sign-in, not every time local state changes (that's the
    // separate write-through effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, configured]);

  // Construct SyncEngine and SyncScheduler once signed in and cloud sync state is ready (Milestone 2.6.1 & 2.6.7)
  useEffect(() => {
    if (!configured || !user || cloudSyncState !== 'ready') {
      // Sign-out or not ready: tear down scheduler and nullify references
      if (syncSchedulerRef.current) {
        syncSchedulerRef.current.stop();
        syncSchedulerRef.current = null;
      }
      syncEngineRef.current = null;
      return;
    }

    // Initialize SyncEngine with live SupabaseSyncTransport (Milestone 2.6.7 Swap)
    const engine = createSyncEngine({
      transport: new SupabaseSyncTransport(),
    });
    syncEngineRef.current = engine;

    // Initialize and start SyncScheduler
    const scheduler = new SyncScheduler(engine);
    scheduler.start();
    syncSchedulerRef.current = scheduler;

    return () => {
      if (syncSchedulerRef.current) {
        syncSchedulerRef.current.stop();
        syncSchedulerRef.current = null;
      }
      syncEngineRef.current = null;
    };
  }, [cloudSyncState, user?.id, configured]);

  /**
   * Write-through: local state stays the instant, optimistic source of truth
   * (unchanged from Phase 1) — this just also mirrors changes to Supabase
   * once a sign-in has fully settled (`cloudSyncState === 'ready'`, so this
   * never fires mid-migration and overwrites what migrateLocalToCloud just
   * wrote with a stale pre-migration snapshot). A short debounce avoids a
   * network write on every keystroke in a notes field; this is NOT a queue —
   * an in-flight write during a page close is simply lost, matching the
   * approved "no complex sync logic" scope.
   */
  const progressWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!configured || !user || cloudSyncState !== 'ready') return;
    if (progressWriteTimer.current) clearTimeout(progressWriteTimer.current);
    progressWriteTimer.current = setTimeout(() => {
      saveCloudProgress(user.id, legacyStateToUserProgress(state));
    }, 1200);
    return () => { if (progressWriteTimer.current) clearTimeout(progressWriteTimer.current); };
  }, [state, user, configured, cloudSyncState]);

  const profileWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!configured || !user || cloudSyncState !== 'ready') {
      previousProfileRef.current = profile; // Keep in sync while signed out/loading
      return;
    }
    if (profileWriteTimer.current) clearTimeout(profileWriteTimer.current);
    profileWriteTimer.current = setTimeout(() => {
      // Enqueue changes in SyncEngine for live cloud sync (Milestone 2.6.3)
      if (syncEngineRef.current) {
        enqueueProfileChanges(syncEngineRef.current, user.id, previousProfileRef.current, profile);
      }
      
      // Keep legacy write-through path active (additive alongside sync engine)
      saveCloudProfile(user.id, profile);
      
      previousProfileRef.current = profile;
    }, 1200);
    return () => { if (profileWriteTimer.current) clearTimeout(profileWriteTimer.current); };
  }, [profile, user, configured, cloudSyncState]);

  // Sign-out Guard Logic (Milestone 2.6.4)
  const performActualSignOut = async (): Promise<{ error: Error | null }> => {
    if (configured) {
      return await signOut();
    } else {
      localStorage.clear();
      window.location.reload();
      return { error: null };
    }
  };

  const handleSignOutRequest = async (): Promise<{ error: Error | null }> => {
    if (!configured || !syncEngineRef.current) {
      if (window.confirm("Are you sure you want to log out? Any unsaved local changes will be cleared.")) {
        return await performActualSignOut();
      }
      return { error: null };
    }

    const { decision, pendingCount } = evaluateSignOut(syncEngineRef.current);
    if (decision === 'proceed') {
      if (window.confirm("Are you sure you want to log out? Any unsaved local changes will be cleared.")) {
        return await performActualSignOut();
      }
    } else {
      setPendingWritesCount(pendingCount);
      setShowSignOutGuard(true);
    }
    return { error: null };
  };

  const handleSyncNow = async (): Promise<number> => {
    if (!syncEngineRef.current) return 0;
    const { pendingCount } = await attemptSyncThenSignOut(syncEngineRef.current);
    if (pendingCount === 0) {
      setShowSignOutGuard(false);
      await performActualSignOut();
    }
    return pendingCount;
  };

  const handleLeaveAnyway = async () => {
    setShowSignOutGuard(false);
    await performActualSignOut();
  };

  const handleCancelSignOut = () => {
    setShowSignOutGuard(false);
  };

  // Track daily lesson complete triggers
  const handleCompleteLesson = (lessonId: string, duration: number) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const newlyCompleted = !state.completedLessons[lessonId];
    
    // Create deep copy of state updates
    const updatedCompleted = { ...state.completedLessons };
    const updatedCompletionDates = { ...(state.completionDates || {}) };
    const updatedCompletionTimes = { ...(state.completionTimes || {}) };

    if (newlyCompleted) {
      updatedCompleted[lessonId] = true;
      updatedCompletionDates[lessonId] = todayStr;

      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
      updatedCompletionTimes[lessonId] = strTime;
    } else {
      delete updatedCompleted[lessonId];
      delete updatedCompletionDates[lessonId];
      delete updatedCompletionTimes[lessonId];
    }

    const updatedStudyLog = { ...state.studyLog };
    const updatedLessonsLog = { ...state.lessonsLog };
    let newStreak = state.streak;
    let newBestStreak = state.bestStreak;
    let lastStudyDateStr = state.lastStudyDate;

    if (newlyCompleted) {
      // Log duration & lessons completed count for today
      updatedStudyLog[todayStr] = (updatedStudyLog[todayStr] || 0) + duration;
      updatedLessonsLog[todayStr] = (updatedLessonsLog[todayStr] || 0) + 1;

      // Calculate streak updates
      if (lastStudyDateStr !== todayStr) {
        if (lastStudyDateStr === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        lastStudyDateStr = todayStr;
        if (newStreak > newBestStreak) {
          newBestStreak = newStreak;
        }
      }
    } else {
      // Adjust logs on uncheck (prevent negative statistics)
      if (updatedStudyLog[todayStr] !== undefined) {
        updatedStudyLog[todayStr] = Math.max(0, updatedStudyLog[todayStr] - duration);
      }
      if (updatedLessonsLog[todayStr] !== undefined) {
        updatedLessonsLog[todayStr] = Math.max(0, updatedLessonsLog[todayStr] - 1);
      }
    }

    setState(prev => ({
      ...prev,
      completedLessons: updatedCompleted,
      completionDates: updatedCompletionDates,
      completionTimes: updatedCompletionTimes,
      studyLog: updatedStudyLog,
      lessonsLog: updatedLessonsLog,
      streak: newStreak,
      bestStreak: newBestStreak,
      lastStudyDate: lastStudyDateStr
    }));
  };

  const handleResetAllData = () => {
    if (window.confirm("Are you sure you want to completely reset all your progress, profile, and study schedule? This will permanently delete your custom configurations and start over from onboarding.")) {
      localStorage.removeItem("ahmad_ledger_v3");
      localStorage.removeItem("study_plan_profile_v1");
      window.location.reload();
    }
  };

  // Level System Calculations
  const totalMinStudied = (Object.values(state.studyLog) as number[]).reduce((a: number, b: number) => a + b, 0);
  const xp = Math.round(totalMinStudied * 10);

  const getLevelInfo = () => {
    let curLevel = LEVELS[0];
    let nextLevel = LEVELS[1];

    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].min) {
        curLevel = LEVELS[i];
        nextLevel = LEVELS[i + 1] || null;
      }
    }

    return { curLevel, nextLevel, xp };
  };

  const { curLevel, nextLevel } = getLevelInfo();
  const xpInCurrentLevel = xp - curLevel.min;
  const xpNeededForNextLevel = nextLevel ? (nextLevel.min - curLevel.min) : 0;
  const levelProgressPct = nextLevel ? Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100)) : 100;

  // Sidebar items
  const menuItems = [
    { id: 'dashboard', label: t('menu.dashboard'), icon: LayoutDashboard },
    { id: 'my-learning', label: t('menu.learning'), icon: BookOpen },
    { id: 'exam-prep', label: 'Exam Prep & Flashcards', icon: Brain },
    { id: 'friends', label: 'Study Squad & Focus', icon: Radio },
    { id: 'roadmap', label: t('menu.career'), icon: Compass },
    { id: 'ai-coach', label: t('menu.ai_coach'), icon: Sparkles },
    { id: 'statistics', label: t('menu.analytics'), icon: BarChart3 },
    { id: 'calendar', label: t('menu.calendar'), icon: Calendar },
    { id: 'achievements', label: t('menu.goals'), icon: Trophy },
    { id: 'assignments', label: t('menu.internships'), icon: ClipboardList },
    { id: 'wrong-answers', label: t('menu.capstone'), icon: Target },
    { id: 'learning-library', label: t('menu.resources'), icon: FileText },
    { id: 'settings', label: t('menu.settings'), icon: Settings },
  ];

  // Auth gating — the app renders exactly as it did in Phase 1 when Supabase
  // isn't configured at all (local-only, no gate, matching every existing
  // user's experience). When configured, a session is required to see any of
  // the app's actual content: sign-in, sign-up, forgot/reset password, and
  // OAuth all live inside AuthScreen itself (see its own internal `mode`
  // state) — no separate routes needed for that.
  if (configured && authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-[#E0E0E6] grid place-items-center">
        <p className="text-sm text-[#94949C]">Loading your learning plan…</p>
      </div>
    );
  }
  if (configured && !user) {
    return <AuthScreen />;
  }
  // Onboarding gate: Profile.onboardingCompleted is the single source of
  // truth (per direction), applying identically whether local-only or
  // signed in — no separate logic branch for either case. Waits for
  // cloudSyncState to settle first when signed in, so a returning user's
  // real onboardingCompleted (loaded from the cloud) is checked, not a
  // stale local value from before their cloud profile loaded.
  if ((!configured || cloudSyncState === 'ready') && !profile.onboardingCompleted) {
    return <Onboarding profile={profile} onUpdateProfile={setProfile} />;
  }

  const bgClasses: Record<string, string> = {
    'midnight': 'bg-[#07090E]',
    'emerald': 'bg-[#07090E]',
    'sapphire': 'bg-[#07090E]',
    'amethyst': 'bg-[#07090E]',
    'obsidian': 'bg-[#07090E]',
    'onyx': 'bg-[#07090E]'
  };
  const activeBg = profile.background && bgClasses[profile.background] ? bgClasses[profile.background] : 'bg-[#07090E]';

  return (
    <div className={`flex h-screen ${activeBg} text-[#E2E8F0] font-sans antialiased overflow-hidden`}>
      {/* SIDEBAR PANEL */}
      <div className="hidden md:flex flex-col w-60 bg-[#0B0E17] border-r border-[#181F32] select-none h-full flex-shrink-0">
        {/* Brand Header with Hexagonal Logo */}
        <div className="p-5 border-b border-[#181F32] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#D4AF37] to-[#F5D061] p-0.5 flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 flex-shrink-0">
            <div className="w-full h-full bg-[#0B0E17] rounded-[7px] flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-[#D4AF37]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
          <div>
            <div className="font-display text-[18px] font-bold tracking-tight text-white flex items-center gap-1.5">
              Himam
            </div>
          </div>
        </div>

        {/* Level & XP Sidebar Card */}
        <div className="mx-4 my-4 p-4 bg-[#171B24] border border-white/5 rounded-[20px] space-y-2">
          <div className="flex justify-between items-center text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider font-display">
            <span className="truncate max-w-[120px]">{curLevel.name}</span>
            <span className="font-mono text-[9px] text-[#94949C]">{xp.toLocaleString()} XP</span>
          </div>
          <div className="w-full bg-[#0B0D12] h-1.5 rounded-full overflow-hidden border border-white/5 mt-1">
            <div className="bg-gradient-to-r from-[#D4AF37] to-[#5DA9FF] h-full" style={{ width: `${levelProgressPct}%` }}></div>
          </div>
          <span className="block text-[8.5px] text-[#94949C] font-medium leading-none">
            {nextLevel ? `${(nextLevel.min - xp).toLocaleString()} XP to ${nextLevel.name.split(' ')[0]}` : "Max tier reached"}
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-none">
          {menuItems.map(item => {
            const Icon = item.icon;
            
            // Map sub-tabs of Academy or ProgressHub to keep them lit
            const isActive = activeTab === item.id || 
              (item.id === 'my-learning' && activeTab === 'academy') ||
              (item.id === 'roadmap' && activeTab === 'roadmap') ||
              (item.id === 'statistics' && activeTab === 'statistics') ||
              (item.id === 'calendar' && activeTab === 'calendar') ||
              (item.id === 'achievements' && activeTab === 'achievements') ||
              (item.id === 'assignments' && activeTab === 'assignments') ||
              (item.id === 'wrong-answers' && activeTab === 'wrong-answers') ||
              (item.id === 'learning-library' && activeTab === 'learning-library');

            return (
              <button
                key={item.id}
                onClick={async () => {
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-[#131927] text-[#D4AF37] border border-[#2D3954] shadow-sm'
                    : 'text-[#8A99AD] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#D4AF37]' : 'text-[#8A99AD]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Himam Pro Upgrade Card */}
        <div className="mx-3 my-3 p-3.5 bg-[#0E1320] border border-[#1E283D] rounded-2xl space-y-2.5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#D4AF37]/5 rounded-full blur-xl pointer-events-none"></div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white font-display">Himam Pro</span>
              <span className="text-[8px] bg-[#D4AF37]/20 text-[#D4AF37] font-bold px-1.5 py-0.2 rounded border border-[#D4AF37]/30">ACTIVE</span>
            </div>
            <span className="text-[9px] text-[#64748B] block mt-0.5">Renewal: Aug 22, 2025</span>
          </div>
          <button 
            onClick={() => setActiveTab('settings')}
            className="w-full bg-[#12192B] hover:bg-[#1A233A] border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 text-[#D4AF37] text-[10.5px] font-bold py-1.5 rounded-xl transition-all duration-200 shadow-md active:scale-[0.98]"
          >
            Upgrade Plan
          </button>
          
          <div className="pt-0.5">
            <p className="text-[9.5px] text-[#64748B] font-medium leading-snug">
              Small progress every day leads to big results.
            </p>
          </div>
        </div>

        {/* Profile Card Footer */}
        <div className="p-4 border-t border-white/5 bg-[#171B24]/40 flex items-center gap-3 select-none">
          <button 
            onClick={() => setActiveTab('settings')}
            className="relative flex-shrink-0 group"
            title="Account Settings"
          >
            <img 
              src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user?.email || 'User')}&background=171B24&color=D4AF37`} 
              alt={profile.name} 
              className="w-9 h-9 rounded-full border border-[#D4AF37]/30 object-cover bg-black p-0.5 transition-transform duration-300 group-hover:scale-105" 
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#3DDC84] border-2 border-[#11141C] rounded-full"></div>
          </button>
          
          <div className="flex-1 min-w-0">
            <button 
              onClick={() => setActiveTab('settings')}
              className="block text-xs font-bold text-white hover:text-[#D4AF37] transition-colors truncate text-left w-full font-display"
            >
              {profile.name || 'Ahmed'}
            </button>
            <span className="block text-[9px] text-[#94949C] truncate font-medium">
              {profile.careerGoal || 'AI Engineer'}
            </span>
          </div>

          {user ? (
            <button
              onClick={handleSignOutRequest}
              className="p-1.5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/5 rounded-lg text-[#94949C] hover:border-red-500/20 transition-all cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="p-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 rounded-lg text-[#D4AF37] transition-all cursor-pointer"
              title="Log In"
            >
              <LogIn className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* MOBILE LOWER BAR NAVIGATION (5 TABS ONLY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#11141C]/95 backdrop-blur-xl border-t border-white/10 z-50 flex justify-around items-center select-none pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-2 px-2 safe-px shadow-2xl">
        {[
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'my-learning', label: 'Learning', icon: BookOpen },
          { id: 'ai-coach', label: 'AI', icon: Sparkles, isAi: true },
          { id: 'roadmap', label: 'Career', icon: Compass },
          { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true }
        ].map(item => {
          const Icon = item.icon;
          const isActive = !item.isMore && (
            activeTab === item.id || 
            (item.id === 'my-learning' && activeTab === 'academy') ||
            (item.id === 'roadmap' && activeTab === 'roadmap')
          );

          if (item.isAi) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab('ai-coach')}
                className="relative -top-3 flex flex-col items-center justify-center group active:scale-95 transition-transform"
              >
                <div className={`w-12 h-12 rounded-full p-0.5 shadow-lg shadow-[#D4AF37]/20 transition-all ${
                  isActive 
                    ? 'bg-gradient-to-tr from-[#D4AF37] via-[#E6C35C] to-[#5DA9FF] ring-2 ring-[#D4AF37]/40 scale-105' 
                    : 'bg-gradient-to-tr from-[#D4AF37]/80 to-[#5DA9FF]/80 hover:scale-105'
                }`}>
                  <div className="w-full h-full bg-[#11141C] rounded-full flex items-center justify-center border border-white/10">
                    <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                </div>
                <span className="text-[9px] font-bold text-[#D4AF37] tracking-tight mt-1">AI</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isMore) {
                  setIsMoreOpen(true);
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 min-w-[56px] min-h-[44px] text-center transition-all active:scale-95 rounded-xl ${
                isActive ? 'text-[#D4AF37] font-bold' : 'text-[#94949C] hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-[#D4AF37]' : ''} transition-transform`} />
              <span className="text-[9px] leading-none font-semibold tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden h-full">
        {/* DESKTOP TOP HEADER */}
        <div className="hidden md:flex items-center justify-between bg-[#0B0E17] border-b border-[#181F32] px-6 py-2.5 select-none flex-shrink-0">
          {/* Search box with Command shortcut */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              disabled
              className="w-full bg-[#0E1320] border border-[#1E283D] rounded-xl pl-9 pr-12 py-1.5 text-xs text-[#94A3B8] focus:outline-none placeholder-[#64748B]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#64748B] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 select-none">⌘K</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Calendar & Bell Notification Icons */}
            <button 
              onClick={() => setActiveTab('calendar')}
              className="p-2 bg-[#0E1320] hover:bg-[#151D30] border border-[#1E283D] rounded-xl text-[#94A3B8] hover:text-white transition-all relative"
              title="Study Calendar"
            >
              <Calendar className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className="p-2 bg-[#0E1320] hover:bg-[#151D30] border border-[#1E283D] rounded-xl text-[#94A3B8] hover:text-white transition-all relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF4D4D] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#0B0E17]">3</span>
            </button>
            
            {/* User profile dropdown button */}
            <div className="flex items-center gap-2 border border-[#1E283D] bg-[#0E1320] px-3 py-1.5 rounded-xl cursor-pointer hover:border-white/20 transition-all" onClick={() => setActiveTab('settings')}>
              <img 
                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user?.email || 'User')}&background=0E1320&color=D4AF37`} 
                alt="Profile" 
                className="w-6 h-6 rounded-full object-cover border border-[#D4AF37]/40 bg-black p-0.5" 
              />
              <span className="text-xs font-semibold text-white">{profile.name ? profile.name.split(' ')[0] : 'Ahmed'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </div>

            {/* Desktop Auth Button */}
            {user ? (
              <button
                onClick={handleSignOutRequest}
                className="p-2 bg-[#0E1320] hover:bg-red-500/10 text-[#94A3B8] hover:text-red-400 border border-[#1E283D] hover:border-red-500/20 rounded-xl transition-all cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Log In"
              >
                <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Log In</span>
              </button>
            )}

            {/* Toggle AI Coach Drawer Pill Badge */}
            <button
              onClick={() => setIsAICoachOpen(!isAICoachOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isAICoachOpen 
                  ? 'bg-[#1E2B48] border-[#3B82F6]/50 text-[#60A5FA] shadow-sm shadow-[#3B82F6]/20' 
                  : 'bg-[#0E1320] border-[#1E283D] text-[#94A3B8] hover:text-white hover:border-white/20'
              }`}
              title="Toggle AI Coach Drawer"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00F0FF] p-0.5 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-black" />
              </div>
              <span>AI Coach</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#3B82F6]" />
            </button>
          </div>
        </div>

        {/* MOBILE TOP HEADER */}
        <div className="md:hidden flex items-center justify-between bg-[#11141C] border-b border-white/5 px-4 pb-2.5 pt-[max(env(safe-area-inset-top,0px)+10px,12px)] select-none flex-shrink-0 safe-px" id="mobile-global-header">
          <div className="font-display text-sm font-bold text-white flex items-center gap-1.5">
            Himam <span className="text-[#D4AF37]" dir="rtl" lang="ar">هِمَم</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Quick settings link avatar */}
            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 border border-white/5 bg-white/5 px-2.5 py-1.5 rounded-full active:scale-95 transition-all min-h-[36px]"
            >
              <img 
                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user?.email || 'User')}&background=171B24&color=D4AF37`} 
                alt="Profile" 
                className="w-5 h-5 rounded-full object-cover border border-[#D4AF37]/30 bg-black p-0.5" 
              />
              <span className="text-[10px] font-bold text-[#E0E0E6] max-w-[70px] truncate">{profile.name ? profile.name.split(' ')[0] : 'Me'}</span>
            </button>

            {user ? (
              <button
                onClick={handleSignOutRequest}
                className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/10 bg-red-500/5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all font-bold min-h-[36px] flex items-center gap-1 cursor-pointer"
                id="mobile-global-logout"
              >
                <LogOut className="w-3 h-3" />
                <span>Log Out</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-[10px] text-[#D4AF37] hover:text-white border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all font-bold min-h-[36px] flex items-center gap-1 cursor-pointer shadow-sm"
                id="mobile-global-login"
              >
                <LogIn className="w-3 h-3 text-[#D4AF37]" />
                <span>Log In</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEWPORT & RIGHT DRAWER FLEX ROW */}
        <div className="flex-1 flex flex-row overflow-hidden h-full">
          {/* MAIN VIEWPORT */}
          <main className={`flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 pb-28 md:pb-8 ${activeBg}`}>
            <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">
            
            {/* Active view conditional routing */}
            {activeTab === 'dashboard' && (
              <Dashboard 
                state={state} 
                onUpdateState={setState} 
                setActiveTab={setActiveTab} 
                profile={profile} 
                onUpdateProfile={setProfile}
                signOut={handleSignOutRequest}
                configured={configured}
                onCompleteLesson={handleCompleteLesson}
              />
            )}
            {['academy', 'my-learning', 'learning-library', 'study-center', 'roadmap', 'exam-prep'].includes(activeTab) && (
              <Academy
                state={state}
                onUpdateState={setState}
                profile={profile}
                onUpdateProfile={setProfile}
                onCompleteLesson={handleCompleteLesson}
                highlightedLessonId={studyCenterHighlightedLessonId}
                onClearHighlightedLessonId={() => setStudyCenterHighlightedLessonId(null)}
                initialSubTab={activeTab}
                setActiveTab={setActiveTab}
                onResumeLesson={(lessonId) => {
                  setStudyCenterHighlightedLessonId(lessonId);
                  setActiveTab('study-center');
                }}
                syncEngine={syncEngineRef.current}
              />
            )}
            {activeTab === 'ai-coach' && (
              <AICoach state={state} profile={profile} />
            )}
            {['progress', 'statistics', 'calendar', 'assignments', 'wrong-answers', 'achievements'].includes(activeTab) && (
              <ProgressHub
                state={state}
                onUpdateState={setState}
                profile={profile}
                onUpdateProfile={setProfile}
                onCompleteLesson={handleCompleteLesson}
                initialSubTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'friends' && (
              <FriendsTab 
                profile={profile} 
                state={state} 
                onUpdateState={setState} 
              />
            )}
            {['settings', 'preferences', 'account'].includes(activeTab) && (
              <SettingsHub
                profile={profile}
                onUpdateProfile={setProfile}
                configured={configured}
                signOut={handleSignOutRequest}
                initialSubTab={activeTab}
                setActiveTab={setActiveTab}
                onResetAllData={handleResetAllData}
              />
            )}
            {['legal-terms', 'legal-privacy', 'legal-cookie', 'legal-ai'].includes(activeTab) && (
              <LegalHub 
                initialTab={
                  activeTab === 'legal-terms' ? 'terms' :
                  activeTab === 'legal-privacy' ? 'privacy' :
                  activeTab === 'legal-cookie' ? 'cookie' : 'ai'
                }
                onBack={() => setActiveTab('settings')}
                defaultLanguage={profile.language || 'en'}
              />
            )}

            </div>
            
            {/* BOTTOM STICKY STATUS BAR */}
            <div className="bg-[#0B0E17] border-t border-[#181F32] px-6 py-2 flex flex-wrap items-center justify-between text-xs text-[#8A99AD] select-none flex-shrink-0 z-20">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Today's Focus:</span>
                  <span className="text-[#3B82F6] font-bold">3 priorities</span>
                  <div className="w-16 bg-[#182032] h-1.5 rounded-full overflow-hidden ml-1 hidden sm:block">
                    <div className="bg-[#3B82F6] h-full w-[60%] rounded-full"></div>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center gap-2 border-l border-[#181F32] pl-5">
                  <span className="font-semibold text-white">Next Event:</span>
                  <span className="text-[#CBD5E1]">Database Systems Lecture Today, 1:00 PM</span>
                </div>

                <div className="hidden lg:flex items-center gap-2 border-l border-[#181F32] pl-5">
                  <span className="font-semibold text-white">Study Streak:</span>
                  <span className="text-[#D4AF37] font-bold">7 days</span>
                  <span className="text-xs">Keep it up! 🔥</span>
                </div>
              </div>

              <button 
                onClick={() => setIsAICoachOpen(true)}
                className="flex items-center gap-2 bg-[#131927] hover:bg-[#1A2235] border border-[#2D3954] text-[#D4AF37] px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>AI Quick Action</span>
              </button>
            </div>
          </main>
          
          {/* PERMANENT / TOGGLEABLE RIGHT-SIDE AI COACH PANEL */}
          {isAICoachOpen && (
            <div className="hidden lg:block w-96 flex-shrink-0 h-full border-l border-white/5">
              <IntegratedAICoach state={state} profile={profile} onClose={() => setIsAICoachOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {showSignOutGuard && (
        <SignOutGuardDialog
          pendingCount={pendingWritesCount}
          onSyncNow={handleSyncNow}
          onLeaveAnyway={handleLeaveAnyway}
          onCancel={handleCancelSignOut}
        />
      )}

      {/* MORE NAVIGATION LAUNCHER SHEET */}
      <MoreSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        setActiveTab={setActiveTab}
        profile={profile}
        onSignOut={handleSignOutRequest}
        onSignIn={() => setShowAuthModal(true)}
        user={user}
      />

      {/* SIGN IN / AUTH MODAL OVERLAY */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <AuthScreen onClose={() => setShowAuthModal(false)} />
        </div>
      )}
    </div>
  );
}
