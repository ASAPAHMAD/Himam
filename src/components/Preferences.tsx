import React from 'react';
import { ArrowLeft, LogOut, Trash2, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Profile } from '../models/types';
import { STEP_ORDER, STEP_LABELS, validateStep } from '../onboarding/validation';
import IdentityStep from '../onboarding/steps/IdentityStep';
import CareerStep from '../onboarding/steps/CareerStep';
import LearningGoalStep from '../onboarding/steps/LearningGoalStep';
import ScheduleStep from '../onboarding/steps/ScheduleStep';
import LearningStyleStep from '../onboarding/steps/LearningStyleStep';

const STEP_COMPONENTS = {
  identity: IdentityStep,
  career: CareerStep,
  certification: LearningGoalStep,
  schedule: ScheduleStep,
  learning_style: LearningStyleStep,
} as const;

interface PreferencesProps {
  profile: Profile;
  onUpdateProfile: (profile: Profile) => void;
  onBack: () => void;
  onGoToAccountSettings: () => void;
  configured: boolean;
  signOut?: () => Promise<{ error: Error | null }>;
  onResetAllData?: () => void;
  onGoToLegal: (tab: string) => void;
}

/**
 * The editable-anytime counterpart to Onboarding.tsx — same 5 step
 * components, same validation (src/onboarding/validation.ts), no wizard
 * chrome: every section is visible at once, edits apply immediately (same
 * write-through path as the rest of the app — App.tsx's debounced effect
 * mirrors profile changes to Supabase once signed in). Deliberately styled
 * as a continuation of the profile itself (name/avatar header, sections
 * flow together) rather than a disconnected settings list — auth/security
 * concerns stay in AccountSettings, which this links to rather than
 * duplicates.
 */
