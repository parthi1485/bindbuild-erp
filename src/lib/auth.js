import { supabase } from './supabase.js';

let _me = null;

const ROLE_TITLES = {
  founder: 'Founder · Executive Access',
  admin: 'Administrator',
  sales: 'Sales',
  project_manager: 'Project Manager',
  designer: 'Designer',
  site_engineer: 'Site Engineer',
  finance: 'Finance',
  procurement: 'Procurement',
  hr: 'HR',
  viewer: 'Viewer'
};

/** Full identity from the dedicated Bind Builds ERP access model. */
export async function me({ force = false } = {}) {
  if (_me && !force) return _me;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const [{ data: profile, error: profileError }, { data: rpcRole, error: roleError }] =
    await Promise.all([
      supabase.from('profiles')
        .select('id,full_name,role,is_active')
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase.rpc('current_app_role')
    ]);

  if (profileError) throw profileError;
  if (roleError) throw roleError;
  if (!profile?.is_active || !rpcRole) return null;

  const role = rpcRole || profile.role || 'viewer';
  _me = {
    id: session.user.id,
    email: session.user.email,
    profile,
    role,
    roles: [role],
    name: profile.full_name || session.user.email?.split('@')[0] || 'User',
    title: ROLE_TITLES[role] || role.replaceAll('_', ' ')
  };
  return _me;
}

export const hasRole = (u, ...roles) =>
  !!u && roles.some(role => (u.roles || [u.role]).includes(role));

export const isAdmin = u => hasRole(u, 'founder', 'admin');
export const isStaff = u => !!u && !['viewer'].includes(u.role);

export async function requireAuth() {
  let u = null;
  try { u = await me(); } catch (error) { console.error(error); }
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
