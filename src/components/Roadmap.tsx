import React, { useState, useMemo } from 'react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile, Milestone, MilestoneType } from '../models/types';
import { calculateGoalPacing } from '../services/progressEngine';
import { sendCoachMessages } from '../services/aiCoachClient';
import { apiFetch } from '../services/apiClient';
import { 
  Compass, 
  DollarSign, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Target, 
  Award, 
  Check, 
  Plus, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  Briefcase, 
  CalendarDays, 
  Users, 
  MapPin, 
  User,
  X,
  HelpCircle
} from 'lucide-react';

interface RoadmapProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  profile: Profile;
  onUpdateProfile: (profile: Profile) => void;
  setActiveTab?: (tab: string) => void;
}

interface GeneratedGoal {
  id: string;
  title: string;
  description: string;
  category: string;
  isCustom: boolean;
  estimatedHours: number;
  skillsCovered: string[];
  suggestedMilestones: string[];
}

interface GeneratedMilestone {
  title: string;
  type: string;
  targetOffsetMonths: number;
  associatedGoal?: string;
}

interface GeneratedRoadmap {
  careerGoal: string;
  careerDescription: string;
  estimatedTimeline: string;
  estimatedStudyHours: number;
  difficulty: string;
  requiredSkills: string[];
  recommendedLearningGoals: GeneratedGoal[];
  optionalLearningGoals: GeneratedGoal[];
  suggestedLearningOrder: string[];
  recommendedMilestones: GeneratedMilestone[];
  transitionGuide?: {
    pivotStrategy: string;
    whatToDo: string[];
    whatToTake: string[];
    howToAchieveIt: string[];
    suggestedCertifications: string[];
  };
}

