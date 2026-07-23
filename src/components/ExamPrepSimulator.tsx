import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Award, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  HelpCircle, 
  Layers, 
  Zap, 
  BookOpen, 
  TrendingDown, 
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { KnowledgeDocument } from './KnowledgeLibrary';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicTag: string;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  topicTag: string;
  mastered?: boolean;
}

const PRESET_SUBJECTS = [
  { id: 'networking', name: 'Networking & Communication', icon: '🌐', count: '12 Questions' },
  { id: 'database', name: 'Database Systems & SQL', icon: '🗄️', count: '15 Questions' },
  { id: 'ai-eng', name: 'AI Engineering & Machine Learning', icon: '🤖', count: '10 Questions' },
  { id: 'cloud', name: 'Cloud Architecture & DevOps', icon: '☁️', count: '10 Questions' },
];

const DEFAULT_QUESTIONS: Record<string, Question[]> = {
  networking: [
    {
      id: 'net-1',
      question: 'Which OSI layer is responsible for end-to-end communication, flow control, and error recovery using TCP or UDP?',
      options: ['Network Layer (Layer 3)', 'Transport Layer (Layer 4)', 'Data Link Layer (Layer 2)', 'Session Layer (Layer 5)'],
      correctIndex: 1,
      explanation: 'Layer 4 (Transport Layer) manages end-to-end communication, segmentation, error recovery, and flow control using TCP or UDP protocols.',
      topicTag: 'OSI Model & Layer 4'
    },
    {
      id: 'net-2',
      question: 'What is the network address for an IP 192.168.1.130 with a subnet mask of 255.255.255.192 (/26)?',
      options: ['192.168.1.0', '192.168.1.64', '192.168.1.128', '192.168.1.192'],
      correctIndex: 2,
      explanation: 'A /26 subnet mask (255.255.255.192) has subnet block sizes of 64. Subnets start at .0, .64, .128, .192. Since 130 falls between 128 and 191, the subnet network address is 192.168.1.128.',
      topicTag: 'Subnetting & CIDR'
    },
    {
      id: 'net-3',
      question: 'Which protocol operates on port 443 and encrypts HTTP traffic using TLS?',
      options: ['SSH', 'HTTPS', 'FTPS', 'DNSSEC'],
      correctIndex: 1,
      explanation: 'HTTPS (Hypertext Transfer Protocol Secure) operates on port 443 and encrypts data using Transport Layer Security (TLS).',
      topicTag: 'Security & Ports'
    },
    {
      id: 'net-4',
      question: 'What mechanism prevents loop topologies in Layer 2 Ethernet switched networks?',
      options: ['BGP (Border Gateway Protocol)', 'Spanning Tree Protocol (STP)', 'Network Address Translation (NAT)', 'OSPF'],
      correctIndex: 1,
      explanation: 'STP (IEEE 802.1D) detects and blocks redundant physical loops in Layer 2 Ethernet networks.',
      topicTag: 'Layer 2 Switching'
    }
  ],
  database: [
    {
      id: 'db-1',
      question: 'Which SQL clause is evaluated BEFORE aggregate functions like COUNT() or SUM() are applied?',
      options: ['HAVING', 'WHERE', 'ORDER BY', 'GROUP BY'],
      correctIndex: 1,
      explanation: 'The WHERE clause filters individual rows BEFORE grouping and aggregate processing. HAVING filters after aggregation.',
      topicTag: 'SQL Execution Order'
    },
    {
      id: 'db-2',
      question: 'What property in ACID guarantees that all operations within a transaction complete successfully or none are applied?',
      options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
      correctIndex: 0,
      explanation: 'Atomicity ensures "all-or-nothing" execution. If any statement fails, the entire transaction is rolled back.',
      topicTag: 'ACID Transactions'
    },
    {
      id: 'db-3',
      question: 'What type of index is most effective for range queries (e.g., WHERE age BETWEEN 20 AND 30) in relational databases?',
      options: ['Hash Index', 'B-Tree Index', 'Bitmap Index', 'Full-Text Index'],
      correctIndex: 1,
      explanation: 'B-Tree indexes maintain sorted order, making them ideal for equality and range queries like BETWEEN, >, <.',
      topicTag: 'Database Indexing'
    }
  ],
  'ai-eng': [
    {
      id: 'ai-1',
      question: 'What attention mechanism component in Transformers computes how much focus to place on other words in a sequence?',
      options: ['Scaled Dot-Product Attention', 'Residual Connection', 'Layer Normalization', 'Feedforward Network'],
      correctIndex: 0,
      explanation: 'Scaled Dot-Product Attention computes query-key matrix multiplications scaled by sqrt(d_k) to compute attention weights.',
      topicTag: 'Transformer Architecture'
    },
    {
      id: 'ai-2',
      question: 'Which metric is most appropriate for evaluating an imbalanced binary classifier where false negatives are critical?',
      options: ['Accuracy', 'Precision', 'Recall (Sensitivity)', 'Specificity'],
      correctIndex: 2,
      explanation: 'Recall measures the proportion of actual positive cases correctly identified. High recall minimizes costly false negatives.',
      topicTag: 'Model Evaluation'
    }
  ]
};

