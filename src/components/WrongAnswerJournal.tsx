import React, { useState } from 'react';
import { StudyPlanState, WrongAnswer } from '../services/Sync/types';
import { AlertCircle, Trash2, Plus, RefreshCw, Hash } from 'lucide-react';

/**
 * Phase 1 migration note: verified, no changes needed.
 *
 * Unlike Statistics/Achievements/Roadmap, this component has no hardcoded
 * course references at all — `topic` is a free-text tag the user types
 * themselves (e.g. "DAX", "RLS"), not tied to any certification's identity,
 * and nothing here reads `l.course`, `ALL_LESSONS`, or a person's name.
 * It was already course-agnostic and person-agnostic before this refactor;
 * confirmed by inspection during the Phase 1 component-by-component pass
 * (see ROADMAP.md / CHANGELOG.md).
 */
interface WrongAnswerJournalProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
}

export default function WrongAnswerJournal({ state, onUpdateState }: WrongAnswerJournalProps) {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [whyWrong, setWhyWrong] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!question.trim()) {
      setErrorMessage('The question field is required.');
      return;
    }

    const newEntry: WrongAnswer = {
      id: `err-${Date.now()}`,
      question: question.trim(),
      topic: topic.trim() || undefined,
      whyWrong: whyWrong.trim(),
      correctAnswer: correctAnswer.trim(),
      date: new Date().toISOString().slice(0, 10)
    };

    onUpdateState({
      ...state,
      journal: [newEntry, ...state.journal]
    });

    // Clear Form fields
    setQuestion('');
    setTopic('');
    setWhyWrong('');
    setCorrectAnswer('');
  };

  const handleDeleteEntry = (id: string) => {
    onUpdateState({
      ...state,
      journal: state.journal.filter(entry => entry.id !== id)
    });
  };

  return (
    <div className="space-y-6" id="journal-view">
      {/* Intro block */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-5">
        <h2 className="font-serif text-xl font-bold text-white mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[#EF4444]" /> Wrong Answer Journal
        </h2>
        <p className="text-xs text-[#94949C] leading-relaxed">
          Log incorrect exam and quiz answers. Analyze precisely why you missed them so you never make the same error twice. The Smart Coach automatically warns you of recurring topic patterns!
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleAddEntry} className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add Journal Entry
        </h3>

        {errorMessage && (
          <div className="text-xs text-[#EF4444] bg-[#1C1212] border border-[#EF4444]/20 rounded p-2.5">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#94949C] font-bold uppercase">Question or Topic Description</label>
            <input
              type="text"
              placeholder="e.g., CALCULATE filter context override behavior"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-[#11141C] border border-white/5 hover:border-[#D4AF37]/40 focus:border-[#D4AF37]/60 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-[#94949C] font-bold uppercase">Topic Tag (Optional)</label>
            <input
              type="text"
              placeholder="e.g., CALCULATE, DAX, RLS, Cardinality"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-[#11141C] border border-white/5 hover:border-[#D4AF37]/40 focus:border-[#D4AF37]/60 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#94949C] font-bold uppercase">Why did you get it wrong?</label>
          <textarea
            placeholder="e.g., I forgot that CALCULATE overrides filter context on existing columns unless wrapped inside KEEPFILTERS."
            value={whyWrong}
            onChange={(e) => setWhyWrong(e.target.value)}
            className="w-full bg-[#11141C] border border-white/5 hover:border-[#D4AF37]/40 focus:border-[#D4AF37]/60 rounded-lg p-3 text-xs text-white placeholder-[#55555B] h-20 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/10 resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-[#94949C] font-bold uppercase">Correct Concept to Remember</label>
          <textarea
            placeholder="e.g., KEEPFILTERS preserves current filter context and intersects it with the new filter arguments instead of overriding."
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            className="w-full bg-[#11141C] border border-white/5 hover:border-[#D4AF37]/40 focus:border-[#D4AF37]/60 rounded-lg p-3 text-xs text-white placeholder-[#55555B] h-20 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/10 resize-y"
          />
        </div>

        <button
          type="submit"
          className="bg-[#D4AF37] hover:bg-[#D7B573] active:scale-[0.98] text-black font-bold text-xs py-2 px-4 rounded-lg cursor-pointer transition-all flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Save Entry
        </button>
      </form>

      {/* Entries List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#94949C] pl-1">Logged Mistakes ({state.journal.length})</h3>
        
        {state.journal.length === 0 ? (
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-10 text-center text-xs text-[#55555B]">
            Your journal is currently clear. Excellent work holding a high accuracy score!
          </div>
        ) : (
          <div className="space-y-3">
            {state.journal.map(entry => (
              <div key={entry.id} className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-white">{entry.question}</span>
                    {entry.topic && (
                      <span className="inline-flex items-center gap-0.5 bg-[#171B24] text-[#D4AF37] border border-[#D4AF37]/30 rounded-full px-2.5 py-0.5 text-[9px] font-semibold font-mono uppercase mt-1">
                        <Hash className="w-2.5 h-2.5" /> {entry.topic}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1.5 text-[#55555B] hover:text-[#EF4444] hover:bg-[#1C1212] rounded-lg transition-colors cursor-pointer"
                    title="Remove entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-white/5">
                  <div className="space-y-1">
                    <span className="block font-bold text-[#EF4444] uppercase text-[9px] tracking-wider">Why wrong:</span>
                    <p className="text-[#94949C] leading-relaxed text-[11px]">{entry.whyWrong || 'Not documented'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="block font-bold text-[#10B981] uppercase text-[9px] tracking-wider">The fix / Concept:</span>
                    <p className="text-[#E0E0E6] leading-relaxed text-[11px]">{entry.correctAnswer || 'Not documented'}</p>
                  </div>
                </div>

                <div className="text-[9px] text-[#55555B] text-right font-mono">
                  Logged on {entry.date}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
