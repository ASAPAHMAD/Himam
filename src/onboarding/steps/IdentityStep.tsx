import React, { useMemo, useState } from 'react';
import { Profile } from '../../models/types';
import { getCountryOptions, getCountryTimezones, getDefaultTimezoneForCountry, getTimezoneDisplayLabel, searchCountries } from '../../services/timezone';
import { Sparkles, Smile, Image, Loader2, AlertCircle, Camera, UploadCloud } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import ImageCropper from '../../components/ImageCropper';
import { apiFetch } from '../../services/apiClient';

interface StepProps {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
}

const PRESET_AVATARS = [
  {
    id: 'compass',
    name: 'Cosmic Amber',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#171B24" stroke="#D4AF37" stroke-width="2"/><polygon points="50,18 58,42 82,50 58,58 50,82 42,58 18,50 42,42" fill="#D4AF37"/></svg>`
  },
  {
    id: 'tech',
    name: 'Emerald Tech',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#06140D" stroke="#10B981" stroke-width="2"/><circle cx="50" cy="50" r="20" fill="none" stroke="#10B981" stroke-width="3"/><circle cx="50" cy="50" r="8" fill="#10B981"/></svg>`
  },
  {
    id: 'focus',
    name: 'Sapphire Focus',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#070D19" stroke="#3B82F6" stroke-width="2"/><path d="M30 35 L70 35 L50 70 Z" fill="#3B82F6"/><circle cx="50" cy="35" r="5" fill="#FFFFFF"/></svg>`
  },
  {
    id: 'spark',
    name: 'Amethyst Spark',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#100714" stroke="#8B5CF6" stroke-width="2"/><path d="M50 25 C50 38.8 38.8 50 25 50 C38.8 50 50 61.2 50 75 C50 61.2 61.2 50 75 50 C61.2 50 50 38.8 50 25 Z" fill="#8B5CF6"/></svg>`
  }
];