const DEFAULT_FLASHCARDS: Record<string, Flashcard[]> = {
  networking: [
    { id: 'fc-1', front: 'What is the purpose of the ARP protocol?', back: 'Address Resolution Protocol resolves Layer 3 IP addresses to Layer 2 MAC addresses on local network segments.', topicTag: 'Layer 2/3 Protocols' },
    { id: 'fc-2', front: 'Compare TCP vs UDP header sizes.', back: 'TCP header is 20-60 bytes (connection-oriented, reliable). UDP header is fixed at 8 bytes (connectionless, fast).', topicTag: 'Transport Layer' },
    { id: 'fc-3', front: 'What is a BGP Autonomous System (AS)?', back: 'A connected group of IP networks under a single administrative domain sharing a unified routing policy.', topicTag: 'Routing & BGP' },
  ],
  database: [
    { id: 'fc-db-1', front: 'Explain 3rd Normal Form (3NF).', back: 'A table is in 3NF if it is in 2NF and has no transitive functional dependencies (non-key columns must depend strictly on the primary key).', topicTag: 'Normalization' },
    { id: 'fc-db-2', front: 'What is the difference between INNER JOIN and LEFT JOIN?', back: 'INNER JOIN returns matching records in both tables. LEFT JOIN returns all rows from the left table plus matching rows from the right table.', topicTag: 'SQL Joins' }
  ]
};

