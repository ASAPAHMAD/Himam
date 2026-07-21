// Deploy with: supabase functions deploy delete-account
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function issuedRecently(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.iat === 'number' && (Date.now() / 1000) - payload.iat < 10 * 60;
  } catch { return false; }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });
  const token = authorization.slice(7);
  if (!issuedRecently(token)) return new Response(JSON.stringify({ error: 'Please sign in again before deleting your account.' }), { status: 401, headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: corsHeaders });

  const admin = createClient(url, serviceRoleKey);
  const { data: files } = await admin.storage.from('avatars').list(user.id);
  if (files?.length) await admin.storage.from('avatars').remove(files.map(file => `${user.id}/${file.name}`));
  // profiles/user_progress rows for this user cascade-delete automatically
  // (both reference auth.users(id) on delete cascade — see the migration file),
  // so no manual table cleanup is needed here beyond the storage files above.
  const { error } = await admin.auth.admin.deleteUser(user.id, true);
  if (error) return new Response(JSON.stringify({ error: 'Unable to delete this account.' }), { status: 500, headers: corsHeaders });
  return new Response(JSON.stringify({ deleted: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
