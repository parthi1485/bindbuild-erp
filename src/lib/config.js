/* Supabase connection — Mumbai (ap-south-1).
   The publishable key is intentionally public: it ships inside the client
   bundle no matter what. Row Level Security is the security boundary, not
   this string. Override per-environment with Vercel env vars if you prefer.
   Never put the service_role key in this repo. */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://eyfccifvzhdgjrhnxsrm.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_9WxWVdQTXXbH2W1_G2ClAA_rIfvRn5c';
