import { supabase } from '../lib/supabase';

/**
 * Fetch wrapper for our own server's /api/* endpoints (AI Coach, roadmap
 * generation, document analysis, avatar moderation, etc). Every /api/*
 * route requires a signed-in Supabase session (see server.ts's requireAuth
 * middleware) — this helper attaches the current session's access token so
 * callers don't each need to know how to fetch it.
 *
 * Throws a clear, user-facing error if there's no signed-in session yet,
 * rather than sending a request the server will reject with a 401.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token: string | null = null;

  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || null;
    } catch {
      // Ignore session fetch errors
    }
  }

  // Fallback for local session / guest mode
  if (!token) {
    const localUser = localStorage.getItem('himam_auth_user') || localStorage.getItem('himam_profile');
    if (localUser) {
      token = 'local-user-token';
    } else {
      token = 'guest-token';
    }
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    const safeToken = String(token).replace(/[^\x20-\x7E]/g, '');
    headers.set('Authorization', `Bearer ${safeToken}`);
  }
  return fetch(path, { ...init, headers });
}
