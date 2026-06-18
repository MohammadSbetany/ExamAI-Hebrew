import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import FileUpload from '@/components/FileUpload';
import DistributionBar from '@/components/DistributionBar';
import { rescaleCounts } from '@/utils/distribution';
import type { Question } from '@/types/questions';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';
const authH = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonH = (token: string) => ({ 'Content-Type': 'application/json', ...authH(token) });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student { uid: string; name: string; email: string; joined_at: string; }
interface ClassItem { id: string; name: string; code: string; students: Student[]; created_at: string; teacher_uid?: string; }
interface ClassExam {
  id: string; title: string; questions: Question[]; num_variants: number;
  assignments: Record<string, number>; open_at: string | null; close_at: string | null;
  visible: boolean; created_at: string; question_type: string;
}
interface Submission {
  student_uid: string; student_name: string; answers: string[];
  grade_result: { score: number; feedback: { question: string; points: number; correct: boolean; explanation: string; covered_points: string[]; missed_points: string[]; override_note?: string }[] } | null;
  graded_by: string | null; score: number | null; submitted_at: string;
  grade_overrides: Record<string, { points: number; note: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDT = (iso: string) => new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Icons ─────────────────────────────────────────────────────────────────────

const Icon = ({ path }: { path: string }) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />;

// ── Confirm Modal ─────────────────────────────────────────────────────────────

const Confirm = ({ msg, onOk, onCancel }: { msg: string; onOk: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()} dir="rtl">
      <p className="text-foreground font-medium mb-5">{msg}</p>
      <div className="flex gap-3">
        <button onClick={onOk} className="flex-1 py-2 rounded-xl bg-destructive text-white text-sm font-semibold hover:opacity-90">אשר</button>
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
      </div>
    </div>
  </div>
);

// ── Class Card ────────────────────────────────────────────────────────────────

const ClassCard = ({ cls, onSelect, onDelete }: { cls: ClassItem; onSelect: () => void; onDelete: () => void }) => (
  <div onClick={onSelect} className="bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{cls.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">נוצרה {fmt(cls.created_at)}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
        <Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </button>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex-1 py-2 px-3 bg-primary/5 border border-primary/20 rounded-xl text-center">
        <p className="text-lg font-bold text-primary tracking-widest">{cls.code}</p>
        <p className="text-xs text-muted-foreground">קוד הצטרפות</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-foreground">{cls.students?.length ?? 0}</p>
        <p className="text-xs text-muted-foreground">תלמידים</p>
      </div>
    </div>
  </div>
);

// ── Question Editor ───────────────────────────────────────────────────────────

const QuestionEditor = ({ questions, onSave, onClose }: {
  questions: Question[]; onSave: (qs: Question[]) => void; onClose: () => void;
}) => {
  const [qs, setQs] = useState<Question[]>(questions.map(q => ({ ...q })));
  const [newQ, setNewQ] = useState({ question: '', answer: '', type: 'open' });

  const deleteQ = (i: number) => setQs(prev => prev.filter((_, j) => j !== i));
  const addQ = () => {
    if (!newQ.question.trim() || !newQ.answer.trim()) return;
    setQs(prev => [...prev, { question: newQ.question, answer: newQ.answer } as Question]);
    setNewQ({ question: '', answer: '', type: 'open' });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl my-8" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">עריכת שאלות</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><Icon path="M18 6 6 18M6 6l12 12" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {qs.map((q, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <p className="text-xs text-muted-foreground mt-0.5">תשובה: {q.answer}</p>
              </div>
              <button onClick={() => deleteQ(i)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                <Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </button>
            </div>
          ))}
        </div>
        {/* Add new question */}
        <div className="p-5 border-t border-border space-y-3">
          <p className="text-sm font-semibold text-foreground">הוסף שאלה חדשה</p>
          <textarea value={newQ.question} onChange={e => setNewQ(p => ({ ...p, question: e.target.value }))}
            placeholder="טקסט השאלה" rows={2}
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <input value={newQ.answer} onChange={e => setNewQ(p => ({ ...p, answer: e.target.value }))}
            placeholder="תשובה נכונה"
            className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={addQ} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">+ הוסף שאלה</button>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={() => onSave(qs)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">שמור שינויים</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
        </div>
      </div>
    </div>
  );
};

// ── Override Form (per-question, isolated state) ──────────────────────────────

const OverrideForm = ({ qi, initialPoints, examId, studentUid, token, onDone }: {
  qi: number; initialPoints: string; examId: string; studentUid: string; token: string; onDone: () => void;
}) => {
  const [points, setPoints] = useState(initialPoints);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await fetch(`${API()}/class-exams/${examId}/submissions/${studentUid}/override`, {
      method: 'PATCH', headers: jsonH(token),
      body: JSON.stringify({ question_index: qi, new_points: parseFloat(points), note }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <select value={points} onChange={e => setPoints(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none">
          <option value="">בחר ניקוד</option>
          <option value="1">1 — נכון</option>
          <option value="0.5">0.5 — חלקי</option>
          <option value="0">0 — שגוי</option>
        </select>
        <button onClick={submit} disabled={!points || saving}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
          {saving ? <Spinner /> : 'אשר'}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 rounded-lg border border-border text-xs">ביטול</button>
      </div>
      <input value={note} onChange={e => setNote(e.target.value)}
        placeholder="הסבר לשינוי (אופציונלי)"
        className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none" />
    </div>
  );
};

// ── Grading Panel ─────────────────────────────────────────────────────────────

const GradingPanel = ({ exam, submission, token, onClose, onRefresh }: {
  exam: ClassExam; submission: Submission; token: string; onClose: () => void; onRefresh: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [openOverrideIdx, setOpenOverrideIdx] = useState<number | null>(null);

  const isLocalGradable = exam.question_type === 'yesno' || exam.question_type === 'multiple';

  const gradeLocally = () => {
    const feedback = exam.questions.map((q, i) => {
      const answer = submission.answers[i] || '';
      const correct = answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      return { question: q.question, points: correct ? 1 : 0, correct, explanation: correct ? 'תשובה נכונה' : `תשובה שגויה. התשובה הנכונה: ${q.answer}`, covered_points: [], missed_points: [] };
    });
    const score = feedback.reduce((s, f) => s + f.points, 0);
    return { score, feedback };
  };

  const gradeWithAI = async () => {
    setLoading(true);
    if (isLocalGradable) {
      const result = gradeLocally();
      await fetch(`${API()}/class-exams/${exam.id}/submissions/${submission.student_uid}/grade-ai`, {
        method: 'POST', headers: jsonH(token),
        body: JSON.stringify({ local_result: result }),
      });
    } else {
      await fetch(`${API()}/class-exams/${exam.id}/submissions/${submission.student_uid}/grade-ai`, {
        method: 'POST', headers: jsonH(token), body: '{}',
      });
    }
    onRefresh();
    setLoading(false);
  };

  const fb = submission.grade_result?.feedback ?? [];
  const score = submission.grade_result?.score;
  const total = exam.questions.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl my-8" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{submission.student_name}</h2>
            <p className="text-xs text-muted-foreground">הגיש {fmtDT(submission.submitted_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            {score != null && (
              <span className={`text-lg font-bold px-3 py-1 rounded-xl ${(score / total) >= 0.8 ? 'bg-green-100 text-green-700' : (score / total) >= 0.6 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {score}/{total}
              </span>
            )}
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><Icon path="M18 6 6 18M6 6l12 12" /></button>
          </div>
        </div>

        {!submission.grade_result && (
          <div className="p-5 border-b border-border">
            <button onClick={gradeWithAI} disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Spinner /> בודק...</> : isLocalGradable ? '⚡ בדיקה מהירה' : '✨ בדיקה אוטומטית על ידי AI'}
            </button>
          </div>
        )}

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {exam.questions.map((q, qi) => {
            const f = fb[qi];
            const answer = submission.answers[qi] || '';
            const override = submission.grade_overrides?.[String(qi)];
            const pts = f?.points ?? null;
            const bg = pts === 1 ? 'border-green-200 bg-green-50' : pts === 0 ? 'border-red-200 bg-red-50' : pts !== null ? 'border-yellow-200 bg-yellow-50' : 'border-border bg-muted/30';

            return (
              <div key={qi} className={`p-4 rounded-xl border-2 ${bg}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-foreground">{qi + 1}. {q.question}</p>
                  {pts !== null && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${pts === 1 ? 'bg-green-100 text-green-700' : pts === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {pts}/1 {override ? '✏️' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">תשובת התלמיד: <span className="text-foreground font-medium">{answer || '—'}</span></p>
                <p className="text-xs text-muted-foreground mb-1">תשובה נכונה: <span className="text-green-700 font-medium">{q.answer}</span></p>
                {f?.explanation && <p className="text-xs text-muted-foreground italic">{f.explanation}</p>}

                {submission.grade_result && (
                  openOverrideIdx === qi ? (
                    <OverrideForm
                      qi={qi}
                      initialPoints={String(pts ?? '')}
                      examId={exam.id}
                      studentUid={submission.student_uid}
                      token={token}
                      onDone={() => { setOpenOverrideIdx(null); onRefresh(); }}
                    />
                  ) : (
                    <button onClick={() => setOpenOverrideIdx(qi)}
                      className="mt-2 text-xs text-muted-foreground hover:text-primary underline">
                      ✏️ שנה ניקוד
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const GenerateExamFlow = ({ exam, token, onDone, onClose }: {
  exam: ClassExam; token: string;
  onDone: (updatedExam: ClassExam) => void; onClose: () => void;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [questionType, setQuestionType] = useState('open');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Question[]>([]);
  // Mixed-mode distributions as counts that sum to questionCount
  const [typeCounts, setTypeCounts] = useState<number[]>([1, 3, 1]);   // yesno, multiple, open
  const [levelCounts, setLevelCounts] = useState<number[]>([1, 3, 1]); // easy, medium, hard

  useEffect(() => {
    setTypeCounts(prev => rescaleCounts(prev, questionCount));
    setLevelCounts(prev => rescaleCounts(prev, questionCount));
  }, [questionCount]);

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('question_type', questionType);
      formData.append('question_count', String(questionCount));
      formData.append('difficulty', difficulty);
      if (questionType === 'merged') {
        formData.append('format_counts', JSON.stringify({
          yesno: typeCounts[0], multiple: typeCounts[1], open: typeCounts[2],
        }));
      }
      if (difficulty === 'merged') {
        const t = Math.max(1, questionCount);
        formData.append('difficulty_dist', JSON.stringify({
          easy: Math.round((levelCounts[0] / t) * 100),
          medium: Math.round((levelCounts[1] / t) * 100),
          hard: Math.round((levelCounts[2] / t) * 100),
        }));
      }
      const r = await fetch(`${API()}/upload`, {
        method: 'POST',
        headers: authH(token),
        body: formData,
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || 'שגיאה ביצירת השאלות');
      }
      const data = await r.json();
      setGenerated(data.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (generated.length === 0) return;
    setIsLoading(true);
    try {
      await fetch(`${API()}/class-exams/${exam.id}/questions`, {
        method: 'PATCH',
        headers: jsonH(token),
        body: JSON.stringify({ questions: generated, question_type: questionType }),
      });
      onDone({ ...exam, questions: generated, question_type: questionType });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl my-8" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">יצירת שאלות — {exam.title}</h2>
            <p className="text-xs text-muted-foreground">העלה חומר לימוד וה-AI ייצור שאלות לבחינה</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <Icon path="M18 6 6 18M6 6l12 12" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* File upload (up to 5 files) */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">העלאת קבצים (עד 5)</p>
            <FileUpload selectedFiles={files} onFilesChange={setFiles} disabled={isLoading} />
          </div>

          {/* Question type */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">סוג שאלות</p>
            <div className="flex gap-2">
              {[{ v: 'open', l: 'פתוחות' }, { v: 'yesno', l: 'כן/לא' }, { v: 'multiple', l: 'רב ברירה' }, { v: 'merged', l: 'מיזוג' }].map(({ v, l }) => (
                <button key={v} onClick={() => setQuestionType(v)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all ${questionType === v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  {l}
                </button>
              ))}
            </div>
            {questionType === 'merged' && (
              <div className="mt-3 p-3 bg-muted/40 rounded-xl border border-border">
                <p className="text-xs font-medium text-foreground mb-2">כמה שאלות מכל סוג? (סה״כ {questionCount})</p>
                <DistributionBar
                  total={questionCount}
                  segments={[
                    { key: 'yesno', label: 'כן/לא', color: 'bg-blue-500' },
                    { key: 'multiple', label: 'רב ברירה', color: 'bg-violet-500' },
                    { key: 'open', label: 'פתוחות', color: 'bg-emerald-500' },
                  ]}
                  counts={typeCounts}
                  onChange={setTypeCounts}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Count + difficulty — on separate lines */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">מספר שאלות: {questionCount}</p>
              <input type="range" min={1} max={100} value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full accent-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">רמת קושי</p>
              <div className="flex gap-1">
                {[{ v: 'easy', l: 'קל' }, { v: 'medium', l: 'בינוני' }, { v: 'hard', l: 'קשה' }, { v: 'merged', l: 'מיזוג' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setDifficulty(v)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${difficulty === v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mixed difficulty — how many questions of each level */}
          {difficulty === 'merged' && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <p className="text-xs font-medium text-foreground mb-2">כמה שאלות בכל רמת קושי? (סה״כ {questionCount})</p>
              <DistributionBar
                total={questionCount}
                segments={[
                  { key: 'easy', label: 'קל', color: 'bg-emerald-500' },
                  { key: 'medium', label: 'בינוני', color: 'bg-amber-500' },
                  { key: 'hard', label: 'קשה', color: 'bg-rose-500' },
                ]}
                counts={levelCounts}
                onChange={setLevelCounts}
                disabled={isLoading}
              />
            </div>
          )}

          {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>}

          {/* Generated questions preview */}
          {generated.length > 0 && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-foreground">{generated.length} שאלות נוצרו — תצוגה מקדימה:</p>
              {generated.map((q, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{i + 1}.</span> {q.question}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          {generated.length === 0 ? (
            <button onClick={handleGenerate} disabled={files.length === 0 || isLoading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading ? <><Spinner /> יוצר שאלות...</> : '✨ צור שאלות'}
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {isLoading ? <><Spinner /> שומר...</> : 'שמור שאלות לבחינה'}
              </button>
              <button onClick={() => setGenerated([])}
                className="px-4 py-3 rounded-xl border border-border text-sm hover:bg-muted">
                נסה שוב
              </button>
            </>
          )}
          <button onClick={onClose} className="px-4 py-3 rounded-xl border border-border text-sm hover:bg-muted">
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Class Detail ──────────────────────────────────────────────────────────────

const ClassDetail = ({ cls, token, onBack, onRefresh }: {
  cls: ClassItem; token: string; onBack: () => void; onRefresh: () => void;
}) => {
  const [showGenerateExam, setShowGenerateExam] = useState(false);
  const [generatingExam, setGeneratingExam] = useState<ClassExam | null>(null);
  const [tab, setTab] = useState<'students' | 'exams'>('students');
  const [exams, setExams] = useState<ClassExam[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [visibleSubmissions, setVisibleSubmissions] = useState<Set<string>>(new Set());
  const [renamingClass, setRenamingClass] = useState(false);
  const [renameValue, setRenameValue] = useState(cls.name);
  const [loading, setLoading] = useState(false);
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [editExam, setEditExam] = useState<ClassExam | null>(null);
  const [gradingExam, setGradingExam] = useState<ClassExam | null>(null);
  const [gradingSub, setGradingSub] = useState<Submission | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; action: () => void } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Add student by email
  const [addEmail, setAddEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Create exam form
  const [examTitle, setExamTitle] = useState('');
  const [numVariants, setNumVariants] = useState(1);
  const [openAt, setOpenAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [examComment, setExamComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const loadExams = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`${API()}/classes/${cls.id}/exams`, { headers: authH(token) });
    const d = await r.json();
    setExams(d.exams ?? []);
    setLoading(false);
  }, [cls.id, token]);

  useEffect(() => { if (tab === 'exams') loadExams(); }, [tab, loadExams]);

  const loadSubmissions = async (examId: string) => {
    const r = await fetch(`${API()}/class-exams/${examId}/submissions`, { headers: authH(token) });
    const d = await r.json();
    setSubmissions(prev => ({ ...prev, [examId]: d.submissions ?? [] }));
    setVisibleSubmissions(prev => new Set([...prev, examId]));
  };

  const hideSubmissions = (examId: string) => {
    setVisibleSubmissions(prev => { const s = new Set(prev); s.delete(examId); return s; });
  };

  const createExam = async () => {
    if (!examTitle.trim()) {
      setFormError('שם הבחינה הוא שדה חובה');
      return;
    }
    setFormError(null);
    const r = await fetch(`${API()}/classes/${cls.id}/exams`, {
      method: 'POST', headers: jsonH(token),
      body: JSON.stringify({
        title: examTitle,
        questions: [],
        num_variants: numVariants,
        open_at: openAt ? new Date(openAt).toISOString() : null,
        close_at: closeAt ? new Date(closeAt).toISOString() : null,
        comment: examComment || null,
      }),
    });
    if (!r.ok) {
      const err = await r.json();
      setFormError(err.detail || 'שגיאה ביצירת הבחינה');
      return;
    }
    const exam = await r.json();
    setExams(prev => [exam, ...prev]);
    setShowCreateExam(false);
    setExamTitle(''); setNumVariants(1); setOpenAt(''); setCloseAt(''); setExamComment('');
    setGeneratingExam(exam); // open AI generation flow
  };

  const saveQuestions = async (exam: ClassExam, questions: Question[]) => {
    await fetch(`${API()}/class-exams/${exam.id}/questions`, {
      method: 'PATCH', headers: jsonH(token),
      body: JSON.stringify({ questions, question_type: exam.question_type }),
    });
    setExams(prev => prev.map(e => e.id === exam.id ? { ...e, questions } : e));
    setEditExam(null);
  };

  const toggleVisibility = async (exam: ClassExam) => {
    await fetch(`${API()}/class-exams/${exam.id}/schedule`, {
      method: 'PATCH', headers: jsonH(token),
      body: JSON.stringify({ open_at: exam.open_at, close_at: exam.close_at, visible: !exam.visible }),
    });
    setExams(prev => prev.map(e => e.id === exam.id ? { ...e, visible: !e.visible } : e));
  };

  const deleteExam = async (examId: string) => {
    await fetch(`${API()}/class-exams/${examId}`, { method: 'DELETE', headers: authH(token) });
    setExams(prev => prev.filter(e => e.id !== examId));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(cls.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const saveRename = async () => {
    const name = renameValue.trim();
    if (!name || name === cls.name) { setRenamingClass(false); return; }
    await fetch(`${API()}/classes/${cls.id}`, {
      method: 'PATCH', headers: jsonH(token), body: JSON.stringify({ name }),
    });
    cls.name = name;
    setRenamingClass(false);
    onRefresh();
  };

  const addStudentByEmail = async () => {
    const email = addEmail.trim();
    if (!email || addingStudent) return;
    setAddingStudent(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const r = await fetch(`${API()}/classes/${cls.id}/add-student-by-email`, {
        method: 'POST', headers: jsonH(token), body: JSON.stringify({ email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAddError(d.detail || 'שגיאה בהוספת התלמיד'); return; }
      setAddSuccess(`${d.student?.name ?? email} נוסף/ה לכיתה`);
      setAddEmail('');
      onRefresh(); // re-syncs the roster from the server (see load())
    } catch {
      setAddError('שגיאה בהוספת התלמיד');
    } finally {
      setAddingStudent(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {confirm && <Confirm msg={confirm.msg} onOk={() => { confirm.action(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
      {editExam && <QuestionEditor questions={editExam.questions} onSave={qs => saveQuestions(editExam, qs)} onClose={() => setEditExam(null)} />}
      {generatingExam && (
        <GenerateExamFlow
          exam={generatingExam}
          token={token}
          onDone={updated => {
            setExams(prev => prev.map(e => e.id === updated.id ? updated : e));
            setGeneratingExam(null);
            setEditExam(updated);
          }}
          onClose={() => setGeneratingExam(null)}
        />
      )} 
      {gradingExam && gradingSub && (
        <GradingPanel exam={gradingExam} submission={gradingSub} token={token}
          onClose={() => { setGradingExam(null); setGradingSub(null); }}
          onRefresh={async () => {
            await loadSubmissions(gradingExam.id);
            // Update the active submission from refreshed data
            setSubmissions(prev => {
              const updated = prev[gradingExam.id]?.find(s => s.student_uid === gradingSub.student_uid);
              if (updated) setGradingSub(updated);
              return prev;
            });
          }} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Icon path="M15 18l-6-6 6-6" /> חזרה לכיתות
        </button>
        <div className="flex-1">
          {renamingClass ? (
            <div className="flex items-center gap-2">
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenamingClass(false); }}
                autoFocus
                className="text-xl font-bold border-b-2 border-primary bg-transparent focus:outline-none text-foreground w-48"
              />
              <button onClick={saveRename} className="text-xs px-2 py-1 rounded-lg bg-primary text-primary-foreground">שמור</button>
              <button onClick={() => setRenamingClass(false)} className="text-xs px-2 py-1 rounded-lg border border-border">ביטול</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-2xl font-bold text-foreground">{cls.name}</h2>
              <button onClick={() => { setRenameValue(cls.name); setRenamingClass(true); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                <Icon path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{cls.students?.length ?? 0} תלמידים · נוצרה {fmt(cls.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-lg font-bold text-primary tracking-widest">{cls.code}</span>
          </div>
          <button onClick={copyCode} className="px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
            {codeCopied ? '✓' : 'העתק'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        {[{ id: 'students', label: `👥 תלמידים (${cls.students?.length ?? 0})` }, { id: 'exams', label: `📝 בחינות` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'students' | 'exams')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Students tab */}
      {tab === 'students' && (
        <div className="space-y-3">
          {/* Add student by email */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-sm font-semibold text-foreground mb-2 block">הוספת תלמיד לפי אימייל</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={addEmail}
                onChange={e => { setAddEmail(e.target.value); setAddError(null); setAddSuccess(null); }}
                onKeyDown={e => { if (e.key === 'Enter') addStudentByEmail(); }}
                placeholder="student@example.com"
                dir="ltr"
                className="flex-1 px-3 py-2 rounded-xl border border-input bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={addStudentByEmail}
                disabled={addingStudent || !addEmail.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {addingStudent ? <Spinner /> : <Icon path="M12 5v14M5 12h14" />}
                הוסף
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">המשתמש חייב להיות רשום במערכת עם כתובת אימייל זו.</p>
            {addError && <p className="text-xs text-destructive mt-2">{addError}</p>}
            {addSuccess && <p className="text-xs text-green-600 mt-2">✓ {addSuccess}</p>}
          </div>

          {cls.students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-3">👥</p>
              <p className="font-medium">אין תלמידים עדיין</p>
              <p className="text-sm">שתף את הקוד <strong className="text-primary">{cls.code}</strong> עם התלמידים</p>
            </div>
          ) : (
            (cls.students ?? []).map(s => (
              <div key={s.uid} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
                <p className="text-xs text-muted-foreground flex-shrink-0">הצטרף {fmt(s.joined_at)}</p>
                <button
                  onClick={() => setConfirm({ msg: `להסיר את "${s.name}" מהכיתה?`, action: async () => {
                    await fetch(`${API()}/classes/${cls.id}/students/${s.uid}`, { method: 'DELETE', headers: authH(token) });
                    onRefresh();
                  }})}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  title="הסר תלמיד"
                >
                  <Icon path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Exams tab */}
      {tab === 'exams' && (
        <div className="space-y-4">
          <button onClick={() => setShowCreateExam(true)}
            className="w-full py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
            <Icon path="M12 5v14M5 12h14" /> צור בחינה חדשה לכיתה
          </button>

          {/* Create exam form */}
          {showCreateExam && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-foreground">בחינה חדשה</h3>
              <label className="text-xs font-medium text-foreground mb-1 block">
                שם הבחינה <span className="text-destructive">*</span>
              </label>
              <input value={examTitle} onChange={e => setExamTitle(e.target.value)} placeholder="שם הבחינה"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">מספר גרסאות ({numVariants})</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={1} max={10} value={numVariants}                  onChange={e => setNumVariants(Number(e.target.value))} className="flex-1 accent-primary" />
                  <span className="text-sm font-bold text-foreground w-8 text-center">{numVariants}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {numVariants === 1 ? 'כולם מקבלים את אותה בחינה' : `${numVariants} גרסאות שונות מחולקות אקראית`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">פתיחה <span className="text-muted-foreground">(אופציונלי)</span></label>
                  <input type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">סגירה <span className="text-muted-foreground">(אופציונלי)</span></label>
                  <input type="datetime-local" value={closeAt} onChange={e => setCloseAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">הוראות מיוחדות לבחינה (אופציונלי)</label>
                <textarea
                  value={examComment}
                  onChange={e => setExamComment(e.target.value)}
                  placeholder="לדוגמה: התמקד בנושא רשימות מקושרות. כתוב שאלות ברמת קושי גבוהה."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-xs text-muted-foreground mt-1">ניתן לכתוב בעברית או באנגלית. ההוראות חייבות להתייחס לנושא הבחינה בלבד.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={createExam} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">צור ופתח עריכה</button>
                <button onClick={() => setShowCreateExam(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
              </div>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : exams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-3">📝</p>
              <p className="font-medium">אין בחינות עדיין</p>
            </div>
          ) : (
            exams.map(exam => {
              const subs = submissions[exam.id];
              return (
                <div key={exam.id} className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-foreground">{exam.title}</h3>
                      <p className="text-xs text-muted-foreground">{exam.questions.length} שאלות · {exam.num_variants} גרסה/ות · נוצרה {fmt(exam.created_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {exam.questions.length === 0 && (
                        <button onClick={() => setGeneratingExam(exam)}
                          className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors">
                          ✨ צור שאלות עם AI
                        </button>
                      )}
                      <button onClick={() => setEditExam(exam)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                        ✏️ עריכת שאלות
                      </button>
                      <button onClick={() => toggleVisibility(exam)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${exam.visible ? 'border-green-300 bg-green-50 text-green-700' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                        {exam.visible ? '👁 גלוי' : '🔒 מוסתר'}
                      </button>
                      <button onClick={() => { loadSubmissions(exam.id); }}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors">
                        📊 הגשות
                      </button>
                      <button onClick={() => setConfirm({ msg: `למחוק את הבחינה "${exam.title}"?`, action: () => deleteExam(exam.id) })}
                        className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors">
                        מחק
                      </button>
                    </div>
                  </div>

                  {/* Schedule */}
                  {(exam.open_at || exam.close_at) && (
                    <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                      {exam.open_at && <span>📅 פתיחה: {fmtDT(exam.open_at)}</span>}
                      {exam.close_at && <span>🔒 סגירה: {fmtDT(exam.close_at)}</span>}
                    </div>
                  )}

                  {/* Submissions */}
                  {subs && visibleSubmissions.has(exam.id) && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">הגשות ({subs.length}/{cls.students?.length ?? 0})</p>
                        <button onClick={() => hideSubmissions(exam.id)} className="text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors">
                          <Icon path="M18 6 6 18M6 6l12 12" />
                        </button>
                      </div>
                      {subs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">אין הגשות עדיין</p>
                      ) : (
                        subs.map(sub => {
                          const pct = sub.score !== null ? Math.round((sub.score / exam.questions.length) * 100) : null;
                          return (
                            <div key={sub.student_uid} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                              onClick={() => { setGradingExam(exam); setGradingSub(sub); }}>
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                {sub.student_name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{sub.student_name}</p>
                                <p className="text-xs text-muted-foreground">{fmtDT(sub.submitted_at)}</p>
                              </div>
                              {pct !== null ? (
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                  {sub.score}/{exam.questions.length} ({pct}%)
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground flex-shrink-0">לא נבדק</span>
                              )}
                              {sub.graded_by && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">{sub.graded_by === 'ai' ? '✨' : '👤'}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const Students = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; action: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(`${API()}/classes`, {
        headers: authH(user.token),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!r.ok) throw new Error(`שגיאה ${r.status}`);
      const d = await r.json();
      // Filter out malformed old documents that lack required fields
      const validClasses = (d.classes ?? []).filter(
        (c: ClassItem) => c.id && c.name && c.code && Array.isArray(c.students)
      );
      setClasses(validClasses);
      // Keep the open class detail in sync with the server (roster changes, etc.);
      // if the class no longer exists, fall back to the list view.
      setSelectedClass(prev => prev ? (validClasses.find((c: ClassItem) => c.id === prev.id) ?? null) : prev);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('הבקשה לקחה יותר מדי זמן. בדוק את החיבור לשרת.');
      } else {
        setError('שגיאה בטעינת הכיתות');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const createClass = async () => {
    if (!newClassName.trim() || !user?.token) return;
    setCreating(true);
    const r = await fetch(`${API()}/classes`, {
      method: 'POST', headers: jsonH(user.token), body: JSON.stringify({ name: newClassName }),
    });
    const cls = await r.json();
    setClasses(prev => [cls, ...prev]);
    setShowCreate(false);
    setNewClassName('');
    setCreating(false);
    setSelectedClass(cls);
  };

  const deleteClass = async (classId: string) => {
    if (!user?.token) return;
    await fetch(`${API()}/classes/${classId}`, { method: 'DELETE', headers: authH(user.token) });
    setClasses(prev => prev.filter(c => c.id !== classId));
    if (selectedClass?.id === classId) setSelectedClass(null);
  };

  if (selectedClass) {
    return (
      <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <ClassDetail
            cls={selectedClass}
            token={user?.token ?? ''}
            onBack={() => { setSelectedClass(null); load(); }}
            onRefresh={load}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {confirm && <Confirm msg={confirm.msg} onOk={() => { confirm.action(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}

        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">ניהול כיתות ובחינות</h1>
            <p className="text-muted-foreground">נהל כיתות, הקצה בחינות ובדוק תלמידים</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
            <Icon path="M12 5v14M5 12h14" /> כיתה חדשה
          </button>
        </div>

        {error && <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

        {/* Create class form */}
        {showCreate && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 space-y-4">
            <h3 className="font-bold text-foreground">יצירת כיתה חדשה</h3>
            <input value={newClassName} onChange={e => setNewClassName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createClass()}
              placeholder="שם הכיתה (למשל: מדעי המחשב — שנה ב׳)"
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex gap-3">
              <button onClick={createClass} disabled={creating || !newClassName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60">
                {creating ? <><Spinner /> יוצר...</> : 'צור כיתה'}
              </button>
              <button onClick={() => { setShowCreate(false); setNewClassName(''); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">🏫</div>
            <h3 className="text-xl font-bold text-foreground mb-2">אין כיתות עדיין</h3>
            <p className="text-muted-foreground max-w-xs mb-6">צור כיתה חדשה, שתף את קוד ההצטרפות עם התלמידים, והתחל לנהל בחינות.</p>
            <button onClick={() => setShowCreate(true)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90">
              + צור כיתה ראשונה
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls, index) => (
                <ClassCard key={cls.id ?? index} cls={cls}
                onSelect={() => setSelectedClass(cls)}
                onDelete={() => setConfirm({ msg: `למחוק את הכיתה "${cls.name}"?`, action: () => deleteClass(cls.id) })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Students;
