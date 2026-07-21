import React, { useState, useMemo, useEffect } from 'react';
import { 
  Play, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Compass, 
  Plus, 
  Check, 
  X, 
  Edit3, 
  Folder, 
  BookOpen, 
  ChevronRight, 
  AlertTriangle,
  Award,
  Sparkles,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Profile, Milestone, MilestoneType, CourseDraft } from '../models/types';
import { StudyPlanState } from '../services/Sync/types';
import { calculateGoalPacing, GoalPacingDetail } from '../services/progressEngine';
import { apiFetch } from '../services/apiClient';
import { CourseCatalog } from '../services/courseCatalog';
import { getOfficialResourcesForGoal, OfficialResource } from '../data/officialResources';
import SyllabusDraftPreview from './SyllabusDraftPreview';

interface MyLearningProps {
  state: StudyPlanState;
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
  onUpdateState: (newState: StudyPlanState) => void;
  setActiveTab: (tab: string) => void;
  onResumeLesson: (lessonId: string) => void;
  syncEngine?: any;
}

const MILESTONE_TYPES: MilestoneType[] = [
  'Exam',
  'Graduation',
  'Certification',
  'Deadline',
  'Interview',
  'Personal Goal',
  'Other'
];

export default function MyLearning({ 
  state, 
  profile, 
  onUpdateProfile, 
  onUpdateState,
  setActiveTab,
  onResumeLesson,
  syncEngine
}: MyLearningProps) {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState<string | null>(null);
  const [newMilestoneType, setNewMilestoneType] = useState<MilestoneType>('Exam');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  // Syllabus Creator states
  const [showSyllabusCreator, setShowSyllabusCreator] = useState<string | null>(null);
  const [activeCreatorTab, setActiveCreatorTab] = useState<'ai' | 'imported' | 'manual'>('ai');
  const [aiDirectives, setAiDirectives] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active Draft states
  const [activeDraft, setActiveDraft] = useState<CourseDraft | null>(null);
  const [openDraftPreview, setOpenDraftPreview] = useState(false);

  useEffect(() => {
    const savedDraftStr = localStorage.getItem('himam_course_draft');
    if (savedDraftStr) {
      try {
        const parsed = JSON.parse(savedDraftStr) as CourseDraft;
        const createdAt = new Date(parsed.createdAt).getTime();
        const now = Date.now();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        if (now - createdAt > sevenDaysInMs) {
          localStorage.removeItem('himam_course_draft');
        } else {
          setActiveDraft(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved draft", e);
      }
    }
  }, []);

  const handleUpdateDraft = (updated: CourseDraft) => {
    setActiveDraft(updated);
    localStorage.setItem('himam_course_draft', JSON.stringify(updated));
  };

  // Manual builder state
  const [manualSections, setManualSections] = useState<Array<{
    name: string;
    lessons: Array<{
      title: string;
      description: string;
      type: 'video' | 'reading' | 'practice' | 'quiz' | 'revision' | 'flashcards' | 'lab' | 'assignment';
      duration: number;
      difficulty: 'Easy' | 'Medium' | 'Hard';
    }>;
  }>>([
    {
      name: 'Module 1: Foundations',
      lessons: [
        { title: 'Core Concepts Overview', description: 'Brief introduction to key subject vocabulary and basic concepts.', type: 'reading', duration: 15, difficulty: 'Easy' }
      ]
    }
  ]);

  // Sub-panel routing and form state for official resources
  const [goalSubView, setGoalSubView] = useState<Record<string, 'milestones' | 'resources'>>({});
  const [showResourceModal, setShowResourceModal] = useState<string | null>(null);
  const [newResourceProvider, setNewResourceProvider] = useState<string>('Udemy');
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [newResourceType, setNewResourceType] = useState<'Free' | 'Paid' | 'Subscription'>('Paid');

  // 1. Calculate Pacing Details for every active learning goal using our Progress Engine
  const activeGoals = useMemo(() => {
    return (profile.learningGoals || []).map(goalName => {
      return calculateGoalPacing(goalName, profile, state);
    });
  }, [profile.learningGoals, profile.learningGoalDetails, state]);

  // 2. Resume studying handler
  const handleResume = (goal: GoalPacingDetail) => {
    if (!goal.isCustom && goal.courseId) {
      const course = CourseCatalog.getAllCourses().find(c => c.id === goal.courseId);
      if (course) {
        // Find first incomplete lesson in syllabus order
        const allLessonsInSyllabusOrder = course.sections.flatMap(s => s.lessons);
        const nextIncomplete = allLessonsInSyllabusOrder.find(l => !state.completedLessons[l.id]);
        if (nextIncomplete) {
          onResumeLesson(nextIncomplete.id);
          return;
        }
        // If all completed, fall back to first lesson
        if (allLessonsInSyllabusOrder.length > 0) {
          onResumeLesson(allLessonsInSyllabusOrder[0].id);
          return;
        }
      }
    }
    // If custom goal, redirect to AI Coach with predefined context!
    setActiveTab('ai-coach');
  };

  // 3. Reordering Goals
  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const updatedGoals = [...(profile.learningGoals || [])];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updatedGoals.length) return;

    const temp = updatedGoals[index];
    updatedGoals[index] = updatedGoals[targetIndex];
    updatedGoals[targetIndex] = temp;

    onUpdateProfile({
      ...profile,
      learningGoals: updatedGoals
    });
  };

  // 4. Removing Goals
  const handleRemoveGoal = (goalName: string) => {
    const updatedGoals = (profile.learningGoals || []).filter(g => g !== goalName);
    const updatedDetails = { ...(profile.learningGoalDetails || {}) };
    delete updatedDetails[goalName];

    onUpdateProfile({
      ...profile,
      learningGoals: updatedGoals,
      learningGoalDetails: updatedDetails
    });

    if (selectedGoal === goalName) {
      setSelectedGoal(null);
    }
  };

  // 5. Milestone CRUD Operations
  const handleAddMilestone = (goalName: string) => {
    if (!newMilestoneDate) return;

    const currentDetails = profile.learningGoalDetails?.[goalName] || {};
    const currentMilestones = currentDetails.milestones || [];

    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      type: newMilestoneType,
      title: newMilestoneTitle.trim() || undefined,
      date: newMilestoneDate,
      completed: false
    };

    const updatedMilestones = [...currentMilestones, newMilestone].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    onUpdateProfile({
      ...profile,
      learningGoalDetails: {
        ...(profile.learningGoalDetails || {}),
        [goalName]: {
          ...currentDetails,
          milestones: updatedMilestones
        }
      }
    });

    // Clear inputs
    setNewMilestoneTitle('');
    setNewMilestoneDate('');
    setShowMilestoneModal(null);
  };

  const handleToggleMilestone = (goalName: string, milestoneId: string) => {
    const currentDetails = profile.learningGoalDetails?.[goalName] || {};
    const currentMilestones = currentDetails.milestones || [];

    const updatedMilestones = currentMilestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, completed: !m.completed };
      }
      return m;
    });

    onUpdateProfile({
      ...profile,
      learningGoalDetails: {
        ...(profile.learningGoalDetails || {}),
        [goalName]: {
          ...currentDetails,
          milestones: updatedMilestones
        }
      }
    });
  };

  const handleDeleteMilestone = (goalName: string, milestoneId: string) => {
    const currentDetails = profile.learningGoalDetails?.[goalName] || {};
    const currentMilestones = currentDetails.milestones || [];

    const updatedMilestones = currentMilestones.filter(m => m.id !== milestoneId);

    onUpdateProfile({
      ...profile,
      learningGoalDetails: {
        ...(profile.learningGoalDetails || {}),
        [goalName]: {
          ...currentDetails,
          milestones: updatedMilestones
        }
      }
    });
  };

  // 6. Custom Learning Resource CRUD Operations
  const handleAddCustomResource = (goalName: string) => {
    if (!newResourceName.trim() || !newResourceUrl.trim()) return;

    const currentDetails = profile.learningGoalDetails?.[goalName] || {};
    const currentCustomResources = (currentDetails as any).customResources || [];

    let formattedUrl = newResourceUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newResource = {
      id: `resource-${Date.now()}`,
      provider: newResourceProvider,
      name: newResourceName.trim(),
      url: formattedUrl,
      type: newResourceType
    };

    onUpdateProfile({
      ...profile,
      learningGoalDetails: {
        ...(profile.learningGoalDetails || {}),
        [goalName]: {
          ...currentDetails,
          customResources: [...currentCustomResources, newResource]
        }
      }
    });

    // Clear inputs
    setNewResourceName('');
    setNewResourceUrl('');
    setNewResourceProvider('Udemy');
    setNewResourceType('Paid');
    setShowResourceModal(null);
  };

  const handleDeleteCustomResource = (goalName: string, resourceId: string) => {
    const currentDetails = profile.learningGoalDetails?.[goalName] || {};
    const currentCustomResources = (currentDetails as any).customResources || [];

    const updatedCustomResources = currentCustomResources.filter((r: any) => r.id !== resourceId);

    onUpdateProfile({
      ...profile,
      learningGoalDetails: {
        ...(profile.learningGoalDetails || {}),
        [goalName]: {
          ...currentDetails,
          customResources: updatedCustomResources
        }
      }
    });
  };

  // Save custom syllabus handler
  const handleSaveCourse = (goalName: string, rawSyllabus: any) => {
    const courseId = `course-custom-${Date.now()}`;
    
    const newCourse = {
      id: courseId,
      name: rawSyllabus.name || goalName,
      mode: activeCreatorTab,
      color: ['#D4AF37', '#3D8C71', '#3D528C', '#8C3D3D', '#8C3D3D'][Math.floor(Math.random() * 5)],
      examDate: null,
      createdAt: new Date().toISOString(),
      description: rawSyllabus.description || `Custom study syllabus for ${goalName}`,
      category: rawSyllabus.category || 'Custom',
      difficulty: rawSyllabus.difficulty || 'Intermediate',
      estimatedHours: rawSyllabus.estimatedHours || 120,
      sections: (rawSyllabus.sections || []).map((sec: any, sIdx: number) => {
        const secId = `section-${courseId}-${sIdx}`;
        return {
          id: secId,
          courseId: courseId,
          name: sec.name || `Section ${sIdx + 1}`,
          order: sIdx + 1,
          lessons: (sec.lessons || []).map((les: any, lIdx: number) => {
            const lesId = `lesson-${courseId}-${sIdx}-${lIdx}`;
            return {
              id: lesId,
              sectionId: secId,
              title: les.title || `Lesson ${lIdx + 1}`,
              description: les.description || '',
              type: les.type || 'reading',
              duration: les.duration || 30,
              difficulty: les.difficulty || 'Medium',
              scheduledDate: null,
              resources: [],
              attachments: [],
              practiceQuestions: []
            };
          })
        };
      })
    };

    const updatedCustomCourses = [...(profile.customCourses || []), newCourse];

    const updatedDetails = {
      ...(profile.learningGoalDetails || {}),
      [goalName]: {
        ...(profile.learningGoalDetails?.[goalName] || {}),
        courseId: courseId,
        category: newCourse.category,
        difficulty: newCourse.difficulty,
        estimatedHours: newCourse.estimatedHours
      }
    };

    onUpdateProfile({
      ...profile,
      customCourses: updatedCustomCourses,
      learningGoalDetails: updatedDetails
    });

    // Reset states
    setShowSyllabusCreator(null);
    setAiDirectives('');
    setImportUrl('');
    setGenerationError(null);
  };

  // Transactional, rollback-safe save of a reviewed draft
  const handleSaveDraft = async (draftToSave: CourseDraft) => {
    // 1. Create a deep backup of the current profile/catalog state
    const backupProfile = JSON.parse(JSON.stringify(profile));
    
    try {
      const courseId = `course-custom-${Date.now()}`;
      
      const finalizedSections = draftToSave.sections.map((sec, sIdx) => {
        const secId = `section-${courseId}-${sIdx}`;
        return {
          id: secId,
          courseId: courseId,
          name: sec.name || `Section ${sIdx + 1}`,
          order: sIdx + 1,
          lessons: sec.lessons.map((les, lIdx) => {
            return {
              id: les.id, // Stable unique ID preserved from the draft
              sectionId: secId,
              title: les.title || `Lesson ${lIdx + 1}`,
              description: les.description || '',
              type: les.type || 'reading',
              duration: les.duration || 30,
              difficulty: les.difficulty || 'Medium',
              scheduledDate: null,
              resources: [],
              attachments: [],
              practiceQuestions: [],
              provenance: les.provenance || (draftToSave.mode === 'ai' ? 'AI Generated' : 'Imported')
            };
          })
        };
      });

      const newCourse = {
        id: courseId,
        name: draftToSave.name || draftToSave.goalName,
        mode: draftToSave.mode,
        provenance: draftToSave.mode === 'ai' ? 'AI Generated' : 'Imported',
        color: ['#D4AF37', '#3D8C71', '#3D528C', '#8C3D3D', '#8C3D3D'][Math.floor(Math.random() * 5)],
        examDate: null,
        createdAt: new Date().toISOString(),
        description: draftToSave.description || `Custom study syllabus for ${draftToSave.goalName}`,
        category: draftToSave.category || 'Custom',
        difficulty: draftToSave.difficulty || 'Intermediate',
        estimatedHours: draftToSave.estimatedHours || 120,
        sections: finalizedSections
      };

      const updatedCustomCourses = [...(profile.customCourses || []), newCourse];

      const updatedDetails = {
        ...(profile.learningGoalDetails || {}),
        [draftToSave.goalName]: {
          ...(profile.learningGoalDetails?.[draftToSave.goalName] || {}),
          courseId: courseId,
          category: newCourse.category,
          difficulty: newCourse.difficulty,
          estimatedHours: newCourse.estimatedHours
        }
      };

      // 2. Perform the atomic update
      onUpdateProfile({
        ...profile,
        customCourses: updatedCustomCourses,
        learningGoalDetails: updatedDetails
      });

      // Enqueue course save for cloud sync if syncEngine is available (Milestone 2.6.2)
      if (syncEngine) {
        const payloadSections = finalizedSections.map(sec => ({
          id: sec.id,
          courseId: sec.courseId,
          name: sec.name,
          order: sec.order
        }));

        const payloadLessons = finalizedSections.flatMap(sec => 
          sec.lessons.map(les => ({
            id: les.id,
            sectionId: les.sectionId,
            title: les.title,
            description: les.description || '',
            type: les.type || 'reading',
            duration: les.duration || 30,
            difficulty: les.difficulty || 'Medium',
            scheduledDate: les.scheduledDate,
            resources: les.resources || [],
            attachments: les.attachments || [],
            practiceQuestions: les.practiceQuestions || []
          }))
        );

        const coursePayload = {
          course: {
            id: newCourse.id,
            name: newCourse.name,
            mode: newCourse.mode,
            color: newCourse.color,
            examDate: newCourse.examDate,
            createdAt: newCourse.createdAt
          },
          sections: payloadSections,
          lessons: payloadLessons
        };

        syncEngine.enqueue({
          entityType: 'course_save',
          payload: coursePayload
        }).catch((e: any) => {
          console.error("Failed to enqueue course_save in SyncEngine:", e);
        });
      }

      // 3. Clear draft states upon successful transaction
      setActiveDraft(null);
      setOpenDraftPreview(false);
      localStorage.removeItem('himam_course_draft');
      
      setAiDirectives('');
      setImportUrl('');
      setGenerationError(null);

    } catch (err) {
      // 4. Rollback in-memory catalog synchronization and restore state if anything fails
      CourseCatalog.setCustomCourses(backupProfile.customCourses || []);
      onUpdateProfile(backupProfile);
      throw err;
    }
  };

  // Regeneration that preserves user intent (reuses prompts & settings)
  const handleRegenerateDraft = async (directives?: string) => {
    if (!activeDraft) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStep(0);

    const stepInterval = setInterval(() => {
      setGenerationStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 4500);

    try {
      const response = await apiFetch('/api/course/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: activeDraft.goalName,
          mode: activeDraft.mode,
          url: activeDraft.importUrl,
          directives: directives !== undefined ? directives : activeDraft.directives
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned code ${response.status}`);
      }

      const rawSyllabus = await response.json();
      clearInterval(stepInterval);

      const draftId = `draft-${Date.now()}`;
      const newDraft: CourseDraft = {
        id: draftId,
        goalName: activeDraft.goalName,
        name: rawSyllabus.name || activeDraft.goalName,
        createdAt: new Date().toISOString(), // Reset 7-day expiration clock upon regeneration
        lastModifiedAt: new Date().toISOString(),
        mode: activeDraft.mode,
        description: rawSyllabus.description || `Custom study syllabus for ${activeDraft.goalName}`,
        category: rawSyllabus.category || 'Custom',
        difficulty: rawSyllabus.difficulty || 'Intermediate',
        estimatedHours: rawSyllabus.estimatedHours || 120,
        directives: directives !== undefined ? directives : activeDraft.directives,
        importUrl: activeDraft.importUrl,
        sections: (rawSyllabus.sections || []).map((sec: any, sIdx: number) => {
          const secId = `section-${draftId}-${sIdx}`;
          return {
            id: secId,
            name: sec.name || `Section ${sIdx + 1}`,
            lessons: (sec.lessons || []).map((les: any, lIdx: number) => {
              const lesId = `lesson-${draftId}-${sIdx}-${lIdx}-${Math.random().toString(36).substr(2, 9)}`;
              return {
                id: lesId,
                title: les.title || `Lesson ${lIdx + 1}`,
                description: les.description || '',
                type: les.type || 'reading',
                duration: les.duration || 30,
                difficulty: les.difficulty || 'Medium',
                provenance: activeDraft.mode === 'ai' ? 'AI Generated' : 'Imported'
              };
            })
          };
        })
      };

      setActiveDraft(newDraft);
      localStorage.setItem('himam_course_draft', JSON.stringify(newDraft));

    } catch (err: any) {
      clearInterval(stepInterval);
      console.error("Failed to regenerate custom syllabus:", err);
      setGenerationError(err.message || "An unexpected error occurred during syllabus building. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };


  // Generate Syllabus via backend
  const handleGenerateSyllabus = async (goalName: string) => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStep(0);

    const stepInterval = setInterval(() => {
      setGenerationStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 4500);

    try {
      const response = await apiFetch('/api/course/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalName,
          mode: activeCreatorTab === 'ai' ? 'ai' : 'imported',
          url: activeCreatorTab === 'imported' ? importUrl : undefined,
          directives: activeCreatorTab === 'ai' ? aiDirectives : undefined
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned code ${response.status}`);
      }

      const rawSyllabus = await response.json();
      clearInterval(stepInterval);
      
      const draftId = `draft-${Date.now()}`;
      const newDraft: CourseDraft = {
        id: draftId,
        goalName: goalName,
        name: rawSyllabus.name || goalName,
        createdAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        mode: activeCreatorTab === 'imported' ? 'imported' : 'ai',
        description: rawSyllabus.description || `Custom study syllabus for ${goalName}`,
        category: rawSyllabus.category || 'Custom',
        difficulty: rawSyllabus.difficulty || 'Intermediate',
        estimatedHours: rawSyllabus.estimatedHours || 120,
        directives: activeCreatorTab === 'ai' ? aiDirectives : undefined,
        importUrl: activeCreatorTab === 'imported' ? importUrl : undefined,
        sections: (rawSyllabus.sections || []).map((sec: any, sIdx: number) => {
          const secId = `section-${draftId}-${sIdx}`;
          return {
            id: secId,
            name: sec.name || `Section ${sIdx + 1}`,
            lessons: (sec.lessons || []).map((les: any, lIdx: number) => {
              const lesId = `lesson-${draftId}-${sIdx}-${lIdx}-${Math.random().toString(36).substr(2, 9)}`;
              return {
                id: lesId,
                title: les.title || `Lesson ${lIdx + 1}`,
                description: les.description || '',
                type: les.type || 'reading',
                duration: les.duration || 30,
                difficulty: les.difficulty || 'Medium',
                provenance: activeCreatorTab === 'ai' ? 'AI Generated' : 'Imported'
              };
            })
          };
        })
      };

      setActiveDraft(newDraft);
      localStorage.setItem('himam_course_draft', JSON.stringify(newDraft));
      setOpenDraftPreview(true);
      setShowSyllabusCreator(null);

    } catch (err: any) {
      clearInterval(stepInterval);
      console.error("Failed to generate custom syllabus:", err);
      setGenerationError(err.message || "An unexpected error occurred during syllabus building. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6" id="my-learning-workspace">
      {/* Header Info Panel */}
      <div className="bg-[#11141C] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#D4AF37]" /> My Learning Workspace
          </h2>
          <p className="text-xs text-[#94949C] leading-relaxed max-w-xl">
            This is your primary workplace. Reorder your priorities, manage custom timelines, and track exam, certification, or graduation deadlines.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('learning-library')}
          className="rounded-xl bg-[#D4AF37] hover:bg-[#b08e4d] text-black text-xs font-bold px-4 py-3 flex items-center gap-2 transition-colors flex-shrink-0"
        >
          <Compass className="w-4 h-4" /> Discover New Goals
        </button>
      </div>

      {/* Active Draft Alert Banner */}
      {activeDraft && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5" /> In-Progress Draft
              </span>
              <span className="text-[10px] font-mono text-[#55555B]">
                Expires soon
              </span>
            </div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              Draft Syllabus for <strong className="text-[#D4AF37] font-semibold">{activeDraft.goalName}</strong> is ready
            </h4>
            <p className="text-xs text-[#94949C]">
              Review the modules, rename or reorder lessons, customize lecture hours, and approve to save this syllabus to your active workspace.
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto self-end md:self-auto">
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to discard this course draft? This will clear your temporary progress preview.")) {
                  setActiveDraft(null);
                  localStorage.removeItem('himam_course_draft');
                }
              }}
              className="flex-1 md:flex-initial px-4 py-2 border border-white/5 bg-white/5 rounded-xl text-xs font-bold text-[#94949C] hover:text-white transition-colors cursor-pointer"
            >
              Discard Draft
            </button>
            <button
              onClick={() => setOpenDraftPreview(true)}
              className="flex-1 md:flex-initial px-4 py-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:from-[#9c7f46] hover:to-[#dbb56c] text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Review Draft</span>
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Syllabus Draft Preview Workspace Overlay */}
      {openDraftPreview && activeDraft && (
        <SyllabusDraftPreview
          draft={activeDraft}
          onUpdateDraft={handleUpdateDraft}
          onSave={handleSaveDraft}
          onDiscard={() => {
            setActiveDraft(null);
            setOpenDraftPreview(false);
            localStorage.removeItem('himam_course_draft');
          }}
          onRegenerate={handleRegenerateDraft}
          isRegenerating={isGenerating}
          generationStep={generationStep}
          generationError={generationError}
        />
      )}

      {activeGoals.length === 0 ? (
        <div className="text-center p-12 bg-[#171B24]/20 border border-dashed border-white/5 rounded-2xl space-y-4">
          <Compass className="w-10 h-10 text-[#55555B] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Your workspace is currently empty</p>
            <p className="text-xs text-[#94949C] max-w-md mx-auto">
              You haven't selected any active learning goals yet. Let's find your first credential, university degree, or technical skillset!
            </p>
          </div>
          <button
            onClick={() => setActiveTab('learning-library')}
            className="rounded-lg border border-[#D4AF37]/30 bg-[#171B24] text-[#D4AF37] text-xs font-bold px-4 py-2 hover:bg-[#D4AF37]/10 transition-colors"
          >
            Browse Learning Library
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeGoals.map((goal, idx) => {
            const hasMilestones = goal.milestones.length > 0;
            const nextMilestone = goal.milestones.find(m => !m.completed);
            const isCustom = goal.isCustom;
            const hasUrl = profile.learningGoalDetails?.[goal.goalName]?.url;

            // Status light styling based on ProgressEngine calculations
            let statusBadge = (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Track
              </span>
            );
            if (goal.overallStatus === 'behind') {
              statusBadge = (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-500 uppercase tracking-wide animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Behind Schedule
                </span>
              );
            } else if (goal.overallStatus === 'approaching') {
              statusBadge = (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wide">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Approaching Deadline
                </span>
              );
            }

            return (
              <div 
                key={goal.goalName}
                className="bg-[#11141C] border border-white/5 rounded-2xl overflow-hidden shadow-md transition-all duration-300"
              >
                {/* Main Goal Card Grid */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Goal Metadata Information */}
                  <div className="md:col-span-5 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-full bg-white/5 border border-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold text-[#94949C]">
                        {goal.category}
                      </span>
                      {statusBadge}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                        {goal.goalName}
                      </h3>
                      <p className="text-[11px] text-[#55555B] flex items-center gap-2">
                        <span>Difficulty: <strong className="text-white/80 font-semibold">{goal.difficulty}</strong></span>
                        <span>•</span>
                        <span>Study Time: <strong className="text-white/80 font-semibold">{goal.estimatedHours}h</strong></span>
                        {hasUrl && (
                          <>
                            <span>•</span>
                            <a 
                              href={hasUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[#D4AF37] hover:underline inline-flex items-center gap-0.5"
                            >
                              Program Site <ExternalLink className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Goal Progress and Upcoming Milestones */}
                  <div className="md:col-span-4 space-y-3">
                    {isCustom ? (
                      <div className="text-[11px] text-[#D4AF37]/90 bg-[#D4AF37]/5 border border-[#D4AF37]/10 rounded-xl p-3 space-y-1.5">
                        <p className="font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> No Syllabus Plan
                        </p>
                        <p className="text-[#94949C] leading-normal text-[10px]">
                          Design a custom study syllabus with AI, import external courses, or build one manually to unlock tracking.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-end text-xs">
                            <span className="text-[#94949C] font-semibold text-[11px]">Syllabus Progress</span>
                            <span className="font-mono font-bold text-white text-[11px]">{goal.completionPercentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#D4AF37] rounded-full transition-all duration-500" 
                              style={{ width: `${goal.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Upcoming Milestone Display */}
                        <div className="text-[11px] text-[#94949C] flex items-start gap-1.5 bg-[#171B24]/40 border border-white/5 rounded-xl p-2">
                          <Calendar className="w-3.5 h-3.5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            {nextMilestone ? (
                              <p className="truncate">
                                <strong className="text-white font-semibold">Next: {nextMilestone.type}</strong> ({nextMilestone.title || 'Untitled'}) on {nextMilestone.date}
                              </p>
                            ) : (
                              <p className="text-[#55555B]">No upcoming milestones. Configure target deadlines below.</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Workplace Goal Controls */}
                  <div className="md:col-span-3 flex flex-row md:flex-col justify-end md:justify-center items-center gap-2 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4 w-full">
                    {isCustom ? (
                      <button
                        onClick={() => {
                          setShowSyllabusCreator(goal.goalName);
                          setActiveCreatorTab('ai');
                        }}
                        className="w-full bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:from-[#9c7f46] hover:to-[#dbb56c] text-black text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                      >
                        <Sparkles className="w-4 h-4" /> 
                        <span>Setup Syllabus Plan</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(goal)}
                        className="w-full bg-[#D4AF37] hover:bg-[#b08e4d] text-black text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" /> 
                        <span>Resume Study</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 w-full justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* Reordering priority */}
                        <button
                          onClick={() => handleMove(idx, 'UP')}
                          disabled={idx === 0}
                          className="p-2 rounded-lg border border-white/5 bg-[#171B24]/20 text-[#55555B] hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:text-[#55555B] transition-colors"
                          title="Move priority up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(idx, 'DOWN')}
                          disabled={idx === activeGoals.length - 1}
                          className="p-2 rounded-lg border border-white/5 bg-[#171B24]/20 text-[#55555B] hover:text-[#D4AF37] disabled:opacity-30 disabled:hover:text-[#55555B] transition-colors"
                          title="Move priority down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveGoal(goal.goalName)}
                        className="p-2 rounded-lg border border-white/5 bg-[#171B24]/20 text-[#55555B] hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition-all"
                        title="Remove goal from workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subpanel triggers */}
                <div className="bg-[#171B24]/40 border-t border-white/5 px-5 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Toggle Milestones view */}
                    <button
                      onClick={() => {
                        if (selectedGoal === goal.goalName && goalSubView[goal.goalName] !== 'resources') {
                          setSelectedGoal(null);
                        } else {
                          setSelectedGoal(goal.goalName);
                          setGoalSubView(prev => ({ ...prev, [goal.goalName]: 'milestones' }));
                        }
                      }}
                      className={`text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                        selectedGoal === goal.goalName && goalSubView[goal.goalName] !== 'resources'
                          ? 'text-[#D4AF37]'
                          : 'text-[#94949C] hover:text-white'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Timeline & Milestones ({goal.milestones.length})</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${selectedGoal === goal.goalName && goalSubView[goal.goalName] !== 'resources' ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Toggle Resources view */}
                    <button
                      onClick={() => {
                        if (selectedGoal === goal.goalName && goalSubView[goal.goalName] === 'resources') {
                          setSelectedGoal(null);
                        } else {
                          setSelectedGoal(goal.goalName);
                          setGoalSubView(prev => ({ ...prev, [goal.goalName]: 'resources' }));
                        }
                      }}
                      className={`text-[11px] font-semibold flex items-center gap-1.5 transition-colors ${
                        selectedGoal === goal.goalName && goalSubView[goal.goalName] === 'resources'
                          ? 'text-[#D4AF37]'
                          : 'text-[#94949C] hover:text-white'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Start Learning / Official Resources ({getOfficialResourcesForGoal(goal.goalName).length + ((profile.learningGoalDetails?.[goal.goalName] as any)?.customResources?.length || 0)})</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${selectedGoal === goal.goalName && goalSubView[goal.goalName] === 'resources' ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Contextual Action Button */}
                  {selectedGoal === goal.goalName && goalSubView[goal.goalName] === 'resources' ? (
                    <button
                      onClick={() => setShowResourceModal(goal.goalName)}
                      className="text-[11px] font-semibold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Attach learning link
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowMilestoneModal(goal.goalName)}
                      className="text-[11px] font-semibold text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add custom milestone
                    </button>
                  )}
                </div>

                {/* Expanded container */}
                {selectedGoal === goal.goalName && (
                  <div className="p-5 border-t border-white/5 bg-[#09090B] space-y-4">
                    {/* View 1: Milestones */}
                    {goalSubView[goal.goalName] !== 'resources' && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#D4AF37]" /> Core timeline & milestones ({goal.goalName})
                        </h4>

                        {hasMilestones ? (
                          <div className="space-y-2">
                            {goal.milestones.map(m => {
                              let labelClass = 'text-[#94949C]';
                              let dotClass = 'bg-emerald-500';

                              if (m.status === 'completed') {
                                labelClass = 'text-[#55555B] line-through';
                                dotClass = 'bg-[#55555B]';
                              } else if (m.status === 'behind') {
                                labelClass = 'text-red-500 font-semibold';
                                dotClass = 'bg-red-500 animate-pulse';
                              } else if (m.status === 'approaching') {
                                labelClass = 'text-amber-500 font-semibold';
                                dotClass = 'bg-amber-500';
                              }

                              return (
                                <div 
                                  key={m.id}
                                  className="flex items-center justify-between gap-4 p-3 bg-[#171B24]/60 border border-white/5 rounded-xl"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button
                                      onClick={() => handleToggleMilestone(goal.goalName, m.id)}
                                      className={`p-1 rounded-md border transition-colors flex-shrink-0 ${
                                        m.completed 
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                                          : 'bg-white/5 border-white/10 text-transparent hover:border-[#D4AF37]/40'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-[#94949C]">
                                          {m.type}
                                        </span>
                                        {m.title && (
                                          <p className={`text-xs font-semibold text-white truncate ${m.completed ? 'opacity-30 line-through' : ''}`}>
                                            {m.title}
                                          </p>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-[#55555B] mt-0.5">
                                        Due on {m.date}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {m.completed ? (
                                      <span className="text-[10px] text-[#55555B] font-semibold uppercase tracking-wider">Completed</span>
                                    ) : (
                                      <span className={`text-[10px] font-bold uppercase tracking-wider ${labelClass}`}>
                                        {m.status === 'behind' ? 'Missed' : m.status === 'approaching' ? 'Approaching' : 'On Track'}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => handleDeleteMilestone(goal.goalName, m.id)}
                                      className="text-[#55555B] hover:text-red-500 p-1 rounded hover:bg-red-500/5 transition-colors"
                                      title="Delete milestone"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center p-6 bg-[#171B24]/20 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B]">
                            No milestones defined yet. Click "Add custom milestone" to set target dates or exam benchmarks!
                          </div>
                        )}
                      </div>
                    )}

                    {/* View 2: Official Resources & Start Learning */}
                    {goalSubView[goal.goalName] === 'resources' && (
                      <div className="space-y-4">
                        <div className="pb-1 border-b border-white/5">
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-[#D4AF37]" /> Official Learning Resources & Providers
                          </h4>
                          <p className="text-[10px] text-[#94949C] mt-1 leading-relaxed">
                            Jump directly into pre-curated study material, certification guides, and practice modules to start learning immediately.
                          </p>
                        </div>

                        {/* Combined Preset + Custom Resources Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* 1. Preset Official Resources */}
                          {getOfficialResourcesForGoal(goal.goalName).map(res => (
                            <a
                              key={res.id}
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 rounded-xl border border-white/5 bg-[#171B24]/60 hover:bg-[#171B24] hover:border-[#D4AF37]/30 transition-all text-left group cursor-pointer"
                            >
                              <div className="flex justify-between items-start gap-2 h-full">
                                <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                                  <div>
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
                                    <p className="text-[11px] text-white/90 font-semibold mt-1 leading-snug">
                                      {res.name}
                                    </p>
                                    {res.description && (
                                      <p className="text-[10px] text-[#94949C] leading-relaxed mt-1 line-clamp-2">
                                        {res.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-2 text-[10px] font-bold text-[#D4AF37] flex items-center gap-1">
                                    <span>Start Learning</span> <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                  </div>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-[#55555B] group-hover:text-[#D4AF37] transition-all flex-shrink-0" />
                              </div>
                            </a>
                          ))}

                          {/* 2. Custom Attached Resources */}
                          {((profile.learningGoalDetails?.[goal.goalName] as any)?.customResources || []).map((res: any) => (
                            <div
                              key={res.id}
                              className="block p-3 rounded-xl border border-white/5 bg-[#171B24]/30 hover:bg-[#171B24]/60 hover:border-[#D4AF37]/30 transition-all text-left group"
                            >
                              <div className="flex justify-between items-start gap-2 h-full">
                                <a
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-w-0 flex-1 flex flex-col justify-between h-full cursor-pointer"
                                >
                                  <div>
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
                                      <span className="text-[8px] px-1.5 py-0.2 rounded bg-white/5 text-[#94949C] font-semibold border border-white/5">
                                        User Attached
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-white/90 font-semibold mt-1 leading-snug">
                                      {res.name}
                                    </p>
                                  </div>
                                  <div className="mt-2 text-[10px] font-bold text-[#D4AF37] flex items-center gap-1">
                                    <span>Open Resource</span> <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                  </div>
                                </a>

                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                  <a href={res.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-3.5 h-3.5 text-[#55555B] hover:text-[#D4AF37] transition-all" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteCustomResource(goal.goalName, res.id)}
                                    className="p-1 rounded text-[#55555B] hover:text-red-500 hover:bg-red-500/5 transition-all"
                                    title="Delete custom link"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Empty state for custom goals with no preset and no custom resources */}
                        {getOfficialResourcesForGoal(goal.goalName).length === 0 && (!((profile.learningGoalDetails?.[goal.goalName] as any)?.customResources) || ((profile.learningGoalDetails?.[goal.goalName] as any)?.customResources?.length === 0)) && (
                          <div className="text-center p-6 bg-[#171B24]/20 border border-dashed border-white/5 rounded-xl text-xs text-[#55555B]">
                            No study resources attached. Click "Attach learning link" above to save official guides, courses, or reference links for this custom goal!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Up Custom Milestone Creation Modal */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-xs" 
            onClick={() => setShowMilestoneModal(null)} 
          />
          
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0D12] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" /> Configure Target Date
              </h3>
              <button 
                onClick={() => setShowMilestoneModal(null)}
                className="text-[#94949C] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Type selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Milestone Type</label>
                <select
                  value={newMilestoneType}
                  onChange={e => setNewMilestoneType(e.target.value as MilestoneType)}
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]/40"
                >
                  {MILESTONE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Milestone Title / Memo (Optional)</label>
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={e => setNewMilestoneTitle(e.target.value)}
                  placeholder="e.g. Chapter 1 Exam, CIPD Unit 1, Graduation Ceremony"
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>

              {/* Date selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Target Completion Date</label>
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={e => setNewMilestoneDate(e.target.value)}
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowMilestoneModal(null)}
                className="flex-1 rounded-xl border border-white/10 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddMilestone(showMilestoneModal)}
                disabled={!newMilestoneDate}
                className="flex-1 rounded-xl bg-[#D4AF37] hover:bg-[#b08e4d] py-2 text-xs font-bold text-black disabled:opacity-50 transition-colors"
              >
                Add Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Up Custom Resource Creation Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/75 backdrop-blur-xs" 
            onClick={() => setShowResourceModal(null)} 
          />
          
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0D12] p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#D4AF37]" /> Attach Study Link
              </h3>
              <button 
                onClick={() => setShowResourceModal(null)}
                className="text-[#94949C] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Provider Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Resource Provider</label>
                <select
                  value={newResourceProvider}
                  onChange={e => setNewResourceProvider(e.target.value)}
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]/40"
                >
                  <option value="Microsoft Learn">Microsoft Learn</option>
                  <option value="Coursera">Coursera</option>
                  <option value="Udemy">Udemy</option>
                  <option value="LinkedIn Learning">LinkedIn Learning</option>
                  <option value="edX">edX</option>
                  <option value="FutureLearn">FutureLearn</option>
                  <option value="AWS Skill Builder">AWS Skill Builder</option>
                  <option value="Google Skill Boost">Google Skill Boost</option>
                  <option value="PMI">PMI (Project Management Inst.)</option>
                  <option value="CIPD">CIPD</option>
                  <option value="YouTube (free)">YouTube (free)</option>
                  <option value="Other Platform">Other Platform</option>
                </select>
              </div>

              {/* Resource Name input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Resource Title</label>
                <input
                  type="text"
                  value={newResourceName}
                  onChange={e => setNewResourceName(e.target.value)}
                  placeholder="e.g. Complete Syllabus Guide, Video Series"
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>

              {/* Resource URL input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Website Link / URL</label>
                <input
                  type="text"
                  value={newResourceUrl}
                  onChange={e => setNewResourceUrl(e.target.value)}
                  placeholder="e.g. www.udemy.com/course/..."
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>

              {/* Resource Access Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Access Type</label>
                <select
                  value={newResourceType}
                  onChange={e => setNewResourceType(e.target.value as any)}
                  className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37]/40"
                >
                  <option value="Free">Free</option>
                  <option value="Paid">Paid / One-off Purchase</option>
                  <option value="Subscription">Platform Subscription</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResourceModal(null)}
                className="flex-1 rounded-xl border border-white/10 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCustomResource(showResourceModal)}
                disabled={!newResourceName.trim() || !newResourceUrl.trim()}
                className="flex-1 rounded-xl bg-[#D4AF37] hover:bg-[#b08e4d] py-2 text-xs font-bold text-black disabled:opacity-50 transition-colors"
              >
                Attach Resource
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Syllabus Creator Modal */}
      {showSyllabusCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm" 
            onClick={() => { if (!isGenerating) setShowSyllabusCreator(null); }} 
          />
          
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0D12] p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Setup Study Syllabus
                </h3>
                <p className="text-xs text-[#94949C]">
                  Configure your dynamic learning content for <strong className="text-white">{showSyllabusCreator}</strong>
                </p>
              </div>
              <button 
                onClick={() => { if (!isGenerating) setShowSyllabusCreator(null); }}
                className="text-[#94949C] hover:text-white disabled:opacity-30"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isGenerating ? (
              <div className="text-center py-12 space-y-6">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/10 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#D4AF37] animate-spin" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white animate-pulse">
                    {generationStep === 0 && "Connecting with Himam AI tutor engine..."}
                    {generationStep === 1 && "Analyzing learning target objectives..."}
                    {generationStep === 2 && "Curating balanced lecture lessons & practice labs..."}
                    {generationStep >= 3 && "Finalizing modular syllabus order..."}
                  </p>
                  <p className="text-xs text-[#94949C] max-w-sm mx-auto">
                    This might take a minute as Gemini designs a comprehensive professional curriculum for your study target.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode Select Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setActiveCreatorTab('ai')}
                    className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeCreatorTab === 'ai' 
                        ? 'bg-[#D4AF37] text-black shadow-md' 
                        : 'text-[#94949C] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Automated</span>
                  </button>
                  <button
                    onClick={() => setActiveCreatorTab('imported')}
                    className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeCreatorTab === 'imported' 
                        ? 'bg-[#D4AF37] text-black shadow-md' 
                        : 'text-[#94949C] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Import Course</span>
                  </button>
                  <button
                    onClick={() => setActiveCreatorTab('manual')}
                    className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      activeCreatorTab === 'manual' 
                        ? 'bg-[#D4AF37] text-black shadow-md' 
                        : 'text-[#94949C] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Manual Builder</span>
                  </button>
                </div>

                {generationError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-500">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{generationError}</p>
                  </div>
                )}

                {/* Tab 1: AI Automated */}
                {activeCreatorTab === 'ai' && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-semibold text-white">How it works</p>
                      <p className="text-[#94949C] leading-relaxed">
                        Our AI Academic Assistant will analyze your study goal and map out a structured professional syllabus comprising modules, deep-dive lessons, and integrated test checkpoints.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Custom Directives or Focus Areas (Optional)</label>
                      <textarea
                        value={aiDirectives}
                        onChange={e => setAiDirectives(e.target.value)}
                        placeholder="e.g., Focus heavily on hands-on practical lab scenarios, beginner-friendly introduction, make it comprehensive and deep-dive, etc."
                        rows={3}
                        className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 resize-none leading-relaxed"
                      />
                    </div>

                    <button
                      onClick={() => handleGenerateSyllabus(showSyllabusCreator)}
                      className="w-full bg-[#D4AF37] hover:bg-[#b08e4d] text-black text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" /> Generate Syllabus with AI
                    </button>
                  </div>
                )}

                {/* Tab 2: Import Course */}
                {activeCreatorTab === 'imported' && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 space-y-2">
                      <p className="font-semibold text-white">How it works</p>
                      <p className="text-[#94949C] leading-relaxed">
                        Paste a URL of an existing educational resource, course page, or curriculum outline (Microsoft Learn, Coursera, Udemy, LinkedIn Learning, YouTube, edX, etc.). Gemini will discover and parse the modules and structure directly into your system.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#55555B]">Course Page URL</label>
                      <input
                        type="url"
                        value={importUrl}
                        onChange={e => setImportUrl(e.target.value)}
                        placeholder="e.g. https://www.udemy.com/course/aws-certified-solutions-architect-associate/"
                        className="w-full bg-[#171B24] border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
                      />
                    </div>

                    <button
                      onClick={() => handleGenerateSyllabus(showSyllabusCreator)}
                      disabled={!importUrl.trim()}
                      className="w-full bg-[#D4AF37] hover:bg-[#b08e4d] text-black text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" /> Import and Parse with AI
                    </button>
                  </div>
                )}

                {/* Tab 3: Manual Builder */}
                {activeCreatorTab === 'manual' && (
                  <div className="space-y-4">
                    <div className="bg-[#171B24]/60 border border-white/5 rounded-xl p-4 text-xs space-y-1">
                      <p className="font-semibold text-white">Visual Curriculum Builder</p>
                      <p className="text-[#94949C]">
                        Build your personalized study syllabus module-by-module. All manual structures integrate seamlessly into your pacing progress engine, study rooms, and trackers.
                      </p>
                    </div>

                    {/* Manual Modules List */}
                    <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-1">
                      {manualSections.map((sec, sIdx) => (
                        <div key={sIdx} className="bg-[#171B24]/40 border border-white/5 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-center gap-4">
                            <input
                              type="text"
                              value={sec.name}
                              onChange={e => {
                                const val = e.target.value;
                                setManualSections(prev => prev.map((s, idx) => idx === sIdx ? { ...s, name: val } : s));
                              }}
                              className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-white/20 focus:border-[#D4AF37]/40 focus:outline-none pb-0.5 px-1 flex-1"
                              placeholder="Module Name (e.g. Module 1: Foundations)"
                            />
                            {manualSections.length > 1 && (
                              <button
                                onClick={() => setManualSections(prev => prev.filter((_, idx) => idx !== sIdx))}
                                className="text-red-500 hover:text-red-400 text-xs font-bold flex items-center gap-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove Module
                              </button>
                            )}
                          </div>

                          {/* Lessons inside Module */}
                          <div className="space-y-2.5 border-l border-white/10 pl-3.5">
                            {sec.lessons.map((les, lIdx) => (
                              <div key={lIdx} className="bg-white/[0.02] border border-white/5 rounded-lg p-2.5 space-y-2 text-xs">
                                <div className="flex gap-2">
                                  {/* Title */}
                                  <input
                                    type="text"
                                    value={les.title}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                        ...s,
                                        lessons: s.lessons.map((l, lIndex) => lIndex === lIdx ? { ...l, title: val } : l)
                                      } : s));
                                    }}
                                    className="bg-transparent text-xs font-semibold text-white border-b border-transparent hover:border-white/15 focus:border-[#D4AF37]/30 focus:outline-none pb-0.5 flex-1 min-w-0"
                                    placeholder="Lesson Title"
                                  />
                                  
                                  {/* Lesson Type selector */}
                                  <select
                                    value={les.type}
                                    onChange={e => {
                                      const val = e.target.value as any;
                                      setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                        ...s,
                                        lessons: s.lessons.map((l, lIndex) => lIndex === lIdx ? { ...l, type: val } : l)
                                      } : s));
                                    }}
                                    className="bg-[#171B24] border border-white/10 rounded-md text-[10px] text-white px-1.5 py-0.5 focus:outline-none focus:border-[#D4AF37]/30"
                                  >
                                    <option value="reading">Reading</option>
                                    <option value="video">Video Lecture</option>
                                    <option value="practice">Practice Set</option>
                                    <option value="quiz">Quiz</option>
                                    <option value="revision">Revision</option>
                                    <option value="flashcards">Flashcards</option>
                                    <option value="lab">Hands-on Lab</option>
                                    <option value="assignment">Assignment</option>
                                  </select>

                                  {/* Duration input */}
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={les.duration}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 10;
                                        setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                          ...s,
                                          lessons: s.lessons.map((l, lIndex) => lIndex === lIdx ? { ...l, duration: val } : l)
                                        } : s));
                                      }}
                                      className="w-10 bg-[#171B24] border border-white/10 rounded-md text-[10px] text-center text-white py-0.5 focus:outline-none focus:border-[#D4AF37]/30"
                                      min={1}
                                    />
                                    <span className="text-[10px] text-[#55555B]">min</span>
                                  </div>

                                  {sec.lessons.length > 1 && (
                                    <button
                                      onClick={() => setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                        ...s,
                                        lessons: s.lessons.filter((_, lIndex) => lIndex !== lIdx)
                                      } : s))}
                                      className="text-red-500 hover:text-red-400 p-1"
                                      title="Remove Lesson"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                <input
                                  type="text"
                                  value={les.description}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                      ...s,
                                      lessons: s.lessons.map((l, lIndex) => lIndex === lIdx ? { ...l, description: val } : l)
                                    } : s));
                                  }}
                                  className="w-full bg-transparent text-[10px] text-[#94949C] border-b border-transparent hover:border-white/10 focus:border-[#D4AF37]/20 focus:outline-none pb-0.5"
                                  placeholder="Brief description of covered concepts..."
                                />
                              </div>
                            ))}

                            <button
                              onClick={() => setManualSections(prev => prev.map((s, idx) => idx === sIdx ? {
                                ...s,
                                lessons: [
                                  ...s.lessons,
                                  { title: 'New Lesson Title', description: 'Brief overview of concepts', type: 'reading', duration: 30, difficulty: 'Medium' }
                                ]
                              } : s))}
                              className="text-[10px] font-bold text-[#D4AF37]/80 hover:text-[#D4AF37] flex items-center gap-1 pt-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add Lesson to Module
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => setManualSections(prev => [
                          ...prev,
                          {
                            name: `Module ${prev.length + 1}: Additional Topics`,
                            lessons: [
                              { title: 'Core Concepts Overview', description: 'Brief introduction to key concepts', type: 'reading', duration: 30, difficulty: 'Medium' }
                            ]
                          }
                        ])}
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Add Module Section
                      </button>

                      <button
                        onClick={() => {
                          // Estimate total hours based on manual lessons sum
                          const totalMinutes = manualSections.flatMap(s => s.lessons).reduce((sum, l) => sum + l.duration, 0);
                          const totalHours = Math.max(1, Math.round(totalMinutes / 60));
                          
                          handleSaveCourse(showSyllabusCreator, {
                            name: showSyllabusCreator,
                            description: `Custom manual course plan for ${showSyllabusCreator}`,
                            category: 'Technical Skills',
                            difficulty: 'Intermediate',
                            estimatedHours: totalHours,
                            sections: manualSections
                          });
                        }}
                        className="rounded-xl bg-[#D4AF37] hover:bg-[#b08e4d] text-black text-xs font-bold px-5 py-2.5 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Save Custom Syllabus
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
