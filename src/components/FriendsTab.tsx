import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Trophy, Flame, Zap, Share2, Copy, Plus, Send, Check, Search, Award, Swords, Clock, AlertCircle, Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, MessageSquare, Hand, Radio, Shield, GraduationCap
} from 'lucide-react';
import { Profile } from '../models/types';
import { StudyPlanState } from '../services/Sync/types';
import { ambientEngine, SoundType } from '../utils/ambientSound';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  xp: number;
  weeklyHours: number;
  streak: number;
  universityBadge: string;
  role: string;
}

interface FocusRoom {
  id: string;
  title: string;
  subject: string;
  hostName: string;
  university: string;
  membersCount: number;
  focusGoal: string;
  isPrivate?: boolean;
  activeTimerDuration: number; // minutes
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  targetFriendId: string;
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
  onAddXp?: (amount: number) => void;
}

const PEER_SEED: Friend[] = [
  { id: 'peer-1', name: 'Layla Al-Khatib', username: 'layla_ksu', xp: 4850, weeklyHours: 18.5, streak: 12, universityBadge: 'KSU • Computer Science', role: 'AI Engineering' },
  { id: 'peer-2', name: 'Omar Al-Mansoor', username: 'omar_kfupm', xp: 4200, weeklyHours: 15.2, streak: 9, universityBadge: 'KFUPM • Software Eng', role: 'Database Systems' },
  { id: 'peer-3', name: 'Sarah Al-Hassan', username: 'sarah_kau', xp: 3910, weeklyHours: 14.0, streak: 14, universityBadge: 'KAU • Data Science', role: 'Networking & Cloud' },
  { id: 'peer-4', name: 'Tariq Al-Otaibi', username: 'tariq_psu', xp: 3450, weeklyHours: 12.8, streak: 7, universityBadge: 'PSU • Cybersecurity', role: 'Security Architect' },
  { id: 'peer-5', name: 'Noura Al-Dosari', username: 'noura_pnu', xp: 3100, weeklyHours: 10.5, streak: 5, universityBadge: 'PNU • Information Systems', role: 'Full-Stack Dev' },
];

const PRESET_ROOMS: FocusRoom[] = [
  { id: 'room-1', title: 'Networking & Security Exam Sprint', subject: 'Networking', hostName: 'Layla Al-Khatib', university: 'KSU', membersCount: 3, focusGoal: 'Subnetting & OSI Layer 4', activeTimerDuration: 25 },
  { id: 'room-2', title: 'Database Systems SQL Deep Dive', subject: 'Databases', hostName: 'Omar Al-Mansoor', university: 'KFUPM', membersCount: 4, focusGoal: 'Complex Joins & B-Tree Indexes', activeTimerDuration: 50 },
  { id: 'room-3', title: 'AI Capstone & Machine Learning Lab', subject: 'AI Engineering', hostName: 'Sarah Al-Hassan', university: 'KAU', membersCount: 2, focusGoal: 'Transformer Attention Models', activeTimerDuration: 25 },
  { id: 'room-4', title: 'Late Night CS Study Lounge', subject: 'Computer Science', hostName: 'Tariq Al-Otaibi', university: 'PSU', membersCount: 5, focusGoal: 'LeetCode & Algorithm Prep', activeTimerDuration: 25 }
];

