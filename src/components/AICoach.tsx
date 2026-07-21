import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile, AIMemory, MemoryCategory, getMemories, saveMemory, deleteMemory } from '../models';
import { CourseCatalog } from '../services/courseCatalog';
import { buildAIContext } from '../services/aiContextBuilder';
import { AI_COACH_INTENTS, AICoachIntent, buildCoachSystemPrompt, buildCoachUserPrompt } from '../services/aiPrompts';
import { sendCoachMessages, AICoachChatMessage, extractMemories } from '../services/aiCoachClient';
import { orchestrateCoachCall } from '../services/aiOrchestrator';
import {
  AICoachConversation, loadConversations, saveConversation, deleteConversation, createEmptyConversation,
} from '../models/aiCoachHistory';
import { getCourseShortLabel } from '../models/courseDisplay';
import { generateId } from '../models/id';
import {
  Sparkles, Send, Plus, MessageSquare, Trash2, Sun, TrendingUp, CalendarClock,
  BookOpenCheck, Route, ClipboardList, HelpCircle, Loader2, ChevronDown, BrainCircuit,
} from 'lucide-react';

interface AICoachProps {
  state: StudyPlanState;
  profile: Profile;
}

const INTENT_ICONS: Record<AICoachIntent, React.ComponentType<{ className?: string }>> = {
  today_plan: Sun,
  am_i_on_track: TrendingUp,
  adjust_schedule: CalendarClock,
  explain_lesson: BookOpenCheck,
  generate_learning_plan: Route,
  review_progress: ClipboardList,
  ask_anything: HelpCircle,
};

