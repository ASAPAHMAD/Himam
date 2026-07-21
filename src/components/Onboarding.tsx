import React, { useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Profile, OnboardingStep } from '../models/types';
import { STEP_ORDER, STEP_LABELS, validateStep } from '../onboarding/validation';
import IdentityStep from '../onboarding/steps/IdentityStep';
import CareerStep from '../onboarding/steps/CareerStep';
import LearningGoalStep from '../onboarding/steps/LearningGoalStep';
import ScheduleStep from '../onboarding/steps/ScheduleStep';
import LearningStyleStep from '../onboarding/steps/LearningStyleStep';

const STEP_COMPONENTS: Record<OnboardingStep, React.ComponentType<{ profile: Profile; onChange: (patch: Partial<Profile>) => void }> | null> = {
  identity: IdentityStep,
  career: CareerStep,
  certification: LearningGoalStep,
  schedule: ScheduleStep,
  learning_style: LearningStyleStep,
  complete: null,
};

interface OnboardingProps {
  profile: Profile;
  onUpdateProfile: (profile: Profile) => void;
}

/**
 * Guided, first-time context for the same 5 step components Preferences uses
 * to edit these fields later — per explicit instruction, onboarding and
 * Preferences differ only in context (wizard vs. editable-anytime), never in
 * the underlying form/validation. See src/onboarding/ for the shared pieces.
 */
export default function Onboarding({ profile, onUpdateProfile }: OnboardingProps) {
  // Resume at the profile's saved step, not step one — this is the whole
  // point of Profile.onboardingStep existing (see models/profileMigration.ts).
  const startIndex = Math.max(0, STEP_ORDER.indexOf(profile.onboardingStep === 'complete' ? 'identity' : profile.onboardingStep));
  const [stepIndex, setStepIndex] = useState(startIndex);
  const [error, setError] = useState<string | null>(null);
  const step = STEP_ORDER[stepIndex];
  const StepComponent = STEP_COMPONENTS[step]!;
  const isLastStep = stepIndex === STEP_ORDER.length - 1;

  const patch = (fields: Partial<Profile>) => {
    setError(null);
    onUpdateProfile({ ...profile, ...fields });
  };

  const goNext = () => {
    const validationError = validateStep(step, profile);
    if (validationError) { setError(validationError); return; }

    if (isLastStep) {
      onUpdateProfile({ ...profile, onboardingCompleted: true, onboardingStep: 'complete' });
      return;
    }
    const nextStep = STEP_ORDER[stepIndex + 1];
    // Persist progress after every step, not just at the end — this is what
    // makes resuming after closing the app actually work.
    onUpdateProfile({ ...profile, onboardingStep: nextStep });
    setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    const prevStep = STEP_ORDER[stepIndex - 1];
    onUpdateProfile({ ...profile, onboardingStep: prevStep });
    setStepIndex(stepIndex - 1);
  };

  return (
    <main className="min-h-screen bg-[#0B0D12] text-[#E0E0E6] grid place-items-center p-5">
      <section className="w-full max-w-lg bg-[#171B24] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="w-11 h-11 grid place-items-center rounded-xl bg-[#171B24] border border-[#D4AF37]/25 text-[#D4AF37]"><Sparkles className="w-5 h-5" /></div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[#D4AF37] mt-6">Step {stepIndex + 1} of {STEP_ORDER.length}</p>
        <h1 className="font-serif text-2xl font-bold text-white mt-2">{STEP_LABELS[step]}</h1>

        <div className="flex gap-1.5 mt-4 mb-6">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-[#D4AF37]' : 'bg-white/10'}`} />
          ))}
        </div>

        <StepComponent profile={profile} onChange={patch} />

        {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}

        <div className="flex items-center justify-between mt-8">
          <button type="button" onClick={goBack} disabled={stepIndex === 0}
            className="text-sm text-[#94949C] font-semibold inline-flex items-center gap-1 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button type="button" onClick={goNext}
            className="rounded-lg px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white inline-flex items-center gap-1">
            {isLastStep ? 'Finish' : 'Continue'} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>
  );
}
