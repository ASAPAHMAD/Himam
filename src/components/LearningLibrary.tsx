import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Award, 
  GraduationCap, 
  Globe, 
  Cpu, 
  UserCheck, 
  Sparkles, 
  Briefcase, 
  Server, 
  Shield, 
  Database, 
  Users, 
  Landmark, 
  FileCheck,
  Trophy,
  Compass,
  BookOpen,
  ArrowRight,
  Plus,
  Check,
  Clock,
  TrendingUp,
  X,
  Layers
} from 'lucide-react';
import { Profile } from '../models/types';
import { GoalSearchEntry, LocalCatalogGoalSearchProvider } from '../onboarding/steps/goalSearch';
import { useGoalSearch } from '../hooks/useGoalSearch';
import { LearningGoalPreview } from './LearningGoalPreview';
import { KnowledgeLibrary } from './KnowledgeLibrary';

interface LearningLibraryProps {
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
  setActiveTab: (tab: string) => void;
}

const searchProvider = new LocalCatalogGoalSearchProvider();

const CATEGORY_METADATA = [
  { id: 'certifications', name: 'Certifications', description: 'Industry-recognized credentials', icon: Award, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { id: 'degrees', name: 'University Degrees', description: 'Undergraduate degrees', icon: GraduationCap, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20' },
  { id: 'masters', name: "Master's Degrees", description: "Postgraduate master's degrees", icon: GraduationCap, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'doctorates', name: 'Doctorates', description: 'PhD research programs', icon: GraduationCap, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { id: 'diplomas', name: 'Diplomas', description: 'Professional field diplomas', icon: Award, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'higher-diplomas', name: 'Higher Diplomas', description: 'Advanced professional diplomas', icon: Award, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
  { id: 'languages', name: 'Languages', description: 'Language and fluency programs', icon: Globe, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
  { id: 'technical', name: 'Technical Skills', description: 'Programming and hard skills', icon: Cpu, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  { id: 'professional', name: 'Professional Skills', description: 'Industry specific methodologies', icon: UserCheck, color: 'text-green-500 bg-green-500/10 border-green-500/20' },
  { id: 'leadership', name: 'Leadership', description: 'Strategic leadership and management', icon: Sparkles, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  { id: 'business', name: 'Business', description: 'Marketing, accounting, and operations', icon: Briefcase, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { id: 'it', name: 'IT', description: 'Cloud and network infrastructure', icon: Server, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
  { id: 'cybersecurity', name: 'Cybersecurity', description: 'Security engineering and audits', icon: Shield, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
  { id: 'data-ai', name: 'Data & AI', description: 'Data analysis and machine learning', icon: Database, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  { id: 'hr', name: 'HR', description: 'People practice and talent development', icon: Users, color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20' },
  { id: 'finance', name: 'Finance', description: 'Financial planning and accounting standards', icon: Landmark, color: 'text-amber-600 bg-amber-600/10 border-amber-600/20' },
  { id: 'project-management', name: 'Project Management', description: 'Delivery, agile frameworks, and tools', icon: FileCheck, color: 'text-lime-500 bg-lime-500/10 border-lime-500/20' },
];

const DISCOVERY_SECTIONS = [
  {
    id: 'recommended',
    title: 'Recommended for your career path',
    description: 'Personalized pathways selected to match your career goals and target role.',
    icon: Compass,
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20 text-emerald-500',
    getGoals: (allGoals: GoalSearchEntry[], profile?: Profile) => {
      const userJob = (profile?.targetJob || profile?.careerGoal || '').toLowerCase();
      if (userJob.includes('hr') || userJob.includes('people') || userJob.includes('recruitment')) {
        return allGoals.filter(g => g.id.includes('cipd'));
      }
      if (userJob.includes('data') || userJob.includes('analyst') || userJob.includes('business intelligence') || userJob.includes('bi')) {
        return allGoals.filter(g => g.id === 'pl-300' || g.id === 'advanced-sql' || g.id === 'python-data-science' || g.id === 'pmi-pba');
      }
      if (userJob.includes('project') || userJob.includes('manager') || userJob.includes('scrum') || userJob.includes('delivery')) {
        return allGoals.filter(g => g.id === 'pmp' || g.id === 'google-project-management' || g.id === 'scrum-master');
      }
      if (userJob.includes('security') || userJob.includes('cyber') || userJob.includes('it') || userJob.includes('network')) {
        return allGoals.filter(g => g.id === 'cyber-security' || g.id === 'iso-27001' || g.id === 'aws-solutions-architect');
      }
      return allGoals.filter(g => ['pmp', 'pl-300', 'google-project-management', 'advanced-sql'].includes(g.id));
    }
  },
  {
    id: 'popular',
    title: 'Popular learning goals',
    description: 'Most selected professional credentials in our worldwide catalog.',
    icon: Trophy,
    color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/20 text-amber-500',
    getGoals: (allGoals: GoalSearchEntry[]) => {
      return allGoals.filter(g => ['pmp', 'pl-300', 'mba', 'cipd-level-5', 'cyber-security', 'aws-solutions-architect'].includes(g.id));
    }
  },
  {
    id: 'trending',
    title: 'Trending right now',
    description: 'Fastest growing skills and certifications this quarter.',
    icon: Sparkles,
    color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/20 text-purple-500',
    getGoals: (allGoals: GoalSearchEntry[]) => {
      return allGoals.filter(g => ['python-data-science', 'google-project-management', 'azure-ai-engineer', 'scrum-master', 'advanced-sql'].includes(g.id));
    }
  },
  {
    id: 'recently-added',
    title: 'Recently Added',
    description: 'New standard programs added to the global catalog.',
    icon: BookOpen,
    color: 'from-blue-500/20 to-sky-500/10 border-blue-500/20 text-blue-500',
    getGoals: (allGoals: GoalSearchEntry[]) => {
      return allGoals.filter(g => ['iso-27001', 'soc-2', 'lean-six-sigma', 'itil-4'].includes(g.id));
    }
  }
];

export function matchesCategory(goal: GoalSearchEntry, catId: string): boolean {
  const label = goal.label.toLowerCase();
  const id = goal.id.toLowerCase();
  const cat = goal.category;

  switch (catId) {
    case 'certifications':
      return cat === 'Certifications';
    case 'degrees':
      return cat === 'University Degrees' && !label.includes('master') && !label.includes('ph.d') && !label.includes('phd');
    case 'masters':
      return label.includes('master') || label.includes('m.s.') || id === 'mba';
    case 'doctorates':
      return label.includes('ph.d') || label.includes('phd') || label.includes('doctorate');
    case 'diplomas':
      return label.includes('diploma');
    case 'higher-diplomas':
      return label.includes('higher diploma') || (label.includes('diploma') && (label.includes('level 5') || label.includes('level 7')));
    case 'languages':
      return cat === 'Languages' || id === 'spanish' || id === 'professional-english';
    case 'technical':
      return cat === 'Technical Skills' || id === 'advanced-sql' || id === 'python-data-science';
    case 'professional':
      return id === 'professional-english' || id === 'lean-six-sigma' || id === 'financial-planner';
    case 'leadership':
      return id === 'mba' || label.includes('leadership') || label.includes('management') || label.includes('strategic');
    case 'business':
      return label.includes('business') || label.includes('accounting') || label.includes('finance') || label.includes('marketing') || id === 'mba';
    case 'it':
      return id.includes('aws') || id.includes('azure') || id.includes('cisco') || id.includes('comptia') || id === 'itil-4';
    case 'cybersecurity':
      return id === 'cyber-security' || id.includes('security') || id === 'soc-2' || id === 'iso-27001';
    case 'data-ai':
      return id.includes('data') || id.includes('analytics') || id.includes('ai') || id === 'pl-300' || id === 'python-data-science' || id === 'advanced-sql';
    case 'hr':
      return id.includes('cipd') || label.includes('hr') || label.includes('people management');
    case 'finance':
      return id === 'cfa' || id === 'acca' || id === 'certified-public-accountant' || id === 'financial-planner' || id.includes('finance') || id.includes('accounting');
    case 'project-management':
      return id === 'pmp' || id === 'pmi-pba' || id === 'capm' || id === 'cbap' || id === 'scrum-master' || id === 'psm' || id === 'prince2' || label.includes('project management');
    default:
      return false;
  }
}

export default function LearningLibrary({ profile, onUpdateProfile, setActiveTab }: LearningLibraryProps) {
  const [libraryTab, setLibraryTab] = useState<'catalog' | 'knowledge'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewGoal, setPreviewGoal] = useState<GoalSearchEntry | null>(null);
  const [catalog, setCatalog] = useState<GoalSearchEntry[]>([]);

  // useGoalSearch for real-time provider integration
  const { results: searchResults, isSearching } = useGoalSearch(searchProvider, searchQuery, 150);

  // Initialize all catalog elements once from the provider
  useEffect(() => {
    searchProvider.search('').then(goals => {
      setCatalog(goals);
    });
  }, []);

  const selectedCategoryMeta = useMemo(() => {
    return CATEGORY_METADATA.find(c => c.id === selectedCategory) || null;
  }, [selectedCategory]);

  const displayedGoals = useMemo(() => {
    if (searchQuery.trim().length > 0) {
      return searchResults;
    }
    if (selectedCategory) {
      return catalog.filter(g => matchesCategory(g, selectedCategory));
    }
    return [];
  }, [searchQuery, searchResults, selectedCategory, catalog]);

  const selectedGoalIds = useMemo(() => {
    return new Set(profile.learningGoals || []);
  }, [profile.learningGoals]);

  const handleToggleGoal = (goal: GoalSearchEntry) => {
    const isAdded = selectedGoalIds.has(goal.label);
    const updatedGoals = [...(profile.learningGoals || [])];
    const updatedDetails = { ...(profile.learningGoalDetails || {}) };

    if (isAdded) {
      const idx = updatedGoals.indexOf(goal.label);
      if (idx > -1) updatedGoals.splice(idx, 1);
      delete updatedDetails[goal.label];
    } else {
      updatedGoals.push(goal.label);
      updatedDetails[goal.label] = {
        category: goal.category,
        courseId: goal.courseId,
        milestones: []
      };
    }

    onUpdateProfile({
      ...profile,
      learningGoals: updatedGoals,
      learningGoalDetails: updatedDetails,
    });
    setPreviewGoal(null);
  };

  return (
    <div className="space-y-6" id="learning-library-view">
      {/* Top Sub-Tab Navigation Bar */}
      <div className="bg-[#171B24]/80 backdrop-blur border border-white/5 p-1.5 rounded-xl flex overflow-x-auto gap-1 scrollbar-none select-none">
        <button
          onClick={() => setLibraryTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg transition-all whitespace-nowrap active:scale-[0.98] ${
            libraryTab === 'catalog'
              ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm'
              : 'text-[#94949C] hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <Compass className="w-4 h-4" /> Course & Goal Catalog
        </button>

        <button
          onClick={() => setLibraryTab('knowledge')}
          className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg transition-all whitespace-nowrap active:scale-[0.98] ${
            libraryTab === 'knowledge'
              ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm'
              : 'text-[#94949C] hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Knowledge Library & Uploads
        </button>
      </div>

      {libraryTab === 'knowledge' ? (
        <KnowledgeLibrary setActiveTab={setActiveTab} />
      ) : (
        <>
          {/* Header Panel */}
      <div className="bg-[#11141C] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="space-y-2">
          <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-[#D4AF37]" /> Learning Library
          </h2>
          <p className="text-xs text-[#94949C] leading-relaxed max-w-2xl">
            Discover professional certifications, university degrees, master's tracks, languages, and technical disciplines. Setup customizable study milestones and track your personal pace.
          </p>
        </div>

        {/* Real-time search bar */}
        <div className="mt-6 flex items-center gap-3 bg-[#171B24] border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#D4AF37]/40 transition-all max-w-xl">
          <Search className="w-5 h-5 text-[#55555B] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedCategory(null);
            }}
            placeholder="Search credentials, skills, or program types..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#55555B] focus:outline-none"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-[#94949C] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SEARCH OR CATEGORY RESULTS PANEL */}
      {(searchQuery.trim().length > 0 || selectedCategory) ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {searchQuery.trim().length > 0 ? (
                <span>Search Matches ({isSearching ? 'Searching...' : displayedGoals.length})</span>
              ) : (
                <span className="flex items-center gap-2">
                  {selectedCategoryMeta && (
                    <selectedCategoryMeta.icon className="w-4 h-4 text-[#D4AF37]" />
                  )}
                  {selectedCategoryMeta?.name} Category ({displayedGoals.length})
                </span>
              )}
            </h3>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
              }}
              className="text-[11px] font-semibold text-[#D4AF37] hover:underline flex items-center gap-1"
            >
              Clear Filters
            </button>
          </div>

          {displayedGoals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayedGoals.map(goal => {
                const isAdded = selectedGoalIds.has(goal.label);
                return (
                  <button
                    key={goal.id}
                    onClick={() => setPreviewGoal(goal)}
                    className={`rounded-xl border p-4 text-left transition-all hover:border-[#D4AF37]/30 hover:bg-[#171B24]/50 group cursor-pointer ${
                      isAdded 
                        ? 'bg-[#171B24]/40 border-[#D4AF37]/30 text-[#D4AF37]' 
                        : 'bg-[#171B24]/20 border-white/5 text-[#94949C]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <span className="inline-block rounded-full bg-white/5 border border-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-[#94949C]">
                          {goal.category}
                        </span>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors truncate">
                          {goal.label}
                        </h4>
                        <p className="text-xs text-[#55555B] line-clamp-2">
                          {goal.description || 'Professional qualifications curriculum details.'}
                        </p>
                      </div>
                      <span className={`p-1.5 rounded-lg border flex-shrink-0 transition-colors ${
                        isAdded 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                          : 'bg-white/5 border-white/10 text-[#55555B] group-hover:text-white'
                      }`}>
                        {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </span>
                    </div>

                    {goal.metadata && (
                      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center gap-3 text-[10px] text-[#55555B]">
                        {goal.metadata.estimatedHours && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {goal.metadata.estimatedHours} hrs
                          </span>
                        )}
                        {goal.metadata.difficulty && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> {goal.metadata.difficulty}
                          </span>
                        )}
                        <span className="ml-auto text-[#D4AF37] group-hover:underline font-semibold flex items-center gap-0.5">
                          View details <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-8 bg-[#171B24]/20 border border-dashed border-white/5 rounded-xl space-y-1">
              <BookOpen className="w-8 h-8 text-[#55555B] mx-auto" />
              <p className="text-xs text-[#94949C] font-semibold">No goals found</p>
              <p className="text-[11px] text-[#55555B]">Try searching with a different term or select a category below.</p>
            </div>
          )}
        </div>
      ) : (
        /* DISCOVERY HOME SCREEN */
        <div className="space-y-8">
          {/* Discovery Bento Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DISCOVERY_SECTIONS.map(section => {
              const goals = section.getGoals(catalog, profile);
              if (goals.length === 0) return null;
              const Icon = section.icon;

              return (
                <div 
                  key={section.id} 
                  className="bg-[#171B24]/20 border border-white/5 rounded-xl p-5 space-y-4"
                >
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className={`p-1 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center ${section.color.split(' ')[0]}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-[#55555B] leading-relaxed">
                      {section.description}
                    </p>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {goals.map(goal => {
                      const isAdded = selectedGoalIds.has(goal.label);
                      return (
                        <button
                          key={goal.id}
                          onClick={() => setPreviewGoal(goal)}
                          className={`w-full flex items-center justify-between gap-3 rounded-lg border p-2.5 text-left text-xs transition-colors hover:border-[#D4AF37]/30 hover:bg-[#171B24]/50 group ${
                            isAdded 
                              ? 'bg-[#171B24]/30 border-[#D4AF37]/20 text-[#D4AF37]' 
                              : 'bg-[#171B24]/40 border-white/5 text-[#94949C]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-white group-hover:text-[#D4AF37] transition-colors truncate">{goal.label}</p>
                            <p className="text-[10px] text-[#55555B] truncate">{goal.description}</p>
                          </div>
                          <span className={`p-1 rounded-md border flex-shrink-0 ${
                            isAdded 
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                              : 'bg-white/5 border-white/10 text-[#55555B]'
                          }`}>
                            {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Browse Categories System (Fully Metadata-Driven) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white border-b border-white/5 pb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4AF37]" /> Browse All Categories
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {CATEGORY_METADATA.map(cat => {
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="flex flex-col items-start gap-2.5 p-3.5 bg-[#171B24]/20 border border-white/5 rounded-xl hover:border-[#D4AF37]/30 hover:bg-[#171B24]/60 transition-all text-left cursor-pointer group"
                  >
                    <span className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${cat.color}`}>
                      <CatIcon className="w-4 h-4" />
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                        {cat.name}
                      </p>
                      <p className="text-[10.5px] text-[#55555B] leading-tight line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Goal Preview Modal */}
      {previewGoal && (
        <LearningGoalPreview
          goal={previewGoal}
          isOpen={!!previewGoal}
          isAdded={selectedGoalIds.has(previewGoal.label)}
          onConfirm={handleToggleGoal}
          onCancel={() => setPreviewGoal(null)}
        />
      )}
        </>
      )}
    </div>
  );
}
