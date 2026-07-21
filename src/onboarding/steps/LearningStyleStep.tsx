import React, { useMemo, useState } from 'react';
import { Profile, LearningStyle } from '../../models/types';
import { getLearningStyleOptions, normalizeLearningStyle } from '../../services/learningStyles';

interface StepProps {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

export default function LearningStyleStep({ profile, onChange }: StepProps) {
  const [customStyle, setCustomStyle] = useState('');
  const options = useMemo(() => getLearningStyleOptions(), []);

  const handleSelect = (style: LearningStyle | string) => {
    const normalized = normalizeLearningStyle(style);
    onChange({ learningStyle: normalized as LearningStyle });
  };

  const handleCustomAdd = () => {
    const value = customStyle.trim();
    if (!value) return;
    handleSelect(value);
    setCustomStyle('');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-[#94949C]">Choose a style that fits how you learn best</p>
        <div className="grid grid-cols-2 gap-3">
          {options.map(option => {
            const selected = profile.learningStyle === option.label;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.label)}
                className={`rounded-lg border px-4 py-4 text-left ${selected ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]' : 'bg-white/5 border-white/10 text-[#94949C]'}`}
              >
                <p className="text-sm font-bold">{option.label}</p>
                <p className="mt-1 text-[11px] opacity-80">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0B0D12] p-3 space-y-2">
        <label className="block text-xs font-semibold text-white">Custom study style</label>
        <input
          value={customStyle}
          onChange={e => setCustomStyle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCustomAdd();
            }
          }}
          placeholder="Describe how you prefer to learn"
          className="w-full rounded-lg bg-[#171B24] border border-white/10 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={handleCustomAdd}
          className="rounded-lg px-3 py-2 text-xs font-semibold bg-[#171B24] border border-[#D4AF37]/20 text-[#D4AF37]"
        >
          Use this style
        </button>
      </div>
    </div>
  );
}
