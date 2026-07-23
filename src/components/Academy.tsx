import React, { useState, useEffect } from 'react';
import MyLearning from './MyLearning';
import LearningLibrary from './LearningLibrary';
import StudyCenter from './StudyCenter';
import Roadmap from './Roadmap';
import ExamPrepSimulator from './ExamPrepSimulator';
import { ClipboardList, BookOpen, GraduationCap, Compass, Brain } from 'lucide-react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';

interface AcademyProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
  onCompleteLesson: (lessonId: string, duration: number) => void;
  highlightedLessonId: string | null;
  onClearHighlightedLessonId: () => void;
  initialSubTab: string;
  setActiveTab: (tab: string) => void;
  onResumeLesson: (lessonId: string) => void;
  syncEngine?: any;
}

export default function Academy({
  state,
  onUpdateState,
  profile,
  onUpdateProfile,
  onCompleteLesson,
  highlightedLessonId,
  onClearHighlightedLessonId,
  initialSubTab,
  setActiveTab,
  onResumeLesson,
  syncEngine
}: AcademyProps) {
  const getValidSubTab = (tab: string) => {
    if (['my-learning', 'learning-library', 'study-center', 'roadmap', 'exam-prep'].includes(tab)) {
      return tab;
    }
    return 'my-learning';
  };

  const [activeSubTab, setActiveSubTab] = useState(getValidSubTab(initialSubTab));

  useEffect(() => {
    setActiveSubTab(getValidSubTab(initialSubTab));
  }, [initialSubTab]);

  const subTabs = [
    { id: 'my-learning', label: 'My Learning Plan', icon: ClipboardList },
    { id: 'learning-library', label: 'Learning Library', icon: BookOpen },
    { id: 'exam-prep', label: 'AI Exam Prep & Flashcards', icon: Brain },
    { id: 'study-center', label: 'Study Room', icon: GraduationCap },
    { id: 'roadmap', label: 'Career Roadmap', icon: Compass },
  ];

  const handleSubTabClick = (tabId: string) => {
    setActiveSubTab(tabId);
    setActiveTab(tabId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#171B24]/80 backdrop-blur border border-white/5 p-1.5 rounded-xl flex overflow-x-auto gap-1 scrollbar-none select-none">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSubTabClick(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg transition-all whitespace-nowrap active:scale-[0.98] ${
                isActive
                  ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm'
                  : 'text-[#94949C] hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#D4AF37]' : 'text-[#94949C]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="transition-all duration-200">
        {activeSubTab === 'my-learning' && (
          <MyLearning
            state={state}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onUpdateState={onUpdateState}
            setActiveTab={setActiveTab}
            onResumeLesson={onResumeLesson}
            syncEngine={syncEngine}
          />
        )}
        {activeSubTab === 'learning-library' && (
          <LearningLibrary
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            setActiveTab={setActiveTab}
          />
        )}
        {activeSubTab === 'exam-prep' && (
          <ExamPrepSimulator />
        )}
        {activeSubTab === 'study-center' && (
          <StudyCenter
            state={state}
            onUpdateState={onUpdateState}
            onCompleteLesson={onCompleteLesson}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            highlightedLessonId={highlightedLessonId}
            onClearHighlightedLessonId={onClearHighlightedLessonId}
          />
        )}
        {activeSubTab === 'roadmap' && (
          <Roadmap
            state={state}
            onUpdateState={onUpdateState}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
}
