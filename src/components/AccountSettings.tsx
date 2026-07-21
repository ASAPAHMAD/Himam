import { useState, DragEvent } from 'react';
import { ArrowLeft, Camera, LogOut, Trash2, Sparkles, Smile, Loader2, AlertCircle, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Profile } from '../models/types';
import { apiFetch } from '../services/apiClient';
import ImageCropper from './ImageCropper';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

const callbackUrl = `${window.location.origin}/auth/callback`;

interface AccountSettingsProps {
  profile: Profile;
  onUpdateProfile: (profile: Profile) => void;
  onBack: () => void;
  onGoToPreferences: () => void;
  signOut?: () => void | Promise<any>;
}

/**
 * Adapted from the ported auth branch (see CHANGELOG.md): name/timezone/avatar
 * now read and write the generic Profile model — persisted to the `profiles`
 * table via the write-through effect in App.tsx, same mechanism as every
 * other profile edit in the app — instead of Supabase Auth's `user_metadata`,
 * which was a second, disconnected place the same information could live.
 * Email/password/linked-identity/account-deletion operations are unchanged:
 * those are genuinely Supabase Auth concerns, not part of Profile.
 */
export default function AccountSettings({ profile, onUpdateProfile, onBack, onGoToPreferences, signOut: signOutProp }: AccountSettingsProps) {
  const { user, signOut: authSignOut } = useAuth();
  const signOut = signOutProp || authSignOut;
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username || '');
  const [timezone, setTimezone] = useState(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [newPassword, setNewPassword] = useState('');
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModerating, setIsModerating] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedFileForCrop, setSelectedFileForCrop] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  // Client-side image resizing and compression helper to keep payloads small and responsive
  const resizeAndCompressImage = (file: File, maxWidth = 150, maxHeight = 150): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const mimeType = 'image/jpeg';
          const dataUrl = canvas.toDataURL(mimeType, 0.85);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, mimeType });
        };
        img.onerror = () => reject(new Error('Failed to load image resource'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const changeEmail = () => run(async () => {
    if (!supabase || !newEmail.trim()) throw new Error('Enter a valid email address.');
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() }, { emailRedirectTo: callbackUrl });
    if (error) throw error;
    setMessage('Verification emails were sent to your current and new addresses. Your email changes after confirmation.');
    setNewEmail('');
    setIsChangingEmail(false);
  });
  const saveProfile = () => run(async () => {
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (trimmedUsername && !/^[a-zA-Z0-9_]{3,15}$/.test(trimmedUsername)) {
      throw new Error('Username must be 3-15 characters long and contain only letters, numbers, or underscores.');
    }
    onUpdateProfile({ ...profile, name: name.trim(), username: trimmedUsername, timezone });
    setMessage('Profile updated.');
  });
  const changePassword = () => run(async () => {
    if (!supabase || newPassword.length < 8) throw new Error('Use a password with at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setNewPassword(''); setMessage('Your password was updated.');
  });
  const uploadAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose a valid image file.');
      return;
    }
    setSelectedFileForCrop(file);
    setAvatarError('');
  };

  const handleCroppedAvatar = async (croppedBlob: Blob, base64: string) => {
    setSelectedFileForCrop(null);
    setIsModerating(true);
    setAvatarError('');
    setMessage('');

    try {
      const mimeType = 'image/jpeg';

      // 1. Query server-side Gemini API for safety moderation (no adult content allowed)
      const response = await apiFetch('/api/avatar/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'The AI safety scanning service could not process your image. Please try another one.');
      }

      const moderation = await response.json();
      if (!moderation.safe) {
        throw new Error(`Inappropriate content flagged: ${moderation.reason || 'This image contains elements violating our professional learning safety standards.'}`);
      }

      // 2. Image is safe, construct the base64 fallback or upload to Supabase storage if connected
      let avatarUrl = `data:${mimeType};base64,${base64}`;

      if (supabase && user) {
        const path = `${user.id}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, croppedBlob, { upsert: true, contentType: mimeType });
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path);
          // Append a cache-buster timestamp query param to prevent browser caching of old avatars
          avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
        } else {
          console.error('Supabase upload error:', uploadError);
          throw new Error('Cloud storage upload failed. Please try again in a few moments.');
        }
      }

      onUpdateProfile({ ...profile, avatarUrl });
      setMessage('Avatar successfully verified safe and updated!');
    } catch (err: any) {
      if (err instanceof TypeError || (err.message && err.message.includes('fetch'))) {
        setAvatarError('A network connectivity issue occurred. Please check your internet connection and try again.');
      } else {
        setAvatarError(err.message || 'Verification or upload failed.');
      }
    } finally {
      setIsModerating(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  const triggerMobileCamera = async (source: CameraSource) => {
    setShowMobileOptions(false);
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source,
      });

      if (image.webPath) {
        setIsModerating(true);
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        const file = new File([blob], `avatar.${image.format || 'jpg'}`, { type: blob.type || 'image/jpeg' });
        uploadAvatar(file);
      }
    } catch (err: any) {
      console.error('Mobile camera error:', err);
      if (err.message && !err.message.includes('User cancelled') && !err.message.includes('user cancelled')) {
        setAvatarError(`Native camera access failed: ${err.message || err}`);
      }
    } finally {
      setIsModerating(false);
    }
  };

  const handleAvatarTrigger = () => {
    if (isModerating) return;
    if (Capacitor.isNativePlatform()) {
      setShowMobileOptions(true);
    } else {
      document.getElementById('web-avatar-input')?.click();
    }
  };
  const generateAIAvatar = async () => {
    if (!avatarPrompt.trim()) return;
    setIsGenerating(true);
    setAvatarError('');
    try {
      const response = await apiFetch('/api/avatar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: avatarPrompt })
      });
      if (!response.ok) {
        throw new Error('Could not generate avatar. Please try again.');
      }
      const data = await response.json();
      if (data.svg) {
        const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`;
        onUpdateProfile({ ...profile, avatarUrl: svgDataUrl });
        setMessage('AI Avatar generated and updated.');
      } else {
        throw new Error('Invalid response from AI avatar model.');
      }
    } catch (err: any) {
      setAvatarError(err.message || 'Avatar generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };
  const deleteAccount = () => run(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    if (!window.confirm('Delete your account and avatar permanently? This cannot be undone.')) return;
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw new Error('Unable to delete the account. Sign in again and retry.');
    await signOut();
  });
  const linkIdentity = (provider: 'google' | 'apple') => run(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo: callbackUrl } });
    if (error) throw error;
  });

  return <main className="min-h-screen bg-transparent text-[#E0E0E6] p-5 sm:p-8">
    <section className="max-w-2xl mx-auto space-y-6">
      <button onClick={onBack} className="text-sm text-[#D4AF37] font-semibold inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to dashboard</button>
      <header><p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[#D4AF37]">Account</p><h1 className="font-serif text-3xl font-bold text-white mt-2">Account settings</h1></header>
      <p className="text-xs text-[#55555B]">Looking for career goals, schedule, or learning style? That's in <button onClick={onGoToPreferences} className="text-[#D4AF37] font-semibold">Preferences</button>.</p>
      <div className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-5">
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col gap-4 border-b border-white/5 pb-4 transition-all duration-200 rounded-xl p-3 ${
            isDraggingOver 
              ? 'border-2 border-dashed border-[#D4AF37] bg-[#D4AF37]/5 scale-[1.01]' 
              : 'border border-transparent'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group">
              <img 
                src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || user?.email || 'User')}&background=171B24&color=D4AF37`} 
                alt="Your avatar" 
                className="w-16 h-16 rounded-xl border border-[#D4AF37]/40 object-cover bg-black p-1 transition-all group-hover:scale-105" 
              />
              {isModerating && (
                <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
                </div>
              )}
              {isDraggingOver && (
                <div className="absolute inset-0 bg-black/45 rounded-xl flex items-center justify-center">
                  <UploadCloud className="w-6 h-6 text-[#D4AF37] animate-bounce" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {Capacitor.isNativePlatform() ? (
                  <button 
                    type="button"
                    onClick={handleAvatarTrigger}
                    className={`cursor-pointer text-xs font-bold text-[#D4AF37] inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg border border-white/10 transition-all ${isModerating ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isModerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scanning image...
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        Upload custom avatar
                      </>
                    )}
                  </button>
                ) : (
                  <label 
                    className={`cursor-pointer text-xs font-bold text-[#D4AF37] inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg border border-white/10 transition-all ${isModerating ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isModerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Scanning image...
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        Upload custom avatar
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="sr-only" 
                      disabled={isModerating} 
                      onChange={e => {
                        uploadAvatar(e.target.files?.[0]);
                        e.target.value = '';
                      }} 
                    />
                  </label>
                )}
              </div>
              
              <p className="text-[10px] text-[#55555B] leading-normal max-w-md">
                Supports JPG, PNG (Max 2MB). Drag &amp; drop your image directly here or click to browse. Files are scanned by automated AI safety filters.
              </p>
              {avatarError && !isGenerating && (
                <p className="text-[10.5px] text-red-400 font-semibold flex items-start gap-1.5 mt-1 bg-red-950/30 border border-red-500/20 p-2 rounded-lg leading-relaxed justify-center sm:justify-start">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
                  <span>{avatarError}</span>
                </p>
              )}
            </div>
          </div>

          {/* AI Avatar generation inside settings */}
          <div className="bg-[#0B0D12]/50 border border-white/5 rounded-xl p-3.5 space-y-2.5">
            <label className="block text-xs font-semibold text-[#D4AF37] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Design Custom AI Vector Avatar</span>
            </label>
            <div className="flex gap-2">
              <input 
                value={avatarPrompt}
                onChange={e => setAvatarPrompt(e.target.value)}
                placeholder="e.g. smart owl, cyber analyst, neon pilot..."
                className="flex-1 rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-2 text-xs"
              />
              <button
                type="button"
                disabled={isGenerating || !avatarPrompt.trim()}
                onClick={generateAIAvatar}
                className="px-3 py-2 text-xs font-bold bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:from-[#D4AF37] hover:to-[#B8932D] text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate AI
                  </>
                )}
              </button>
            </div>
            {avatarError && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">{avatarError}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-xs font-semibold">Name
            <input value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm" />
          </label>
          <label className="block text-xs font-semibold">Username
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm lowercase" placeholder="username_123" />
          </label>
        </div>

        <label className="block text-xs font-semibold">Time zone<input value={timezone} onChange={e => setTimezone(e.target.value)} className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm" /></label>
        <button disabled={busy} onClick={saveProfile} className="rounded-lg px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95">Save Profile Changes</button>
        
        <div className="border-t border-white/5 pt-5 space-y-4">
          <div>
            <span className="block text-xs font-semibold text-white">Email Address</span>
            <div className="relative mt-1.5">
              <input 
                type="email" 
                value={user?.email || ''} 
                placeholder={supabase ? "No email address found" : "Offline Guest (No Account)"}
                readOnly 
                className="w-full rounded-lg bg-[#0B0D12]/40 border border-white/5 px-3 py-3 text-sm text-[#94949C] cursor-not-allowed select-none" 
              />
              {supabase ? (
                user?.email_confirmed_at ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 rounded border border-[#D4AF37]/20 uppercase tracking-wider">
                    Verified
                  </span>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 rounded border border-amber-500/20 uppercase tracking-wider">
                    Pending
                  </span>
                )
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 bg-gray-500/10 rounded border border-gray-500/20 uppercase tracking-wider">
                  Guest
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#55555B] font-normal mt-1 leading-normal">
              {supabase 
                ? "Your email address is managed via your security credentials." 
                : "You are currently studying in offline Guest Mode. All progress is saved locally to this browser."
              }
            </p>
          </div>

          {supabase ? (
            !isChangingEmail ? (
              <button 
                type="button"
                disabled={busy}
                onClick={() => setIsChangingEmail(true)} 
                className="rounded-lg px-4 py-2.5 text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all active:scale-95 disabled:opacity-50"
              >
                Change Email Address
              </button>
            ) : (
              <div className="bg-[#0B0D12]/30 border border-white/5 rounded-xl p-4 space-y-3">
                <label className="block text-xs font-semibold text-white">
                  New Email Address
                  <input 
                    type="email" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    placeholder="new-email@example.com"
                    required
                    className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm focus:border-[#D4AF37]/40 focus:outline-none" 
                  />
                </label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    disabled={busy || !newEmail.trim()} 
                    onClick={changeEmail} 
                    className="rounded-lg px-4 py-2 text-xs font-bold bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                  >
                    Send Verification Link
                  </button>
                  <button 
                    type="button"
                    disabled={busy}
                    onClick={() => { setIsChangingEmail(false); setNewEmail(''); }} 
                    className="rounded-lg px-4 py-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-[#94949C] border border-white/5 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.02] p-4 text-xs">
              <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Email Verification is Disabled (Offline Mode)
              </span>
              <p className="text-[#94949C] text-[10.5px] mt-1.5 leading-relaxed">
                A backend database has not been linked to this application. To add your email and verify your account, please connect and configure Supabase in your environment variables.
              </p>
            </div>
          )}
        </div>

        {supabase ? (
          <>
            <label className="block text-xs font-semibold">
              New password
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                minLength={8} 
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm" 
              />
            </label>
            <button 
              disabled={busy} 
              onClick={changePassword} 
              className="rounded-lg px-4 py-2 text-sm font-bold bg-white/10 disabled:opacity-50 hover:bg-white/15 transition-all active:scale-95"
            >
              Change password
            </button>
            <div>
              <p className="text-xs font-semibold mb-2">Linked sign-in methods</p>
              <div className="flex gap-2">
                <button 
                  disabled={busy} 
                  onClick={() => linkIdentity('google')} 
                  className="rounded-lg px-4 py-2 text-sm font-bold bg-white/10 disabled:opacity-50 hover:bg-white/15 transition-all active:scale-95"
                >
                  Link Google
                </button>
                <button 
                  disabled={busy} 
                  onClick={() => linkIdentity('apple')} 
                  className="rounded-lg px-4 py-2 text-sm font-bold bg-white/10 disabled:opacity-50 hover:bg-white/15 transition-all active:scale-95"
                >
                  Link Apple
                </button>
              </div>
            </div>
          </>
        ) : null}
        {message && <p role="status" className="text-sm text-[#D4AF37]">{message}</p>}
      </div>

      {/* App Appearance / Background Selector Section */}
      <div className="rounded-2xl border border-white/10 bg-[#171B24] p-5 space-y-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-white">App Appearance</h2>
          <p className="text-xs text-[#94949C] mt-1">Select your preferred workspace background theme. This will sync to your account profile.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { id: 'midnight', name: 'Midnight Slate', color: 'bg-[#0B0D12] border-white/20', desc: 'Default deep charcoal' },
            { id: 'emerald', name: 'Emerald Oasis', color: 'bg-[#06140D] border-emerald-500/20', desc: 'Calming clinical green' },
            { id: 'sapphire', name: 'Deep Sapphire', color: 'bg-[#070D19] border-blue-500/20', desc: 'Focused study blue' },
            { id: 'amethyst', name: 'Royal Amethyst', color: 'bg-[#100714] border-purple-500/20', desc: 'Creative inspiration plum' },
            { id: 'obsidian', name: 'Obsidian Dark', color: 'bg-[#020202] border-white/10', desc: 'True absolute black' },
            { id: 'onyx', name: 'Chocolate Onyx', color: 'bg-[#0F0A07] border-amber-900/20', desc: 'Warm espresso bronze' },
          ].map(bg => {
            const isActive = (profile.background || 'midnight') === bg.id;
            return (
              <button
                key={bg.id}
                onClick={() => {
                  onUpdateProfile({ ...profile, background: bg.id });
                }}
                className={`relative flex flex-col items-center text-center p-3 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 ${
                  isActive
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10 shadow-lg shadow-[#D4AF37]/5'
                    : 'border-white/5 bg-[#11141C] hover:border-white/10'
                }`}
              >
                {/* Circle preview */}
                <div className={`w-8 h-8 rounded-full ${bg.color} border shadow-inner mb-2 flex items-center justify-center`}>
                  {isActive && <div className="w-2.5 h-2.5 bg-[#D4AF37] rounded-full" />}
                </div>
                <span className="text-white text-xs font-bold block">{bg.name}</span>
                <span className="text-[9px] text-[#94949C] mt-0.5 leading-tight">{bg.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-[#171B24] p-5 flex flex-wrap gap-3"><button disabled={busy} onClick={() => run(async () => { const result = await signOut(); if (result.error) throw result.error; })} className="rounded-lg px-4 py-2 text-sm font-bold bg-white/10 inline-flex gap-2"><LogOut className="w-4 h-4" /> Sign out</button><button disabled={busy} onClick={deleteAccount} className="rounded-lg px-4 py-2 text-sm font-bold text-red-300 bg-red-500/10 inline-flex gap-2"><Trash2 className="w-4 h-4" /> Delete account</button></div>
    </section>

    {selectedFileForCrop && (
      <ImageCropper
        file={selectedFileForCrop}
        onCropComplete={handleCroppedAvatar}
        onCancel={() => setSelectedFileForCrop(null)}
      />
    )}

    {showMobileOptions && (
      <div className="fixed inset-0 z-[100] bg-black/85 flex items-end justify-center p-4">
        <div className="w-full max-w-sm bg-[#171B24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <div className="text-center pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Change Profile Photo</h3>
            <p className="text-[10px] text-[#55555B] mt-0.5">Capture or select an image to verify &amp; crop</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              type="button"
              onClick={() => triggerMobileCamera(CameraSource.Camera)}
              className="w-full py-3 text-center bg-[#D4AF37] text-black text-xs font-bold rounded-xl active:opacity-90 transition-opacity"
            >
              Take Photo
            </button>
            <button 
              type="button"
              onClick={() => triggerMobileCamera(CameraSource.Photos)}
              className="w-full py-3 text-center bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl active:bg-white/10 transition-all border border-white/5"
            >
              Choose from Photos
            </button>
            <button 
              type="button"
              onClick={() => setShowMobileOptions(false)}
              className="w-full py-3 text-center bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl active:bg-red-500/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </main>;
}
