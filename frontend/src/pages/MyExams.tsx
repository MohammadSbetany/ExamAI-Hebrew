import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { listExams, deleteExam, saveExam, type ExamRecord } from '@/lib/examsApi';
import { gradeLocally } from '@/utils/gradingUtils';
import { exportBlankPdf, exportGradedPdf, exportBlankDocx, exportGradedDocx } from '@/lib/exportUtils';
import type { Question, GradeResult } from '@/types/questions';

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

const pctColor = (pct: number) => {
  if (pct >= 80) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', ring: 'ring-green-400' };
  if (pct >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200', ring: 'ring-yellow-400' };
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', ring: 'ring-red-400' };
};

const typeLabel: Record<string, string> = {
  open: 'פתוחות', yesno: 'כן/לא', multiple: 'רב ברירה', merged: 'מיזוג',
};

const examTypeBadge: Record<string, { label: string; cls: string }> = {
  generated: { label: '✨ נוצרה', cls: 'bg-primary/10 text-primary' },
  digitized:  { label: '📄 דיגיטציה', cls: 'bg-purple-100 text-purple-700' },
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">אין בחינות שמורות עדיין</h3>
    <p className="text-muted-foreground text-sm max-w-xs">
      צור בחינה חדשה או ייבא בחינה קיימת מהדף הראשי — היא תישמר כאן אוטומטית.
    </p>
  </div>
);

// ── Exam Detail (solve + grade + export) ─────────────────────────────────────

interface ExamDetailProps {
  exam: ExamRecord;
  onBack: () => void;
  onGraded: (updated: ExamRecord) => void;
}

const ExamDetail = ({ exam, onBack, onGraded }: ExamDetailProps) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<string[]>(exam.answers?.length ? exam.answers : Array(exam.questions.length).fill(''));
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(exam.grade_result);
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const questions: Question[] = exam.questions;
  const allAnswered = answers.length === questions.length && answers.every(a => a.trim() !== '');
  const questionType = exam.question_type;

  const handleAnswerChange = (i: number, val: string) => {
    setAnswers(prev => { const a = [...prev]; a[i] = val; return a; });
  };

  // ── Export Dropdown ───────────────────────────────────────────────────────────

interface ExportDropdownProps {
  label: string;
  variant: 'blank' | 'graded';
  onExport: (fmt: 'pdf' | 'docx') => void;
  loading: string | null;
}

const ExportDropdown = ({ label, variant, onExport, loading }: ExportDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isLoading = loading?.startsWith(variant) ?? false;
  const isGraded = variant === 'graded';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isLoading}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 ${
          isGraded
            ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
            : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
        }`}
      >
        {isLoading
          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          : <DownloadIcon />}
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-36 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {(['pdf', 'docx'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => { onExport(fmt); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
            >
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {fmt.toUpperCase()}
              </span>
              {fmt === 'pdf' ? 'קובץ PDF' : 'קובץ Word'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

  const handleGrade = async () => {
    setIsGrading(true);
    setError(null);
    try {
      // Local grading for simple types
      if (questionType === 'multiple' || questionType === 'yesno') {
        const result = gradeLocally(questions, answers, questionType as 'multiple' | 'yesno');
        setGradeResult(result);
        await persistGrade(result);
        return;
      }
      // AI grading for open / merged / digitized
      const r = await fetch(`${API()}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user?.token}` },
        body: JSON.stringify({ questions, answers, question_type: questionType }),
      });
      if (!r.ok) throw new Error('שגיאה בבדיקת התשובות');
      const data: GradeResult = await r.json();
      setGradeResult(data);
      await persistGrade(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בבדיקת התשובות');
    } finally {
      setIsGrading(false);
    }
  };

  const persistGrade = async (result: GradeResult) => {
    if (!user?.token) return;
    setIsSaving(true);
    try {
      await saveExam(user.token, {
        title: exam.title,
        exam_type: exam.exam_type,
        question_type: exam.question_type,
        questions,
        answers,
        grade_result: result,
      });
      onGraded({ ...exam, answers, grade_result: result, score: result.score });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx', type: 'blank' | 'graded') => {
    setExportLoading(`${type}-${format}`);
    try {
      if (type === 'blank') {
        if (format === 'pdf') await exportBlankPdf(questions);
        else await exportBlankDocx(questions);
      } else {
        if (!gradeResult) return;
        if (format === 'pdf') await exportGradedPdf(questions, gradeResult);
        else await exportGradedDocx(questions, gradeResult);
      }
    } finally {
      setExportLoading(null);
    }
  };

  const pct = gradeResult ? Math.round((gradeResult.score / questions.length) * 100) : null;
  const colors = pct !== null ? pctColor(pct) : null;

  return (
    <div className="max-w-3xl mx-auto" dir="rtl">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BackIcon /> חזרה לרשימה
        </button>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <ExportDropdown
            label="ייצוא בחינה"
            variant="blank"
            onExport={fmt => handleExport(fmt, 'blank')}
            loading={exportLoading}
          />
          {gradeResult && (
            <ExportDropdown
              label="דוח ציון"
              variant="graded"
              onExport={fmt => handleExport(fmt, 'graded')}
              loading={exportLoading}
            />
          )}
        </div>
      </div>

      {/* Exam header */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{exam.title}</h2>
            <p className="text-sm text-muted-foreground">{formatDate(exam.created_at)}</p>
          </div>
          {pct !== null && colors && (
            <div className={`px-5 py-3 rounded-xl border ${colors.bg} ${colors.border} text-center min-w-[100px]`}>
              <p className={`text-2xl font-bold ${colors.text}`}>{pct}%</p>
              <p className={`text-xs ${colors.text}`}>{gradeResult?.score} / {questions.length}</p>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${examTypeBadge[exam.exam_type]?.cls ?? 'bg-muted text-muted-foreground'}`}>
            {examTypeBadge[exam.exam_type]?.label ?? exam.exam_type}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
            {typeLabel[questionType] ?? questionType}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
            {questions.length} שאלות
          </span>
          {gradeResult
            ? <span className="text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 font-medium">✓ נבדק</span>
            : <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 font-medium">⏳ ממתין לפתרון</span>
          }
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>
      )}

      {/* Questions */}
      <ol className="space-y-4 mb-6">
        {questions.map((q, i) => {
          const fb = gradeResult?.feedback[i];
          const pts = fb?.points;
          const effectiveType = questionType === 'merged' ? (q.type || 'open') : questionType;
          const qBg = pts === 1 ? 'border-green-200 bg-green-50/50' : pts === 0.5 ? 'border-yellow-200 bg-yellow-50/50' : pts === 0 ? 'border-red-200 bg-red-50/50' : 'border-border bg-card';

          return (
            <li key={i} className={`border rounded-2xl p-5 transition-all ${qBg}`}>
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1 flex justify-between items-start gap-2">
                  <p className="text-foreground leading-relaxed font-medium">{q.question}</p>
                  {fb && (
                    <span className={`flex-shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg ${pts === 1 ? 'bg-green-100 text-green-700' : pts === 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {pts}/1
                    </span>
                  )}
                </div>
              </div>

              {/* Answer input */}
              {effectiveType === 'open' && (
                <textarea
                  value={answers[i] || ''}
                  onChange={e => handleAnswerChange(i, e.target.value)}
                  disabled={!!gradeResult || isGrading}
                  placeholder="כתוב את תשובתך כאן..."
                  className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-70"
                  dir="rtl"
                />
              )}

              {effectiveType === 'yesno' && (
                <div className="flex gap-3">
                  {['כן', 'לא'].map(opt => (
                    <button key={opt} onClick={() => handleAnswerChange(i, opt)} disabled={!!gradeResult || isGrading}
                      className={`px-8 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${answers[i] === opt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {effectiveType === 'multiple' && (
                <div className="space-y-2">
                  {['א', 'ב', 'ג', 'ד'].map(opt => (
                    <button key={opt} onClick={() => handleAnswerChange(i, opt)} disabled={!!gradeResult || isGrading}
                      className={`w-full text-right px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${answers[i] === opt ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      <span className="font-bold ml-2">{opt}.</span> {q.options?.[opt] || ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Feedback */}
              {fb && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    התשובה הנכונה: <span className="text-green-700 font-normal">{q.answer}</span>
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{fb.explanation}</p>
                  {effectiveType === 'open' && fb.covered_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-1">נקודות שכוסו:</p>
                      {fb.covered_points.map((p, j) => <p key={j} className="text-xs text-green-600">✓ {p}</p>)}
                    </div>
                  )}
                  {effectiveType === 'open' && fb.missed_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1">נקודות חסרות:</p>
                      {fb.missed_points.map((p, j) => <p key={j} className="text-xs text-red-600">✗ {p}</p>)}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Submit button */}
      {!gradeResult && (
        <button
          onClick={handleGrade}
          disabled={!allAnswered || isGrading || isSaving}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
            allAnswered && !isGrading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isGrading ? (
            <><span className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />בודק תשובות...</>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
              </svg>
              בדוק את הפתרון שלי
            </>
          )}
        </button>
      )}

      {/* Final score banner */}
      {gradeResult && colors && (
        <div className={`mt-6 p-5 rounded-2xl border-2 ${colors.bg} ${colors.border} text-center`}>
          <p className={`text-3xl font-bold ${colors.text} mb-1`}>{pct}%</p>
          <p className={`text-sm ${colors.text}`}>{gradeResult.score} / {questions.length} שאלות נכונות</p>
          {isSaving && <p className="text-xs text-muted-foreground mt-2">שומר תוצאה...</p>}
        </div>
      )}
    </div>
  );
};

// ── Exam Card ─────────────────────────────────────────────────────────────────

interface ExamCardProps {
  exam: ExamRecord;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const ExamCard = ({ exam, onSelect, onDelete, isDeleting }: ExamCardProps) => {
  const pct = exam.score !== null && exam.total > 0 ? Math.round((exam.score / exam.total) * 100) : null;
  const colors = pct !== null ? pctColor(pct) : null;
  const badge = examTypeBadge[exam.exam_type] ?? { label: exam.exam_type, cls: 'bg-muted text-muted-foreground' };

  return (
    <div onClick={onSelect} className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 ml-2">
          <h3 className="font-semibold text-foreground truncate text-base group-hover:text-primary transition-colors">{exam.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(exam.created_at)}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={isDeleting}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          title="מחק"
        >
          {isDeleting
            ? <span className="w-4 h-4 block rounded-full border-2 border-current border-t-transparent animate-spin" />
            : <TrashIcon />}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${badge.cls}`}>{badge.label}</span>
        <span className="text-xs px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">{typeLabel[exam.question_type] ?? exam.question_type}</span>
        <span className="text-xs px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium">{exam.total} שאלות</span>
      </div>

      {pct !== null && colors ? (
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
          <span className={`text-sm font-bold ${colors.text}`}>{exam.score} / {exam.total}</span>
          <span className={`text-sm font-bold ${colors.text}`}>{pct}%</span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed border-border">
          <span className="text-xs text-muted-foreground">ממתין לפתרון</span>
          <span className="text-xs font-medium text-primary">לחץ לפתרון ←</span>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const MyExams = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'graded' | 'pending'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ExamRecord | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    try { setExams(await listExams(user.token)); }
    catch { setError('שגיאה בטעינת הבחינות'); }
    finally { setLoading(false); }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!user?.token || !window.confirm('האם למחוק בחינה זו?')) return;
    setDeletingId(id);
    try {
      await deleteExam(user.token, id);
      setExams(prev => prev.filter(e => e.id !== id));
      if (activeExam?.id === id) setActiveExam(null);
    } catch { setError('שגיאה במחיקת הבחינה'); }
    finally { setDeletingId(null); }
  };

  const handleGraded = (updated: ExamRecord) => {
    setExams(prev => prev.map(e => e.id === updated.id ? updated : e));
    setActiveExam(updated);
  };

  const filtered = exams.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'graded' && e.grade_result !== null) || (filter === 'pending' && e.grade_result === null);
    return matchSearch && matchFilter;
  });

  // ── Detail view ──
  if (activeExam) {
    return (
      <div className="bg-background min-h-screen py-10 px-4">
        <ExamDetail
          exam={activeExam}
          onBack={() => setActiveExam(null)}
          onGraded={handleGraded}
        />
      </div>
    );
  }

  // ── Gallery view ──
  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">הבחינות שלי</h1>
          <p className="text-muted-foreground">כל הבחינות שיצרת או ייבאת — לחץ על בחינה לפתרון וציון</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="חפש לפי שם בחינה..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex gap-2">
            {(['all', 'graded', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                {f === 'all' ? 'הכל' : f === 'graded' ? 'עם ציון' : 'ממתין'}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

        {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}

        {!loading && filtered.length === 0 && <EmptyState />}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(exam => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onSelect={() => setActiveExam(exam)}
                onDelete={() => handleDelete(exam.id)}
                isDeleting={deletingId === exam.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyExams;