import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function callbackSessionFromHash() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  return accessToken && refreshToken ? { access_token: accessToken, refresh_token: refreshToken } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const restoreSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const hashSession = callbackSessionFromHash();
      let result: { data: { session: Session | null }; error: Error | null };

      if (code) {
        result = await supabase.auth.exchangeCodeForSession(code);
      } else if (hashSession) {
        result = await supabase.auth.setSession(hashSession);
      } else {
        result = await supabase.auth.getSession();
      }

      if (!active) return;
      if (result.error) setError(result.error.message);
      setSession(result.data.session);
      if (code || hashSession) window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(false);
    };

    void restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(supabase),
    loading,
    session,
    user: session?.user ?? null,
    error,
    signOut: async () => {
      if (!supabase) return { error: new Error('Supabase is not configured.') };
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      return { error: signOutError };
    },
  }), [error, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
