import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

const JoinClass = () => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim() || !user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API()}/student/join-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ class_code: code.trim().toUpperCase(), student_name: user.name }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || 'שגיאה בהצטרפות');
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהצטרפות לכיתה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen py-12 px-4 flex items-center justify-center" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">הצטרף לכיתה</h1>
          <p className="text-muted-foreground text-sm">הכנס את קוד הכיתה שקיבלת מהמורה</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="text-lg font-bold text-foreground mb-1">הצטרפת בהצלחה!</p>
              <p className="text-sm text-muted-foreground">הבחינות של המורה יופיעו בדף הראשי.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="text-sm font-medium text-foreground mb-2 block">קוד כיתה</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-center text-2xl font-bold tracking-[0.3em] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary uppercase"
                />
              </div>

              {error && (
                <div className="mb-4 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>
              )}

              <button
                onClick={handleJoin}
                disabled={code.length < 6 || loading}
                className={`w-full py-3 rounded-xl font-semibold text-base transition-all ${
                  code.length >= 6 && !loading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin"/>
                    מצטרף...
                  </span>
                ) : 'הצטרף לכיתה'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinClass;