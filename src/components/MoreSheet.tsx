import React from 'react';
import { 
  Calendar, 
  BarChart3, 
  Trophy, 
  ClipboardList, 
  Target, 
  FileText, 
  Settings, 
  Users, 
  ShieldCheck, 
  X, 
  ChevronRight,
  LogOut,
  LogIn,
  Sparkles,
  BookOpen,
  Compass,
  Brain,
  Radio
} from 'lucide-react';
import { Profile } from '../models/types';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  profile: Profile;
  onSignOut?: () => void;
  onSignIn?: () => void;
  user?: any;
}

export default function MoreSheet({ isOpen, onClose, setActiveTab, profile, onSignOut, onSignIn, user }: MoreSheetProps) {
  if (!isOpen) return null;

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    onClose();
  };

  const navItems = [
    {
      id: 'calendar',
      label: 'Schedule & Deadlines',
      desc: 'Milestones, exams & study windows',
      icon: Calendar,
      color: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20'
    },
    {
      id: 'statistics',
      label: 'Analytics Engine',
      desc: 'Time distribution & mastery stats',
      icon: BarChart3,
      color: 'from-blue-500/20 to-indigo-600/10 text-blue-400 border-blue-500/20'
    },
    {
      id: 'achievements',
      label: 'Goals & Milestones',
      desc: 'Streaks, levels & XP achievements',
      icon: Trophy,
      color: 'from-[#D4AF37]/20 to-[#E6C35C]/10 text-[#D4AF37] border-[#D4AF37]/20'
    },
    {
      id: 'learning-library',
      label: 'Knowledge Library',
      desc: 'PDFs, docs, notes & AI uploads',
      icon: FileText,
      color: 'from-[#D4AF37]/30 to-[#E6C35C]/20 text-[#D4AF37] border-[#D4AF37]/40 shadow-lg'
    },
    {
      id: 'assignments',
      label: 'Career & Internship CRM',
      desc: 'Job applications & interview tracker',
      icon: ClipboardList,
      color: 'from-emerald-500/20 to-teal-600/10 text-emerald-400 border-emerald-500/20'
    },
    {
      id: 'wrong-answers',
      label: 'Projects & Deliverables',
      desc: 'Mentors, milestones & timeline',
      icon: Target,
      color: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20'
    },
    {
      id: 'exam-prep',
      label: 'AI Exam Prep & Flashcards',
      desc: 'Multiple choice, flashcards & mock exams',
      icon: Brain,
      color: 'from-blue-500/30 to-indigo-600/20 text-[#3B82F6] border-[#3B82F6]/40 shadow-lg'
    },
    {
      id: 'friends',
      label: 'Study Squad & Focus Rooms',
      desc: 'Live Pomodoro rooms & peer leaderboards',
      icon: Radio,
      color: 'from-rose-500/20 to-pink-600/10 text-rose-400 border-rose-500/20'
    },
    {
      id: 'settings',
      label: 'Settings & Profile',
      desc: 'Account, preferences & security',
      icon: Settings,
      color: 'from-slate-500/20 to-slate-600/10 text-slate-300 border-slate-500/20'
    },
    {
      id: 'legal-terms',
      label: 'Legal & Ethics',
      desc: 'Terms, privacy & AI policy',
      icon: ShieldCheck,
      color: 'from-zinc-500/20 to-zinc-600/10 text-zinc-400 border-zinc-500/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="flex-1 w-full" onClick={onClose} />

      {/* Bottom sheet content container */}
      <div className="w-full max-h-[85vh] bg-[#11141C] border-t border-white/10 rounded-t-[28px] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-250 select-none">
        
        {/* Pull Indicator */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&background=171B24&color=D4AF37`} 
              alt={profile.name} 
              className="w-10 h-10 rounded-full border border-[#D4AF37]/40 object-cover bg-black p-0.5" 
            />
            <div>
              <h3 className="font-display text-sm font-bold text-white leading-snug">{profile.name || 'Ahmed'}</h3>
              <p className="text-[11px] text-[#94949C]">{profile.careerGoal || 'AI Engineer'}</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 text-[#94949C] hover:text-white rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Grid */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-0.5 scrollbar-none">
          <div className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider px-1">
            Secondary Apps & Services
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className="flex items-center justify-between p-3.5 bg-[#171B24]/80 hover:bg-[#1C212C] border border-white/5 hover:border-white/15 rounded-[20px] transition-all duration-200 active:scale-[0.98] group text-left"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} border flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                        {item.label}
                      </span>
                      <span className="block text-[10.5px] text-[#94949C] truncate mt-0.5">
                        {item.desc}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#55555B] group-hover:text-white transition-colors flex-shrink-0 ml-2" />
                </button>
              );
            })}
          </div>

          {/* Quick Log In or Log Out Action */}
          <div className="pt-2 space-y-2">
            {user ? (
              onSignOut && (
                <button
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-xs rounded-[20px] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Account</span>
                </button>
              )
            ) : (
              onSignIn && (
                <button
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 hover:from-[#B8932D]/30 hover:to-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-xs rounded-[20px] transition-all active:scale-[0.98] cursor-pointer shadow-lg"
                >
                  <LogIn className="w-4 h-4 text-[#D4AF37]" />
                  <span>Log In / Sign Up</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
