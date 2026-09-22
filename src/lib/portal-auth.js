import { supabase } from './supabase.js';

export async function portalIdentity(type){
  const {data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(!session)return {session:null,staff:false,members:[]};

  const roleRes=await supabase.rpc('current_app_role');
  const role=roleRes.error?null:roleRes.data;
  if(role)return {session,staff:true,role,members:[]};

  await supabase.rpc('claim_portal_access',{p_portal_type:type});
  const m=await supabase.from('portal_memberships')
    .select('*').eq('portal_type',type).eq('user_id',session.user.id).eq('status','active')
    .order('created_at');
  if(m.error)throw m.error;
  return {session,staff:false,role:null,members:m.data||[]};
}

export async function sendPortalMagicLink(email,type){
  const clean=String(email||'').trim().toLowerCase();
  if(!clean)throw new Error('Email required');
  const page=type==='client'?'client-portal.html':'vendor-portal.html';
  const {error}=await supabase.auth.signInWithOtp({
    email:clean,
    options:{shouldCreateUser:true,emailRedirectTo:location.origin+'/'+page}
  });
  if(error)throw error;
  return clean;
}

export async function portalSignOut(){
  await supabase.auth.signOut();
  location.replace(location.pathname);
}

export function portalUserLabel(identity){
  return identity?.session?.user?.email||'Portal user';
}