export default function FriendsTab({ profile, state, onUpdateState }: FriendsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'leaderboard' | 'challenges' | 'invite'>('rooms');
  
  // Leaderboard Filter
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'weekly' | 'streak'>('all');

  // Friends & Peers
  const [friends, setFriends] = useState<Friend[]>(() => {
    const saved = localStorage.getItem('himam_friends_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return PEER_SEED;
  });

  // Focus Rooms State
  const [focusRooms, setFocusRooms] = useState<FocusRoom[]>(() => {
    const saved = localStorage.getItem('himam_focus_rooms');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return PRESET_ROOMS;
  });

  const [activeRoom, setActiveRoom] = useState<FocusRoom | null>(null);

  // Active Room Pomodoro State
  const [pomodoroMins, setPomodoroMins] = useState<number>(25);
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');

  // Ambient Sound Generator State
  const [soundType, setSoundType] = useState<SoundType>('off');
  const [soundVolume, setSoundVolume] = useState<number>(0.5);

  // High Five & Cheer Toasts
  const [cheerToast, setCheerToast] = useState<string>('');

  // Challenges
  const [challenges, setChallenges] = useState<Challenge[]>(() => {
    const saved = localStorage.getItem('himam_challenges_v1');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // New Room Creation Modal State
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomSubject, setNewRoomSubject] = useState('Computer Science');
  const [newRoomGoal, setNewRoomGoal] = useState('');

  // Form Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

  // Calculate my XP
  const totalMinStudied = (Object.values(state.studyLog) as number[]).reduce((a: number, b: number) => a + b, 0);
  const myXp = Math.round(totalMinStudied * 10);
  const myWeeklyHours = Number((totalMinStudied / 60).toFixed(1));

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('himam_friends_v2', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('himam_focus_rooms', JSON.stringify(focusRooms));
  }, [focusRooms]);

  // Pomodoro Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && pomodoroSeconds > 0) {
      interval = setInterval(() => {
        setPomodoroSeconds(prev => prev - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (timerMode === 'work') {
        setTimerMode('break');
        setPomodoroSeconds(5 * 60);
        setCheerToast('🎉 Focus session completed! Take a 5-minute break.');
      } else {
        setTimerMode('work');
        setPomodoroSeconds(pomodoroMins * 60);
        setCheerToast('⚡ Break over! Ready for the next focus sprint.');
      }
      setTimeout(() => setCheerToast(''), 5000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, pomodoroSeconds, timerMode, pomodoroMins]);

  // Ambient Sound Engine Control
  const handleSoundChange = (type: SoundType) => {
    setSoundType(type);
    if (type === 'off') {
      ambientEngine.stop();
    } else {
      ambientEngine.play(type, soundVolume);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    ambientEngine.setVolume(vol);
  };

  const handleJoinRoom = (room: FocusRoom) => {
    setActiveRoom(room);
    setPomodoroMins(room.activeTimerDuration);
    setPomodoroSeconds(room.activeTimerDuration * 60);
    setIsTimerRunning(false);
    setTimerMode('work');
  };

  const handleLeaveRoom = () => {
    setActiveRoom(null);
    setIsTimerRunning(false);
    ambientEngine.stop();
    setSoundType('off');
  };

  const handleSendCheer = (peerName: string) => {
    setCheerToast(`🙌 Sent a High Five & Cheer to ${peerName}!`);
    setTimeout(() => setCheerToast(''), 4000);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return;

    const newRoom: FocusRoom = {
      id: `room-${Date.now()}`,
      title: newRoomTitle.trim(),
      subject: newRoomSubject,
      hostName: profile.name || 'You',
      university: profile.university || 'Your University',
      membersCount: 1,
      focusGoal: newRoomGoal || 'General Study Session',
      activeTimerDuration: 25
    };

    setFocusRooms(prev => [newRoom, ...prev]);
    setShowCreateRoom(false);
    handleJoinRoom(newRoom);
    setNewRoomTitle('');
    setNewRoomGoal('');
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sorted Leaderboard
  const sortedLeaderboard = [
    { 
      id: 'me', 
      name: `${profile.name} (You)`, 
      username: profile.name.toLowerCase().replace(/\s+/g, '_'), 
      xp: myXp, 
      weeklyHours: myWeeklyHours, 
      streak: state.streak, 
      universityBadge: profile.university || 'University Peer', 
      role: profile.careerGoal || 'AI Engineer' 
    },
    ...friends
  ].sort((a, b) => {
    if (leaderboardFilter === 'weekly') return b.weeklyHours - a.weeklyHours;
    if (leaderboardFilter === 'streak') return b.streak - a.streak;
    return b.xp - a.xp;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {cheerToast && (
        <div className="fixed top-20 right-6 z-50 bg-[#10192D] border border-[#3B82F6] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 text-[#3B82F6]" />
          <span>{cheerToast}</span>
        </div>
      )}

      {/* Main SubTab Header */}
      <div className="flex border-b border-white/5 bg-[#171B24]/60 backdrop-blur rounded-2xl p-1.5 gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'rooms'
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Live Focus Rooms</span>
        </button>
        <button
          onClick={() => setActiveSubTab('leaderboard')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'leaderboard'
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Weekly XP Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveSubTab('challenges')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'challenges'
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>Study Duels & Challenges</span>
        </button>
        <button
          onClick={() => setActiveSubTab('invite')}
          className={`flex-1 py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'invite'
              ? 'bg-[#3B82F6] text-white shadow-md'
              : 'text-[#8A99AD] hover:text-white hover:bg-white/5'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Study Partners</span>
        </button>
      </div>

      {/* SUB-TAB 1: LIVE FOCUS ROOMS */}
      {activeSubTab === 'rooms' && (
        <div className="space-y-6">
          {/* Active Joined Focus Room Banner */}
          {activeRoom ? (
            <div className="bg-[#0B0E17] border border-[#1E3A8A] rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden animate-in fade-in">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Room Top Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#182032] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">LIVE FOCUS ROOM</span>
                    <span className="text-xs text-[#8A99AD]">• {activeRoom.membersCount} Active Partners</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">{activeRoom.title}</h2>
                  <p className="text-xs text-[#8A99AD]">Goal: {activeRoom.focusGoal}</p>
                </div>

                <button
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Leave Focus Room
                </button>
              </div>

              {/* Pomodoro Timer & Ambient Sound Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Live Pomodoro Counter */}
                <div className="bg-[#101726] border border-[#1E283D] rounded-2xl p-6 text-center space-y-4">
                  <div className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider">
                    {timerMode === 'work' ? '⚡ FOCUS SPRINT MODE' : '☕ REST BREAK MODE'}
                  </div>

                  <div className="font-mono text-5xl font-black text-white tracking-widest my-2">
                    {formatTimer(pomodoroSeconds)}
                  </div>

                  {/* Timer Controls */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                        isTimerRunning
                          ? 'bg-amber-500 hover:bg-amber-400 text-black'
                          : 'bg-[#3B82F6] hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{isTimerRunning ? 'Pause Timer' : 'Start Focus Timer'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsTimerRunning(false);
                        setPomodoroSeconds(pomodoroMins * 60);
                      }}
                      className="p-2.5 bg-[#182032] hover:bg-[#232F48] text-[#8A99AD] hover:text-white rounded-xl border border-[#232F48] transition-all cursor-pointer"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Built-in Web Audio Ambient Sound Synthesizer */}
                <div className="bg-[#101726] border border-[#1E283D] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Volume2 className="w-4 h-4 text-[#3B82F6]" />
                      <span>Background Ambient Generator</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      Web Audio Synthesizer
                    </span>
                  </div>

                  {/* Sound Type Options */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'rain', label: '🌧️ Gentle Rain' },
                      { type: 'brownian', label: '🎧 Deep Noise' },
                      { type: 'lofi', label: '🎹 Lo-Fi Beats' },
                      { type: 'ocean', label: '🌊 Ocean Waves' },
                    ].map(snd => (
                      <button
                        key={snd.type}
                        onClick={() => handleSoundChange(snd.type as SoundType)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                          soundType === snd.type
                            ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-white font-bold'
                            : 'bg-[#182032] border-[#232F48] text-[#8A99AD] hover:text-white'
                        }`}
                      >
                        {snd.label}
                      </button>
                    ))}
                  </div>

                  {/* Master Volume Slider */}
                  {soundType !== 'off' && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs text-[#8A99AD]">Volume:</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={soundVolume}
                        onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                        className="flex-1 accent-[#3B82F6]"
                      />
                      <button
                        onClick={() => handleSoundChange('off')}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Mute
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Room Active Partners */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#8A99AD] uppercase tracking-wider">
                  Active Study Partners in Room ({activeRoom.membersCount})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {PEER_SEED.slice(0, activeRoom.membersCount).map(p => (
                    <div key={p.id} className="p-3.5 rounded-xl bg-[#121826] border border-[#232F48] flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=182032&color=3B82F6`}
                            className="w-8 h-8 rounded-full border border-white/10"
                            alt={p.name}
                          />
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#121826]"></span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                          <div className="text-[10px] text-[#8A99AD] truncate">{p.universityBadge}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendCheer(p.name)}
                        className="p-1.5 bg-[#182032] hover:bg-[#3B82F6]/20 text-[#3B82F6] rounded-lg border border-[#232F48] transition-all cursor-pointer"
                        title="Send High Five"
                      >
                        <Hand className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-[#3B82F6]" />
                    <span>Live Focus & Pomodoro Rooms</span>
                  </h2>
                  <p className="text-xs text-[#8A99AD] mt-1">
                    Study alongside university peers in real-time focus rooms with background ambient sounds.
                  </p>
                </div>

                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Host New Focus Room</span>
                </button>
              </div>

              {/* Rooms List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {focusRooms.map(room => (
                  <div
                    key={room.id}
                    className="p-5 rounded-2xl bg-[#0B0E17] border border-[#181F32] hover:border-[#3B82F6]/40 transition-all space-y-4 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-[#3B82F6] bg-[#10192D] px-2 py-0.5 rounded-md border border-[#1E3A8A]">
                          {room.subject}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-2">{room.title}</h3>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                        👥 {room.membersCount} Active
                      </span>
                    </div>

                    <div className="text-xs text-[#8A99AD] space-y-1">
                      <div>Host: <strong className="text-white">{room.hostName}</strong> ({room.university})</div>
                      <div>Focus Goal: <span className="text-white">{room.focusGoal}</span></div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room)}
                      className="w-full py-2.5 bg-[#182032] hover:bg-[#3B82F6] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Join Focus Room</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Host New Room Modal */}
          {showCreateRoom && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md grid place-items-center p-4">
              <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 max-w-md w-full space-y-4">
                <h3 className="text-lg font-bold text-white">Host a Live Focus Room</h3>

                <form onSubmit={handleCreateRoom} className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8A99AD] block mb-1">Room Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Networking Exam Sprint"
                      value={newRoomTitle}
                      onChange={e => setNewRoomTitle(e.target.value)}
                      className="w-full bg-[#121826] border border-[#232F48] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#8A99AD] block mb-1">Subject</label>
                    <select
                      value={newRoomSubject}
                      onChange={e => setNewRoomSubject(e.target.value)}
                      className="w-full bg-[#121826] border border-[#232F48] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                    >
                      <option value="Networking">Networking</option>
                      <option value="Databases">Database Systems</option>
                      <option value="AI Engineering">AI Engineering</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                      <option value="Computer Science">Computer Science</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-[#8A99AD] block mb-1">Focus Goal</label>
                    <input
                      type="text"
                      placeholder="e.g., Subnetting or SQL Join optimization"
                      value={newRoomGoal}
                      onChange={e => setNewRoomGoal(e.target.value)}
                      className="w-full bg-[#121826] border border-[#232F48] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateRoom(false)}
                      className="flex-1 py-2 bg-[#182032] text-white text-xs font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold rounded-xl"
                    >
                      Create Room
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: WEEKLY XP LEADERBOARD */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>University Peers XP Leaderboard</span>
                </h2>
                <p className="text-xs text-[#8A99AD] mt-1">
                  Compete with peers across top universities on study hours, consistency streaks, and total XP.
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex bg-[#121826] border border-[#232F48] rounded-xl p-1 gap-1">
                <button
                  onClick={() => setLeaderboardFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    leaderboardFilter === 'all' ? 'bg-[#3B82F6] text-white' : 'text-[#8A99AD]'
                  }`}
                >
                  All-Time XP
                </button>
                <button
                  onClick={() => setLeaderboardFilter('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    leaderboardFilter === 'weekly' ? 'bg-[#3B82F6] text-white' : 'text-[#8A99AD]'
                  }`}
                >
                  Weekly Hours
                </button>
                <button
                  onClick={() => setLeaderboardFilter('streak')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    leaderboardFilter === 'streak' ? 'bg-[#3B82F6] text-white' : 'text-[#8A99AD]'
                  }`}
                >
                  Streak Champions
                </button>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="space-y-2.5">
              {sortedLeaderboard.map((entry, idx) => {
                const isMe = entry.id === 'me';
                const medalColors = [
                  'from-amber-400 to-[#D4AF37]',
                  'from-slate-300 to-slate-400',
                  'from-amber-700 to-amber-800'
                ];

                return (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                      isMe
                        ? 'bg-[#101726] border-[#3B82F6] shadow-lg'
                        : 'bg-[#121826] border-[#182032] hover:border-[#232F48]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Rank Badge */}
                      <div className="w-7 text-center flex-shrink-0">
                        {idx < 3 ? (
                          <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${medalColors[idx]} text-black text-xs font-black flex items-center justify-center mx-auto shadow-md`}>
                            {idx + 1}
                          </span>
                        ) : (
                          <span className="text-[#64748B] font-mono text-xs font-bold">#{idx + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&background=182032&color=${isMe ? '3B82F6' : 'CBD5E1'}`}
                        alt={entry.name}
                        className="w-10 h-10 rounded-full border border-white/10 flex-shrink-0"
                      />

                      {/* Name & University Tag */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold truncate ${isMe ? 'text-[#3B82F6]' : 'text-white'}`}>
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="bg-[#3B82F6]/20 text-[#3B82F6] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#3B82F6]/30">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#8A99AD] flex items-center gap-1 mt-0.5">
                          <GraduationCap className="w-3 h-3 text-[#3B82F6]" />
                          <span className="truncate">{entry.universityBadge}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Interactive Cheer */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xs font-bold text-white">{entry.xp.toLocaleString()} XP</div>
                        <div className="text-[10px] text-[#8A99AD]">{entry.weeklyHours}h this week • 🔥 {entry.streak}d</div>
                      </div>

                      {!isMe && (
                        <button
                          onClick={() => handleSendCheer(entry.name)}
                          className="px-3 py-1.5 bg-[#182032] hover:bg-[#3B82F6]/20 text-[#3B82F6] text-xs font-bold rounded-lg border border-[#232F48] transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Hand className="w-3.5 h-3.5" />
                          <span>Cheer</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STUDY DUELS & CHALLENGES */}
      {activeSubTab === 'challenges' && (
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-amber-400" />
            <span>Active Study Duels</span>
          </h2>
          <p className="text-xs text-[#8A99AD]">Challenge your university partners to weekly study volume and streak battles.</p>

          <div className="p-8 border border-dashed border-[#182032] rounded-xl text-center space-y-3">
            <Award className="w-8 h-8 text-[#3B82F6] mx-auto" />
            <h3 className="text-sm font-bold text-white">No active duels pending</h3>
            <p className="text-xs text-[#8A99AD]">Select a study partner from the Leaderboard to issue a 7-day study challenge!</p>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: INVITE */}
      {activeSubTab === 'invite' && (
        <div className="bg-[#0B0E17] border border-[#181F32] rounded-2xl p-6 space-y-4 max-w-lg mx-auto text-center">
          <UserPlus className="w-10 h-10 text-[#3B82F6] mx-auto" />
          <h2 className="text-xl font-bold text-white">Invite Study Partners</h2>
          <p className="text-xs text-[#8A99AD]">Share your unique referral link to study together and earn bonus XP.</p>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}?ref=HIMAM-STUDY-2026`}
              className="flex-1 bg-[#121826] border border-[#232F48] rounded-xl px-3 py-2 text-xs text-white"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=HIMAM-STUDY-2026`);
                setCheerToast('Link copied to clipboard!');
                setTimeout(() => setCheerToast(''), 3000);
              }}
              className="px-4 py-2 bg-[#3B82F6] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
