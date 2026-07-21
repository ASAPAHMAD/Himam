import React, { useState } from 'react';
import { 
  X, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  Sparkles, 
  Clock, 
  Save, 
  AlertTriangle,
  RotateCw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Tag,
  MapPin,
  Plus
} from 'lucide-react';
import { CourseDraft } from '../models/types';

interface SyllabusDraftPreviewProps {
  draft: CourseDraft;
  onUpdateDraft: (updated: CourseDraft) => void;
  onSave: (draft: CourseDraft) => Promise<void>;
  onDiscard: () => void;
  onRegenerate: (directives?: string) => Promise<void>;
  isRegenerating: boolean;
  generationStep: number;
  generationError: string | null;
}

export default function SyllabusDraftPreview({
  draft,
  onUpdateDraft,
  onSave,
  onDiscard,
  onRegenerate,
  isRegenerating,
  generationStep,
  generationError
}: SyllabusDraftPreviewProps) {
  const [showDirectivesBox, setShowDirectivesBox] = useState(false);
  const [editedDirectives, setEditedDirectives] = useState(draft.directives || '');
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Expiration calc
  const expirationDate = new Date(new Date(draft.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil((expirationDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  const updateDraft = (updated: CourseDraft) => {
    onUpdateDraft({
      ...updated,
      lastModifiedAt: new Date().toISOString()
    });
  };

  const handleSectionNameChange = (sIdx: number, name: string) => {
    const sections = [...draft.sections];
    sections[sIdx] = { ...sections[sIdx], name };
    updateDraft({ ...draft, sections });
  };

  const handleMoveSection = (sIdx: number, direction: 'UP' | 'DOWN') => {
    const sections = [...draft.sections];
    const targetIdx = direction === 'UP' ? sIdx - 1 : sIdx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const temp = sections[sIdx];
    sections[sIdx] = sections[targetIdx];
    sections[targetIdx] = temp;
    updateDraft({ ...draft, sections });
  };

  const handleDeleteSection = (sIdx: number) => {
    if (window.confirm("Are you sure you want to delete this entire module and all its lessons?")) {
      const sections = draft.sections.filter((_, idx) => idx !== sIdx);
      updateDraft({ ...draft, sections });
    }
  };

  const handleLessonTitleChange = (sIdx: number, lIdx: number, title: string) => {
    const sections = [...draft.sections];
    const lessons = [...sections[sIdx].lessons];
    lessons[lIdx] = { ...lessons[lIdx], title };
    sections[sIdx] = { ...sections[sIdx], lessons };
    updateDraft({ ...draft, sections });
  };

  const handleLessonDurationChange = (sIdx: number, lIdx: number, duration: number) => {
    const sections = [...draft.sections];
    const lessons = [...sections[sIdx].lessons];
    lessons[lIdx] = { ...lessons[lIdx], duration: Math.max(1, duration) };
    sections[sIdx] = { ...sections[sIdx], lessons };
    updateDraft({ ...draft, sections });
  };

  const handleLessonTypeChange = (sIdx: number, lIdx: number, type: any) => {
    const sections = [...draft.sections];
    const lessons = [...sections[sIdx].lessons];
    lessons[lIdx] = { ...lessons[lIdx], type };
    sections[sIdx] = { ...sections[sIdx], lessons };
    updateDraft({ ...draft, sections });
  };

  const handleMoveLesson = (sIdx: number, lIdx: number, direction: 'UP' | 'DOWN') => {
    const sections = [...draft.sections];
    const lessons = [...sections[sIdx].lessons];
    const targetIdx = direction === 'UP' ? lIdx - 1 : lIdx + 1;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;
    const temp = lessons[lIdx];
    lessons[lIdx] = lessons[targetIdx];
    lessons[targetIdx] = temp;
    sections[sIdx] = { ...sections[sIdx], lessons };
    updateDraft({ ...draft, sections });
  };

  const handleDeleteLesson = (sIdx: number, lIdx: number) => {
    const sections = [...draft.sections];
    sections[sIdx] = {
      ...sections[sIdx],
      lessons: sections[sIdx].lessons.filter((_, idx) => idx !== lIdx)
    };
    updateDraft({ ...draft, sections });
  };

  const handleAddLesson = (sIdx: number) => {
    const sections = [...draft.sections];
    const nextLessonNum = sections[sIdx].lessons.length + 1;
    sections[sIdx] = {
      ...sections[sIdx],
      lessons: [
        ...sections[sIdx].lessons,
        {
          id: `draft-lesson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `Lesson ${nextLessonNum}: Dynamic Topic`,
          description: 'Custom added review or exercise',
          type: 'reading',
          duration: 30,
          difficulty: 'Medium',
          provenance: 'Manual'
        }
      ]
    };
    updateDraft({ ...draft, sections });
  };

  const totalMinutes = draft.sections.flatMap(s => s.lessons).reduce((sum, l) => sum + l.duration, 0);
  const totalHours = Math.max(1, Math.round(totalMinutes / 60));

  const triggerSave = async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave(draft);
    } catch (err: any) {
      console.error("Transactional save failure:", err);
      setSaveError(err.message || "A transactional error occurred while saving. The operation was rolled back safely.");
    } finally {
      setIsSaving(false);
    }
  };

  const triggerRegenerate = async () => {
    await onRegenerate(editedDirectives);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/85 backdrop-blur-sm" 
        onClick={() => { if (!isRegenerating && !isSaving) setShowConfirmDiscard(true); }} 
      />

      {/* Main Draft Editor Workspace */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0D12] p-6 shadow-2xl flex flex-col space-y-5" id="draft-workspace-container">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-wide">
                Course Syllabus Draft
              </span>
              <span className="text-[10px] text-[#55555B] font-mono">
                ID: {draft.id}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#D4AF37]" /> Review: {draft.name || draft.goalName}
            </h3>
            <p className="text-xs text-[#94949C]">
              Verify and tailor your AI-generated draft curriculum. Changes are stored locally and committed transactionally when saved.
            </p>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto">
            <button
              onClick={() => setShowConfirmDiscard(true)}
              className="px-4 py-2 text-xs font-bold text-[#94949C] hover:text-white border border-white/5 bg-white/5 rounded-xl transition-colors cursor-pointer"
              disabled={isRegenerating || isSaving}
            >
              Discard Draft
            </button>
            <button
              onClick={triggerSave}
              disabled={isRegenerating || isSaving || draft.sections.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-black bg-[#D4AF37] hover:bg-[#b08e4d] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save to My Learning"}</span>
            </button>
          </div>
        </div>

        {/* LifeCycle Banner / Expiration info */}
        <div className="bg-[#171B24] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
          <div className="flex items-center gap-2 text-[#94949C]">
            <Clock className="w-4 h-4 text-[#D4AF37]/70" />
            <span>Draft Created: <strong className="text-white font-medium">{new Date(draft.createdAt).toLocaleString()}</strong></span>
            <span className="text-white/10 hidden sm:inline">•</span>
            <span>Expires in: <strong className="text-amber-500 font-bold">{daysLeft} days</strong> (Temporary cache)</span>
          </div>
          <div className="text-[10px] text-white/40 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>Provenance: {draft.mode === 'ai' ? 'AI Generated' : 'External Imported'}</span>
          </div>
        </div>

        {/* Error Displays */}
        {(generationError || saveError) && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-red-500">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Error Occurred</p>
              <p className="leading-relaxed">{generationError || saveError}</p>
            </div>
          </div>
        )}

        {/* Regeneration Section */}
        <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowDirectivesBox(!showDirectivesBox)}
              className="text-xs text-[#D4AF37] hover:text-[#dbb56c] font-bold flex items-center gap-1 focus:outline-none"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showDirectivesBox ? "Hide AI Prompt Details" : "View/Modify AI Prompt Instructions"}</span>
              {showDirectivesBox ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={triggerRegenerate}
              disabled={isRegenerating || isSaving}
              className="text-xs font-bold text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-lg border border-white/5 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isRegenerating ? "Regenerating..." : "Regenerate Syllabus"}</span>
            </button>
          </div>

          {showDirectivesBox && (
            <div className="space-y-2.5 pt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B] block">
                Original System Directives & Instructions
              </label>
              <textarea
                value={editedDirectives}
                onChange={e => setEditedDirectives(e.target.value)}
                placeholder="No custom directives were specified. Enter focus areas or instructions here..."
                rows={3}
                className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 resize-none leading-relaxed"
                disabled={isRegenerating || isSaving}
              />
              <p className="text-[10px] text-[#55555B] leading-relaxed">
                Clicking <strong>Regenerate Syllabus</strong> will reuse this prompt and regenerate the course layout. Your unsaved lightweight edits in the preview below will be replaced.
              </p>
            </div>
          )}
        </div>

        {/* AI Loading indicator */}
        {isRegenerating ? (
          <div className="text-center py-16 bg-[#171B24]/20 border border-white/5 rounded-xl space-y-6">
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/10 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#D4AF37] animate-spin" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-bold text-white animate-pulse">
                {generationStep === 0 && "Connecting with Himam AI tutor engine..."}
                {generationStep === 1 && "Re-analyzing study syllabus scope..."}
                {generationStep === 2 && "Curating new practice milestones & lectures..."}
                {generationStep >= 3 && "Ordering dynamic syllabus sections..."}
              </p>
              <p className="text-xs text-[#94949C] max-w-sm mx-auto leading-relaxed">
                Gemini is re-writing a comprehensive study plan matching your directives.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Metadata and Stats */}
            <div className="flex justify-between items-center bg-[#11141C]/40 px-4 py-2.5 border border-white/5 rounded-xl text-xs">
              <span className="text-[#94949C]">Modules: <strong className="text-white font-semibold">{draft.sections.length}</strong></span>
              <span className="text-[#94949C]">Total Lessons: <strong className="text-white font-semibold">{draft.sections.flatMap(s => s.lessons).length}</strong></span>
              <span className="text-[#94949C]">Estimated Pacing: <strong className="text-white font-semibold">~{totalHours} study hours</strong></span>
            </div>

            {/* Syllabus Builder Structure */}
            <div className="space-y-5" id="draft-sections-list">
              {draft.sections.length === 0 ? (
                <div className="p-8 text-center bg-[#171B24]/30 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B]">
                  No modules left in this syllabus. Add sections or regenerate.
                </div>
              ) : (
                draft.sections.map((sec, sIdx) => (
                  <div key={sec.id} className="bg-[#11141C] border border-white/5 rounded-xl p-4 space-y-3.5 shadow-sm">
                    {/* Section/Module Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-white/5">
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <span className="text-xs font-mono font-bold text-[#D4AF37]">M{sIdx + 1}</span>
                        <input
                          type="text"
                          value={sec.name}
                          onChange={e => handleSectionNameChange(sIdx, e.target.value)}
                          className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-white/20 focus:border-[#D4AF37]/40 focus:outline-none pb-0.5 px-0.5 flex-1"
                          placeholder="Module Section Title"
                        />
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => handleMoveSection(sIdx, 'UP')}
                          disabled={sIdx === 0}
                          className="p-1.5 rounded bg-white/5 border border-white/5 text-[#94949C] hover:text-[#D4AF37] disabled:opacity-30 transition-colors"
                          title="Move module up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveSection(sIdx, 'DOWN')}
                          disabled={sIdx === draft.sections.length - 1}
                          className="p-1.5 rounded bg-white/5 border border-white/5 text-[#94949C] hover:text-[#D4AF37] disabled:opacity-30 transition-colors"
                          title="Move module down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSection(sIdx)}
                          className="p-1.5 rounded bg-white/5 border border-white/5 text-[#55555B] hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition-all"
                          title="Delete module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Lessons inside Section */}
                    <div className="space-y-2 border-l border-white/5 pl-4 ml-1">
                      {sec.lessons.length === 0 ? (
                        <div className="text-xs text-[#55555B] italic py-2">
                          No lessons in this section. Add one or delete this module.
                        </div>
                      ) : (
                        sec.lessons.map((les, lIdx) => (
                          <div 
                            key={les.id} 
                            className="bg-white/[0.01] border border-white/5 rounded-xl p-3 space-y-2.5 text-xs relative group hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              {/* Lesson title input */}
                              <div className="flex items-center gap-2 flex-1 w-full">
                                <span className="text-[10px] font-mono text-[#55555B] flex-shrink-0">L{lIdx + 1}</span>
                                <input
                                  type="text"
                                  value={les.title}
                                  onChange={e => handleLessonTitleChange(sIdx, lIdx, e.target.value)}
                                  className="bg-transparent text-xs font-semibold text-white border-b border-transparent hover:border-white/10 focus:border-[#D4AF37]/30 focus:outline-none pb-0.5 flex-1 min-w-0"
                                  placeholder="Lesson Title"
                                />
                              </div>

                              {/* Lesson Controls */}
                              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                                {/* Type Select */}
                                <select
                                  value={les.type}
                                  onChange={e => handleLessonTypeChange(sIdx, lIdx, e.target.value)}
                                  className="bg-[#171B24] border border-white/10 rounded-lg text-[10px] text-white px-2 py-0.5 focus:outline-none focus:border-[#D4AF37]/30"
                                >
                                  <option value="reading">Reading</option>
                                  <option value="video">Video</option>
                                  <option value="practice">Practice</option>
                                  <option value="quiz">Quiz</option>
                                  <option value="revision">Revision</option>
                                  <option value="flashcards">Flashcards</option>
                                  <option value="lab">Lab</option>
                                  <option value="assignment">Assignment</option>
                                </select>

                                {/* Duration number adjustment */}
                                <div className="flex items-center gap-1 bg-[#171B24] px-1.5 py-0.5 rounded-lg border border-white/10">
                                  <input
                                    type="number"
                                    value={les.duration}
                                    onChange={e => handleLessonDurationChange(sIdx, lIdx, parseInt(e.target.value) || 10)}
                                    className="w-8 bg-transparent text-[10px] font-mono text-center text-white focus:outline-none"
                                    min={1}
                                  />
                                  <span className="text-[9px] text-[#55555B] font-bold">m</span>
                                </div>

                                {/* Reordering Buttons */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleMoveLesson(sIdx, lIdx, 'UP')}
                                    disabled={lIdx === 0}
                                    className="p-1 rounded text-[#55555B] hover:text-white disabled:opacity-20 transition-colors"
                                    title="Move lesson up"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveLesson(sIdx, lIdx, 'DOWN')}
                                    disabled={lIdx === sec.lessons.length - 1}
                                    className="p-1 rounded text-[#55555B] hover:text-white disabled:opacity-20 transition-colors"
                                    title="Move lesson down"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(sIdx, lIdx)}
                                    className="p-1 rounded text-[#55555B] hover:text-red-500 transition-colors"
                                    title="Delete lesson"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Provenance and subtext indicators */}
                            <div className="flex justify-between items-center text-[9px] text-[#55555B] border-t border-white/[0.02] pt-1.5">
                              <p className="truncate max-w-[70%]">{les.description || "No lecture summary provided yet."}</p>
                              <span className="flex items-center gap-1 font-mono uppercase bg-white/[0.02] border border-white/5 px-1.5 py-0.2 rounded text-[#94949C]">
                                <Tag className="w-2 h-2 text-[#D4AF37]" />
                                {les.provenance || (draft.mode === 'ai' ? 'AI' : 'Imported')}
                              </span>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Add Lesson to Module button */}
                      <button
                        onClick={() => handleAddLesson(sIdx)}
                        className="text-[10px] font-bold text-[#D4AF37]/80 hover:text-[#D4AF37] flex items-center gap-1 pt-1 ml-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Lesson to Section
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="flex justify-between items-center border-t border-white/5 pt-4">
          <button
            onClick={() => setShowConfirmDiscard(true)}
            className="px-4 py-2 text-xs font-bold text-red-500 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 hover:bg-red-500/5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            disabled={isRegenerating || isSaving}
          >
            <Trash2 className="w-4 h-4" />
            <span>Discard This Draft</span>
          </button>

          <button
            onClick={triggerSave}
            disabled={isRegenerating || isSaving || draft.sections.length === 0}
            className="px-6 py-3 text-xs font-bold text-black bg-[#D4AF37] hover:bg-[#b08e4d] rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{isSaving ? "Saving..." : "Approve & Save Course to Workspace"}</span>
          </button>
        </div>
      </div>

      {/* Discard Confirmation Modal Overlay */}
      {showConfirmDiscard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xs" onClick={() => setShowConfirmDiscard(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#11141C] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="text-sm font-bold text-white">Discard Course Draft?</h4>
            </div>
            <p className="text-xs text-[#94949C] leading-relaxed">
              Are you sure? This will permanently delete your custom generated curriculum draft. If you have active browser refreshes, they won't save this draft. This operation cannot be undone.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmDiscard(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white hover:bg-white/5 transition-colors"
              >
                No, Keep Draft
              </button>
              <button
                onClick={() => {
                  setShowConfirmDiscard(false);
                  onDiscard();
                }}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 py-2.5 text-xs font-bold text-white transition-colors"
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
