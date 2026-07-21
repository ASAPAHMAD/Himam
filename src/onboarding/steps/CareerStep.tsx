import React from 'react';
import { Profile } from '../../models/types';
import { 
  GraduationCap, 
  Briefcase, 
  Calendar, 
  Award, 
  BookOpen, 
  Clock, 
  Plus, 
  X, 
  Edit2, 
  Check, 
  Sparkles, 
  Database, 
  RefreshCw, 
  Info, 
  Trash2, 
  ArrowRight, 
  Lock, 
  Cloud 
} from 'lucide-react';

interface StepProps {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

export default function CareerStep({ profile, onChange }: StepProps) {
  const isStudent = !!profile.isStudent;

  // Redesigned Courses Input states
  const [activeTab, setActiveTab] = React.useState<'manual' | 'suggested' | 'lms'>('manual');
  const [inputValue, setInputValue] = React.useState('');
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editingValue, setEditingValue] = React.useState('');

  // Suggested curriculum state
  const [selectedSuggestions, setSelectedSuggestions] = React.useState<string[]>([]);
  
  // LMS Integration state
  const [selectedLms, setSelectedLms] = React.useState<string | null>(null);
  const [lmsStatus, setLmsStatus] = React.useState<'idle' | 'connecting' | 'success'>('idle');
  const [lmsProgress, setLmsProgress] = React.useState('');
  const [lmsCourses, setLmsCourses] = React.useState<string[]>([]);
  const [selectedLmsCourses, setSelectedLmsCourses] = React.useState<string[]>([]);

  // Dynamic curriculum retrieval list based on selected major/university
  const getSuggestedCoursesForMajor = React.useCallback((majorName: string): string[] => {
    const norm = (majorName || '').toLowerCase().trim();
    if (norm.includes('computer') || norm.includes('software') || norm.includes('cs') || norm.includes('it') || norm.includes('developer') || norm.includes('prog')) {
      return ['Operating Systems (CS 311)', 'Database Systems (CS 322)', 'Software Engineering (CS 330)', 'Linear Algebra (MATH 244)', 'Technical Writing (ENG 201)'];
    }
    if (norm.includes('medic') || norm.includes('doctor') || norm.includes('anatom') || norm.includes('bio') || norm.includes('health') || norm.includes('nurs')) {
      return ['Human Anatomy I', 'General Biochemistry', 'Medical Pathology', 'Clinical Microbiology', 'Introduction to Physiology'];
    }
    if (norm.includes('electr') || norm.includes('mechan') || norm.includes('civil') || norm.includes('engine') || norm.includes('chem')) {
      return ['Calculus III (MATH 201)', 'Differential Equations (MATH 204)', 'Physics for Engineers II', 'Engineering Statics', 'Materials Science'];
    }
    if (norm.includes('business') || norm.includes('financ') || norm.includes('market') || norm.includes('econ') || norm.includes('account')) {
      return ['Principles of Microeconomics', 'Financial Accounting', 'Business Statistics', 'Marketing Principles', 'Organizational Behavior'];
    }
    return ['Required Core Subject I', 'Advanced Major Elective', 'Interdisciplinary Core', 'General University Requirement', 'Specialized Research Lab'];
  }, []);

  // Update selection array on load or major change
  React.useEffect(() => {
    if (profile.major) {
      setSelectedSuggestions(getSuggestedCoursesForMajor(profile.major));
    }
  }, [profile.major, getSuggestedCoursesForMajor]);

  const handleLmsConnect = (provider: string) => {
    setSelectedLms(provider);
    setLmsStatus('connecting');
    setLmsProgress('Establishing secure handshake protocol...');
    
    // Generate LMS specific simulated courses
    const baseCourses = getSuggestedCoursesForMajor(profile.major || '');
    const lmsSpecific = baseCourses.map(c => `${c} [LMS Sync]`);
    setLmsCourses(lmsSpecific);
    setSelectedLmsCourses(lmsSpecific); // all checked by default

    let step = 0;
    const stepsText = [
      'Establishing secure handshake protocol...',
      'Verifying student OAuth session keys...',
      `Pulling active semester schedule for "${profile.currentSemester || 'Fall/Spring 2026'}"...`,
      'Ready to import!'
    ];

    const interval = setInterval(() => {
      step++;
      if (step < stepsText.length - 1) {
        setLmsProgress(stepsText[step]);
      } else {
        clearInterval(interval);
        setLmsStatus('success');
        setLmsProgress('');
      }
    }, 700);
  };

