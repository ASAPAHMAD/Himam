import React, { useState, useEffect } from 'react';
import Preferences from './Preferences';
import AccountSettings from './AccountSettings';
import { ClipboardList, Settings } from 'lucide-react';
import { Profile } from '../models/types';

interface SettingsHubProps {
  profile: Profile;
  onUpdateProfile: (newProfile: Profile) => void;
  configured: boolean;
  signOut?: () => Promise<{ error: Error | null }>;
  initialSubTab: string;
  setActiveTab: (tab: string) => void;
  onResetAllData?: () => void;
}

export default function SettingsHub({
  profile,
  onUpdateProfile,
  configured,
  signOut,
  initialSubTab,
  setActiveTab,
  onResetAllData
}: SettingsHubProps) {
  const getValidSubTab = (tab: string) => {
    if (configured && tab === 'account') {
      return 'account';
    }
    return 'preferences';
  };

  const [activeSubTab, setActiveSubTab] = useState(getValidSubTab(initialSubTab));

  useEffect(() => {
    setActiveSubTab(getValidSubTab(initialSubTab));
  }, [initialSubTab, configured]);

  const handleSubTabClick = (tabId: string) => {
    setActiveSubTab(tabId);
    setActiveTab(tabId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#171B24]/80 backdrop-blur border border-white/5 p-1.5 rounded-xl flex overflow-x-auto gap-1 scrollbar-none select-none">
        <button
          onClick={() => handleSubTabClick('preferences')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
            activeSubTab === 'preferences'
              ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm'
              : 'text-[#94949C] hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <ClipboardList className={`w-3.5 h-3.5 ${activeSubTab === 'preferences' ? 'text-[#D4AF37]' : 'text-[#94949C]'}`} />
          <span>Preferences &amp; Styling</span>
        </button>

        {configured && (
          <button
            onClick={() => handleSubTabClick('account')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              activeSubTab === 'account'
                ? 'bg-gradient-to-r from-[#B8932D]/20 to-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm'
                : 'text-[#94949C] hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Settings className={`w-3.5 h-3.5 ${activeSubTab === 'account' ? 'text-[#D4AF37]' : 'text-[#94949C]'}`} />
            <span>Account Settings</span>
          </button>
        )}
      </div>

      <div className="transition-all duration-200">
        {activeSubTab === 'preferences' && (
          <Preferences
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onBack={() => setActiveTab('dashboard')}
            onGoToAccountSettings={() => handleSubTabClick('account')}
            configured={configured}
            signOut={signOut}
            onResetAllData={onResetAllData}
            onGoToLegal={setActiveTab}
          />
        )}
        {activeSubTab === 'account' && configured && (
          <AccountSettings
            profile={profile}
            onUpdateProfile={onUpdateProfile}
            onBack={() => setActiveTab('dashboard')}
            onGoToPreferences={() => handleSubTabClick('preferences')}
            signOut={signOut}
          />
        )}
      </div>
    </div>
  );
}
