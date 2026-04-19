import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/context/AuthContext';

// ─── Firebase error → Hebrew message ─────────────────────────────────────────

const toHebrewError = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'כתובת האימייל כבר בשימוש';
    case 'auth/invalid-email':
      return 'כתובת האימייל אינה תקינה';
    case 'auth/weak-password':
      return 'הסיסמה חלשה מדי — השתמש ב-6 תווים לפחות';
    case 'auth/network-request-failed':
      return 'בעיית חיבור לרשת. בדוק את החיבור לאינטרנט';
    default:
      return 'אירעה שגיאה. נסה שוב';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const Signup = () => {
  const { signup } = useAuth();
  const navigate   = useNavigate();

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
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (password.length < 6) {
      setError('הסיסמה חלשה מדי — השתמש ב-6 תווים לפחות');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, name, role);
      navigate('/', { replace: true });
    } catch (err) {
        const errorCode = (err as { code?: string })?.code ?? '';
        setError(toHebrewError(errorCode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10" dir="rtl">

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
          <h1 className="text-2xl font-bold text-foreground">יצירת חשבון</h1>
          <p className="text-muted-foreground mt-1 text-sm">הצטרף ל-ExamAI בחינם</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role toggle */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">אני</label>
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
                    {r === 'student' ? '🎓 תלמיד' : '📚 מורה'}
                  </button>
                ))}
              </div>
            </div>

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">שם מלא</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ישראל ישראלי"
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
              <label className="text-sm font-medium text-foreground">אימייל</label>
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
              <label className="text-sm font-medium text-foreground">סיסמה</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
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
              <label className="text-sm font-medium text-foreground">אימות סיסמה</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="הקלד שוב את הסיסמה"
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
                  יוצר חשבון...
                </span>
              ) : 'צור חשבון'}
            </button>

          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">יש לך כבר חשבון?</span>
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
            התחבר
          </Link>

        </div>
      </div>
    </div>
  );
};

export default Signup;