  const courseList = React.useMemo(() => {
    return (profile.currentCourses || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
  }, [profile.currentCourses]);

  const addCourse = (courseName: string) => {
    const trimmed = courseName.trim();
    if (!trimmed) return;
    if (courseList.includes(trimmed)) return;
    const newList = [...courseList, trimmed];
    onChange({ currentCourses: newList.join(', ') });
  };

  const removeCourse = (indexToRemove: number) => {
    const newList = courseList.filter((_, i) => i !== indexToRemove);
    onChange({ currentCourses: newList.join(', ') });
  };

  const updateCourse = (indexToUpdate: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      removeCourse(indexToUpdate);
      return;
    }
    const newList = [...courseList];
    newList[indexToUpdate] = trimmed;
    onChange({ currentCourses: newList.join(', ') });
  };

  const applySuggestedCurriculum = () => {
    const existing = [...courseList];
    selectedSuggestions.forEach(course => {
      if (!existing.includes(course)) {
        existing.push(course);
      }
    });
    onChange({ currentCourses: existing.join(', ') });
    setActiveTab('manual');
  };

  const applyLmsCourses = () => {
    const existing = [...courseList];
    selectedLmsCourses.forEach(course => {
      const cleanName = course.replace(' [LMS Sync]', '');
      if (!existing.includes(cleanName)) {
        existing.push(cleanName);
      }
    });
    onChange({ currentCourses: existing.join(', ') });
    setSelectedLms(null);
    setLmsStatus('idle');
    setActiveTab('manual');
  };

