import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, BookOpen, Link as LinkIcon, ExternalLink, Search } from 'lucide-react';
import { Profile } from '../../models/types';
import { GoalSearchEntry, GoalSearchProvider, LocalCatalogGoalSearchProvider, CompositeGoalSearchProvider, ServerAIGoalSearchProvider } from './goalSearch';
import { buildLearningGoalPatch } from './learningGoalState';
import { useGoalSearch } from '../../hooks/useGoalSearch';
import { LearningGoalPreview } from '../../components/LearningGoalPreview';

interface StepProps {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

const CUSTOM_CATEGORY_OPTIONS = ['Certifications', 'University Degrees', 'Languages', 'Technical Skills', 'Custom'];

const searchProvider: GoalSearchProvider = new CompositeGoalSearchProvider([
  new LocalCatalogGoalSearchProvider(),
  new ServerAIGoalSearchProvider()
]);

export default function LearningGoalStep({ profile, onChange }: StepProps) {
  const [draft, setDraft] = useState('');
  const [draftCategory, setDraftCategory] = useState('Custom');
  const [draftUrl, setDraftUrl] = useState('');
  const { results: searchResults, isSearching, popularGoals } = useGoalSearch(searchProvider, draft, 120);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [previewGoal, setPreviewGoal] = useState<GoalSearchEntry | null>(null);

  const details = profile.learningGoalDetails || {};

  const applyGoalPatch = (patch: { learningGoals: string[]; learningGoalDetails: Record<string, { category?: string; url?: string }> }) => {
    onChange(patch);
  };

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [draft]);

