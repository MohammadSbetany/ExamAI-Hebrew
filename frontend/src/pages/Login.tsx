import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import GoogleSignInButton from '@/components/GoogleSignInButton';

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ─── Firebase error code → i18n key ──────────────────────────────────────────

const authErrorKey = (code: string): string => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'auth.errInvalidCredentials';
    case 'auth/invalid-email':
      return 'auth.errInvalidEmail';
    case 'auth/too-many-requests':
      return 'auth.errTooManyRequests';
    case 'auth/network-request-failed':
      return 'auth.errNetwork';
    default:
      return 'auth.errGeneric';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const Login = () => {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const { t, isRTL } = useTranslation();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation before hitting Firebase
    const trimmedEmail = email.trim();
    if (!trimmedEmail)            { setError(t('auth.emailRequired')); return; }
    if (!isValidEmail(trimmedEmail)) { setError(t('auth.errInvalidEmail')); return; }
    if (!password)                { setError(t('auth.passwordRequired')); return; }

    setLoading(true);
    try {
      await login(trimmedEmail, password);
      navigate('/dashboard');
    } catch (err) {
      const errorCode = (err as { code?: string })?.code ?? '';
      setError(t(authErrorKey(errorCode)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl mb-4 shadow-lg shadow-primary/25">
            <img src="/favicon.ico" alt="ExamAI" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('auth.welcome')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth.loginSubtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="
                  w-full px-4 py-2.5 rounded-xl border border-input bg-background
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  disabled:opacity-50 transition-all
                "
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.passwordLabel')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="
                    w-full px-4 py-2.5 pl-11 rounded-xl border border-input bg-background
                    text-sm text-foreground placeholder:text-muted-foreground
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    disabled:opacity-50 transition-all
                  "
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="
                w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200
                bg-primary text-primary-foreground
                hover:bg-primary/90 shadow-md shadow-primary/20
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              "
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.loggingIn')}
                </span>
              ) : t('auth.loginButton')}
            </button>

          </form>

          {/* "or" divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t('auth.orDivider')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google sign-in */}
          <GoogleSignInButton disabled={loading} />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t('auth.noAccount')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Signup link */}
          <Link
            to="/signup"
            className="
              block w-full py-3 px-6 rounded-xl font-semibold text-sm text-center
              border-2 border-border text-foreground
              hover:bg-muted transition-colors
            "
          >
            {t('auth.signupNow')}
          </Link>

        </div>
      </div>
    </div>
  );
};

export default Login;