export default function IdentityStep({ profile, onChange }: StepProps) {
  const { user, configured } = useAuth();
  const [countryQuery, setCountryQuery] = useState(profile.country || '');
  const [isOpen, setIsOpen] = useState(false);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  // Custom photo upload & camera states
  const [isModerating, setIsModerating] = useState(false);
  const [selectedFileForCrop, setSelectedFileForCrop] = useState<File | null>(null);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const [avatarError, setAvatarError] = useState('');

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

    try {
      const mimeType = 'image/jpeg';

      if (configured) {
        const response = await apiFetch('/api/avatar/moderate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mimeType })
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || 'The AI safety scanning service could not process your image.');
        }

        const moderation = await response.json();
        if (!moderation.safe) {
          throw new Error(`Inappropriate image detected: ${moderation.reason}. Please select a different image.`);
        }
      }

      let avatarUrl = '';
      if (configured && supabase) {
        const path = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, croppedBlob, { upsert: true, contentType: mimeType });
        if (!uploadError) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
        } else {
          console.error('Supabase upload error:', uploadError);
          throw new Error('Cloud storage upload failed. Please try again.');
        }
      } else {
        avatarUrl = `data:image/jpeg;base64,${base64}`;
      }

      onChange({ avatarUrl });
    } catch (err: any) {
      setAvatarError(err.message || 'Verification or upload failed.');
    } finally {
      setIsModerating(false);
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

  const countryOptions = useMemo(() => searchCountries(countryQuery), [countryQuery]);

  const handleCountrySelect = (country: string) => {
    const timezones = getCountryTimezones(country);
    const preferredTimezone = timezones.includes(profile.timezone) ? profile.timezone : getDefaultTimezoneForCountry(country);
    onChange({ country, timezone: preferredTimezone });
    setCountryQuery(country);
    setIsOpen(false);
  };

  const handleCountryInput = (value: string) => {
    setCountryQuery(value);
    setIsOpen(true);
    if (!value) {
      onChange({ country: '', timezone: profile.timezone });
    }
  };

  const handleTimezoneSelect = (timezone: string) => {
    onChange({ timezone });
  };

  const generateAIAvatar = async () => {
    if (!avatarPrompt.trim()) return;
    setIsGenerating(true);
    setGenerationError('');
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
        onChange({ avatarUrl: svgDataUrl });
      } else {
        throw new Error('Invalid response from AI avatar model.');
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Avatar generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const countryTimezones = useMemo(() => getCountryTimezones(profile.country), [profile.country]);

  // If no avatar is selected, set default preset
  React.useEffect(() => {
    if (!profile.avatarUrl) {
      const defaultDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(PRESET_AVATARS[0].svg)}`;
      onChange({ avatarUrl: defaultDataUrl });
    }
  }, []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="block text-xs font-semibold text-white">Full Name <span className="text-[#D4AF37]">*</span>
          <input value={profile.name} onChange={e => onChange({ name: e.target.value })} required
            placeholder="Your name" className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm" />
        </label>

        <label className="block text-xs font-semibold text-white">Username <span className="text-[#D4AF37]">*</span>
          <input 
            value={profile.username || ''} 
            onChange={e => onChange({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} 
            required
            placeholder="username_123" 
            className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm lowercase" 
          />
        </label>

        <div className="block text-xs font-semibold text-white">
          <span>Email Address <span className="text-[#D4AF37]">*</span></span>
          <div className="relative mt-1.5">
            {user?.email ? (
              <>
                <input 
                  type="email"
                  value={user.email} 
                  readOnly
                  className="w-full rounded-lg bg-[#0B0D12]/40 border border-white/5 px-3 py-3 text-sm text-[#94949C] cursor-not-allowed select-none" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 rounded border border-[#D4AF37]/20 uppercase tracking-wider">
                  Verified
                </span>
              </>
            ) : (
              <>
                <input 
                  type="email"
                  value={profile.email || ''} 
                  onChange={e => onChange({ email: e.target.value })}
                  placeholder="yourname@example.com"
                  className="w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/35 outline-none" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-bold text-[#94949C] bg-white/5 rounded border border-white/10 uppercase tracking-wider">
                  Profile
                </span>
              </>
            )}
          </div>
          <p className="text-[10px] text-[#55555B] font-normal mt-1 leading-normal">
            {user?.email 
              ? 'Linked to your authenticated account credentials.' 
              : 'Enter your email address to associate with your learning profile.'}
          </p>
        </div>
      </div>

      {/* Profile Picture/Avatar Selector */}
      <div className="rounded-xl border border-white/5 bg-[#171B24]/50 p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-white">Choose Profile Picture</h4>
          <p className="text-[10px] text-[#94949C] mt-0.5">Select a sleek professional design or design one with AI.</p>
        </div>

        {/* Selected avatar preview & presets */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            {profile.avatarUrl ? (
              <img 
                src={profile.avatarUrl} 
                alt="Selected avatar" 
                className="w-16 h-16 rounded-xl border border-[#D4AF37]/40 object-cover bg-black p-1" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl border border-white/10 bg-[#0B0D12] flex items-center justify-center">
                <Smile className="w-6 h-6 text-[#55555B]" />
              </div>
            )}
            <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] font-bold text-white bg-[#D4AF37] rounded uppercase">Active</span>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {PRESET_AVATARS.map(preset => {
              const presetDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(preset.svg)}`;
              const isSelected = profile.avatarUrl === presetDataUrl;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ avatarUrl: presetDataUrl })}
                  className={`w-11 h-11 rounded-lg overflow-hidden border p-0.5 bg-black transition-all hover:scale-105 active:scale-95 ${
                    isSelected ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/35' : 'border-white/10 hover:border-white/20'
                  }`}
                  title={preset.name}
                >
                  <div dangerouslySetInnerHTML={{ __html: preset.svg }} className="w-full h-full" />
                </button>
              );
            })}

            {/* Custom upload image button */}
            {Capacitor.isNativePlatform() ? (
              <button
                type="button"
                onClick={() => setShowMobileOptions(true)}
                disabled={isModerating}
                className="w-11 h-11 rounded-lg flex items-center justify-center border border-dashed border-white/20 hover:border-[#D4AF37]/50 bg-white/5 text-[#D4AF37] hover:bg-white/10 transition-all hover:scale-105 active:scale-95 relative"
                title="Upload custom picture"
              >
                {isModerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            ) : (
              <label
                className="w-11 h-11 rounded-lg flex items-center justify-center border border-dashed border-white/20 hover:border-[#D4AF37]/50 bg-white/5 text-[#D4AF37] hover:bg-white/10 transition-all hover:scale-105 active:scale-95 relative cursor-pointer"
                title="Upload custom picture"
              >
                {isModerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
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

          {avatarError && (
            <div className="w-full flex items-center gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/10 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}
        </div>

        {/* AI Avatar generation */}
        <div className="border-t border-white/5 pt-3">
          <label className="block text-[11px] font-semibold text-[#D4AF37] flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Generate Custom AI Vector Avatar</span>
          </label>
          <div className="flex gap-2 mt-1.5">
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
                  Generate
                </>
              )}
            </button>
          </div>
          {generationError && (
            <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1 leading-normal">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-white">Country <span className="text-[#D4AF37]">*</span></label>
        <div className="relative">
          <input
            value={countryQuery}
            onChange={e => handleCountryInput(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            required
            placeholder="Search country"
            className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm"
          />
          {isOpen && countryOptions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-[#171B24] shadow-lg max-h-52 overflow-auto">
              {countryOptions.map(option => (
                <button
                  key={option.name}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleCountrySelect(option.name)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#E0E0E6] hover:bg-white/5"
                >
                  <span>{option.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-[#55555B]">{option.timezones[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <label className="block text-xs font-semibold text-white">Time zone <span className="text-[#D4AF37]">*</span>
        <select value={profile.timezone} onChange={e => handleTimezoneSelect(e.target.value)} required
          className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3 py-3 text-sm text-white">
          {countryTimezones.length > 0 ? countryTimezones.map(tz => (
            <option key={tz} value={tz}>{getTimezoneDisplayLabel(tz)}</option>
          )) : (
            <option value={profile.timezone}>{profile.timezone}</option>
          )}
        </select>
        <span className="block mt-1 text-[10.5px] text-[#55555B] font-normal normal-case">
          We detect a sensible default from your selected country and keep the IANA timezone for scheduling accuracy.
        </span>
      </label>

      {/* Native Camera Choice Overlay */}
      {showMobileOptions && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#11141C] border border-white/5 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white text-center">Change profile photo</h3>
            <button
              onClick={() => triggerMobileCamera(CameraSource.Camera)}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-all text-center"
            >
              Take Photo
            </button>
            <button
              onClick={() => triggerMobileCamera(CameraSource.Photos)}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/15 transition-all text-center"
            >
              Choose from Photos
            </button>
            <button
              onClick={() => setShowMobileOptions(false)}
              className="w-full py-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-[#94949C] transition-all text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Interactive Image Cropper Overlay */}
      {selectedFileForCrop && (
        <ImageCropper
          file={selectedFileForCrop}
          onCropComplete={handleCroppedAvatar}
          onCancel={() => setSelectedFileForCrop(null)}
        />
      )}
    </div>
  );
}
