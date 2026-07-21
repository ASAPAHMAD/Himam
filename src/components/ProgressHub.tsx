import React, { useState, useEffect } from 'react';
import Statistics from './Statistics';
import Calendar from './Calendar';
import WrongAnswerJournal from './WrongAnswerJournal';
import Achievements from './Achievements';
import AssignmentsTracker from './AssignmentsTracker';
import { BarChart3, CalendarDays, ShieldAlert, Trophy, FileText } from 'lucide-react';
import { StudyPlanState } from '../services/Sync/types';
import { Profile } from '../models/types';

interface ProgressHubProps {
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
  onCompleteLesson: (lessonId: string, duration: number) => void;
  initialSubTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ProgressHub({
  state,
  onUpdateState,
  profile,
  onUpdateProfile,
  onCompleteLesson,
  initialSubTab,
  setActiveTab
}: ProgressHubProps) {
  const getValidSubTab = (tab: string) => {
    if (['statistics', 'calendar', 'wrong-answers', 'achievements', 'assignments'].includes(tab)) {
      return tab;
    }
    return 'statistics';
  };

  const [activeSubTab, setActiveSubTab] = useState(getValidSubTab(initialSubTab));

  useEffect(() => {
    setActiveSubTab(getValidSubTab(initialSubTab));
  }, [initialSubTab]);

  const subTabs = [
    { id: 'statistics', label: 'Stats & Activity', icon: BarChart3 },
    { id: 'calendar', label: 'Study Calendar', icon: CalendarDays },
    { id: 'assignments', label: 'Homework & Exams', icon: FileText },
    { id: 'wrong-answers', label: 'Mistakes Journal', icon: ShieldAlert },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
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
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
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
        {activeSubTab === 'statistics' && (
          <Statistics state={state} profile={profile} />
        )}
        {activeSubTab === 'calendar' && (
          <Calendar
            state={state}
            onUpdateState={onUpdateState}
            onCompleteLesson={onCompleteLesson}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
          />
        )}
        {activeSubTab === 'assignments' && (
          <AssignmentsTracker
            state={state}
            onUpdateState={onUpdateState}
            profile={profile}
          />
        )}
        {activeSubTab === 'wrong-answers' && (
          <WrongAnswerJournal
            state={state}
            onUpdateState={onUpdateState}
          />
        )}
        {activeSubTab === 'achievements' && (
          <Achievements state={state} profile={profile} />
        )}
      </div>
    </div>
  );
}