export default function AICoach({ state, profile }: AICoachProps) {
  const [conversations, setConversations] = useState<AICoachConversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id || null);
  const [inputValue, setInputValue] = useState('');
  const [pendingIntent, setPendingIntent] = useState<AICoachIntent | null>(null);
  const [focusLessonId, setFocusLessonId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemCategory, setNewMemCategory] = useState<MemoryCategory>('preference');
  const [newMemImportance, setNewMemImportance] = useState<number>(5);
  const [newMemSummary, setNewMemSummary] = useState<string>('');

  const loadAllMemories = async () => {
    try {
      const list = await getMemories(profile.id);
      setMemories(list);
    } catch (e) {
      console.error('Failed to load memories:', e);
    }
  };

  useEffect(() => {
    loadAllMemories();
  }, [profile.id]);

  const handleAddManualMemory = async () => {
    if (!newMemSummary.trim()) return;
    const newMem: AIMemory = {
      id: generateId('mem'),
      userId: profile.id || 'guest',
      category: newMemCategory,
      importance: newMemImportance,
      confidence: 1.0, // Manual additions have absolute certainty
      summary: newMemSummary.trim(),
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveMemory(newMem, profile.id);
    setNewMemSummary('');
    setShowAddMemory(false);
    loadAllMemories();
  };

  const handleRemoveMemory = async (id: string) => {
    await deleteMemory(id, profile.id);
    loadAllMemories();
  };

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  // Flat, catalog-driven lesson list for the "Explain This Lesson" picker —
  // no hardcoded course names, generated from whatever is currently active.
  const lessonOptions = useMemo(() => {
    const activeCourses = CourseCatalog.getActiveCourses(profile.learningGoals, profile.learningGoalDetails);
    return activeCourses.flatMap(course =>
      course.sections.flatMap(section =>
        section.lessons.map(lesson => ({
          id: lesson.id,
          label: `${getCourseShortLabel(course)} \u2014 ${lesson.title}`,
        }))
      )
    );
  }, [profile.learningGoals]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeConversation?.displayMessages.length, loading]);

  const persist = (conversation: AICoachConversation) => {
    saveConversation(conversation);
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conversation.id);
      const next = idx >= 0 ? [...prev.slice(0, idx), conversation, ...prev.slice(idx + 1)] : [conversation, ...prev];
      return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    });
  };

  const handleNewConversation = () => {
    setActiveId(null);
    setPendingIntent(null);
    setFocusLessonId('');
    setInputValue('');
    setError(null);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  /**
   * Sends one turn to the Coach. All business logic (what the model knows,
   * what instruction it gets) is delegated to aiContextBuilder/aiPrompts —
   * this function only assembles the conversation and calls the client.
   */
  const sendTurn = async (opts: { intent?: AICoachIntent; freeformText?: string }) => {
    setError(null);
    setLoading(true);

    try {
      const isNewConversation = !activeConversation;
      const context = buildAIContext(profile, state, {
        focusLessonId: opts.intent === 'explain_lesson' ? (focusLessonId || undefined) : undefined,
        memories,
      });

      const userDisplayText = opts.intent === 'explain_lesson' && context.focusLesson
        ? `Explain: ${context.focusLesson.title}`
        : (opts.freeformText || AI_COACH_INTENTS.find(i => i.id === opts.intent)?.label || '');

      const providerMessages: AICoachChatMessage[] = isNewConversation
        ? [{ role: 'system', content: buildCoachSystemPrompt(context) }]
        : [...activeConversation!.providerMessages];

      const userPromptText = opts.intent
        ? buildCoachUserPrompt(opts.intent, context, opts.freeformText)
        : (opts.freeformText || '');

      providerMessages.push({ role: 'user', content: userPromptText });

      const result = await orchestrateCoachCall(providerMessages);
      const replyText = result.text;
      const responseSource = result.source;
      providerMessages.push({ role: 'assistant', content: replyText });

      const now = new Date().toISOString();
      const base = activeConversation || createEmptyConversation(
        userDisplayText.length > 48 ? userDisplayText.slice(0, 45) + '\u2026' : userDisplayText
      );

      const updated: AICoachConversation = {
        ...base,
        providerMessages,
        displayMessages: [
          ...base.displayMessages,
          { id: generateId('msg'), role: 'user', content: userDisplayText, createdAt: now },
          { id: generateId('msg'), role: 'assistant', content: replyText, createdAt: now, source: responseSource },
        ],
        updatedAt: now,
      };

      persist(updated);
      setActiveId(updated.id);
      setInputValue('');
      setPendingIntent(null);
      setFocusLessonId('');

      // Background, non-blocking evaluation of whether any new memories can be extracted
      setTimeout(async () => {
        try {
          const candidates = await extractMemories(updated.providerMessages, memories);
          if (candidates && candidates.length > 0) {
            for (const cand of candidates) {
              if (cand.action === 'delete' && cand.id) {
                await deleteMemory(cand.id, profile.id);
              } else if (cand.action === 'update' && cand.id) {
                const existing = memories.find(m => m.id === cand.id);
                if (existing) {
                  const updatedMem: AIMemory = {
                    ...existing,
                    category: cand.category as any,
                    importance: cand.importance,
                    confidence: cand.confidence,
                    summary: cand.summary,
                    source: cand.source || 'conversation',
                    updatedAt: new Date().toISOString(),
                  };
                  await saveMemory(updatedMem, profile.id);
                }
              } else {
                const newMem: AIMemory = {
                  id: generateId('mem'),
                  userId: profile.id || 'guest',
                  category: cand.category as any,
                  importance: cand.importance,
                  confidence: cand.confidence,
                  summary: cand.summary,
                  source: cand.source || 'conversation',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                await saveMemory(newMem, profile.id);
              }
            }
            loadAllMemories();
          }
        } catch (extractErr) {
          console.warn('Background memory extraction failed:', extractErr);
        }
      }, 50);

    } catch (err: any) {
      setError(err.message || 'Could not reach the AI Coach. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleIntentClick = (intentId: AICoachIntent) => {
    const def = AI_COACH_INTENTS.find(i => i.id === intentId)!;
    if (def.requiresFocusLesson || def.requiresFreeformInput) {
      // Needs more input from the learner first — don't send yet.
      setPendingIntent(intentId);
      return;
    }
    sendTurn({ intent: intentId });
  };

  const handleSubmitPending = () => {
    if (!pendingIntent) return;
    if (pendingIntent === 'explain_lesson' && !focusLessonId) return;
    sendTurn({ intent: pendingIntent, freeformText: inputValue.trim() || undefined });
  };

  const handleFreeformSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    if (pendingIntent) {
      sendTurn({ intent: pendingIntent, freeformText: text });
    } else {
      sendTurn({ intent: 'ask_anything', freeformText: text });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5" id="ai-coach-view" style={{ minHeight: '70vh' }}>
      {/* ---------------- Conversation History Sidebar ---------------- */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl p-3 flex flex-col gap-2 lg:max-h-[75vh]">
        <button
          onClick={handleNewConversation}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-90 text-white text-xs font-bold rounded-lg py-2.5 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New Conversation
        </button>

        <div className="text-[10px] uppercase tracking-wider text-[#55555B] font-semibold px-1 pt-2">
          History
        </div>

        <div className="flex-[2] overflow-y-auto space-y-1 min-h-[120px] max-h-[40%]">
          {conversations.length === 0 && (
            <div className="text-[11px] text-[#55555B] px-1 py-4 text-center italic">
              No conversations yet. Pick a suggested prompt to get started.
            </div>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => { setActiveId(conv.id); setPendingIntent(null); }}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                activeId === conv.id ? 'bg-white/5 text-white' : 'text-[#94949C] hover:bg-white/5 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-[#55555B]" />
              <span className="text-xs truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 text-[#55555B] hover:text-[#EF4444] transition-all flex-shrink-0"
                title="Delete conversation"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* ---------------- Coach Memories Panel ---------------- */}
        <div className="border-t border-white/5 pt-3 mt-1 flex flex-col flex-[3] overflow-hidden">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="text-[10px] uppercase tracking-wider text-[#55555B] font-semibold flex items-center gap-1.5">
              <span>🧠 Coach's Memories</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAddMemory(!showAddMemory)}
                className="text-[#94949C] hover:text-[#D4AF37] transition-colors"
                title="Add manual memory"
              >
                <Plus className="w-3 h-3" />
              </button>
              {memories.length > 0 && (
                <span className="text-[9px] bg-white/5 text-[#D4AF37] px-1.5 py-0.5 rounded-full font-mono font-medium">
                  {memories.length}
                </span>
              )}
            </div>
          </div>

          {showAddMemory && (
            <div className="bg-white/[0.02] border border-[#D4AF37]/20 rounded-lg p-2.5 mb-2.5 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={newMemCategory}
                  onChange={(e) => setNewMemCategory(e.target.value as any)}
                  className="bg-[#171B24] border border-white/5 text-[10px] text-white rounded p-1 focus:outline-none focus:border-[#D4AF37]/40"
                >
                  <option value="preference">Preference</option>
                  <option value="weakness">Weakness</option>
                  <option value="strength">Strength</option>
                  <option value="habit">Habit</option>
                  <option value="goal">Goal</option>
                  <option value="milestone">Milestone</option>
                  <option value="motivation">Motivation</option>
                </select>
                <select
                  value={newMemImportance}
                  onChange={(e) => setNewMemImportance(Number(e.target.value))}
                  className="bg-[#171B24] border border-white/5 text-[10px] text-white rounded p-1 focus:outline-none focus:border-[#D4AF37]/40"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i} value={10 - i}>Imp: {10 - i}/10</option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={newMemSummary}
                onChange={(e) => setNewMemSummary(e.target.value)}
                placeholder="e.g. Learns best with visual models."
                className="w-full bg-[#171B24] border border-white/5 text-[10px] text-white rounded p-1.5 placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
              />
              <div className="flex items-center justify-end gap-1.5 text-[9px]">
                <button
                  onClick={() => setShowAddMemory(false)}
                  className="text-[#94949C] hover:text-white px-2 py-0.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddManualMemory}
                  disabled={!newMemSummary.trim()}
                  className="bg-[#D4AF37] text-[#0B0D12] font-bold px-2 py-0.5 rounded disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-[11px] min-h-[120px]">
            {memories.length === 0 ? (
              <div className="text-[10px] text-[#55555B] px-1 py-4 text-center italic leading-relaxed">
                No long-term memories saved yet. Talk to the coach to teach it about your preferences and habits!
              </div>
            ) : (
              memories.map(mem => (
                <div
                  key={mem.id}
                  className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 relative group hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase font-mono font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-1 py-0.5 rounded">
                      {mem.category}
                    </span>
                    <button
                      onClick={() => handleRemoveMemory(mem.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#55555B] hover:text-[#EF4444] transition-opacity absolute top-2 right-2"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-white/80 leading-relaxed font-sans">{mem.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[8px] text-[#55555B] font-mono">
                    <span>Imp: {mem.importance}/10</span>
                    <span>•</span>
                    <span>Conf: {Math.round(mem.confidence * 100)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Main Chat Panel ---------------- */}
      <div className="bg-[#11141C] border border-white/5 rounded-xl flex flex-col lg:max-h-[75vh]">
        <div className="p-5 border-b border-white/5 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#171B24] border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-white">AI Coach</h2>
            <p className="text-[11px] text-[#94949C]">Grounded in your live progress, schedule, and goals</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[300px]">
          {!activeConversation ? (
            <div className="space-y-5">
              <p className="text-xs text-[#94949C] leading-relaxed max-w-lg">
                Ask your coach about today's plan, your pace, or a specific lesson — or start with one of these:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AI_COACH_INTENTS.map(intent => {
                  const Icon = INTENT_ICONS[intent.id];
                  return (
                    <button
                      key={intent.id}
                      onClick={() => handleIntentClick(intent.id)}
                      className="text-left bg-[#171B24] border border-white/5 hover:border-[#D4AF37]/30 rounded-xl p-4 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-4 h-4 text-[#D4AF37]" />
                        <span className="text-xs font-bold text-white">{intent.label}</span>
                      </div>
                      <p className="text-[11px] text-[#94949C] leading-relaxed">{intent.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            activeConversation.displayMessages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white'
                      : 'bg-[#171B24] border border-white/5 text-white'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'assistant' && msg.source && (
                  <span className="text-[8px] font-mono uppercase font-bold tracking-wider text-[#D4AF37] mt-1 ml-1 opacity-70">
                    {msg.source === 'deterministic' && '⚡ Local Instant Engine'}
                    {msg.source === 'cache' && '💾 Smart Cache'}
                    {msg.source === 'live' && '🌐 Live AI Engine'}
                  </span>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#171B24] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-[#94949C] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" /> Coach is thinking…
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#1C1212] border border-[#EF4444]/30 text-xs text-[#FCA5A5] rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* ---------------- Input Area ---------------- */}
        <div className="p-4 border-t border-white/5 space-y-2.5">
          {pendingIntent === 'explain_lesson' && (
            <div className="flex items-center gap-2 bg-[#171B24] border border-white/5 rounded-lg px-3 py-2">
              <BookOpenCheck className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0" />
              <div className="relative flex-1">
                <select
                  value={focusLessonId}
                  onChange={(e) => setFocusLessonId(e.target.value)}
                  className="w-full appearance-none bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-6"
                >
                  <option value="" className="bg-[#171B24]">Choose a lesson to explain…</option>
                  {lessonOptions.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-[#171B24]">{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#55555B] absolute right-0 top-1 pointer-events-none" />
              </div>
              <button
                onClick={handleSubmitPending}
                disabled={!focusLessonId || loading}
                className="bg-[#D4AF37] text-[#0B0D12] text-[10px] font-bold px-3 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Explain
              </button>
            </div>
          )}

          {pendingIntent === 'generate_learning_plan' && (
            <div className="text-[10px] text-[#94949C] px-1">
              What goal, certification, degree, or skill should the plan be for?
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleFreeformSend(); }}
              placeholder={
                pendingIntent === 'generate_learning_plan'
                  ? 'e.g. "AWS Solutions Architect Associate"'
                  : 'Ask your AI Coach anything\u2026'
              }
              disabled={loading || pendingIntent === 'explain_lesson'}
              className="flex-1 bg-[#171B24] border border-white/5 rounded-lg py-2.5 px-3.5 min-h-[44px] text-base sm:text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 disabled:opacity-50"
            />
            <button
              onClick={handleFreeformSend}
              disabled={loading || !inputValue.trim() || pendingIntent === 'explain_lesson'}
              className="bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-90 text-white rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
