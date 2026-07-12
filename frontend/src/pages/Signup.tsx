import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import GoogleSignInButton from '@/components/GoogleSignInButton';

// ─── Firebase error code → i18n key ──────────────────────────────────────────

const signupErrorKey = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'auth.errEmailInUse';
    case 'auth/invalid-email':
      return 'auth.errInvalidEmail';
    case 'auth/weak-password':
      return 'auth.errWeakPassword6';
    case 'auth/network-request-failed':
      return 'auth.errNetwork';
    default:
      return 'auth.errGeneric';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const Signup = () => {
  const { signup } = useAuth();
  const navigate   = useNavigate();
  const { t, isRTL } = useTranslation();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [role,     setRole]     = useState<UserRole>('student');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errWeakPassword6'));
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, role);
      navigate('/dashboard');
    } catch (err) {
      const errorCode = (err as { code?: string })?.code ?? '';
      setError(t(signupErrorKey(errorCode)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10" dir={isRTL ? 'rtl' : 'ltr'}>

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
          <h1 className="text-2xl font-bold text-foreground">{t('auth.signupHeading')}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('auth.signupTagline')}</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role toggle */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.roleLabel')}</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                {(['student', 'teacher'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`
                      py-2.5 rounded-lg text-sm font-semibold transition-all duration-150
                      ${role === r
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    {r === 'student' ? `🎓 ${t('auth.roleStudent')}` : `📚 ${t('auth.roleTeacher')}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.fullNameLabel')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                required
                disabled={loading}
                className="
                  w-full px-4 py-2.5 rounded-xl border border-input bg-background
                  text-sm text-foreground placeholder:text-muted-foreground
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  disabled:opacity-50 transition-all
                "
              />
            </div>

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
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholderMin')}
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

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('auth.confirmPasswordLabel')}</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={t('auth.confirmPlaceholder')}
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
              disabled={loading || !email || !password || !name || !confirm}
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
                  {t('auth.creatingAccount')}
                </span>
              ) : t('auth.createAccount')}
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
            <span className="text-xs text-muted-foreground">{t('auth.haveAccount')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Login link */}
          <Link
            to="/login"
            className="
              block w-full py-3 px-6 rounded-xl font-semibold text-sm text-center
              border-2 border-border text-foreground
              hover:bg-muted transition-colors
            "
          >
            {t('auth.loginButton')}
          </Link>

        </div>
      </div>
    </div>
  );
};

export default Signup;