export default function ExamPrepSimulator() {
  const [activeMode, setActiveMode] = useState<'quiz' | 'flashcards' | 'exam'>('quiz');
  const [selectedSubject, setSelectedSubject] = useState<string>('networking');
  const [customDocs, setCustomDocs] = useState<KnowledgeDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS.networking);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showAnswerExplanation, setShowAnswerExplanation] = useState<Record<number, boolean>>({});
  const [quizFinished, setQuizFinished] = useState(false);

  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>(DEFAULT_FLASHCARDS.networking || []);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // Timed Mock Exam state
  const [examDurationMins, setExamDurationMins] = useState<number>(15);
  const [examTimeRemaining, setExamTimeRemaining] = useState<number>(15 * 60);
  const [examActive, setExamActive] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScore, setExamScore] = useState<number>(0);
  const [weakTopics, setWeakTopics] = useState<{ topic: string; missedCount: number }[]>([]);

  // AI Generator state
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Load Knowledge Library docs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('himam_knowledge_library');
      if (saved) {
        setCustomDocs(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load docs', e);
    }
  }, []);

  // Subject or Document Change
  useEffect(() => {
    if (selectedDocId) {
      // Generated from custom doc or fallback
      const doc = customDocs.find(d => d.id === selectedDocId);
      if (doc) {
        generateFromDoc(doc);
      }
    } else {
      setQuestions(DEFAULT_QUESTIONS[selectedSubject] || DEFAULT_QUESTIONS.networking);
      setFlashcards(DEFAULT_FLASHCARDS[selectedSubject] || DEFAULT_FLASHCARDS.networking || []);
      resetQuizState();
    }
  }, [selectedSubject, selectedDocId]);

  // Timed Exam Countdown Effect
  useEffect(() => {
    let timer: any = null;
    if (examActive && !examSubmitted && examTimeRemaining > 0) {
      timer = setInterval(() => {
        setExamTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            submitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examActive, examSubmitted, examTimeRemaining]);

  const resetQuizState = () => {
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setShowAnswerExplanation({});
    setQuizFinished(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setExamActive(false);
    setExamSubmitted(false);
  };

  const generateFromDoc = async (doc: KnowledgeDocument) => {
    setIsAiGenerating(true);
    try {
      const res = await apiFetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Generate 4 multiple-choice questions and 3 flashcards for document "${doc.fileName}". 
Return JSON in this format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Sample Q?",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "Why correct",
      "topicTag": "Main Topic"
    }
  ],
  "flashcards": [
    { "id": "f1", "front": "Term", "back": "Definition", "topicTag": "Topic" }
  ]
}

Document text: ${doc.extractedText.slice(0, 3000)}`
            }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.response || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.questions && parsed.questions.length > 0) {
            setQuestions(parsed.questions);
          }
          if (parsed.flashcards && parsed.flashcards.length > 0) {
            setFlashcards(parsed.flashcards);
          }
        }
      }
    } catch (e) {
      console.error('Failed to generate quiz from AI:', e);
    } finally {
      setIsAiGenerating(false);
      resetQuizState();
    }
  };

  const handleAnswerSelect = (qIdx: number, optionIdx: number) => {
    if (selectedAnswers[qIdx] !== undefined && activeMode === 'exam') return;
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: optionIdx }));
    setShowAnswerExplanation(prev => ({ ...prev, [qIdx]: true }));
  };

  const startExam = () => {
    setSelectedAnswers({});
    setExamTimeRemaining(examDurationMins * 60);
    setExamActive(true);
    setExamSubmitted(false);
    setQuizFinished(false);
    setCurrentQIndex(0);
  };

  const submitExam = () => {
    setExamActive(false);
    setExamSubmitted(true);

    let correct = 0;
    const topicMisses: Record<string, number> = {};

    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correct++;
      } else {
        const tag = q.topicTag || 'General Concept';
        topicMisses[tag] = (topicMisses[tag] || 0) + 1;
      }
    });

    const pct = Math.round((correct / questions.length) * 100);
    setExamScore(pct);

    const weakList = Object.entries(topicMisses)
      .map(([topic, count]) => ({ topic, missedCount: count }))
      .sort((a, b) => b.missedCount - a.missedCount);

    setWeakTopics(weakList);
  };

  const toggleMastered = (cardId: string) => {
    setMasteredIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#101C38] border border-[#1E3A8A] text-[#3B82F6] text-[10px] font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>AI EXAM PREP & SIMULATOR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Smart Quiz & Timed Mock Exams
            </h1>
            <p className="text-xs text-[#8A99AD] leading-relaxed">
              Extract key concepts from your Knowledge Library or core courses. Test yourself with instant AI grading and weak-topic detection.
            </p>
          </div>

          {/* Mode Selector Switcher */}
          <div className="flex bg-[#121826] border border-[#232F48] rounded-xl p-1.5 gap-1.5 w-full md:w-auto">
            <button
              onClick={() => { setActiveMode('quiz'); resetQuizState(); }}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'quiz'
                  ? 'bg-[#3B82F6] text-white shadow-md'
                  : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Smart Quiz</span>
            </button>
            <button
              onClick={() => { setActiveMode('flashcards'); resetQuizState(); }}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'flashcards'
                  ? 'bg-[#3B82F6] text-white shadow-md'
                  : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
            </button>
            <button
              onClick={() => { setActiveMode('exam'); resetQuizState(); }}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'exam'
                  ? 'bg-[#3B82F6] text-white shadow-md'
                  : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timed Exam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Material Selector Bar */}
      <div className="bg-[#111622] border border-[#1E283D] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-[#8A99AD] whitespace-nowrap">Subject:</span>
          {PRESET_SUBJECTS.map(subj => (
            <button
              key={subj.id}
              onClick={() => { setSelectedSubject(subj.id); setSelectedDocId(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                selectedSubject === subj.id && !selectedDocId
                  ? 'bg-[#3B82F6]/20 border border-[#3B82F6] text-white'
                  : 'bg-[#182032] border border-[#232F48] text-[#8A99AD] hover:text-white'
              }`}
            >
              <span>{subj.icon}</span>
              <span>{subj.name}</span>
            </button>
          ))}
        </div>

        {/* Custom Document Selector */}
        {customDocs.length > 0 && (
          <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[#1E283D] pt-3 md:pt-0 md:pl-4">
            <FileText className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
            <select
              value={selectedDocId}
              onChange={e => setSelectedDocId(e.target.value)}
              className="bg-[#182032] border border-[#232F48] text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">Or pick from Knowledge Library...</option>
              {customDocs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.fileName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isAiGenerating && (
        <div className="p-8 bg-[#0B0E17] border border-[#181F32] rounded-2xl text-center space-y-3">
          <Sparkles className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-white">AI Engine Synthesizing Custom Quiz...</h3>
          <p className="text-xs text-[#8A99AD]">Extracting key technical concepts and creating options from your uploaded document.</p>
        </div>
      )}

      {/* MODE 1: SMART QUIZ */}
      {!isAiGenerating && activeMode === 'quiz' && (
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-6">
          {/* Question Progress Header */}
          <div className="flex items-center justify-between border-b border-[#181F32] pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#3B82F6]">QUESTION {currentQIndex + 1} OF {questions.length}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#182032] text-[#8A99AD] border border-[#232F48]">
                {questions[currentQIndex]?.topicTag}
              </span>
            </div>
            <div className="text-xs text-[#8A99AD]">
              Score: {Object.keys(selectedAnswers).filter(idx => selectedAnswers[Number(idx)] === questions[Number(idx)]?.correctIndex).length} / {questions.length}
            </div>
          </div>

          {/* Question Statement */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {questions[currentQIndex]?.question}
            </h3>

            {/* Options List */}
            <div className="space-y-3">
              {questions[currentQIndex]?.options.map((opt, oIdx) => {
                const isSelected = selectedAnswers[currentQIndex] === oIdx;
                const isCorrect = oIdx === questions[currentQIndex]?.correctIndex;
                const hasAnswered = selectedAnswers[currentQIndex] !== undefined;

                let optionStyle = 'bg-[#121826] border-[#232F48] text-[#CBD5E1] hover:border-[#3B82F6]/50';
                if (hasAnswered) {
                  if (isCorrect) {
                    optionStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold';
                  } else if (isSelected) {
                    optionStyle = 'bg-red-500/10 border-red-500 text-red-400 font-bold';
                  } else {
                    optionStyle = 'bg-[#121826]/50 border-[#182032] text-[#64748B] opacity-50';
                  }
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleAnswerSelect(currentQIndex, oIdx)}
                    className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm flex items-start gap-3 transition-all cursor-pointer ${optionStyle}`}
                  >
                    <span className="w-6 h-6 rounded-full bg-[#182032] flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {hasAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                    {hasAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Answer Explanation Box */}
            {selectedAnswers[currentQIndex] !== undefined && (
              <div className="p-4 rounded-xl bg-[#10192D] border border-[#1E3A8A] space-y-2 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#3B82F6]">
                  <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>EXPLANATION</span>
                </div>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  {questions[currentQIndex]?.explanation}
                </p>
              </div>
            )}
          </div>

          {/* Question Navigation Controls */}
          <div className="flex items-center justify-between border-t border-[#181F32] pt-4">
            <button
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex(prev => prev - 1)}
              className="px-4 py-2 bg-[#182032] hover:bg-[#232F48] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {currentQIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQIndex(prev => prev + 1)}
                className="px-5 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setQuizFinished(true)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Complete Quiz</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: FLASHCARDS */}
      {!isAiGenerating && activeMode === 'flashcards' && flashcards.length > 0 && (
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#181F32] pb-4">
            <span className="text-xs font-bold text-[#3B82F6]">CARD {currentCardIndex + 1} OF {flashcards.length}</span>
            <span className="text-xs text-[#8A99AD]">
              Mastered: {masteredIds.size} / {flashcards.length}
            </span>
          </div>

          {/* 3D Flip Card */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[220px] bg-[#101726] border border-[#1E283D] hover:border-[#3B82F6]/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-xl relative overflow-hidden group select-none"
          >
            <div className="absolute top-3 right-3 text-[10px] text-[#8A99AD] font-semibold bg-[#182032] px-2 py-1 rounded-md border border-[#232F48]">
              {isFlipped ? 'BACK (ANSWER)' : 'FRONT (QUESTION)'}
            </div>

            {!isFlipped ? (
              <div className="space-y-3">
                <span className="text-xs text-[#3B82F6] font-bold uppercase tracking-wider">
                  {flashcards[currentCardIndex]?.topicTag}
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white max-w-lg leading-snug">
                  {flashcards[currentCardIndex]?.front}
                </h3>
                <p className="text-[11px] text-[#64748B] pt-2">Click or tap to flip card 🔄</p>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in">
                <h3 className="text-sm sm:text-base text-[#CBD5E1] max-w-lg leading-relaxed">
                  {flashcards[currentCardIndex]?.back}
                </h3>
                <p className="text-[11px] text-[#3B82F6] font-semibold pt-2">Click to return to question</p>
              </div>
            )}
          </div>

          {/* Mastery Rating Bar */}
          <div className="flex items-center justify-between border-t border-[#181F32] pt-4">
            <button
              onClick={() => toggleMastered(flashcards[currentCardIndex]?.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                masteredIds.has(flashcards[currentCardIndex]?.id)
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#182032] text-[#8A99AD] hover:text-white border border-[#232F48]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{masteredIds.has(flashcards[currentCardIndex]?.id) ? 'Mastered ✓' : 'Mark as Mastered'}</span>
            </button>

            <div className="flex gap-2">
              <button
                disabled={currentCardIndex === 0}
                onClick={() => { setCurrentCardIndex(prev => prev - 1); setIsFlipped(false); }}
                className="px-4 py-2 bg-[#182032] hover:bg-[#232F48] text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer"
              >
                Prev
              </button>
              <button
                disabled={currentCardIndex === flashcards.length - 1}
                onClick={() => { setCurrentCardIndex(prev => prev + 1); setIsFlipped(false); }}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer"
              >
                Next Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: TIMED MOCK EXAM */}
      {!isAiGenerating && activeMode === 'exam' && (
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-6">
          {!examActive && !examSubmitted && (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Timed Exam Simulation</h3>
              <p className="text-xs text-[#8A99AD] leading-relaxed">
                Test your knowledge under timed exam conditions. Instant AI grading will evaluate your performance and detect weak topics.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <span className="text-xs text-[#8A99AD]">Duration:</span>
                {[10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setExamDurationMins(mins)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      examDurationMins === mins
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-[#182032] text-[#8A99AD] hover:text-white'
                    }`}
                  >
                    {mins} Mins
                  </button>
                ))}
              </div>

              <button
                onClick={startExam}
                className="w-full py-3 bg-[#3B82F6] hover:bg-blue-600 text-white font-bold text-sm rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Start Timed Exam Now
              </button>
            </div>
          )}

          {/* Active Exam Interface */}
          {examActive && !examSubmitted && (
            <div className="space-y-6">
              {/* Exam Timer & Header */}
              <div className="flex items-center justify-between bg-[#121826] border border-[#232F48] rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">EXAM IN PROGRESS</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-lg font-bold text-[#3B82F6]">
                  <Clock className="w-4 h-4" />
                  <span>{formatTimer(examTimeRemaining)}</span>
                </div>
              </div>

              {/* Exam Question */}
              <div className="space-y-4">
                <div className="text-xs text-[#8A99AD]">Question {currentQIndex + 1} of {questions.length}</div>
                <h3 className="text-base font-bold text-white">{questions[currentQIndex]?.question}</h3>

                <div className="space-y-2.5">
                  {questions[currentQIndex]?.options.map((opt, oIdx) => {
                    const isSelected = selectedAnswers[currentQIndex] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswerSelect(currentQIndex, oIdx)}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-white font-bold'
                            : 'bg-[#121826] border-[#232F48] text-[#CBD5E1] hover:border-[#3B82F6]/50'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#182032] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit & Nav Controls */}
              <div className="flex items-center justify-between border-t border-[#181F32] pt-4">
                <div className="flex gap-2">
                  <button
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex(prev => prev - 1)}
                    className="px-3 py-1.5 bg-[#182032] text-white text-xs rounded-lg disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={currentQIndex === questions.length - 1}
                    onClick={() => setCurrentQIndex(prev => prev + 1)}
                    className="px-3 py-1.5 bg-[#182032] text-white text-xs rounded-lg disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>

                <button
                  onClick={submitExam}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Submit Exam
                </button>
              </div>
            </div>
          )}

          {/* Exam Results & Weak Topic Analysis */}
          {examSubmitted && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-[#10192D] border border-[#1E3A8A] rounded-2xl p-6 text-center space-y-3">
                <Award className="w-10 h-10 text-[#3B82F6] mx-auto" />
                <h3 className="text-xl font-bold text-white">Exam Results Submitted</h3>
                <div className="text-3xl font-black text-white">
                  {examScore}% <span className="text-xs text-[#8A99AD] font-normal">Score</span>
                </div>
                <p className="text-xs text-[#CBD5E1]">
                  {examScore >= 80 ? '🌟 Outstanding performance! High topic mastery.' : '👍 Good effort! Review your weak topics below.'}
                </p>
              </div>

              {/* Weak Topic Detection */}
              {weakTopics.length > 0 && (
                <div className="bg-[#131018] border border-[#3A1E2D] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    <span>WEAK TOPIC DETECTION</span>
                  </div>
                  <p className="text-xs text-[#8A99AD]">The AI engine identified these areas requiring focused revision:</p>
                  <div className="space-y-2">
                    {weakTopics.map((wt, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#1B1422] border border-[#3A1E2D]">
                        <span className="text-xs font-bold text-white">{wt.topic}</span>
                        <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          {wt.missedCount} Missed Question{wt.missedCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={resetQuizState}
                className="w-full py-2.5 bg-[#182032] hover:bg-[#232F48] text-white font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Retake Exam
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
