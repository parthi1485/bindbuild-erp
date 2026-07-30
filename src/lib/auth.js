import { supabase } from './supabase.js';

let _me = null;

/** Full identity: session user + profile row + role list. */
export async function me({ force = false } = {}) {
  if (_me && !force) return _me;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', session.user.id)
  ]);

  _me = {
    id:      session.user.id,
    email:   session.user.email,
    profile: profile ?? null,
    roles:   (roleRows ?? []).map(r => r.role),
    name:    profile?.full_name || session.user.email?.split('@')[0] || 'User',
    title:   profile?.job_title || 'Team member'
  };
  return _me;
}

export const hasRole   = (u, ...r) => !!u && r.some(x => u.roles.includes(x));
export const isAdmin   = u => hasRole(u, 'owner', 'admin');
export const isStaff   = u => !!u && u.roles.some(r => !['client','vendor'].includes(r));

/** Redirect to login if not authenticated. Returns identity when it is. */
export async function requireAuth() {
  const u = await me();
  if (!u) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace(`/login.html?next=${next}`);
    return null;
  }
  return u;
}

export async function signOut() {
  await supabase.auth.signOut();
  _me = null;
  location.replace('/login.html');
}