export default function Roadmap({ state, onUpdateState, profile, onUpdateProfile, setActiveTab }: RoadmapProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pathway' | 'generator'>('pathway');
  
  // Generator form state
  const [targetCareer, setTargetCareer] = useState(profile.targetJob || profile.careerGoal || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentJob, setCurrentJob] = useState(profile.currentJob || '');
  const [currentSalary, setCurrentSalary] = useState(profile.currentSalary || '');
  const [targetSalary, setTargetSalary] = useState(profile.targetSalary || '');
  const [country, setCountry] = useState(profile.country || '');
  
  // Student additions for college/university support
  const [isStudent, setIsStudent] = useState(profile.isStudent ?? false);
  const [university, setUniversity] = useState(profile.university || '');
  const [major, setMajor] = useState(profile.major || '');
  const [academicYear, setAcademicYear] = useState(profile.academicYear || '');
  const [currentSemester, setCurrentSemester] = useState(profile.currentSemester || '');
  const [currentGpa, setCurrentGpa] = useState(profile.currentGpa || '');
  const [currentCourses, setCurrentCourses] = useState(profile.currentCourses || '');
  const [expectedGraduation, setExpectedGraduation] = useState(profile.expectedGraduation || '');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatedRoadmap, setGeneratedRoadmap] = useState<GeneratedRoadmap | null>(null);
  
  // Review/import state
  const [checkedGoals, setCheckedGoals] = useState<Set<string>>(new Set());
  const [checkedMilestones, setCheckedMilestones] = useState<Set<string>>(new Set());
  const [importSuccess, setImportSuccess] = useState(false);

  // Explain with AI state
  const [explanationNode, setExplanationNode] = useState<string | null>(null);
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

  // Cycling generation status messages
  const loadingSteps = [
    "Analyzing career landscape & industry qualifications...",
    "Querying standard certification requirements...",
    "Formulating custom training milestones...",
    "Structuring optimal sequencing flow...",
    "Assembling your golden career roadmap..."
  ];

  // Dynamic steps mapping for the current user's roadmap sequence (My Pathway)
  const steps = useMemo(() => {
    const list: { title: string; status: 'completed' | 'current' | 'pending'; desc: string }[] = [];
    
    // 1. Current position / starting point
    if (profile.isStudent) {
      list.push({
        title: `${profile.university || "University"} Student`,
        status: 'completed',
        desc: `Majoring in ${profile.major || "Field of Study"} (${profile.academicYear || "Current Year"})`
      });
    } else if (profile.currentJob) {
      list.push({
        title: profile.currentJob,
        status: 'completed',
        desc: `${profile.name}'s baseline professional starting point`
      });
    } else {
      list.push({
        title: "Starting Point",
        status: 'completed',
        desc: `${profile.name}'s current professional foundation`
      });
    }

    // 2. Active learning goals dynamically loaded and tracked!
    const activeGoals = profile.learningGoals || [];
    activeGoals.forEach((goal) => {
      const pacing = calculateGoalPacing(goal, profile, state);
      const details = profile.learningGoalDetails?.[goal];
      
      let status: 'completed' | 'current' | 'pending' = 'pending';
      if (pacing.completionPercentage === 100) {
        status = 'completed';
      } else if (pacing.completionPercentage > 0) {
        status = 'current';
      } else {
        // Fallback to current if it's the first active focus, else pending
        status = 'current'; 
      }

      list.push({
        title: goal,
        status,
        desc: `${pacing.completionPercentage}% complete • ${details?.category || 'Professional Certification'}`
      });
    });

    // If no goals added yet, provide a friendly placeholder tip step
    if (activeGoals.length === 0) {
      list.push({
        title: "Identify Next Focus",
        status: 'current',
        desc: "Add learning goals in the AI Generator tab or Learning Library to chart your path."
      });
    }

    // 3. Final Target Career position
    const finalJob = profile.targetJob || profile.careerGoal || 'Analytics Leader';
    list.push({
      title: finalJob,
      status: 'pending',
      desc: "Target career destination & professional objectives"
    });

    return list;
  }, [profile, state]);

  const handleSalaryChange = (key: 'currentSalary' | 'targetSalary', val: string) => {
    onUpdateProfile({ ...profile, [key]: val });
  };

  const startRoadmapGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCareer.trim()) {
      setError("Please specify a target career goal.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep(0);
    setError(null);
    setGeneratedRoadmap(null);
    setImportSuccess(false);

    // Dynamic cycling of status messages during loading
    const interval = setInterval(() => {
      setGenerationStep(prev => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 2200);

    try {
      const response = await apiFetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careerGoal: targetCareer,
          currentJob: isStudent ? 'Student' : currentJob,
          currentSalary: isStudent ? '' : currentSalary,
          targetSalary: isStudent ? '' : targetSalary,
          country,
          isStudent,
          university: isStudent ? university : '',
          major: isStudent ? major : '',
          academicYear: isStudent ? academicYear : '',
          currentSemester: isStudent ? currentSemester : '',
          currentGpa: isStudent ? currentGpa : '',
          currentCourses: isStudent ? currentCourses : '',
          expectedGraduation: isStudent ? expectedGraduation : '',
        })
      });

      const data = await response.json();
      clearInterval(interval);

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate roadmap from AI provider.");
      }

      setGeneratedRoadmap(data);
      
      // Select all recommended goals and their milestones by default
      const goals = new Set<string>();
      const milestones = new Set<string>();

      data.recommendedLearningGoals.forEach((g: GeneratedGoal) => {
        goals.add(g.title);
      });

      data.recommendedMilestones.forEach((m: GeneratedMilestone, idx: number) => {
        const key = `${m.associatedGoal || 'general'}-${m.title}-${idx}`;
        milestones.add(key);
      });

      setCheckedGoals(goals);
      setCheckedMilestones(milestones);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleGoalSelection = (title: string) => {
    const next = new Set(checkedGoals);
    if (next.has(title)) {
      next.delete(title);
    } else {
      next.add(title);
    }
    setCheckedGoals(next);
  };

  const toggleMilestoneSelection = (key: string) => {
    const next = new Set(checkedMilestones);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCheckedMilestones(next);
  };

  const getMilestoneDate = (offsetMonths: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths);
    return d.toISOString().split('T')[0];
  };

  const handleImportRoadmap = () => {
    if (!generatedRoadmap) return;

    const updatedGoals = [...(profile.learningGoals || [])];
    const updatedDetails = { ...(profile.learningGoalDetails || {}) };

    // Group goals from both recommended and optional sets
    const allGeneratedGoals = [
      ...generatedRoadmap.recommendedLearningGoals,
      ...generatedRoadmap.optionalLearningGoals
    ];

    allGeneratedGoals.forEach(g => {
      // Only import if checked
      if (checkedGoals.has(g.title)) {
        if (!updatedGoals.includes(g.title)) {
          updatedGoals.push(g.title);
        }

        // Gather checked milestones for this goal
        const goalMilestones: Milestone[] = [];
        generatedRoadmap.recommendedMilestones.forEach((m, idx) => {
          const key = `${m.associatedGoal || 'general'}-${m.title}-${idx}`;
          if (checkedMilestones.has(key) && (m.associatedGoal === g.title || (!m.associatedGoal && goalMilestones.length === 0))) {
            goalMilestones.push({
              id: `ms-${g.id || 'custom'}-${idx}-${Date.now()}`,
              type: m.type as MilestoneType,
              title: m.title,
              date: getMilestoneDate(m.targetOffsetMonths),
              completed: false
            });
          }
        });

        // Set structural details
        updatedDetails[g.title] = {
          category: g.category,
          courseId: g.isCustom ? undefined : g.id,
          isCustom: g.isCustom,
          description: g.description,
          skills: g.skillsCovered,
          estimatedHours: g.estimatedHours,
          difficulty: generatedRoadmap.difficulty || 'Intermediate',
          milestones: goalMilestones
        };
      }
    });

    // Update profile with the integrated goals/details, plus update targetJob and salaries
    onUpdateProfile({
      ...profile,
      targetJob: generatedRoadmap.careerGoal,
      currentJob: isStudent ? 'Student' : (currentJob || profile.currentJob),
      currentSalary: isStudent ? '' : (currentSalary || profile.currentSalary),
      targetSalary: isStudent ? '' : (targetSalary || profile.targetSalary),
      isStudent,
      university: isStudent ? university : '',
      major: isStudent ? major : '',
      academicYear: isStudent ? academicYear : '',
      currentSemester: isStudent ? currentSemester : '',
      currentGpa: isStudent ? currentGpa : '',
      currentCourses: isStudent ? currentCourses : '',
      expectedGraduation: isStudent ? expectedGraduation : '',
      learningGoals: updatedGoals,
      learningGoalDetails: updatedDetails,
    });

    setImportSuccess(true);
  };

  return (
    <div className="space-y-6" id="roadmap-view">
      {/* Header Panel */}
      <div className="bg-[#11141C] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="space-y-2">
          <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-[#D4AF37]" /> Career Planner
          </h2>
          <p className="text-xs text-[#94949C] leading-relaxed max-w-2xl">
            Synthesize professional certifications, degree tracks, and local workspace training into a direct tactical timeline. Align your studying directly with high-trajectory career objectives.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/5 mt-6 gap-6">
          <button
            onClick={() => setActiveSubTab('pathway')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 relative ${
              activeSubTab === 'pathway' 
                ? 'border-[#D4AF37] text-white' 
                : 'border-transparent text-[#94949C] hover:text-white'
            }`}
          >
            My Pathway Timeline
          </button>
          <button
            onClick={() => setActiveSubTab('generator')}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${
              activeSubTab === 'generator' 
                ? 'border-[#D4AF37] text-white' 
                : 'border-transparent text-[#94949C] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> AI Roadmap Generator
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: DYNAMIC CAREER TIMELINE PATHWAY */}
      {activeSubTab === 'pathway' && (
        <div className="space-y-6">
          {/* Timeline Sequence Panel */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-6 flex flex-col items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#94949C] mb-6 text-center">
              Active Progression Blueprint
            </h3>
            
            <div className="space-y-2 w-full max-w-lg">
              {steps.map((s, idx) => {
                let borderClass = "border-white/5";
                let bgClass = "bg-[#11141C]";
                let textClass = "text-[#94949C]";
                let badgeText = "Pending";
                let badgeClass = "bg-[#171B24] text-[#55555B] border-white/5";

                if (s.status === 'completed') {
                  borderClass = "border-[#10B981]/20";
                  bgClass = "bg-[#0D1C13]";
                  textClass = "text-[#10B981]";
                  badgeText = "Completed / Active";
                  badgeClass = "bg-[#0D1C13] text-[#10B981] border-[#10B981]/20";
                } else if (s.status === 'current') {
                  borderClass = "border-[#D4AF37]/40";
                  bgClass = "bg-gradient-to-br from-[#171B24] to-[#11141C]";
                  textClass = "text-[#D4AF37]";
                  badgeText = "Active Target";
                  badgeClass = "bg-[#171B24] text-[#D4AF37] border-[#D4AF37]/30";
                }

                return (
                  <React.Fragment key={idx}>
                    <div className={`border rounded-xl p-4 flex items-center justify-between gap-4 transition-all duration-300 ${borderClass} ${bgClass}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`block text-xs font-bold ${textClass}`}>{s.title}</span>
                          <button
                            onClick={async () => {
                              if (explanationNode === s.title) {
                                setExplanationNode(null);
                                setExplanationText(null);
                                return;
                              }
                              setExplanationNode(s.title);
                              setIsGeneratingExplanation(true);
                              setExplanationText(null);
                              try {
                                const prompt = `Provide a concise, highly practical explanation of how this career roadmap step fits into a learner's professional journey.
Step: "${s.title}"
Details/Progress: "${s.desc}"
Target Goal: "${profile.targetJob || profile.careerGoal || 'Target Role'}"

Structure your reply into 2 brief, high-impact paragraphs:
1. **Strategic Relevance**: Why this step is crucial for the target role "${profile.targetJob || profile.careerGoal || 'Target Role'}".
2. **Tactical Advice**: 1-2 immediate, actionable things the learner can do today to master this step (such as specific technical skills, concepts, or tools).`;

                                const response = await sendCoachMessages([
                                  { role: 'system', content: 'You are an elite career development advisor and technical mentor.' },
                                  { role: 'user', content: prompt }
                                ]);
                                setExplanationText(response);
                              } catch (err: any) {
                                setExplanationText("Failed to load explanation. Please check your internet connection.");
                              } finally {
                                setIsGeneratingExplanation(false);
                              }
                            }}
                            className="text-[#94949C] hover:text-[#D4AF37] p-0.5 rounded transition-all focus:outline-none"
                            title="Explain with AI Mentor"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="block text-[10.5px] text-[#94949C] mt-0.5 leading-snug">{s.desc}</span>
                      </div>
                      <span className={`border px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="flex justify-center h-4 py-1 text-[#55555B]">
                        <span className="text-[10px] font-bold">↓</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Collapsible explanation drawer */}
            {explanationNode && (
              <div className="w-full max-w-lg mt-5 bg-[#171B24] border border-[#D4AF37]/30 rounded-xl p-5 relative overflow-hidden animate-fadeIn">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-xl" />
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> AI Mentor: {explanationNode}
                  </h4>
                  <button onClick={() => { setExplanationNode(null); setExplanationText(null); }} className="text-[#94949C] hover:text-white text-xs font-bold font-mono">
                    Close ×
                  </button>
                </div>

                {isGeneratingExplanation ? (
                  <div className="text-[11px] text-[#94949C] flex items-center gap-2 py-2">
                    <div className="w-3.5 h-3.5 border-2 border-t-transparent border-[#D4AF37] rounded-full animate-spin" />
                    Consulting Career Advisor...
                  </div>
                ) : (
                  <div className="space-y-3 text-[11px] text-[#E0E0E6] leading-relaxed">
                    <div className="whitespace-pre-wrap">{explanationText}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Salary Vision & Objectives Block */}
          <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> Compensation Milestones &amp; Vision
            </h3>
            <p className="text-[11px] text-[#94949C]">
              Configure current and destination salary brackets to frame your studies with clear economic motivation.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
              <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 text-center w-full sm:w-44 space-y-2">
                <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider block">Current Compensation</span>
                <input
                  type="text"
                  placeholder="e.g. SAR 15,000"
                  value={profile.currentSalary}
                  onChange={(e) => handleSalaryChange('currentSalary', e.target.value)}
                  className="bg-[#171B24] border border-white/5 text-sm text-[#D4AF37] font-mono text-center rounded py-1 px-2 w-full focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>

              <ArrowRight className="hidden sm:block w-4 h-4 text-[#55555B]" />

              <div className="bg-[#11141C] border border-white/5 rounded-xl p-4 text-center w-full sm:w-44 space-y-2">
                <span className="text-[9px] text-[#94949C] uppercase font-bold tracking-wider block">Target Compensation</span>
                <input
                  type="text"
                  placeholder="e.g. SAR 25,000"
                  value={profile.targetSalary}
                  onChange={(e) => handleSalaryChange('targetSalary', e.target.value)}
                  className="bg-[#171B24] border border-white/5 text-sm text-white font-mono font-bold text-center rounded py-1 px-2 w-full focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>
            </div>

            <div className="text-[10px] text-[#55555B] text-center border-t border-white/5 pt-3">
              "Tactical education is the highest-leverage investment in future compensation."
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AI CAREER ROADMAP GENERATOR */}
      {activeSubTab === 'generator' && (
        <div className="space-y-6">
          {/* Main Error Alert */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="block text-xs font-bold text-white">Generation Error</span>
                <p className="text-[11px] text-[#94949C] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Loading Screen */}
          {isGenerating && (
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-12 text-center flex flex-col items-center justify-center space-y-6 min-h-[300px]">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/10 border-t-[#D4AF37] animate-spin" />
                <Sparkles className="w-5 h-5 text-[#D4AF37] absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="text-xs font-bold text-white tracking-wider uppercase">Generating Career Pathway</p>
                <p className="text-[11.5px] text-[#D4AF37] leading-snug animate-pulse min-h-[30px]">{loadingSteps[generationStep]}</p>
                <p className="text-[10px] text-[#55555B]">This may take a minute. We are synthesizing standard certifications with your dynamic career parameters.</p>
              </div>
            </div>
          )}

          {/* Import Success Screen */}
          {importSuccess && (
            <div className="bg-[#171B24] border border-white/5 rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-6">
              <div className="w-12 h-12 bg-[#10B981]/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="font-serif text-lg font-bold text-white">Roadmap successfully integrated!</h3>
                <p className="text-xs text-[#94949C] leading-relaxed">
                  Your customized learning goals and target milestones have been successfully integrated into your profile. These will now propagate to My Learning, the Study Coach, the Scheduler, and your dashboard widgets.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => setActiveTab?.('my-learning')}
                  className="bg-white hover:bg-neutral-200 text-black text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <BookOpen className="w-4 h-4" /> Go to My Learning
                </button>
                <button
                  onClick={() => setActiveTab?.('dashboard')}
                  className="bg-[#171B24] border border-white/10 hover:border-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          )}

          {/* INPUT FORM PANEL */}
          {!isGenerating && !importSuccess && !generatedRoadmap && (
            <form onSubmit={startRoadmapGeneration} className="bg-[#171B24] border border-white/5 rounded-xl p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-white flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#D4AF37]" /> Target Career Goal
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Business Intelligence Officer, HR Director, Cloud Security Architect..."
                  value={targetCareer}
                  onChange={e => setTargetCareer(e.target.value)}
                  className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-xl p-3 focus:outline-none focus:border-[#D4AF37]/40 placeholder-[#55555B]"
                  required
                />
                <p className="text-[10.5px] text-[#55555B]">Specify the professional role or title you want to strategically achieve.</p>
              </div>

              {/* Advanced Context settings */}
              <div className="border border-white/5 rounded-xl bg-[#11141C] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full p-4 flex items-center justify-between text-left text-xs font-bold text-[#94949C] hover:text-white transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#D4AF37]" /> Customize Advisor Context (Optional)
                  </span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvanced && (
                  <div className="p-4 border-t border-white/5 space-y-4 bg-[#171B24]/20">
                    {/* Inner Student / Pro Toggle */}
                    <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-[#0B0D12] border border-white/5 max-w-sm">
                      <button
                        type="button"
                        onClick={() => setIsStudent(true)}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isStudent
                            ? 'bg-[#171B24] border border-[#D4AF37]/30 text-[#D4AF37]'
                            : 'text-[#94949C] hover:text-white border border-transparent'
                        }`}
                      >
                        University Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsStudent(false)}
                        className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          !isStudent
                            ? 'bg-[#171B24] border border-[#D4AF37]/30 text-[#D4AF37]'
                            : 'text-[#94949C] hover:text-white border border-transparent'
                        }`}
                      >
                        Working Professional
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {isStudent ? (
                        <>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">University / College</span>
                            <input
                              type="text"
                              value={university}
                              onChange={e => setUniversity(e.target.value)}
                              placeholder="e.g. King Saud University"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Major / Field of Study</span>
                            <input
                              type="text"
                              value={major}
                              onChange={e => setMajor(e.target.value)}
                              placeholder="e.g. Software Engineering"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Year of Study</span>
                            <select
                              value={academicYear}
                              onChange={e => setAcademicYear(e.target.value)}
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            >
                              <option value="">Select academic year</option>
                              <option value="First Year (Freshman)">First Year (Freshman)</option>
                              <option value="Second Year (Sophomore)">Second Year (Sophomore)</option>
                              <option value="Third Year (Junior)">Third Year (Junior)</option>
                              <option value="Fourth Year (Senior)">Fourth Year (Senior)</option>
                              <option value="Fifth Year+">Fifth Year / Internship</option>
                              <option value="Postgraduate (Master/PhD)">Postgraduate (Master/PhD)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Current Semester</span>
                            <select
                              value={currentSemester}
                              onChange={e => setCurrentSemester(e.target.value)}
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            >
                              <option value="">Select current semester</option>
                              <option value="Fall Semester">Fall Semester</option>
                              <option value="Spring Semester">Spring Semester</option>
                              <option value="Summer Term">Summer Term</option>
                              <option value="Summer Training">Summer Training</option>
                              <option value="Internship / Co-op">Internship / Co-op</option>
                              <option value="Final Semester">Final Semester</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Current GPA (Optional)</span>
                            <input
                              type="text"
                              value={currentGpa}
                              onChange={e => setCurrentGpa(e.target.value)}
                              placeholder="e.g. 3.72 / 5"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Expected Graduation</span>
                            <input
                              type="text"
                              value={expectedGraduation}
                              onChange={e => setExpectedGraduation(e.target.value)}
                              placeholder="e.g. May 2028"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="col-span-1 md:col-span-2 space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Current Courses This Semester (Optional)</span>
                            <input
                              type="text"
                              value={currentCourses}
                              onChange={e => setCurrentCourses(e.target.value)}
                              placeholder="e.g. Operating Systems, Databases, Calculus II"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30 font-mono"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Current Job / Role</span>
                            <input
                              type="text"
                              value={currentJob}
                              onChange={e => setCurrentJob(e.target.value)}
                              placeholder="e.g. Business Analyst"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Current Compensation</span>
                            <input
                              type="text"
                              value={currentSalary}
                              onChange={e => setCurrentSalary(e.target.value)}
                              placeholder="e.g. SAR 15,000"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Target Compensation</span>
                            <input
                              type="text"
                              value={targetSalary}
                              onChange={e => setTargetSalary(e.target.value)}
                              placeholder="e.g. SAR 25,000"
                              className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Target Specialty / Role</span>
                        <input
                          type="text"
                          value={targetCareer}
                          onChange={e => setTargetCareer(e.target.value)}
                          placeholder="e.g. Cardiologist, AI Engineer"
                          className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                        />
                      </div>
                      <div className="col-span-1 md:col-span-2 space-y-1">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-[#94949C]">Country (for local requirements)</span>
                        <input
                          type="text"
                          value={country}
                          onChange={e => setCountry(e.target.value)}
                          placeholder="e.g. Saudi Arabia"
                          className="w-full bg-[#11141C] border border-white/5 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-[#D4AF37]/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#D4AF37] hover:bg-[#A88645] text-black text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#D4AF37]/10 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Synthesize AI Career Roadmap
              </button>
            </form>
          )}

          {/* GENERATED ROADMAP PREVIEW & REVIEW PANEL */}
          {generatedRoadmap && !isGenerating && !importSuccess && (
            <div className="space-y-6">
              {/* Top Banner and Overview */}
              <div className="bg-[#171B24] border border-white/5 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-[#D4AF37]">Generated AI Pathway</span>
                    <h3 className="font-serif text-xl font-bold text-white mt-1">{generatedRoadmap.careerGoal}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setGeneratedRoadmap(null);
                      setImportSuccess(false);
                    }}
                    className="text-[10px] font-bold text-[#94949C] hover:text-white border border-white/5 rounded-lg px-2.5 py-1.5 bg-[#11141C]"
                  >
                    Start Over
                  </button>
                </div>

                <div className="border-l-2 border-[#D4AF37] pl-3 italic text-xs text-[#94949C] leading-relaxed">
                  {generatedRoadmap.careerDescription}
                </div>

                {/* Bento Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#11141C] border border-white/5 rounded-lg p-3">
                    <span className="block text-[8.5px] uppercase tracking-wider font-bold text-[#55555B]">Estimated Timeline</span>
                    <span className="block text-xs font-bold text-white mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#D4AF37]" /> {generatedRoadmap.estimatedTimeline}
                    </span>
                  </div>
                  <div className="bg-[#11141C] border border-white/5 rounded-lg p-3">
                    <span className="block text-[8.5px] uppercase tracking-wider font-bold text-[#55555B]">Expected Study Investment</span>
                    <span className="block text-xs font-bold text-white mt-1 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-[#D4AF37]" /> ~{generatedRoadmap.estimatedStudyHours} hrs
                    </span>
                  </div>
                  <div className="bg-[#11141C] border border-white/5 rounded-lg p-3 col-span-2 md:col-span-1">
                    <span className="block text-[8.5px] uppercase tracking-wider font-bold text-[#55555B]">Pathway Difficulty</span>
                    <span className="block text-xs font-bold text-white mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" /> {generatedRoadmap.difficulty}
                    </span>
                  </div>
                </div>

                {/* Core Skills Needed */}
                <div className="space-y-2 pt-2">
                  <span className="block text-[9px] uppercase tracking-wider font-bold text-white">Target Core Competencies</span>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedRoadmap.requiredSkills.map((sk, idx) => (
                      <span key={idx} className="bg-white/5 border border-white/5 px-2 py-0.5 rounded text-[10px] text-[#94949C]">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* SPECIALIZED TRANSITION GUIDE */}
              {generatedRoadmap.transitionGuide && (
                <div className="bg-[#171B24] border border-[#D4AF37]/15 rounded-xl p-6 space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#D4AF37]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]">
                      <Compass className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-[#D4AF37]">Career Pivot Blueprint</span>
                      <h3 className="font-serif text-lg font-bold text-white mt-0.5">Role Transition Guide</h3>
                      <p className="text-[11.5px] text-[#94949C] mt-1.5 leading-relaxed">
                        {generatedRoadmap.transitionGuide.pivotStrategy}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* What to Do */}
                    <div className="bg-[#0B0D12]/40 border border-white/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                        <span>What to Do (Actionable Steps)</span>
                      </h4>
                      <ul className="space-y-2">
                        {generatedRoadmap.transitionGuide.whatToDo.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#E0E0E6]">
                            <span className="text-[#D4AF37] font-mono font-bold shrink-0">{idx + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* What to Take */}
                    <div className="bg-[#0B0D12]/40 border border-white/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                        <span>What to Take (Subject Areas)</span>
                      </h4>
                      <ul className="space-y-2">
                        {generatedRoadmap.transitionGuide.whatToTake.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#E0E0E6]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suggested Certifications */}
                    <div className="bg-[#0B0D12]/40 border border-white/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Award className="w-4 h-4 text-[#D4AF37]" />
                        <span>Required Certifications</span>
                      </h4>
                      <ul className="space-y-2">
                        {generatedRoadmap.transitionGuide.suggestedCertifications.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#E0E0E6]">
                            <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/10 text-[#D4AF37] text-[9px] font-bold uppercase shrink-0 mt-0.5">BADGE</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* How to Achieve It */}
                    <div className="bg-[#0B0D12]/40 border border-white/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                        <Target className="w-4 h-4 text-[#D4AF37]" />
                        <span>How to Achieve It (Execution)</span>
                      </h4>
                      <ul className="space-y-2">
                        {generatedRoadmap.transitionGuide.howToAchieveIt.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#E0E0E6]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* RECOMMENDED LEARNING GOALS LIST */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <BookOpen className="w-4 h-4 text-[#D4AF37]" /> 1. Select Learning Goals to Import
                </h3>
                <p className="text-[11.5px] text-[#94949C] leading-snug">
                  Choose which goals to integrate. Reused catalog courses unlock full interactive curriculum modules. Custom goals establish lightweight tracked targets.
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {/* Recommended Goals */}
                  {generatedRoadmap.recommendedLearningGoals.map((goal) => {
                    const isChecked = checkedGoals.has(goal.title);
                    return (
                      <div
                        key={goal.id}
                        onClick={() => toggleGoalSelection(goal.title)}
                        className={`border rounded-xl p-4 text-left transition-all cursor-pointer flex items-start gap-4 ${
                          isChecked 
                            ? 'bg-[#171B24]/30 border-[#D4AF37]/30 text-white' 
                            : 'bg-[#171B24]/20 border-white/5 text-[#94949C]'
                        }`}
                      >
                        <div className={`p-1 rounded-md border flex-shrink-0 mt-0.5 ${
                          isChecked 
                            ? 'bg-amber-500/10 border-amber-500/20 text-[#D4AF37]' 
                            : 'bg-white/5 border-white/10 text-transparent'
                        }`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>

                        <div className="space-y-3 flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                            <div>
                              <span className="inline-block rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[8.5px] uppercase tracking-wider font-bold text-[#94949C]">
                                {goal.category}
                              </span>
                              <h4 className="text-xs font-bold text-white mt-1 flex items-center gap-2">
                                {goal.title}
                              </h4>
                            </div>
                            <span className={`self-start sm:self-center border px-2 py-0.5 rounded text-[8.5px] font-bold tracking-wider ${
                              goal.isCustom 
                                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-[#10B981]'
                            }`}>
                              {goal.isCustom ? "Custom Target" : "Catalog Match Course"}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#94949C] leading-snug">{goal.description}</p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-[#55555B] border-t border-white/5 pt-2">
                            <span>Estimated: <strong>{goal.estimatedHours} hrs</strong></span>
                            <span>Skills: <strong>{goal.skillsCovered.join(', ')}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Optional Goals (if any exist) */}
                  {generatedRoadmap.optionalLearningGoals.length > 0 && (
                    <div className="space-y-2 pt-4">
                      <span className="block text-[10px] uppercase tracking-wider font-bold text-[#94949C]">Optional Elective Pathways</span>
                      {generatedRoadmap.optionalLearningGoals.map((goal) => {
                        const isChecked = checkedGoals.has(goal.title);
                        return (
                          <div
                            key={goal.id}
                            onClick={() => toggleGoalSelection(goal.title)}
                            className={`border rounded-xl p-4 text-left transition-all cursor-pointer flex items-start gap-4 ${
                              isChecked 
                                ? 'bg-[#171B24]/30 border-[#D4AF37]/30 text-white' 
                                : 'bg-[#171B24]/20 border-white/5 text-[#94949C]'
                            }`}
                          >
                            <div className={`p-1 rounded-md border flex-shrink-0 mt-0.5 ${
                              isChecked 
                                ? 'bg-amber-500/10 border-amber-500/20 text-[#D4AF37]' 
                                : 'bg-white/5 border-white/10 text-transparent'
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>

                            <div className="space-y-3 flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div>
                                  <span className="inline-block rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[8.5px] uppercase tracking-wider font-bold text-[#94949C]">
                                    {goal.category}
                                  </span>
                                  <h4 className="text-xs font-bold text-white mt-1">
                                    {goal.title}
                                  </h4>
                                </div>
                                <span className={`self-start sm:self-center border px-2 py-0.5 rounded text-[8.5px] font-bold tracking-wider ${
                                  goal.isCustom 
                                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-[#10B981]'
                                }`}>
                                  {goal.isCustom ? "Custom Target" : "Catalog Match Course"}
                                </span>
                              </div>

                              <p className="text-[11px] text-[#94949C] leading-snug">{goal.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* SEQUENCE MAP */}
              <div className="bg-[#171B24] border border-white/5 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Suggested Learning Order Flow</h3>
                <div className="flex flex-col md:flex-row items-center justify-center gap-2 py-2">
                  {generatedRoadmap.suggestedLearningOrder.map((stepTitle, idx) => {
                    const isSelected = checkedGoals.has(stepTitle);
                    return (
                      <React.Fragment key={idx}>
                        <div className={`border rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                          isSelected 
                            ? 'bg-[#171B24] border-[#D4AF37]/30 text-[#D4AF37]' 
                            : 'bg-[#11141C] border-white/5 text-[#55555B] line-through'
                        }`}>
                          {stepTitle}
                        </div>
                        {idx < generatedRoadmap.suggestedLearningOrder.length - 1 && (
                          <ArrowRight className="hidden md:block w-4 h-4 text-[#55555B]" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* MILESTONES TIMELINE LIST */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <CalendarDays className="w-4 h-4 text-[#D4AF37]" /> 2. Review and Select Pathway Milestones
                </h3>
                <p className="text-[11.5px] text-[#94949C]">
                  Select the critical timeline triggers you wish to schedule onto your learning calendar and target dashboards.
                </p>

                <div className="bg-[#171B24]/20 border border-white/5 rounded-xl p-5 space-y-4">
                  {generatedRoadmap.recommendedMilestones.map((m, idx) => {
                    const key = `${m.associatedGoal || 'general'}-${m.title}-${idx}`;
                    const isChecked = checkedMilestones.has(key);
                    const isGoalSelected = !m.associatedGoal || checkedGoals.has(m.associatedGoal);

                    return (
                      <div
                        key={idx}
                        onClick={() => isGoalSelected && toggleMilestoneSelection(key)}
                        className={`flex items-start gap-3 p-3 border rounded-lg transition-all ${
                          !isGoalSelected 
                            ? 'opacity-40 cursor-not-allowed bg-transparent border-transparent' 
                            : isChecked 
                              ? 'bg-[#171B24]/20 border-[#D4AF37]/20 cursor-pointer' 
                              : 'bg-transparent border-white/5 hover:border-white/10 cursor-pointer'
                        }`}
                      >
                        <div className={`p-0.5 rounded border flex-shrink-0 mt-0.5 ${
                          !isGoalSelected 
                            ? 'bg-neutral-900 border-neutral-800 text-transparent' 
                            : isChecked 
                              ? 'bg-[#D4AF37]/20 border-[#D4AF37]/40 text-[#D4AF37]' 
                              : 'bg-white/5 border-white/10 text-transparent'
                        }`}>
                          <Check className="w-3 h-3" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-mono font-bold text-[#D4AF37] bg-[#171B24] border border-[#D4AF37]/15 px-1.5 py-0.5 rounded">
                              Month {m.targetOffsetMonths}
                            </span>
                            <span className="text-[8.5px] uppercase tracking-wider font-bold text-[#94949C]">
                              {m.type}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white mt-1.5">{m.title}</p>
                          {m.associatedGoal && (
                            <p className="text-[10px] text-[#55555B] mt-0.5">
                              Associated goal: {m.associatedGoal}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* INTEGRATION CALL TO ACTION */}
              <div className="bg-[#171B24] border border-[#D4AF37]/20 rounded-xl p-5 space-y-4 text-center">
                <div className="space-y-1">
                  <span className="block text-xs font-bold text-[#D4AF37]">Ready to Synchronize Career Blueprint?</span>
                  <p className="text-[11px] text-[#94949C]">
                    This will instantly register {checkedGoals.size} active learning goals and scheduling timers directly into your learning dashboard.
                  </p>
                </div>
                
                <button
                  onClick={handleImportRoadmap}
                  disabled={checkedGoals.size === 0}
                  className={`w-full max-w-sm mx-auto text-xs font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                    checkedGoals.size === 0 
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5' 
                      : 'bg-[#D4AF37] hover:bg-[#A88645] text-black shadow-lg shadow-[#D4AF37]/10 cursor-pointer'
                  }`}
                >
                  <Plus className="w-4 h-4" /> Import {checkedGoals.size} Goals &amp; {checkedMilestones.size} Milestones
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
