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
  if (!supabase) {
    throw new Error('Sign in to use this feature.');
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sign in to use this feature.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
