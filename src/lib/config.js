/* Dedicated Bind Builds ERP Supabase connection.
   The publishable key is intentionally public: it ships inside the client
   bundle no matter what. Row Level Security is the security boundary, not
   this string. Override per-environment with Vercel env vars if you prefer.
   Never put the service_role key in this repo. */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://glywgbhuqrfxgowovylo.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_TKMCFIasqTeCyG98OJgjPQ_swiBI1eq';
