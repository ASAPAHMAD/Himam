import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';
import { buildAIContext } from '../services/aiContextBuilder';
import { buildCoachSystemPrompt, buildCoachUserPrompt } from '../services/aiPrompts';
import { orchestrateCoachCall } from '../services/aiOrchestrator';
import {
  AICoachConversation,
  loadConversations,
  saveConversation,
  createEmptyConversation
} from '../models/aiCoachHistory';
import { generateId } from '../models/id';

interface IntegratedAICoachProps {
  state: StudyPlanState;
  profile: Profile;
  onClose?: () => void;
}

export default function IntegratedAICoach({ state, profile, onClose }: IntegratedAICoachProps) {
  const [conversations, setConversations] = useState<AICoachConversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const list = loadConversations();
    return list[0]?.id || null;
  });
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.displayMessages.length, loading]);

  const persist = (conversation: AICoachConversation) => {
    saveConversation(conversation);
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conversation.id);
      const next = idx >= 0 ? [...prev.slice(0, idx), conversation, ...prev.slice(idx + 1)] : [conversation, ...prev];
      return next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    });
  };

  const sendTurn = async (text: string, intent: string = 'ask_anything') => {
    if (!text.trim() || loading) return;

    setError(null);
    setLoading(true);
    setInputValue('');

    const userText = text.trim();

    try {
      const isNewConversation = !activeConversation;
      const context = buildAIContext(profile, state, {});
      
      const providerMessages = isNewConversation
        ? [{ role: 'system' as const, content: buildCoachSystemPrompt(context) }]
        : [...activeConversation!.providerMessages];

      const userPromptText = intent === 'ask_anything' 
        ? userText 
        : buildCoachUserPrompt(intent as any, context, userText);

      providerMessages.push({ role: 'user' as const, content: userPromptText });

      const result = await orchestrateCoachCall(providerMessages);
      const replyText = result.text;
      const responseSource = result.source;
      
      providerMessages.push({ role: 'assistant' as const, content: replyText });

      const now = new Date().toISOString();
      const base = activeConversation || createEmptyConversation(
        userText.length > 40 ? userText.slice(0, 37) + '...' : userText
      );

      const updated: AICoachConversation = {
        ...base,
        providerMessages,
        displayMessages: [
          ...base.displayMessages,
          { id: generateId('msg'), role: 'user', content: userText, createdAt: now },
          { id: generateId('msg'), role: 'assistant', content: replyText, createdAt: now, source: responseSource },
        ],
        updatedAt: now,
      };

      persist(updated);
      setActiveId(updated.id);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not reach the AI Coach. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (suggestionText: string, intent: string) => {
    sendTurn(suggestionText, intent);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendTurn(inputValue, 'ask_anything');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const suggestionChips = [
    { text: 'Explain this lesson in detail', intent: 'explain_lesson', display: 'Explain this lesson' },
    { text: 'Am I on track to meet my goals?', intent: 'am_i_on_track', display: 'Am I on track?' },
    { text: 'Generate a study plan for me', intent: 'generate_learning_plan', display: 'Generate study plan' },
    { text: 'Find relevant tech internship opportunities', intent: 'ask_anything', display: 'Find internships' },
    { text: 'Summarize my uploaded PDF document', intent: 'ask_anything', display: 'Summarize my PDF' },
    { text: 'Quiz me on my active study materials', intent: 'ask_anything', display: 'Quiz me' }
  ];

  return (
    <div className="flex flex-col h-full bg-[#11141C] border-l border-white/5 text-white overflow-hidden select-none">
      {/* HEADER */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-[#5DA9FF]/10 flex items-center justify-center border border-[#5DA9FF]/20">
              <Sparkles className="w-4 h-4 text-[#5DA9FF]" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#3DDC84] border border-[#11141C] rounded-full"></div>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-white tracking-wide">AI Coach</h3>
            <span className="text-[10px] text-[#3DDC84] font-medium block leading-none mt-0.5">● Online</span>
          </div>
        </div>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-[#94949C] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* CHAT MESSAGES PANEL */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5"
      >
        {activeConversation?.displayMessages.length === 0 || !activeConversation ? (
          <div className="space-y-4 py-6">
            <div className="bg-[#171B24]/40 border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#5DA9FF]">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">AI Coach Welcome</span>
              </div>
              <p className="text-xs text-[#94949C] leading-relaxed">
                Good morning, {profile.name || 'Ahmed'}! I've analyzed your schedule, registered exam deadlines, and study achievements. You have several priorities today that will move you closer to your certification target.
              </p>
              <p className="text-xs text-[#94949C] leading-relaxed">
                How can I assist you in mastering your syllabus or planning your career path today?
              </p>
            </div>
            
            <div className="text-[10px] text-[#55555B] uppercase tracking-wider font-bold">
              Suggested Insights
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {activeConversation.displayMessages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div 
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-white border border-[#D4AF37]/30 rounded-tr-none' 
                      : 'bg-[#171B24] text-[#E0E0E6] border border-white/5 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] text-[#55555B] mt-1 px-1 font-mono">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#94949C] bg-[#171B24]/40 border border-white/5 p-3 rounded-xl max-w-[80%] animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5DA9FF]" />
            <span>AI Coach is thinking...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-500/20 rounded-xl text-xs text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* SUGGESTIONS CHIPS (SLIDABLE / STACKED) */}
      <div className="px-4 py-2 border-t border-white/5 flex flex-wrap gap-1.5 bg-[#171B24]/20 flex-shrink-0">
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleChipClick(chip.text, chip.intent)}
            className="text-[10.5px] font-medium bg-[#171B24] hover:bg-[#1C212C] border border-white/5 hover:border-[#D4AF37]/30 text-[#94949C] hover:text-white px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer shadow-sm text-left block"
          >
            {chip.display} <span className="text-[#D4AF37] ml-0.5 font-mono">→</span>
          </button>
        ))}
      </div>

      {/* INPUT BAR */}
      <div className="p-4 border-t border-white/5 bg-[#11141C] flex items-center gap-2 flex-shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          className="flex-1 bg-[#171B24] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#55555B] focus:border-[#D4AF37]/40 focus:ring-1 focus:ring-[#D4AF37]/20 transition-all font-sans"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || loading}
          className="w-9 h-9 bg-gradient-to-r from-[#D4AF37] to-[#E6C35C] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all flex-shrink-0 shadow-md shadow-[#D4AF37]/10"
        >
          <Send className="w-3.5 h-3.5 text-[#0B0D12]" />
        </button>
      </div>
    </div>
  );
}
