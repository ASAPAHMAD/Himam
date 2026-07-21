import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Trophy, Flame, Zap, Share2, Copy, Plus, Send, Check, Search, Award, Swords, Clock, AlertCircle
} from 'lucide-react';
import { Profile } from '../models/types';
import { StudyPlanState } from '../services/Sync/types';
import { supabase } from '../lib/supabase';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  xp: number;
  streak: number;
  role: string;
  isCustom?: boolean;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  creatorId: string; // 'me' or friend ID
  targetFriendId: string; // 'me' or friend ID
  creatorName: string;
  targetFriendName: string;
  type: 'minutes' | 'lessons' | 'streak';
  targetValue: number;
  currentValue: number;
  rewardXp: number;
  status: 'pending' | 'active' | 'completed' | 'declined';
  daysLeft: number;
}

interface FriendsTabProps {
  profile: Profile;
  state: StudyPlanState;
  onUpdateState: (newState: StudyPlanState) => void;
  onAddXp?: (amount: number) => void; // Optional XP reward callback
}

export default function FriendsTab({ profile, state, onUpdateState }: FriendsTabProps) {
  // 1. Local Persistence Setup
  const [friends, setFriends] = useState<Friend[]>(() => {
    const saved = localStorage.getItem('himam_friends_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Friend[];
        // Filter out any lingering unverified mock seed friends
        return parsed.filter(f => f.id !== 'f-1' && f.id !== 'f-2' && f.id !== 'f-3' && f.id !== 'f-4');
      } catch (e) {
        console.error('Error parsing friends:', e);
      }
    }
    return [];
  });

  const [challenges, setChallenges] = useState<Challenge[]>(() => {
    const saved = localStorage.getItem('himam_challenges_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Challenge[];
        // Filter out any lingering challenges involving mock seed accounts
        return parsed.filter(c => 
          c.creatorId !== 'f-1' && c.creatorId !== 'f-2' && c.creatorId !== 'f-3' && c.creatorId !== 'f-4' &&
          c.targetFriendId !== 'f-1' && c.targetFriendId !== 'f-2' && c.targetFriendId !== 'f-3' && c.targetFriendId !== 'f-4'
        );
      } catch (e) {
        console.error('Error parsing challenges:', e);
      }
    }
    return [];
  });

  // Keep state.streak in sync with our own user challenge progress
  useEffect(() => {
    setChallenges(prev => 
      prev.map(ch => {
        if (ch.status === 'active' && ch.type === 'streak') {
          if (ch.creatorId === 'me' || ch.targetFriendId === 'me') {
            const nextVal = Math.min(ch.targetValue, state.streak);
            const nextStatus = nextVal >= ch.targetValue ? 'completed' : ch.status;
            return { ...ch, currentValue: nextVal, status: nextStatus };
          }
        }
        return ch;
      })
    );
  }, [state.streak]);

  // Sync user's study log minutes to minutes challenges
  useEffect(() => {
    const totalMinutesStudiedThisWeek = Object.entries(state.studyLog).reduce((acc, [dateStr, mins]) => {
      // Simple check to sum study logs within last 7 days
      const logDate = new Date(dateStr);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return acc + (mins as number);
      }
      return acc;
    }, 0);

    setChallenges(prev => 
      prev.map(ch => {
        if (ch.status === 'active' && ch.type === 'minutes' && (ch.creatorId === 'me' || ch.targetFriendId === 'me')) {
          const nextVal = Math.min(ch.targetValue, totalMinutesStudiedThisWeek);
          const nextStatus = nextVal >= ch.targetValue ? 'completed' : ch.status;
          return { ...ch, currentValue: nextVal, status: nextStatus };
        }
        return ch;
      })
    );
  }, [state.studyLog]);

  // Sync completed lessons to lessons challenges
  useEffect(() => {
    const completedCount = Object.keys(state.completedLessons).length;
    setChallenges(prev => 
      prev.map(ch => {
        if (ch.status === 'active' && ch.type === 'lessons' && (ch.creatorId === 'me' || ch.targetFriendId === 'me')) {
          const nextVal = Math.min(ch.targetValue, completedCount);
          const nextStatus = nextVal >= ch.targetValue ? 'completed' : ch.status;
          return { ...ch, currentValue: nextVal, status: nextStatus };
        }
        return ch;
      })
    );
  }, [state.completedLessons]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('himam_friends_v1', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('himam_challenges_v1', JSON.stringify(challenges));
  }, [challenges]);

  // 2. Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState<'leaderboard' | 'challenges' | 'invite'>('leaderboard');

  // 3. Invite State Management
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  
  // 4. Friend Addition Form
  const [searchUsername, setSearchUsername] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');

  // 5. Challenge Creation Form
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [challengeType, setChallengeType] = useState<'minutes' | 'lessons' | 'streak'>('minutes');
  const [challengeGoal, setChallengeGoal] = useState<number>(60);
  const [challengeXp, setChallengeXp] = useState<number>(250);
  const [formSuccess, setFormSuccess] = useState('');

  // 6. User XP Calculation
  const totalMinStudied = (Object.values(state.studyLog) as number[]).reduce((a: number, b: number) => a + b, 0);
  const myXp = Math.round(totalMinStudied * 10);

  // 7. Dynamic Leaderboard
  const leaderboardList: Friend[] = [
    { id: 'me', name: `${profile.name} (You)`, username: profile.name.toLowerCase().replace(/\s+/g, '_'), xp: myXp, streak: state.streak, role: 'My Pathway' },
    ...friends
  ].sort((a, b) => b.xp - a.xp);

  // 8. Copy Invite Link Function
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}?ref=HIMAM-4A8F-92`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 9. Send Email Invitation
  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteSuccessMsg(`Invitation email sent successfully to ${inviteEmail}!`);
    setInviteEmail('');
    setInviteName('');
    setTimeout(() => setInviteSuccessMsg(''), 5000);
  };

  // 10. Handle Add Friend
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFriendError('');
    setAddFriendSuccess('');

    const target = searchUsername.trim().toLowerCase();
    if (!target) return;

    // NOTE (Phase 1 fix): a real Supabase lookup used to run here, but the
    // `profiles` table's RLS policy (supabase/migrations/0001) only allows
    // a user to select their OWN row, so this could never actually find
    // another real person — the error/success copy below was always
    // misleading regardless of who searched. Turned into an honest
    // "not yet available" message rather than left half-working. Wiring
    // this up for real needs a public-safe, allowlisted search view
    // (name + id only — never salary/career fields) plus a matching RLS
    // policy; that's a deliberate follow-up, not a today fix.
    void target;
    setAddFriendError("Adding real study partners isn't connected yet — coming soon.");
  };

  // 11. Handle Accept/Decline Challenge
  const handleAcceptChallenge = (id: string) => {
    setChallenges(prev => 
      prev.map(ch => ch.id === id ? { ...ch, status: 'active' } : ch)
    );
  };

  const handleDeclineChallenge = (id: string) => {
    setChallenges(prev => 
      prev.map(ch => ch.id === id ? { ...ch, status: 'declined' } : ch)
    );
  };

  // 12. Create New Custom Challenge
  const handleCreateChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess('');

    if (!selectedFriendId) {
      alert('Please select a study partner to challenge.');
      return;
    }

    const friend = friends.find(f => f.id === selectedFriendId);
    if (!friend) return;

    let desc = '';
    if (challengeType === 'minutes') {
      desc = `Study for a total of ${challengeGoal} minutes this week.`;
    } else if (challengeType === 'lessons') {
      desc = `Complete ${challengeGoal} practice or revision lessons.`;
    } else {
      desc = `Maintain a study streak for ${challengeGoal} consecutive days.`;
    }

    const newChallenge: Challenge = {
      id: `c-${Date.now()}`,
      title: `${challengeType.charAt(0).toUpperCase() + challengeType.slice(1)} Duel`,
      description: desc,
      creatorId: 'me',
      targetFriendId: selectedFriendId,
      creatorName: 'You',
      targetFriendName: friend.name,
      type: challengeType,
      targetValue: challengeGoal,
      currentValue: challengeType === 'streak' ? state.streak : 0,
      rewardXp: challengeXp,
      status: 'active',
      daysLeft: 7
    };

    setChallenges(prev => [newChallenge, ...prev]);
    setFormSuccess(`Challenge issued to ${friend.name}! Track their progress under Active Challenges.`);
    setSelectedFriendId('');
    setTimeout(() => setFormSuccess(''), 4000);
  };

  // Dynamic values helper
  const getChallengeProgressPercent = (ch: Challenge) => {
    return Math.min(100, Math.round((ch.currentValue / ch.targetValue) * 100));
  };

  return (
    <div className="space-y-6" id="friends-challenges-container">
      {/* Upper Tab Navigation */}
      <div className="flex border-b border-white/5 bg-[#171B24]/40 rounded-xl p-1.5 gap-1.5">
        <button
          onClick={() => setActiveSubTab('leaderboard')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'leaderboard'
              ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white shadow-md'
              : 'text-[#94949C] hover:text-white hover:bg-white/5'
          }`}
          id="tab-leaderboard"
        >
          <Trophy className="w-4 h-4" />
          <span>Squad Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveSubTab('challenges')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'challenges'
              ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white shadow-md'
              : 'text-[#94949C] hover:text-white hover:bg-white/5'
          }`}
          id="tab-challenges"
        >
          <Swords className="w-4 h-4" />
          <span>Study Challenges</span>
          {challenges.filter(c => c.status === 'pending').length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
              {challenges.filter(c => c.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('invite')}
          className={`flex-1 py-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'invite'
              ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white shadow-md'
              : 'text-[#94949C] hover:text-white hover:bg-white/5'
          }`}
          id="tab-invite"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Partners</span>
        </button>
      </div>

      {/* SUB-VIEW 1: LEADERBOARD */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-white flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-[#D4AF37]" />
                  <span>Study Squad Rankings</span>
                </h2>
                <p className="text-xs text-[#94949C] mt-1">Study and gain XP to rank up against your peers and clinical study partners.</p>
              </div>

              {/* Add friend input */}
              <form onSubmit={handleAddFriend} className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#55555B]">@</span>
                  <input
                    type="text"
                    placeholder="Enter partner username..."
                    value={searchUsername}
                    onChange={e => setSearchUsername(e.target.value)}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-[#55555B] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#1C1C21] hover:bg-white/5 text-[#D4AF37] px-4 py-2 rounded-lg text-xs font-semibold border border-white/5 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>
            </div>

            {addFriendError && (
              <p className="mb-4 text-xs text-red-400 flex items-center gap-1.5 bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5" /> {addFriendError}
              </p>
            )}

            {addFriendSuccess && (
              <p className="mb-4 text-xs text-green-400 flex items-center gap-1.5 bg-green-500/5 border border-green-500/10 p-3 rounded-lg">
                <Check className="w-3.5 h-3.5" /> {addFriendSuccess}
              </p>
            )}

            {/* Main Leaderboard Table */}
            <div className="space-y-2.5">
              {leaderboardList.map((entry, idx) => {
                const isMe = entry.id === 'me';
                const medalColors = [
                  'from-amber-400 to-[#D4AF37]', // Gold
                  'from-slate-300 to-slate-400', // Silver
                  'from-amber-700 to-amber-800'  // Bronze
                ];
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isMe 
                        ? 'bg-[#171B24] border-[#D4AF37]/40 shadow-inner shadow-[#D4AF37]/5' 
                        : 'bg-[#171B24]/80 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Rank Indicator */}
                      <div className="w-8 flex justify-center flex-shrink-0">
                        {idx < 3 ? (
                          <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${medalColors[idx]} text-black text-xs font-black flex items-center justify-center shadow-md`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-[#55555B] font-mono text-xs font-bold">#{idx + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <img
                        src={entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&background=${isMe ? '171B24' : '171B24'}&color=D4AF37`}
                        alt={entry.name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                      />

                      {/* Name & Title */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold truncate ${isMe ? 'text-[#D4AF37]' : 'text-white'}`}>
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-[#94949C] mt-0.5 truncate">{entry.role}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-5 pr-1.5 flex-shrink-0">
                      {/* Streak */}
                      {entry.streak > 0 ? (
                        <div className="flex items-center gap-1 text-green-400" title="Active Study Streak">
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span className="font-mono text-xs font-bold">{entry.streak}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[#55555B]">
                          <Flame className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs font-bold">0</span>
                        </div>
                      )}

                      {/* XP Label */}
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-white block">{entry.xp.toLocaleString()}</span>
                        <span className="text-[8.5px] text-[#94949C] uppercase tracking-wider font-semibold">XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {friends.length === 0 && (
                <div className="mt-4 p-5 rounded-xl border border-dashed border-white/5 bg-white/[0.01] text-center space-y-2">
                  <div className="mx-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#94949C]">
                    <Users className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-white">No Verified Study Partners</h4>
                  <p className="text-[11px] text-[#55555B] max-w-sm mx-auto leading-relaxed">
                    We have removed unverified mock accounts to keep your rankings real. Only clinical peers with verified accounts will appear in your Study Squad rankings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CHALLENGES */}
      {activeSubTab === 'challenges' && (
        <div className="space-y-6">
          {/* Active / Pending Duel Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left: Active Challenges Feed */}
            <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                  <Swords className="w-5 h-5 text-[#D4AF37]" />
                  <span>Active Duels</span>
                </h3>
                <p className="text-xs text-[#94949C] mt-0.5">Your live cooperative and competitive milestones.</p>
              </div>

              <div className="space-y-3">
                {challenges.filter(c => c.status === 'active' || c.status === 'completed').length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#55555B] border border-dashed border-white/5 rounded-xl">
                    No active challenges. Start one by using the challenge form on the right!
                  </div>
                ) : (
                  challenges
                    .filter(c => c.status === 'active' || c.status === 'completed')
                    .map(ch => {
                      const pct = getChallengeProgressPercent(ch);
                      const isCompleted = ch.status === 'completed';
                      return (
                        <div 
                          key={ch.id} 
                          className={`p-4 rounded-xl border ${
                            isCompleted 
                              ? 'bg-[#0D1C13] border-green-500/20' 
                              : 'bg-[#0B0D12] border-white/5'
                          } space-y-3`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{ch.title}</span>
                                {isCompleted && (
                                  <span className="bg-green-500/10 text-green-400 text-[8.5px] font-bold px-1.5 py-0.5 rounded">
                                    COMPLETED
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#94949C] mt-1">{ch.description}</p>
                            </div>

                            <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-current" /> +{ch.rewardXp} XP
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-[#55555B]">
                              <span>Progress: <strong className="text-white">{ch.currentValue}</strong> / {ch.targetValue}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {ch.daysLeft}d left
                              </span>
                            </div>
                            <div className="w-full bg-[#171B24] h-1.5 rounded-full overflow-hidden border border-white/5">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37]'
                                }`} 
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>

                          <div className="text-[10px] text-[#55555B] flex justify-between items-center">
                            <span>Duel partner: <strong className="text-[#94949C]">{ch.creatorId === 'me' ? ch.targetFriendName : ch.creatorName}</strong></span>
                            {isCompleted && (
                              <span className="text-green-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Reward Claimed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Right: Create and Issue a Duel */}
            <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#D4AF37]" />
                  <span>Issue New Challenge</span>
                </h3>
                <p className="text-xs text-[#94949C] mt-0.5">Select a squad member and formulate a duel parameter.</p>
              </div>

              <form onSubmit={handleCreateChallenge} className="space-y-4">
                {/* Select Partner */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Select Study Partner</label>
                  <select
                    value={selectedFriendId}
                    onChange={e => setSelectedFriendId(e.target.value)}
                    required
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="">-- Choose Study Partner --</option>
                    {friends.map(f => (
                      <option key={f.id} value={f.id}>{f.name} (@{f.username})</option>
                    ))}
                  </select>
                </div>

                {/* Challenge Type */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Goal Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setChallengeType('minutes');
                        setChallengeGoal(120);
                        setChallengeXp(200);
                      }}
                      className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        challengeType === 'minutes'
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#94949C] hover:text-white'
                      }`}
                    >
                      Study Minutes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChallengeType('lessons');
                        setChallengeGoal(4);
                        setChallengeXp(300);
                      }}
                      className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        challengeType === 'lessons'
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#94949C] hover:text-white'
                      }`}
                    >
                      Lessons Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChallengeType('streak');
                        setChallengeGoal(5);
                        setChallengeXp(400);
                      }}
                      className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                        challengeType === 'streak'
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#0B0D12] border-white/5 text-[#94949C] hover:text-white'
                      }`}
                    >
                      Streak Days
                    </button>
                  </div>
                </div>

                {/* Challenge Target Amount */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Target Goal {challengeType === 'minutes' ? '(Minutes)' : challengeType === 'lessons' ? '(Lessons)' : '(Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={challengeGoal}
                    onChange={e => setChallengeGoal(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                {/* Challenge XP Prize */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">Prize Bounty (XP)</label>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    required
                    value={challengeXp}
                    onChange={e => setChallengeXp(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-95 text-white font-bold py-3 px-4 rounded-lg text-xs tracking-wider uppercase transition-all shadow-md"
                >
                  Issue Duel
                </button>

                {formSuccess && (
                  <p className="text-xs text-green-400 text-center bg-green-500/5 border border-green-500/10 p-3 rounded-lg animate-pulse">
                    {formSuccess}
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Pending Invitations list */}
          {challenges.filter(c => c.status === 'pending').length > 0 && (
            <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6 mt-4">
              <h3 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#D4AF37]" />
                <span>Pending Dual Invitations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {challenges.filter(c => c.status === 'pending').map(ch => (
                  <div key={ch.id} className="bg-[#0B0D12] border border-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold text-white">{ch.title}</span>
                        <p className="text-[11px] text-[#94949C] mt-1">{ch.description}</p>
                      </div>
                      <span className="bg-[#D4AF37]/10 text-[#D4AF37] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        +{ch.rewardXp} XP
                      </span>
                    </div>

                    <div className="text-[10px] text-[#55555B]">
                      From: <strong className="text-[#94949C]">{ch.creatorName}</strong>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptChallenge(ch.id)}
                        className="flex-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 font-bold py-1.5 rounded text-[10px] uppercase border border-green-500/10 transition-all"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineChallenge(ch.id)}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-[#94949C] font-bold py-1.5 rounded text-[10px] uppercase border border-white/5 transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: INVITE FRIENDS */}
      {/*
        Phase 1 fix: this used to show a fake "Invitation email sent!"
        message with no backend call, plus a static referral code
        (identical for every user, so it could never actually attribute
        an invite to anyone) claiming a "+500 XP" reward that was never
        granted. Replaced with an honest placeholder until a real
        invite/referral backend exists — see the audit for what that needs
        (per-user code generation + an actual email-send path, likely a
        Supabase edge function).
      */}
      {activeSubTab === 'invite' && (
        <div className="bg-[#171B24] border border-white/5 rounded-2xl p-10 text-center">
          <Share2 className="w-8 h-8 text-[#D4AF37] mx-auto mb-4" />
          <h2 className="font-serif text-xl font-bold text-white mb-2">Invites are coming soon</h2>
          <p className="text-xs text-[#94949C] max-w-md mx-auto leading-relaxed">
            Referral codes and email invitations aren't connected to a real backend yet, so we've
            turned this off rather than show you something that looks like it works but doesn't.
            Check back in a future update.
          </p>
        </div>
      )}
    </div>
  );
}
