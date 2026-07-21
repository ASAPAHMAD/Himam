import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

// Sanitize URL by removing trailing slashes or /rest/v1 subpaths commonly added in environment configs
let url = rawUrl;
if (url) {
  url = url.trim();
  if (url.endsWith('/rest/v1/')) {
    url = url.slice(0, -9);
  } else if (url.endsWith('/rest/v1')) {
    url = url.slice(0, -8);
  }
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
}

/**
 * Browser client only. The publishable/anon key is intentionally safe to expose;
 * never put a service-role key in a Vite environment variable.
 *
 * `supabase` is `null` when env vars aren't configured — every call site checks
 * this and falls back to local-only (signed-out) behavior, so the app keeps
 * working exactly as it did in Phase 1 for anyone not using Supabase at all.
 */
export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
