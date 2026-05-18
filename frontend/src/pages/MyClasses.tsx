import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Question } from '@/types/questions';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';
const authH = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonH = (token: string) => ({ 'Content-Type': 'application/json', ...authH(token) });

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassExam {
  id: string; title: string; questions: Question[];
  question_type: string; visible: boolean;
  open_at: string | null; close_at: string | null; created_at: string;
  my_submission?: Record<string, unknown> | null;
}
interface StudentClass { id: string; name: string; code: string; teacher_uid: string; created_at: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDT = (iso: string) => new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const examStatus = (exam: ClassExam) => {
  if (!exam.visible) return 'hidden';
  const now = Date.now();
  if (exam.open_at && now < new Date(exam.open_at).getTime()) return 'scheduled';
  if (exam.close_at && now > new Date(exam.close_at).getTime()) return 'closed';
  return 'open';
};

const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />;

const PreviousSubmission = ({ exam, submission, onBack }: {
  exam: ClassExam;
  submission: { answers: string[]; submitted_at: string; grade_result: { score: number; feedback: { points: number; explanation: string }[] } | null };
  onBack: () => void;
}) => (
  <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
    <div className="max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{exam.title}</h1>
            <p className="text-sm text-green-600 font-medium mt-0.5">✓ הוגשה ב-{fmtDT(submission.submitted_at)}</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted">חזרה</button>
        </div>
        {submission.grade_result && (
          <div className="mt-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
            <p className="text-sm font-semibold text-foreground">
              ציון: <span className="text-primary">{submission.grade_result.score} / {exam.questions.length}</span>
              <span className="text-muted-foreground mr-2">({Math.round((submission.grade_result.score / exam.questions.length) * 100)}%)</span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {exam.questions.map((q, i) => {
          const fb = submission.grade_result?.feedback?.[i];
          const pts = fb?.points ?? null;
          const bg = pts === 1 ? 'border-green-200 bg-green-50' : pts === 0 ? 'border-red-200 bg-red-50' : pts !== null ? 'border-yellow-200 bg-yellow-50' : 'border-border bg-card';
          return (
            <div key={i} className={`p-5 rounded-2xl border-2 ${bg}`}>
              <div className="flex items-start gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <p className="text-foreground font-medium">{q.question}</p>
                {pts !== null && (
                  <span className={`mr-auto flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${pts === 1 ? 'bg-green-100 text-green-700' : pts === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {pts}/1
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-1">תשובתך: <span className="text-foreground font-medium">{submission.answers[i] || '—'}</span></p>
              {fb?.explanation && <p className="text-xs text-muted-foreground italic mt-1">{fb.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ── Exam Taking Screen ────────────────────────────────────────────────────────

const ExamScreen = ({ exam, token, studentName, onDone }: {
  exam: ClassExam; token: string; studentName: string; onDone: () => void;
}) => {
  const [answers, setAnswers] = useState<string[]>(Array(exam.questions.length).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = answers.every(a => a.trim() !== '');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`${API()}/student/class-exam/${exam.id}/submit`, {
        method: 'POST',
        headers: jsonH(token),
        body: JSON.stringify({ answers, student_name: studentName }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || 'שגיאה בהגשת הבחינה');
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">הבחינה הוגשה בהצלחה!</h2>
          <p className="text-muted-foreground mb-6">תשובותיך נשמרו. המורה יבדוק אותן בקרוב.</p>
          <button onClick={onDone} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
            חזרה לכיתה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{exam.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{exam.questions.length} שאלות</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {answers.filter(a => a.trim()).length} / {exam.questions.length} נענו
              </span>
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(answers.filter(a => a.trim()).length / exam.questions.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>
        )}

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {exam.questions.map((q, i) => {
            const effectiveType = exam.question_type === 'merged' ? (q.type || 'open') : exam.question_type;
            return (
              <div key={i} className={`bg-card border-2 rounded-2xl p-5 transition-all ${answers[i]?.trim() ? 'border-primary/20' : 'border-border'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-foreground font-medium leading-relaxed">{q.question}</p>
                </div>

                {effectiveType === 'open' && (
                  <textarea
                    value={answers[i]}
                    onChange={e => setAnswers(prev => { const a = [...prev]; a[i] = e.target.value; return a; })}
                    placeholder="כתוב את תשובתך כאן..."
                    rows={4}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    dir="rtl"
                  />
                )}

                {effectiveType === 'yesno' && (
                  <div className="flex gap-3">
                    {['כן', 'לא'].map(opt => (
                      <button key={opt} onClick={() => setAnswers(prev => { const a = [...prev]; a[i] = opt; return a; })}
                        className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${answers[i] === opt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {effectiveType === 'multiple' && (
                  <div className="space-y-2">
                    {Object.entries(q.options ?? {}).map(([key, val]) => (
                      <button key={key} onClick={() => setAnswers(prev => { const a = [...prev]; a[i] = key; return a; })}
                        className={`w-full text-right px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${answers[i] === key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                        <span className="font-bold ml-2">{key}.</span> {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
            allAnswered && !submitting
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {submitting ? <><Spinner /> מגיש...</> : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              הגש בחינה
            </>
          )}
        </button>
        {!allAnswered && (
          <p className="text-xs text-muted-foreground text-center mt-2">יש לענות על כל השאלות לפני ההגשה</p>
        )}
      </div>
    </div>
  );
};

// ── Exam Card ─────────────────────────────────────────────────────────────────

const ExamCard = ({ exam, onTake, isSubmitted, submission }: {
  exam: ClassExam; onTake: () => void; isSubmitted: boolean;
  submission?: Record<string, unknown>;
}) => {
  const status = examStatus(exam);
  const isOpen = status === 'open';
  const canView = isOpen || isSubmitted;

  const statusBadge = (
    <div className="flex gap-1 flex-wrap justify-end">
      {isSubmitted && (
        <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 font-medium">✓ הוגש</span>
      )}
      {{
        hidden:    <span className="text-xs px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">מוסתר</span>,
        scheduled: <span className="text-xs px-2 py-0.5 rounded-lg bg-yellow-100 text-yellow-700">ממתין לפתיחה</span>,
        closed:    <span className="text-xs px-2 py-0.5 rounded-lg bg-red-100 text-red-700">נסגר</span>,
        open:      <span className="text-xs px-2 py-0.5 rounded-lg bg-green-100 text-green-700">פתוח</span>,
      }[status]}
    </div>
  );

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${isOpen ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-foreground text-sm">{exam.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{exam.questions?.length ?? 0} שאלות · {fmt(exam.created_at)}</p>
        </div>
        {statusBadge}
      </div>

      {/* Grade status — above dates */}
      {isSubmitted && (() => {
        const gradeResult = submission?.grade_result as { score: number } | null;
        const totalQ = exam.questions?.length ?? 0;
        if (gradeResult && totalQ > 0) {
          const pct = Math.round((gradeResult.score / totalQ) * 100);
          const clr = pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-yellow-700' : 'text-red-700';
          return (
            <p className={`text-xs font-semibold mb-1 ${clr}`}>
              ציון: {gradeResult.score}/{totalQ} ({pct}%)
            </p>
          );
        }
        return (
          <p className="text-xs text-muted-foreground mb-1">ציון: ממתין לבדיקה</p>
        );
      })()}

      {/* Always show times or timeless */}
      <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
        {exam.open_at 
          ? <p>📅 פתיחה: {fmtDT(exam.open_at)}</p>
          : null}
        {exam.close_at
          ? <p>🔒 סגירה: {fmtDT(exam.close_at)}</p>
          : null}
        {!exam.open_at && !exam.close_at && (
          <p className="text-primary/70 font-medium">⏳ בחינה ללא מגבלת זמן</p>
        )}
      </div>

      {canView && (
        <button onClick={onTake}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            isSubmitted
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}>
          {isSubmitted ? '👁 צפה בתשובותיך' : 'פתח בחינה →'}
        </button>
      )}
    </div>
  );
};

// ── Class Detail ──────────────────────────────────────────────────────────────

const ClassDetail = ({ cls, token, studentName, onBack }: {
  cls: StudentClass; token: string; studentName: string; onBack: () => void;
}) => {
  const [exams, setExams] = useState<ClassExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ClassExam | null>(null);
  const [previousSubmission, setPreviousSubmission] = useState<Record<string, unknown> | null>(null);
  const [checkingSubmission, setCheckingSubmission] = useState(false);
  const [submittedExams, setSubmittedExams] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API()}/student/classes/${cls.id}/exams`, { headers: authH(token) });
        if (!r.ok) throw new Error('שגיאה בטעינת הבחינות');
        const d = await r.json();
        const loadedExams = d.exams ?? [];
        setExams(loadedExams);
        const map: Record<string, Record<string, unknown>> = {};
        loadedExams.forEach((exam: ClassExam) => {
          if (exam.my_submission) map[exam.id] = exam.my_submission;
        });
        setSubmittedExams(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה');
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [cls.id, token]);

  const handleOpenExam = async (exam: ClassExam) => {
    if (submittedExams[exam.id]) {
      setActiveExam(exam);
      setPreviousSubmission(submittedExams[exam.id]);
      return;
    }
    setCheckingSubmission(true);
    try {
      const r = await fetch(`${API()}/student/class-exam/${exam.id}/my-submission`, { headers: authH(token) });
      const d = await r.json();
      setActiveExam(exam);
      setPreviousSubmission(d.submitted ? d.submission : null);
    } catch {
      setActiveExam(exam);
      setPreviousSubmission(null);
    } finally {
      setCheckingSubmission(false);
    }
  };

  if (activeExam && previousSubmission) {
    return (
      <PreviousSubmission
        exam={activeExam}
        submission={previousSubmission as { answers: string[]; submitted_at: string; grade_result: { score: number; feedback: { points: number; explanation: string }[] } | null }}
        onBack={() => { setActiveExam(null); setPreviousSubmission(null); }}
      />
    );
  }

  if (activeExam) {
    return (
      <ExamScreen
        exam={activeExam}
        token={token}
        studentName={studentName}
        onDone={() => setActiveExam(null)}
      />
    );
  }

  const open = exams.filter(e => examStatus(e) === 'open');
  const other = exams.filter(e => examStatus(e) !== 'open');

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          חזרה לכיתות
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{cls.name}</h2>
          <p className="text-sm text-muted-foreground">קוד: <span className="font-bold text-primary">{cls.code}</span></p>
        </div>
      </div>

      {error && <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : exams.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">📝</p>
          <p className="font-medium">אין בחינות עדיין</p>
          <p className="text-sm">המורה טרם הוסיף בחינות לכיתה זו</p>
        </div>
      ) : (
        <div className="space-y-5">
          {open.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">✅ בחינות פתוחות ({open.length})</p>
              <div className="space-y-3">
                {open.map(e => <ExamCard key={e.id} exam={e} onTake={() => handleOpenExam(e)} isSubmitted={!!submittedExams[e.id]} submission={submittedExams[e.id]} />)}
              </div>
            </div>
          )}
          {other.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">בחינות נוספות ({other.length})</p>
              <div className="space-y-3">
               {other.map(e => <ExamCard key={e.id} exam={e} onTake={() => handleOpenExam(e)} isSubmitted={!!submittedExams[e.id]} submission={submittedExams[e.id]} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Join Modal ────────────────────────────────────────────────────────────────

const JoinModal = ({ token, userName, onJoined, onClose }: {
  token: string; userName: string; onJoined: (cls: StudentClass) => void; onClose: () => void;
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (code.length < 6 || !token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API()}/classes/join`, {
        method: 'POST', headers: jsonH(token),
        body: JSON.stringify({ code: code.trim().toUpperCase(), name: userName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'שגיאה בהצטרפות');
      onJoined(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהצטרפות לכיתה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()} dir="rtl">
        <h2 className="text-lg font-bold text-foreground mb-1">הצטרף לכיתה</h2>
        <p className="text-sm text-muted-foreground mb-5">הזן את קוד הכיתה שקיבלת מהמורה</p>
        <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoin()} placeholder="ABC123" maxLength={6}
          className="w-full px-4 py-3 rounded-xl border border-input bg-background text-center text-2xl font-bold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3 uppercase" />
        {error && <div className="mb-3 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}
        <div className="flex gap-3">
          <button onClick={handleJoin} disabled={code.length < 6 || loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Spinner /> מצטרף...</> : 'הצטרף'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const MyClasses = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedClass, setSelectedClass] = useState<StudentClass | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API()}/student/classes`, { headers: authH(user.token) });
      if (!r.ok) throw new Error('שגיאה');
      const d = await r.json();
      setClasses(d.classes ?? []);
    } catch { setError('שגיאה בטעינת הכיתות'); }
    finally { setLoading(false); }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  if (selectedClass) {
    return (
      <div className="bg-background min-h-screen py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <ClassDetail cls={selectedClass} token={user?.token ?? ''} studentName={user?.name ?? 'תלמיד'} onBack={() => setSelectedClass(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto">
        {showJoin && (
          <JoinModal token={user?.token ?? ''} userName={user?.name ?? 'תלמיד'}
            onJoined={cls => {
              if (!cls?.id) { setShowJoin(false); load(); return; }
              setClasses(prev => prev.find(c => c.id === cls.id) ? prev : [cls, ...prev]);
              setShowJoin(false);
            }}
            onClose={() => setShowJoin(false)} />
        )}

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">הכיתות שלי</h1>
            <p className="text-muted-foreground">כל הכיתות שאתה רשום בהן</p>
          </div>
          <button onClick={() => setShowJoin(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 shadow-md shadow-primary/20 transition-colors">
            + הצטרף לכיתה
          </button>
        </div>

        {error && <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">🏫</div>
            <h3 className="text-xl font-bold text-foreground mb-2">אינך רשום לאף כיתה</h3>
            <p className="text-muted-foreground max-w-xs mb-6">קבל קוד הצטרפות מהמורה שלך והצטרף לכיתה.</p>
            <button onClick={() => setShowJoin(true)} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
              + הצטרף לכיתה ראשונה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classes.map((cls, index) => (
              <div key={cls.id ?? index} onClick={() => setSelectedClass(cls)}
                className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{cls.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">הצטרפת ב {fmt(cls.created_at)}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold tracking-widest">{cls.code}</span>
                </div>
                <p className="text-xs text-muted-foreground">לחץ לצפייה בבחינות ←</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyClasses;
