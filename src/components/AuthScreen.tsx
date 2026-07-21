import React, { useMemo, useState } from 'react';
import { Apple, Chrome, Sparkles, HelpCircle, ExternalLink, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LegalHub from './LegalHub';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

const friendlyAuthError = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'That email or password is incorrect.';
  if (lower.includes('email not confirmed')) return 'Confirm your email address before signing in.';
  if (lower.includes('already registered') || lower.includes('already been registered')) return 'An account already exists for this email. Try signing in instead.';
  if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (lower.includes('network') || lower.includes('fetch')) return 'We could not reach the authentication service. Check your connection and try again.';
  if (lower.includes('provider is not enabled')) return 'This sign-in provider is not enabled yet. Please contact support.';
  return 'We could not complete that request. Please try again.';
};

const passwordError = (password: string) => {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.';
  return null;
};

export default function AuthScreen({ initialMode = 'signin' }: { initialMode?: Mode }) {
  const [activeLegal, setActiveLegal] = useState<'terms' | 'privacy' | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOauthHelp, setShowOauthHelp] = useState(false);
  const [copiedText, setCopiedText] = useState<'site' | 'redirect' | null>(null);

  const copyToClipboard = (text: string, type: 'site' | 'redirect') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isPasswordMode = mode === 'signin' || mode === 'signup' || mode === 'reset';
  const title = useMemo(() => ({
    signin: 'Welcome back.', signup: 'Make your plan stick.', forgot: 'Reset your password.', reset: 'Choose a new password.',
  }[mode]), [mode]);

  const changeMode = (next: Mode) => {
    setMode(next); setMessage(''); setPassword(''); setConfirmPassword('');
    setFullName(''); setUsername(''); setAgreeToTerms(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return setMessage('Supabase is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values, then restart the app.');
    if (isPasswordMode) {
      const validation = passwordError(password);
      if ((mode === 'signup' || mode === 'reset') && validation) return setMessage(validation);
      if ((mode === 'signup' || mode === 'reset') && password !== confirmPassword) return setMessage('Your passwords do not match.');
      if (mode === 'signup' && !agreeToTerms) return setMessage('Please agree to the Terms & Conditions and Privacy Policy.');
      if (mode === 'signup' && username && !/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
        return setMessage('Username must be 3-15 characters long and contain only letters, numbers, or underscores.');
      }
    }
    setLoading(true); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              full_name: fullName,
              username: username,
            }
          },
        });
        if (error) throw error;
        // Index the username locally so we can resolve it to the email later for easy sign-in
        if (username) {
          localStorage.setItem('email_by_username_' + username.toLowerCase().trim(), email);
        }
        if (!data.session) setMessage('Verification email sent. Open the link in the same browser, then sign in.');
        else setMessage('Account created successfully.');
      } else if (mode === 'signin') {
        // Resolve username to email if there's no '@' in the input identifier
        const resolvedEmail = email.includes('@')
          ? email
          : localStorage.getItem('email_by_username_' + email.toLowerCase().trim());

        if (!resolvedEmail) {
          throw new Error(`Could not find a registered email for the username "${email}" on this device. Please sign in using your email address instead.`);
        }

        const { error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setMessage('If an account exists for that email, a password reset link is on its way.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password updated. You can continue to your Himam dashboard.');
        window.setTimeout(() => window.location.assign('/dashboard'), 600);
      }
    } catch (error) {
      setMessage(friendlyAuthError(error instanceof Error ? error.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const socialSignIn = async (provider: 'google' | 'apple') => {
    if (!supabase) return setMessage('Supabase is not configured.');
    setLoading(true); setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setMessage(friendlyAuthError(error.message)); setLoading(false); }
  };

  if (activeLegal) {
    return (
      <div className="min-h-screen bg-[#0B0D12] text-[#E0E0E6] w-full">
        <LegalHub 
          initialTab={activeLegal}
          onBack={() => setActiveLegal(null)}
          defaultLanguage="ar" // Since Himam's primary focus region is Saudi Arabia, we can default legal agreements to Arabic if they want, or standard English detection
        />
      </div>
    );
  }

  return <main className="min-h-screen bg-[#0B0D12] text-[#E0E0E6] grid place-items-center p-4 sm:p-6 safe-py safe-px">
    <section className="w-full max-w-md bg-[#171B24] border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl">
      <div className="w-11 h-11 grid place-items-center rounded-xl bg-[#171B24] border border-[#D4AF37]/25 text-[#D4AF37]"><Sparkles className="w-5 h-5" /></div>
      <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[#D4AF37] mt-5 sm:mt-6">Himam <span dir="rtl" lang="ar">هِمَم</span></p>
      <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white mt-1.5">{title}</h1>
      <p className="text-xs sm:text-sm text-[#94949C] mt-1.5">Your progress, streaks and goals stay with your account.</p>
      <p className="mt-2.5 text-xs sm:text-sm text-[#D4AF37] font-medium">Start your learning journey in minutes.</p>
      {(mode === 'signin' || mode === 'signup') && (
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-[#0B0D12] p-1.5">
          <button
            type="button"
            onClick={() => changeMode('signup')}
            className={`rounded-lg px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold transition-all ${mode === 'signup' ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white' : 'text-[#94949C] hover:text-white'}`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => changeMode('signin')}
            className={`rounded-lg px-3 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold transition-all ${mode === 'signin' ? 'bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white' : 'text-[#94949C] hover:text-white'}`}
          >
            Sign in
          </button>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4 mt-5">
        {mode === 'signup' && (
          <>
            <label className="block text-xs font-semibold text-white">
              Full Name
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Dr. John Doe"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3.5 py-3 text-base sm:text-sm min-h-[44px]"
              />
            </label>
            <label className="block text-xs font-semibold text-white">
              Username
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="johndoe_md"
                className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3.5 py-3 text-base sm:text-sm min-h-[44px]"
              />
            </label>
          </>
        )}
        {mode !== 'reset' && (
          <label className="block text-xs font-semibold text-white">
            {mode === 'signin' ? 'Email or Username' : 'Email'}
            <input
              type={mode === 'signin' ? 'text' : 'email'}
              autoComplete={mode === 'signin' ? 'username' : 'email'}
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={mode === 'signin' ? 'you@example.com or username_123' : 'you@example.com'}
              className="mt-1.5 w-full rounded-lg bg-[#0B0D12] border border-white/10 px-3.5 py-3 text-base sm:text-sm min-h-[44px]"
            />
          </label>
        )}
        {isPasswordMode && <label className="block text-xs font-semibold text-white">{mode === 'reset' ? 'New password' : 'Password'}<div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D12] px-3.5 py-2.5 min-h-[44px]"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? 1 : 8} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signin' ? 'Your password' : '8+ characters, letter and number'} className="w-full bg-transparent text-base sm:text-sm outline-none" /><button type="button" onClick={() => setShowPassword(v => !v)} className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37] px-2 py-1 min-h-[36px] flex items-center">{showPassword ? 'Hide' : 'Show'}</button></div></label>}
        {(mode === 'signup' || mode === 'reset') && <label className="block text-xs font-semibold text-white">Confirm password<div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D12] px-3.5 py-2.5 min-h-[44px]"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-transparent text-base sm:text-sm outline-none" /></div></label>}
        
        {mode === 'signup' && (
          <div className="flex items-start gap-3 text-xs text-[#94949C] pt-1 selection:bg-transparent">
            <input
              type="checkbox"
              required
              id="agreeToTermsCheckbox"
              checked={agreeToTerms}
              onChange={e => setAgreeToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-white/10 bg-[#0B0D12] text-[#D4AF37] focus:ring-[#D4AF37]/40 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="agreeToTermsCheckbox" className="cursor-pointer select-none leading-relaxed text-[#94949C]">
              I agree to the{' '}
              <button 
                type="button" 
                onClick={() => setActiveLegal('terms')} 
                className="inline-block cursor-pointer text-[#D4AF37] font-bold hover:underline focus:outline-none bg-transparent border-0 p-0 align-baseline"
              >
                Terms &amp; Conditions
              </button>{' '}
              and acknowledge the{' '}
              <button 
                type="button" 
                onClick={() => setActiveLegal('privacy')} 
                className="inline-block cursor-pointer text-[#D4AF37] font-bold hover:underline focus:outline-none bg-transparent border-0 p-0 align-baseline"
              >
                Privacy Policy
              </button>.
            </label>
          </div>
        )}

        <button disabled={loading} className="w-full rounded-lg py-3 min-h-[44px] bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white font-bold text-sm active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center">{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
      </form>
      {message && <p role="status" className="mt-3 text-xs leading-relaxed text-[#D4AF37]">{message}</p>}
      {mode === 'signin' && <button type="button" onClick={() => changeMode('forgot')} className="mt-3 text-xs text-[#D4AF37] font-bold py-1 min-h-[36px] flex items-center">Forgot password?</button>}
      {mode !== 'forgot' && mode !== 'reset' && (
        <>
          <div className="flex items-center gap-3 my-5 text-[10px] text-[#55555B]">
            <span className="h-px flex-1 bg-white/10" />
            OR
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={loading} onClick={() => socialSignIn('google')} className="border border-white/10 rounded-lg py-2.5 min-h-[44px] text-xs font-bold flex justify-center gap-2 items-center hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50">
              <Chrome className="w-4 h-4" /> Google
            </button>
            <button type="button" disabled={loading} onClick={() => socialSignIn('apple')} className="border border-white/10 rounded-lg py-2.5 min-h-[44px] text-xs font-bold flex justify-center gap-2 items-center hover:bg-white/5 active:scale-[0.98] transition-all disabled:opacity-50">
              <Apple className="w-4 h-4" /> Apple
            </button>
          </div>

          <div className="mt-6 border-t border-white/5 pt-4">
            <button
              type="button"
              onClick={() => setShowOauthHelp(v => !v)}
              className="w-full flex items-center justify-between text-[11px] text-[#D4AF37] hover:text-[#D4AF37]/85 font-semibold bg-[#0B0D12]/45 hover:bg-[#0B0D12]/80 border border-[#D4AF37]/20 rounded-lg px-3 py-2 transition-all"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5" />
                Fix "Localhost refused to connect"
              </span>
              {showOauthHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            
            {showOauthHelp && (
              <div className="mt-3 bg-[#0B0D12] border border-white/5 rounded-lg p-3.5 text-xs text-[#94949C] space-y-3 leading-relaxed animate-in fade-in duration-200">
                <p>
                  Because the app is running in the cloud, Supabase OAuth redirects to <code className="text-white bg-white/5 px-1 rounded font-mono">localhost</code> by default until you add your development domain to Supabase.
                </p>
                
                <div className="space-y-2">
                  <p className="font-bold text-white text-[10px] uppercase tracking-wider">How to fix this in Supabase:</p>
                  <ol className="list-decimal pl-4 space-y-2 text-[11px]">
                    <li>
                      Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] font-semibold hover:underline inline-flex items-center gap-0.5">Supabase Dashboard <ExternalLink className="w-2.5 h-2.5" /></a>
                    </li>
                    <li>
                      Go to <strong className="text-white font-medium">Authentication</strong> &rarr; <strong className="text-white font-medium">URL Configuration</strong>.
                    </li>
                    <li>
                      Set <strong className="text-white font-medium">Site URL</strong> to:
                      <div className="mt-1 flex items-center gap-1.5 bg-black/45 border border-white/10 rounded px-2 py-1 font-mono text-[10px] text-white">
                        <span className="truncate flex-1">{window.location.origin}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(window.location.origin, 'site')}
                          className="text-[#D4AF37] hover:text-white flex-shrink-0"
                          title="Copy URL"
                        >
                          {copiedText === 'site' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </li>
                    <li>
                      Add to <strong className="text-white font-medium">Redirect URLs</strong>:
                      <div className="mt-1 flex items-center gap-1.5 bg-black/45 border border-white/10 rounded px-2 py-1 font-mono text-[10px] text-white">
                        <span className="truncate flex-1">{window.location.origin}/auth/callback</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`${window.location.origin}/auth/callback`, 'redirect')}
                          className="text-[#D4AF37] hover:text-white flex-shrink-0"
                          title="Copy URL"
                        >
                          {copiedText === 'redirect' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </li>
                    <li>
                      Scroll down and click <strong className="text-white font-medium">Save</strong>.
                    </li>
                  </ol>
                </div>
                
                <div className="bg-[#B8932D]/10 border border-[#B8932D]/20 rounded-lg p-2.5 text-[11px] text-[#D4AF37] leading-tight">
                  <strong>Google Console step:</strong> Make sure you've also added your Supabase callback URL (<code className="text-white bg-white/5 px-1 rounded text-[9px]">https://&lt;project&gt;.supabase.co/auth/v1/callback</code>) to the Google Developer Console OAuth credentials list.
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {mode === 'forgot' && <p className="text-center text-xs text-[#94949C] mt-6"><button onClick={() => changeMode('signin')} className="text-[#D4AF37] font-bold">Back to sign in</button></p>}
      {(mode === 'signin' || mode === 'signup') && <p className="text-center text-xs text-[#94949C] mt-6">{mode === 'signup' ? 'Already have an account?' : 'New here?'} <button onClick={() => changeMode(mode === 'signup' ? 'signin' : 'signup')} className="text-[#D4AF37] font-bold">{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>}
    </section>
  </main>;
}
