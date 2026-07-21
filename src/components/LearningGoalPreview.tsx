import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Star, 
  Clock, 
  Calendar, 
  TrendingUp, 
  Check, 
  ExternalLink, 
  BookOpen, 
  AlertCircle, 
  FileText 
} from 'lucide-react';
import { GoalSearchEntry } from '../onboarding/steps/goalSearch';
import { getOfficialResourcesForGoal } from '../data/officialResources';

interface LearningGoalPreviewProps {
  goal: GoalSearchEntry | null;
  isAdded: boolean;
  isOpen: boolean;
  onConfirm: (goal: GoalSearchEntry) => void;
  onCancel: () => void;
}

export function LearningGoalPreview({
  goal,
  isAdded,
  isOpen,
  onConfirm,
  onCancel,
}: LearningGoalPreviewProps) {
  if (!isOpen || !goal) return null;

  const metadata = goal.metadata;
  const officialResources = getOfficialResourcesForGoal(goal.id || goal.label);

  // Rating Stars Renderer
  const renderStars = (rating?: number) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    return (
      <div className="flex items-center gap-0.5 text-[#D4AF37]" id="preview-rating-stars">
        {Array.from({ length: 5 }).map((_, i) => {
          const isFilled = i < fullStars || (i === fullStars && hasHalf);
          return (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${isFilled ? 'fill-current' : 'opacity-30'}`}
            />
          );
        })}
        <span className="ml-1 text-xs font-semibold text-[#D4AF37]">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/75 backdrop-blur-xs"
          id="preview-backdrop"
        />

        {/* Modal container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0B0D12] shadow-2xl"
          id="preview-modal-container"
        >
          {/* Header decoration */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#D4AF37]/40 via-[#D4AF37] to-[#D4AF37]/40" />

          {/* Close button */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 rounded-full border border-white/5 bg-white/5 p-1.5 text-[#94949C] hover:bg-white/10 hover:text-white transition-colors"
            id="preview-close-button"
            aria-label="Close Preview"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto custom-scrollbar">
            {/* Title & Classification */}
            <div className="space-y-1.5 pr-8">
              <span className="inline-block rounded-full bg-[#171B24] border border-[#D4AF37]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                {goal.category}
              </span>
              <h3 className="text-lg font-bold tracking-tight text-white leading-snug">
                {goal.label}
              </h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#94949C]">
                {metadata?.providerName && (
                  <span className="font-semibold text-white/80">{metadata.providerName}</span>
                )}
                {metadata?.providerName && metadata?.rating && (
                  <span className="text-white/20">•</span>
                )}
                {renderStars(metadata?.rating)}
              </div>
            </div>

            {/* Description */}
            {goal.description && (
              <p className="text-xs text-[#94949C] leading-relaxed border-b border-white/5 pb-4">
                {goal.description}
              </p>
            )}

            {/* Metadata Fields Section */}
            {metadata ? (
              <div className="space-y-5">
                {/* Micro metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5" id="preview-metrics-grid">
                  {metadata.estimatedHours !== undefined && (
                    <div className="rounded-xl border border-white/5 bg-[#171B24] p-3 text-center">
                      <Clock className="w-4 h-4 mx-auto mb-1.5 text-[#D4AF37]/70" />
                      <p className="text-[9px] font-medium uppercase tracking-wider text-[#55555B]">Study Hours</p>
                      <p className="text-xs font-bold text-white mt-0.5">{metadata.estimatedHours} hrs</p>
                    </div>
                  )}
                  {metadata.estimatedDuration && (
                    <div className="rounded-xl border border-white/5 bg-[#171B24] p-3 text-center">
                      <Calendar className="w-4 h-4 mx-auto mb-1.5 text-[#D4AF37]/70" />
                      <p className="text-[9px] font-medium uppercase tracking-wider text-[#55555B]">Duration</p>
                      <p className="text-xs font-bold text-white mt-0.5">{metadata.estimatedDuration}</p>
                    </div>
                  )}
                  {metadata.difficulty && (
                    <div className="rounded-xl border border-white/5 bg-[#171B24] p-3 text-center">
                      <TrendingUp className="w-4 h-4 mx-auto mb-1.5 text-[#D4AF37]/70" />
                      <p className="text-[9px] font-medium uppercase tracking-wider text-[#55555B]">Difficulty</p>
                      <p className="text-xs font-bold text-white mt-0.5">{metadata.difficulty}</p>
                    </div>
                  )}
                </div>

                {/* Skills Covered */}
                {metadata.skillsCovered && metadata.skillsCovered.length > 0 && (
                  <div className="space-y-2" id="preview-skills-covered">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]/70" /> Skills Covered
                    </h4>
                    <ul className="grid grid-cols-2 gap-1.5 text-xs">
                      {metadata.skillsCovered.map((skill, index) => (
                        <li key={index} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/5 px-2 py-1 text-[#94949C]">
                          <Check className="w-3 h-3 text-[#D4AF37] flex-shrink-0" />
                          <span className="font-medium truncate text-[11px]">{skill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prerequisites */}
                {metadata.prerequisites && metadata.prerequisites.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/5 pt-4" id="preview-prerequisites">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-[#D4AF37]/70" /> Prerequisites
                    </h4>
                    <ul className="space-y-1 text-xs text-[#94949C]">
                      {metadata.prerequisites.map((prereq, index) => (
                        <li key={index} className="flex items-start gap-2 leading-relaxed text-[11px]">
                          <span className="mt-1.5 h-1 w-1 rounded-full bg-[#D4AF37] flex-shrink-0" />
                          <span>{prereq}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Exam Information */}
                {metadata.examInfo && (
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 space-y-1" id="preview-exam-info">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#D4AF37]/70" /> Exam Information
                    </h4>
                    <p className="text-[11px] text-[#94949C] leading-relaxed">
                      {metadata.examInfo}
                    </p>
                  </div>
                )}

                {/* Official Website */}
                {metadata.officialWebsite && (
                  <div className="pt-2 border-t border-white/5">
                    <a
                      href={metadata.officialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#D4AF37] hover:text-[#e4be74] transition-colors"
                      id="preview-official-website"
                    >
                      Official Program Website <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Start Learning Instantly Section */}
                {officialResources.length > 0 && (
                  <div className="space-y-2.5 border-t border-white/5 pt-4" id="preview-official-resources">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" /> Start Learning Instantly
                    </h4>
                    <p className="text-[10px] text-[#94949C] leading-relaxed">
                      Select a trusted provider below to immediately access official courses, practice tools, or syllabus materials:
                    </p>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {officialResources.map(res => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2.5 rounded-xl border border-white/5 bg-[#171B24]/60 hover:bg-[#171B24] hover:border-[#D4AF37]/30 transition-all text-left group cursor-pointer"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-white text-[11px] group-hover:text-[#D4AF37] transition-colors truncate">
                                  {res.provider}
                                </span>
                                <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                                  res.type === 'Free' 
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' 
                                    : res.type === 'Paid' 
                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' 
                                    : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-500'
                                }`}>
                                  {res.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-white/80 font-semibold mt-1 leading-snug">
                                {res.name}
                              </p>
                              {res.description && (
                                <p className="text-[9.5px] text-[#94949C] leading-relaxed mt-1">
                                  {res.description}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-[#55555B] group-hover:text-[#D4AF37] transition-all flex-shrink-0 mt-0.5" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Fallback placeholder message if metadata is completely empty (e.g. fully custom goal)
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center space-y-3">
                <p className="text-xs font-bold text-white">Custom Learning Goal</p>
                <p className="text-[11px] text-[#94949C] leading-relaxed">
                  This is a user-defined custom learning goal. A complete customizable study plan, note-taking suite, and active habits monitor will be prepared for you.
                </p>

                {officialResources.length > 0 && (
                  <div className="space-y-2 text-left" id="custom-preview-resources">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 border-t border-white/5 pt-3">
                      <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" /> Suggested Learning Resources
                    </h4>
                    <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                      {officialResources.map(res => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-[#D4AF37]/30 text-white hover:text-[#D4AF37] transition-all text-xs cursor-pointer"
                        >
                          <span className="truncate pr-2 font-medium">{res.provider} — {res.name}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-xs font-bold text-white hover:bg-white/5 transition-colors text-center"
                id="preview-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm(goal)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors text-center text-black ${
                  isAdded
                    ? 'bg-[#EF4444] text-white hover:bg-[#DC2626]'
                    : 'bg-[#D4AF37] hover:bg-[#b08e4d]'
                }`}
                id="preview-confirm-btn"
              >
                {isAdded ? 'Remove Goal' : 'Add Learning Goal'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