  const handleToggle = (studentStatus: boolean) => {
    if (studentStatus) {
      onChange({
        isStudent: true,
        currentJob: 'Student',
        currentSalary: '',
        targetSalary: '',
      });
    } else {
      onChange({
        isStudent: false,
        currentJob: profile.currentJob === 'Student' ? '' : profile.currentJob,
        university: '',
        major: '',
        academicYear: '',
        currentSemester: '',
        currentGpa: '',
        currentCourses: '',
        expectedGraduation: '',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Toggle Selector */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-[#94949C] uppercase tracking-wider">I am currently a:</span>
        <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-[#0B0D12] border border-white/10">
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isStudent
                ? 'bg-[#171B24] border border-[#D4AF37]/30 text-[#D4AF37]'
                : 'text-[#94949C] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            University Student
          </button>
          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isStudent
                ? 'bg-[#171B24] border border-[#D4AF37]/30 text-[#D4AF37]'
                : 'text-[#94949C] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Working Professional
          </button>
        </div>
      </div>

      {isStudent ? (
        <div className="space-y-5 animate-fadeIn">
          {/* Main Institution Information */}
          <div className="bg-[#171B24]/40 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-white">University & Major</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-white">
                University / College <span className="text-[#D4AF37]">*</span>
                <input
                  value={profile.university || ''}
                  onChange={e => onChange({ university: e.target.value })}
                  placeholder="e.g. King Saud University"
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
                />
              </label>
              <label className="block text-xs font-semibold text-white">
                Major / Field of Study <span className="text-[#D4AF37]">*</span>
                <input
                  value={profile.major || ''}
                  onChange={e => onChange({ major: e.target.value })}
                  placeholder="e.g. Computer Science, Medicine, Mechanical Eng."
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
                />
              </label>
            </div>
          </div>

          {/* Academic Timeline & Progress */}
          <div className="bg-[#171B24]/40 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <Calendar className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-white">Academic Timeline</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-white">
                Academic Year <span className="text-[#D4AF37]">*</span>
                <select
                  value={profile.academicYear || ''}
                  onChange={e => onChange({ academicYear: e.target.value })}
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm text-white focus:border-[#D4AF37]/50"
                >
                  <option value="" disabled>Select academic year</option>
                  <option value="First Year (Freshman)">First Year (Freshman)</option>
                  <option value="Second Year (Sophomore)">Second Year (Sophomore)</option>
                  <option value="Third Year (Junior)">Third Year (Junior)</option>
                  <option value="Fourth Year (Senior)">Fourth Year (Senior)</option>
                  <option value="Fifth Year+">Fifth Year / Internship</option>
                  <option value="Postgraduate (Master/PhD)">Postgraduate (Master/PhD)</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-white">
                Current Semester <span className="text-[#D4AF37]">*</span>
                <select
                  value={profile.currentSemester || ''}
                  onChange={e => onChange({ currentSemester: e.target.value })}
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm text-white focus:border-[#D4AF37]/50"
                >
                  <option value="" disabled>Select current semester</option>
                  <option value="Fall Semester">Fall Semester</option>
                  <option value="Spring Semester">Spring Semester</option>
                  <option value="Summer Term">Summer Term</option>
                  <option value="Summer Training">Summer Training</option>
                  <option value="Internship / Co-op">Internship / Co-op</option>
                  <option value="Final Semester">Final Semester</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="block text-xs font-semibold text-white">
                Expected Graduation <span className="text-[#D4AF37]">*</span> <span className="text-white/40 font-normal">(e.g. May 2028)</span>
                <input
                  value={profile.expectedGraduation || ''}
                  onChange={e => onChange({ expectedGraduation: e.target.value })}
                  placeholder="e.g. May 2028"
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
                />
              </label>

              <label className="block text-xs font-semibold text-white">
                Current GPA <span className="text-[#D4AF37]">*</span> <span className="text-white/40 font-normal">(e.g. 3.72/5 or 3.6/4)</span>
                <input
                  value={profile.currentGpa || ''}
                  onChange={e => onChange({ currentGpa: e.target.value })}
                  placeholder="e.g. 3.72 / 5"
                  className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
                />
              </label>
            </div>
          </div>

          {/* Current Courses & Goals */}
          <div className="bg-[#171B24]/40 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <BookOpen className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-white">Current Coursework & Career Goal</span>
            </div>
            
            <label className="block text-xs font-semibold text-white">
              Target Career Specialty / Role <span className="text-[#D4AF37]">*</span>
              <input
                value={profile.targetJob}
                onChange={e => onChange({ targetJob: e.target.value })}
                placeholder="e.g. Cardiologist, AI Engineer, Structural Architect"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
              />
            </label>

            {/* Redesigned Current Semester Courses section */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-semibold text-white">
                    Current Semester Courses <span className="text-[#D4AF37]/80 font-normal">(Optional but Recommended)</span>
                  </span>
                </div>
                {/* Future-Ready Architecture Modes Tabs */}
                <div className="flex items-center gap-1 bg-[#0B0D12] border border-white/5 p-0.5 rounded-lg self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('manual')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      activeTab === 'manual'
                        ? 'bg-[#171B24] text-[#D4AF37] border border-[#D4AF37]/20'
                        : 'text-[#94949C] hover:text-white'
                    }`}
                  >
                    Manual Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('suggested')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      activeTab === 'suggested'
                        ? 'bg-[#171B24] text-[#D4AF37] border border-[#D4AF37]/20'
                        : 'text-[#94949C] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" />
                    Suggested Curriculum
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('lms')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      activeTab === 'lms'
                        ? 'bg-[#171B24] text-[#D4AF37] border border-[#D4AF37]/20'
                        : 'text-[#94949C] hover:text-white'
                    }`}
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-[#D4AF37]" />
                    LMS Auto-Import
                  </button>
                </div>
              </div>

              <p className="text-[10.5px] text-[#94949C] leading-normal bg-white/[0.02] border border-white/5 p-2.5 rounded-lg">
                Add the courses you’re taking this semester. This helps the AI personalize your study plans, detect scheduling conflicts, provide course-specific tutoring, and improve recommendations.
              </p>

              {/* Tab Content */}
              {activeTab === 'manual' && (
                <div className="space-y-3 animate-fadeIn">
                  {/* Tag / Chip container */}
                  <div className="min-h-[44px] p-2 rounded-lg bg-[#0B0D12]/40 border border-white/10 flex flex-wrap gap-2 items-center">
                    {courseList.length === 0 ? (
                      <span className="text-xs text-[#55555B] px-1 italic select-none">
                        No courses added yet. Type below to add or check suggestions.
                      </span>
                    ) : (
                      courseList.map((course, idx) => {
                        const isEditing = editingIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              isEditing 
                                ? 'bg-[#171B24] border-[#D4AF37] text-white' 
                                : 'bg-[#171B24]/60 border-[#D4AF37]/15 text-[#D4AF37] hover:bg-[#171B24] hover:border-[#D4AF37]/30'
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      updateCourse(idx, editingValue);
                                      setEditingIndex(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingIndex(null);
                                    }
                                  }}
                                  className="bg-transparent text-xs text-white focus:outline-none w-24 font-medium"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateCourse(idx, editingValue);
                                    setEditingIndex(null);
                                  }}
                                  className="text-emerald-500 hover:text-emerald-400 p-0.5"
                                  title="Save Changes"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(null)}
                                  className="text-rose-500 hover:text-rose-400 p-0.5"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span 
                                  className="cursor-pointer select-none"
                                  onDoubleClick={() => {
                                    setEditingIndex(idx);
                                    setEditingValue(course);
                                  }}
                                  title="Double click to edit course name"
                                >
                                  {course}
                                </span>
                                <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/10">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingIndex(idx);
                                      setEditingValue(course);
                                    }}
                                    className="text-white/40 hover:text-white transition-colors p-0.5"
                                    title="Edit course name"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeCourse(idx)}
                                    className="text-white/40 hover:text-rose-400 transition-colors p-0.5"
                                    title="Remove course"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Input group */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCourse(inputValue);
                          setInputValue('');
                        }
                      }}
                      placeholder={
                        profile.major
                          ? `e.g. ${getSuggestedCoursesForMajor(profile.major)[0] || 'Calculus'}, ${getSuggestedCoursesForMajor(profile.major)[1] || 'Physics'}`
                          : "e.g. Operating Systems, Calculus II, Organic Chemistry"
                      }
                      className="flex-1 rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-2.5 text-sm focus:border-[#D4AF37]/50 outline-none placeholder:text-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addCourse(inputValue);
                        setInputValue('');
                      }}
                      className="px-4 py-2.5 rounded-lg bg-[#171B24] border border-[#D4AF37]/30 text-[#D4AF37] font-bold text-xs hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/50 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'suggested' && (
                <div className="space-y-3 animate-fadeIn bg-[#0B0D12]/30 border border-white/5 p-3.5 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">Suggested Curriculum Provider</h4>
                      <p className="text-[10.5px] text-[#94949C] mt-0.5">
                        Detects and retrieves standard curriculum schedules mapped to your university, major, and level.
                      </p>
                    </div>
                  </div>

                  {profile.university && profile.major ? (
                    <div className="space-y-3 pt-1">
                      <div className="text-[10px] text-[#D4AF37] font-mono bg-[#D4AF37]/5 px-2.5 py-1.5 rounded border border-[#D4AF37]/15 flex items-center justify-between">
                        <span>PROVIDER ACTIVE: {profile.university} &bull; {profile.major}</span>
                        <span className="text-white/40">{profile.currentSemester}</span>
                      </div>

                      <div className="space-y-2">
                        {getSuggestedCoursesForMajor(profile.major).map((course, idx) => {
                          const isChecked = selectedSuggestions.includes(course);
                          return (
                            <label
                              key={idx}
                              className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                                isChecked
                                  ? 'bg-[#171B24]/30 border-[#D4AF37]/25 text-[#D4AF37]'
                                  : 'bg-white/[0.01] border-white/5 text-[#94949C] hover:border-white/10 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSuggestions(prev => prev.filter(c => c !== course));
                                    } else {
                                      setSelectedSuggestions(prev => [...prev, course]);
                                    }
                                  }}
                                  className="rounded border-white/10 text-[#D4AF37] focus:ring-0 focus:ring-offset-0 bg-[#0B0D12] w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-medium">{course}</span>
                              </div>
                              <span className="text-[9px] font-mono tracking-wider opacity-60 uppercase bg-white/5 px-1.5 py-0.5 rounded">Core Course</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => setActiveTab('manual')}
                          className="px-3 py-2 rounded text-xs text-[#94949C] hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={applySuggestedCurriculum}
                          disabled={selectedSuggestions.length === 0}
                          className="px-4 py-2 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:bg-[#D4AF37]/95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Apply {selectedSuggestions.length} Selected Courses
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-[#0B0D12]/50 rounded-lg border border-white/5">
                      <GraduationCap className="w-7 h-7 text-white/20 mx-auto mb-1.5" />
                      <p className="text-xs text-white/50 px-4">
                        Please select your University and Major in the fields above first to retrieve localized curriculum suggestions.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'lms' && (
                <div className="space-y-3 animate-fadeIn bg-[#0B0D12]/30 border border-white/5 p-3.5 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Database className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">LMS & Portal Integration Bridge</h4>
                      <p className="text-[10.5px] text-[#94949C] mt-0.5">
                        Directly synchronize coursework schedules and syllabus parameters from your institution's digital learning management systems.
                      </p>
                    </div>
                  </div>

                  {selectedLms === null ? (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {[
                        { name: 'Canvas LMS', desc: 'Secure OAuth Sync', icon: Cloud },
                        { name: 'Moodle Portal', desc: 'Syllabus & Course Parser', icon: RefreshCw },
                        { name: 'Blackboard Learn', desc: 'Active Schedule Link', icon: Database },
                        { name: 'Microsoft Teams', desc: 'Academic Roster Sync', icon: GraduationCap }
                      ].map((prov, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLmsConnect(prov.name)}
                          className="flex flex-col items-start p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-[#D4AF37]/25 transition-all text-left group cursor-pointer"
                        >
                          <prov.icon className="w-4 h-4 text-[#D4AF37]/70 group-hover:text-[#D4AF37] transition-colors mb-1.5" />
                          <span className="text-xs font-bold text-white block">{prov.name}</span>
                          <span className="text-[9px] text-white/40 block mt-0.5">{prov.desc}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#0B0D12]/50 rounded-lg border border-white/5 p-4 space-y-4">
                      {lmsStatus === 'connecting' ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-3">
                          <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
                          <div className="text-center">
                            <p className="text-xs font-semibold text-white">Connecting securely to {selectedLms}...</p>
                            <p className="text-[10px] text-white/40 mt-1 font-mono">{lmsProgress}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold text-white">Successfully pulled courses from {selectedLms}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedLms(null)}
                              className="text-[10px] text-[#D4AF37] hover:underline cursor-pointer"
                            >
                              Choose different LMS
                            </button>
                          </div>

                          <p className="text-[10px] text-[#94949C]">
                            Choose the courses you want to import into your learning schedule profile:
                          </p>

                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {lmsCourses.map((course, idx) => {
                              const cleanName = course.replace(' [LMS Sync]', '');
                              const isChecked = selectedLmsCourses.includes(course);
                              return (
                                <label
                                  key={idx}
                                  className={`flex items-center justify-between p-2 rounded border transition-all cursor-pointer ${
                                    isChecked
                                      ? 'bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-400'
                                      : 'bg-white/[0.01] border-white/5 text-[#94949C] hover:border-white/10 hover:text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSelectedLmsCourses(prev => prev.filter(c => c !== course));
                                        } else {
                                          setSelectedLmsCourses(prev => [...prev, course]);
                                        }
                                      }}
                                      className="rounded border-white/10 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-[#0B0D12] w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="text-xs">{cleanName}</span>
                                  </div>
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">Verified Sync</span>
                                </label>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLms(null);
                                setLmsStatus('idle');
                              }}
                              className="px-3 py-1.5 rounded text-xs text-[#94949C] hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={applyLmsCourses}
                              disabled={selectedLmsCourses.length === 0}
                              className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[#0B0D12] font-bold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Import {selectedLmsCourses.length} Courses
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <p className="text-[10.5px] text-[#55555B] leading-relaxed flex items-start gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
            <span>
              Your full academic context (Semester, GPA, Current Courses) will dynamically guide your certification paths, design appropriate semester workload strategies, and power your personalized AI Coach.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {/* Professional Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-white">
              Current Job <span className="text-[#D4AF37]">*</span>
              <input
                value={profile.currentJob === 'Student' ? '' : profile.currentJob}
                onChange={e => onChange({ currentJob: e.target.value })}
                placeholder="e.g. Executive Assistant"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
              />
            </label>
            <label className="block text-xs font-semibold text-white">
              Target Career / Job <span className="text-[#D4AF37]">*</span>
              <input
                value={profile.targetJob}
                onChange={e => onChange({ targetJob: e.target.value })}
                placeholder="e.g. Data Analyst"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-white">
              Current Salary <span className="text-[#55555B] font-normal normal-case">(optional)</span>
              <input
                value={profile.currentSalary}
                onChange={e => onChange({ currentSalary: e.target.value })}
                placeholder="e.g. SAR 15,000"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
              />
            </label>
            <label className="block text-xs font-semibold text-white">
              Target Salary <span className="text-[#55555B] font-normal normal-case">(optional)</span>
              <input
                value={profile.targetSalary}
                onChange={e => onChange({ targetSalary: e.target.value })}
                placeholder="e.g. SAR 25,000"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/50"
              />
            </label>
          </div>
          <p className="text-[10.5px] text-[#55555B] leading-relaxed">
            Salary is only used to frame your Career Roadmap view — never required, never sent anywhere except an AI request you explicitly trigger.
          </p>
        </div>
      )}
    </div>
  );
}