  const addGoal = (value: string, meta?: { category?: string; url?: string; courseId?: string }) => {
    const patch = buildLearningGoalPatch({
      existingGoals: profile.learningGoals,
      existingDetails: details,
      goal: value,
      meta,
    });
    if (patch.learningGoals.length === profile.learningGoals.length && patch.learningGoalDetails === details) {
      return;
    }
    applyGoalPatch(patch);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const results = draft.trim().length > 0 ? searchResults : popularGoals;
    if (!results.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(prev => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const index = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
      const suggestion = results[index];
      if (suggestion) {
        setPreviewGoal(suggestion);
      } else {
        const cleaned = draft.trim();
        if (cleaned) {
          setPreviewGoal({
            id: 'custom-' + Date.now(),
            label: cleaned,
            category: draftCategory,
            description: draftUrl.trim() ? `Course Link: ${draftUrl.trim()}` : 'User-defined learning goal.',
          });
        }
      }
    }
  };

  const removeGoal = (goal: string) => {
    const patch = buildLearningGoalPatch({
      existingGoals: profile.learningGoals,
      existingDetails: details,
      goal,
      remove: true,
    });
    applyGoalPatch(patch);
  };

  const selectedGoalIds = useMemo(() => new Set(profile.learningGoals), [profile.learningGoals]);

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <label className="block text-xs font-semibold text-[#94949C]">
          What is your target learning goal?
        </label>
        <div className="rounded-xl border border-white/10 bg-[#0B0D12] p-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#171B24] px-3 py-2.5">
            <Search className="h-4 w-4 text-[#55555B]" />
            <input
              value={draft}
              onChange={e => {
                setDraft(e.target.value);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search goals, skills, or certifications..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#55555B] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const cleaned = draft.trim();
                if (!cleaned) return;
                setPreviewGoal({
                  id: 'custom-' + Date.now(),
                  label: cleaned,
                  category: draftCategory,
                  description: draftUrl.trim() ? `Course Link: ${draftUrl.trim()}` : 'User-defined learning goal.',
                });
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[#171B24] border border-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="mt-2.5 space-y-2.5">
            {draft.trim().length > 0 && (
              <div className="rounded-lg border border-white/5 bg-[#171B24] p-2.5 space-y-2.5">
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#55555B] font-semibold">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_CATEGORY_OPTIONS.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setDraftCategory(cat)}
                        className={`text-[11px] rounded-lg px-2.5 py-1 font-semibold border transition-all ${
                          draftCategory === cat
                            ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]'
                            : 'bg-[#171B24] border-white/5 text-[#94949C] hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-[10px] uppercase tracking-wider text-[#55555B] font-semibold">
                  Course link <span className="text-[#55555B] font-normal normal-case lowercase">(optional — Udemy, LinkedIn Learning, Coursera, etc.)</span>
                  <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#0B0D12] border border-white/10 px-2.5 py-2">
                    <LinkIcon className="w-3.5 h-3.5 text-[#55555B] flex-shrink-0" />
                    <input
                      value={draftUrl}
                      onChange={e => setDraftUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 bg-transparent text-xs text-white placeholder-[#55555B] focus:outline-none"
                    />
                  </div>
                </label>
              </div>
            )}

            <div className="rounded-lg border border-white/5 bg-[#171B24] p-2.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-[#94949C] font-semibold">
                  {draft.trim().length > 0 ? 'Matching goals' : 'Popular learning goals'}
                </p>
                <span className="text-[10px] text-[#55555B]">
                  {isSearching ? 'Searching...' : `${draft.trim().length > 0 ? searchResults.length : popularGoals.length} options`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {(draft.trim().length > 0 ? searchResults : popularGoals).map((result, index) => {
                  const isAdded = selectedGoalIds.has(result.label);
                  const isActive = index === activeSuggestionIndex;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => setPreviewGoal(result)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer ${
                        isAdded
                          ? 'border-[#D4AF37]/30 bg-[#171B24] text-[#D4AF37]'
                          : isActive
                            ? 'border-[#D4AF37]/30 bg-[#171B24] text-white'
                            : 'border-white/5 bg-[#0B0D12] text-[#94949C] hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{result.label}</p>
                          <p className="mt-0.5 text-[11px] text-[#55555B]">{result.description}</p>
                        </div>
                        {isAdded ? <Check className="mt-0.5 h-3.5 w-3.5 text-[#10B981]" /> : <Plus className="mt-0.5 h-3.5 w-3.5 opacity-50" />}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#94949C]">
                          {result.category}
                        </span>
                        <span className="text-[10px] text-[#55555B]">Tap to view details</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {((draft.trim().length > 0 && searchResults.length === 0 && !isSearching) || (draft.trim().length === 0 && popularGoals.length === 0)) && (
                <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-[#0B0D12] p-3 text-center text-[11px] text-[#55555B]">
                  No matches yet. Add your own goal with the button above or type a custom goal.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Active Goals list */}
      {profile.learningGoals.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          <p className="text-xs font-semibold text-white">Your Selected Learning Goals ({profile.learningGoals.length})</p>
          <div className="flex flex-col gap-2">
            {profile.learningGoals.map(goal => {
              const meta = details[goal];
              return (
                <div
                  key={goal}
                  onClick={async () => {
                    const matches = await searchProvider.search(goal);
                    const match = matches.find(m => m.label.toLowerCase() === goal.toLowerCase());
                    if (match) {
                      setPreviewGoal(match);
                    } else {
                      setPreviewGoal({
                        id: 'custom-' + Date.now(),
                        label: goal,
                        category: meta?.category || 'Custom',
                        description: meta?.url ? `Course Link: ${meta.url}` : 'User-defined learning goal.',
                        courseId: meta?.courseId,
                      });
                    }
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#171B24] border border-[#D4AF37]/20 px-3 py-2 cursor-pointer hover:border-[#D4AF37]/40 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]/70 flex-shrink-0" />
                    <span className="text-xs font-semibold text-[#D4AF37] truncate" title={goal}>{goal}</span>
                    {meta?.category && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C] bg-white/5 px-1.5 py-0.5 rounded flex-shrink-0">
                        {meta.category}
                      </span>
                    )}
                    {meta?.url && (
                      <a
                        href={meta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={meta.url}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#94949C] hover:text-[#D4AF37] flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeGoal(goal);
                    }}
                    aria-label={`Remove ${goal}`}
                    className="hover:bg-white/10 rounded-full p-0.5 transition-colors flex-shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <p className="text-[10.5px] text-[#55555B] leading-relaxed">
        Select a suggestion to view its detailed specifications, key skills, and study duration, or create your own custom goal if you have specific objectives.
      </p>

      {/* Learning Goal Preview Modal */}
      {previewGoal && (
        <LearningGoalPreview
          goal={previewGoal}
          isAdded={selectedGoalIds.has(previewGoal.label)}
          isOpen={!!previewGoal}
          onConfirm={(goal) => {
            const isAdded = selectedGoalIds.has(goal.label);
            if (isAdded) {
              removeGoal(goal.label);
            } else {
              // Extract original link parameters if they were specified in the draft form or metadata
              const finalUrl = goal.description?.startsWith('Course Link: ') 
                ? goal.description.replace('Course Link: ', '') 
                : draftUrl.trim() || undefined;

              addGoal(goal.label, {
                category: goal.category,
                courseId: goal.courseId,
                url: finalUrl,
              });
            }
            setPreviewGoal(null);
            setDraft('');
            setDraftUrl('');
            setDraftCategory('Custom');
          }}
          onCancel={() => setPreviewGoal(null)}
        />
      )}
    </div>
  );
}

// Simple internal icon definition for check
function Check({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
