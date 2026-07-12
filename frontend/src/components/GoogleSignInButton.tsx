import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';

// Firebase auth error code → i18n key for the Google flow.
const googleErrorKey = (code: string): string | null => {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // user intentionally dismissed — no error to show
    case 'auth/popup-blocked':
      return 'auth.googleErrBlocked';
    case 'auth/operation-not-allowed':
      return 'auth.googleErrNotEnabled';
    case 'auth/account-exists-with-different-credential':
      return 'auth.googleErrAccountExists';
    case 'auth/network-request-failed':
      return 'auth.errNetwork';
    default:
      return 'auth.errGeneric';
  }
};

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
);

interface Props {
  disabled?: boolean;
}

/**
 * "Continue with Google" button. Handles the popup sign-in, maps errors to
 * friendly localized messages, and — for first-time Google users — prompts for
 * a teacher/student role before completing the account.
 */
const GoogleSignInButton = ({ disabled }: Props) => {
  const { loginWithGoogle, completeGoogleSignup } = useAuth();
  const { t, isRTL } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needRole, setNeedRole] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        setNeedRole(true); // show the role picker; navigation happens after choice
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const key = googleErrorKey(code);
      if (key) setError(t(key));
    } finally {
      setLoading(false);
    }
  };

  const pickRole = async (role: UserRole) => {
    setSavingRole(true);
    setError('');
    try {
      await completeGoogleSignup(role);
      navigate('/dashboard');
    } catch {
      setError(t('auth.errGeneric'));
      setSavingRole(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={disabled || loading}
        className="
          w-full py-3 px-6 rounded-xl font-semibold text-sm
          border-2 border-border text-foreground bg-background
          hover:bg-muted transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-3
        "
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {loading ? t('auth.connectingGoogle') : t('auth.googleButton')}
      </button>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* First-time Google user → choose a role before entering the app */}
      {needRole && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <h2 className="text-lg font-bold text-foreground mb-1">{t('auth.chooseRoleTitle')}</h2>
            <p className="text-sm text-muted-foreground mb-5">{t('auth.chooseRoleSubtitle')}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => pickRole('teacher')}
                disabled={savingRole}
                className="py-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all font-semibold text-foreground disabled:opacity-50"
              >
                📚 {t('auth.roleTeacher')}
              </button>
              <button
                onClick={() => pickRole('student')}
                disabled={savingRole}
                className="py-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all font-semibold text-foreground disabled:opacity-50"
              >
                🎓 {t('auth.roleStudent')}
              </button>
            </div>
            {savingRole && <p className="text-xs text-muted-foreground mt-4">{t('auth.savingRole')}</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleSignInButton;
