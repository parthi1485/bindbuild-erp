import { supabase } from '../lib/supabase.js';
import { toast, fail } from '../lib/ui.js';

const $ = s => document.querySelector(s);
const nextUrl = new URLSearchParams(location.search).get('next') || '/dashboard.html';

/* already signed in? skip the form */
const { data: { session } } = await supabase.auth.getSession();
if (session) location.replace(nextUrl);

/* ---------- theme ---------- */
$('#themeToggle')?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('bindbuild.theme', next);
});

/* ---------- show / hide password ---------- */
$('#togglePass')?.addEventListener('click', () => {
  const f = $('#password');
  f.type = f.type === 'password' ? 'text' : 'password';
});

/* ---------- view switching (login / forgot / done) ---------- */
function showView(name) {
  document.querySelectorAll('[data-view]').forEach(v => {
    v.classList.toggle('is-active', v.dataset.view === name);
  });
}
document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.go));
});

/* ---------- sign in ---------- */
$('#loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn   = $('#loginBtn');
  const email = $('#email').value.trim();
  const pass  = $('#password').value;

  if (!email || !pass) return toast('Enter your email and password', 'err');

  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Signing in…';

  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error) {
    btn.disabled = false;
    btn.innerHTML = label;
    return toast(
      error.message.includes('Invalid login')
        ? 'Email or password is incorrect'
        : error.message,
      'err'
    );
  }
  location.replace(nextUrl);
});

/* ---------- password reset ---------- */
$('#forgotForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#remail').value.trim();
  if (!email) return toast('Enter your email', 'err');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/reset.html`
  });
  if (error) return fail(error);
  showView('done');
  toast('Reset link sent — check your inbox');
});

/* SSO button is inert until the provider is configured in Supabase */
document.querySelectorAll('[data-sso]').forEach(b => {
  b.addEventListener('click', () =>
    toast('Google sign-in not enabled yet — use email and password', 'err'));
});