export default function Preferences({ profile, onUpdateProfile, onBack, onGoToAccountSettings, configured, signOut, onResetAllData, onGoToLegal }: PreferencesProps) {
  const patch = (fields: Partial<Profile>) => onUpdateProfile({ ...profile, ...fields });
  const { t, i18n } = useTranslation();

  const isRtl = i18n.language === 'ar';

  return (
    <main className="min-h-screen bg-transparent text-[#E0E0E6] p-5 sm:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <section className="max-w-2xl mx-auto space-y-6">
        <button onClick={onBack} className="text-sm text-[#D4AF37] font-semibold inline-flex items-center gap-2">
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} /> {t('common.back')}
        </button>

        <header className="flex items-center gap-4">
          <img
            src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'You')}&background=171B24&color=D4AF37`}
            alt="Your profile" className="w-14 h-14 rounded-xl border-2 border-[#D4AF37]/40 object-cover bg-black p-1 shadow-md transition-transform hover:scale-105 duration-300"
          />
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[#D4AF37]">{t('settings.preferences')}</p>
            <h1 className="font-serif text-2xl font-bold text-white">{profile.name || t('onboarding.custom_avatar')}</h1>
          </div>
        </header>

        {/* Language Selection Section */}
        <div className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              🌐 {t('settings.language')}
            </h2>
            <p className="text-xs text-[#94949C]">{t('settings.language_subtitle')}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'en', name: '🇺🇸 English', desc: 'Left-to-Right layout' },
              { id: 'ar', name: '🇸🇦 العربية', desc: 'تنسيق من اليمين إلى اليسار' },
            ].map(lang => {
              const isActive = (profile.language || 'en') === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    i18n.changeLanguage(lang.id);
                    patch({ language: lang.id as 'en' | 'ar' });
                  }}
                  className={`relative flex flex-col p-3 rounded-xl border text-start transition-all hover:scale-[1.02] ${
                    isActive
                      ? 'border-[#D4AF37] bg-white/5 shadow-[0_0_15px_rgba(197,160,89,0.15)]'
                      : 'border-white/5 bg-[#11141C]/50 hover:border-white/10'
                  }`}
                >
                  <span className="text-xs font-bold text-white">{lang.name}</span>
                  <span className="text-[10px] text-[#94949C] mt-1">{lang.desc}</span>
                  {isActive && (
                    <span className={`absolute top-2 ${isRtl ? 'left-2' : 'right-2'} w-1.5 h-1.5 rounded-full bg-[#D4AF37]`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ambient Theme Customization */}
        <div className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              🎨 Ambient Theme Customization
            </h2>
            <p className="text-xs text-[#94949C]">Select your preferred background atmosphere. The change applies instantly across your space.</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: 'midnight', name: 'Midnight Coal', color: 'bg-[#0B0D12] border-[#1C1C24]' },
              { id: 'emerald', name: 'Aramco Emerald', color: 'bg-[#06140D] border-[#0F2D1E]' },
              { id: 'sapphire', name: 'Sapphire Royal', color: 'bg-[#070D19] border-[#131F3B]' },
              { id: 'amethyst', name: 'Mystic Amethyst', color: 'bg-[#100714] border-[#291336]' },
              { id: 'obsidian', name: 'Obsidian Jet', color: 'bg-[#020202] border-[#141414]' },
              { id: 'onyx', name: 'Volcanic Onyx', color: 'bg-[#0F0A07] border-[#261E1A]' },
            ].map(theme => (
              <button
                key={theme.id}
                onClick={() => patch({ background: theme.id })}
                className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                  (profile.background || 'midnight') === theme.id
                    ? 'border-[#D4AF37] bg-white/5 shadow-[0_0_15px_rgba(197,160,89,0.15)]'
                    : 'border-white/5 bg-[#11141C]/50 hover:border-white/10'
                }`}
              >
                {/* Colored circle */}
                <span className={`w-4 h-4 rounded-full border ${theme.color} flex-shrink-0`} />
                <span className={`text-xs font-semibold ${
                  (profile.background || 'midnight') === theme.id ? 'text-white' : 'text-[#94949C]'
                }`}>
                  {theme.name}
                </span>
                
                {/* Active check indicator */}
                {(profile.background || 'midnight') === theme.id && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Daily Learning Goal Customization */}
        <div className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-[#D4AF37]" /> Daily Study Goal
            </h2>
            <p className="text-xs text-[#94949C]">Set your target study duration for each day. We'll track your daily streaks and completion on the dashboard.</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#94949C] font-semibold">Daily Study Target:</span>
              <span className="text-sm font-mono font-bold text-[#D4AF37] bg-[#171B24] border border-[#D4AF37]/20 px-3 py-1 rounded">
                {profile.dailyGoalMinutes || 30} minutes
              </span>
            </div>

            {/* Slider or range input */}
            <div className="space-y-2">
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={profile.dailyGoalMinutes || 30}
                onChange={(e) => patch({ dailyGoalMinutes: parseInt(e.target.value) })}
                className="w-full accent-[#D4AF37] bg-white/5 rounded-lg appearance-none h-1.5 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#55555B] font-mono">
                <span>5m</span>
                <span>30m</span>
                <span>60m</span>
                <span>90m</span>
                <span>120m</span>
                <span>180m</span>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120].map((mins) => {
                const isActive = (profile.dailyGoalMinutes || 30) === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => patch({ dailyGoalMinutes: mins })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                      isActive
                        ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                        : 'bg-[#11141C]/50 border-white/5 text-[#94949C] hover:text-white hover:border-white/10'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {STEP_ORDER.map(step => {
          const StepComponent = STEP_COMPONENTS[step as keyof typeof STEP_COMPONENTS];
          const error = validateStep(step, profile);
          return (
            <div key={step} className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-4">
              <h2 className="font-serif text-lg font-bold text-white">{STEP_LABELS[step]}</h2>
              <StepComponent profile={profile} onChange={patch} />
              {error && <p className="text-xs text-[#D4AF37]">{error}</p>}
            </div>
          );
        })}

        {/* Account & Session Actions */}
        <div className="rounded-2xl border border-red-500/20 bg-[#171B24] p-5 space-y-4" id="preferences-session-card">
          <div>
            <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
              🚪 Session &amp; Data Management
            </h2>
            <p className="text-xs text-[#94949C] mt-1">Manage your active learning session and local or cloud-synchronized data.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to log out? Any unsaved local changes will be cleared.")) {
                  if (configured && signOut) {
                    const result = await signOut();
                    if (result?.error) {
                      alert(result.error.message);
                    }
                  } else {
                    localStorage.clear();
                    window.location.reload();
                  }
                }
              }}
              className="rounded-lg px-4 py-2.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
              id="preferences-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>

            {onResetAllData && (
              <button
                onClick={onResetAllData}
                className="rounded-lg px-4 py-2.5 text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 hover:bg-[#D4AF37]/20 transition-all inline-flex items-center gap-2 cursor-pointer animate-pulse-subtle"
                id="preferences-reset-btn"
              >
                <Trash2 className="w-4 h-4" />
                Reset Progress &amp; Schedule
              </button>
            )}
          </div>
        </div>

        {configured ? (
          <p className="text-xs text-[#55555B] text-center">
            Looking for email, password, linked accounts, or account deletion? That's in{' '}
            <button onClick={onGoToAccountSettings} className="text-[#D4AF37] font-semibold">Account settings</button>.
          </p>
        ) : (
          <p className="text-xs text-[#55555B] text-center">
            You are currently using local-only mode. All progress is saved in this browser.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3 text-[11px] text-[#55555B] pt-4 border-t border-white/5 select-none">
          <button 
            type="button"
            onClick={() => onGoToLegal('legal-terms')} 
            className="hover:text-[#D4AF37] hover:underline transition-colors font-medium cursor-pointer"
          >
            {t('legal.terms_title')}
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={() => onGoToLegal('legal-privacy')} 
            className="hover:text-[#D4AF37] hover:underline transition-colors font-medium cursor-pointer"
          >
            {t('legal.privacy_title')}
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={() => onGoToLegal('legal-cookie')} 
            className="hover:text-[#D4AF37] hover:underline transition-colors font-medium cursor-pointer"
          >
            {t('legal.cookie_title')}
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={() => onGoToLegal('legal-ai')} 
            className="hover:text-[#D4AF37] hover:underline transition-colors font-medium cursor-pointer"
          >
            {t('legal.ai_title')}
          </button>
        </div>
      </section>
    </main>
  );
}
