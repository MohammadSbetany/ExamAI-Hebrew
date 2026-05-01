import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  student_uid: string;
  student_name: string;
  student_email: string;
  joined_at: string;
  notes: string;
}

interface ExamAttempt {
  exam_id: string;
  exam_title: string;
  question_type: string;
  total_questions: number;
  score: number | null;
  submitted_at: string;
  grade_result: any;
  answers: string[];
}

interface SharedExam {
  id: string;
  title: string;
  question_type: string;
  visible: boolean;
  deadline: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

const pctColor = (pct: number) => {
  if (pct >= 80) return 'text-green-700 bg-green-100';
  if (pct >= 60) return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
};

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Confirm dialog ────────────────────────────────────────────────────────────

const ConfirmModal = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()} dir="rtl">
      <p className="text-foreground font-medium mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity">אשר</button>
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl border-2 border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">ביטול</button>
      </div>
    </div>
  </div>
);

// ── Student Profile Modal ─────────────────────────────────────────────────────

const StudentModal = ({
  student, token, onClose, onRemove,
}: {
  student: Student; token: string; onClose: () => void; onRemove: () => void;
}) => {
  const [history, setHistory] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState(student.notes || '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [overrideExamId, setOverrideExamId] = useState<string | null>(null);
  const [newScore, setNewScore] = useState('');
  const [overrideNote, setOverrideNote] = useState('');
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetch(`${API()}/teacher/students/${student.student_uid}/history`, { headers: authHeader(token) })
      .then(r => r.json())
      .then(d => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [student.student_uid, token]);

  const saveNotes = async () => {
    await fetch(`${API()}/teacher/students/${student.student_uid}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ note: notes }),
    });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  const handleReset = (examId: string, examTitle: string) => {
    setConfirm({
      message: `האם לאפס את ניסיון הגשה של ${student.student_name} לבחינה "${examTitle}"? התלמיד יוכל לגשת מחדש.`,
      action: async () => {
        setConfirm(null);
        setActionLoading(true);
        await fetch(`${API()}/teacher/students/${student.student_uid}/attempts/${examId}`, {
          method: 'DELETE', headers: authHeader(token),
        });
        setHistory(prev => prev.filter(a => a.exam_id !== examId));
        setActionLoading(false);
      },
    });
  };

  const handleOverride = async (examId: string) => {
    const score = parseFloat(newScore);
    if (isNaN(score)) return;
    setActionLoading(true);
    await fetch(`${API()}/teacher/students/${student.student_uid}/attempts/${examId}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ score, note: overrideNote }),
    });
    setHistory(prev => prev.map(a => a.exam_id === examId ? { ...a, score } : a));
    setOverrideExamId(null);
    setNewScore('');
    setOverrideNote('');
    setActionLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl my-8" onClick={e => e.stopPropagation()} dir="rtl">
        {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.action} onCancel={() => setConfirm(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">{student.student_name}</h2>
            <p className="text-sm text-muted-foreground">{student.student_email} · הצטרף {formatDate(student.joined_at)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm({ message: `האם להסיר את ${student.student_name} מהכיתה?`, action: onRemove })}
              className="px-3 py-2 rounded-xl border-2 border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
            >
              הסר מהכיתה
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Notes */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">הערות פנימיות</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הוסף הערה על התלמיד..."
              className="w-full border border-border rounded-xl p-3 text-sm resize-none h-20 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              dir="rtl"
            />
            <button
              onClick={saveNotes}
              className="mt-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              {notesSaved ? '✓ נשמר' : 'שמור הערה'}
            </button>
          </div>

          {/* Exam history */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">היסטוריית בחינות ({history.length})</p>
            {loading ? (
              <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">התלמיד עדיין לא הגיש אף בחינה.</p>
            ) : (
              <div className="space-y-3">
                {history.map(attempt => {
                  const pct = attempt.score !== null && attempt.total_questions > 0
                    ? Math.round((attempt.score / attempt.total_questions) * 100) : null;

                  return (
                    <div key={attempt.exam_id} className="border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{attempt.exam_title}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(attempt.submitted_at)}</p>
                        </div>
                        {pct !== null && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${pctColor(pct)}`}>
                            {attempt.score}/{attempt.total_questions} ({pct}%)
                          </span>
                        )}
                      </div>

                      {/* Grade override form */}
                      {overrideExamId === attempt.exam_id ? (
                        <div className="mt-3 p-3 bg-muted/40 rounded-xl space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number" min={0} max={attempt.total_questions} step={0.5}
                              value={newScore}
                              onChange={e => setNewScore(e.target.value)}
                              placeholder={`ציון (0–${attempt.total_questions})`}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <button
                              onClick={() => handleOverride(attempt.exam_id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                            >
                              אשר
                            </button>
                            <button onClick={() => setOverrideExamId(null)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">
                              ביטול
                            </button>
                          </div>
                          <input
                            type="text" value={overrideNote}
                            onChange={e => setOverrideNote(e.target.value)}
                            placeholder="הסבר לשינוי הציון (אופציונלי)"
                            className="w-full px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { setOverrideExamId(attempt.exam_id); setNewScore(String(attempt.score ?? '')); }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                          >
                            ✏️ שנה ציון
                          </button>
                          <button
                            onClick={() => handleReset(attempt.exam_id, attempt.exam_title)}
                            disabled={actionLoading}
                            className="text-xs px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            🔄 אפס ניסיון
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Exam control row ──────────────────────────────────────────────────────────

const ExamRow = ({ exam, token, onUpdate }: { exam: SharedExam; token: string; onUpdate: (id: string, changes: Partial<SharedExam>) => void }) => {
  const [deadline, setDeadline] = useState(exam.deadline ? exam.deadline.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);

  const toggleVisibility = async () => {
    setSaving(true);
    await fetch(`${API()}/teacher/exams/${exam.id}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ visible: !exam.visible }),
    });
    onUpdate(exam.id, { visible: !exam.visible });
    setSaving(false);
  };

  const saveDeadline = async () => {
    setSaving(true);
    await fetch(`${API()}/teacher/exams/${exam.id}/deadline`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ deadline: deadline || null }),
    });
    onUpdate(exam.id, { deadline: deadline || null });
    setSaving(false);
  };

  return (
    <div className="border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{exam.title}</p>
          <p className="text-xs text-muted-foreground">{formatDate(exam.created_at)}</p>
        </div>
        {/* Visibility toggle */}
        <button
          onClick={toggleVisibility}
          disabled={saving}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all disabled:opacity-50 ${
            exam.visible ? 'border-green-300 bg-green-50 text-green-700' : 'border-border text-muted-foreground hover:border-primary/40'
          }`}
        >
          {exam.visible ? '👁 גלוי לתלמידים' : '🔒 מוסתר'}
        </button>
      </div>
      {/* Deadline */}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="datetime-local"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={saveDeadline}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? '...' : 'קבע דדליין'}
        </button>
        {deadline && (
          <button onClick={() => { setDeadline(''); saveDeadline(); }} className="px-2 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">
            נקה
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const Students = () => {
  const { user } = useAuth();
  const [roster, setRoster] = useState<Student[]>([]);
  const [sharedExams, setSharedExams] = useState<SharedExam[]>([]);
  const [classCode, setClassCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const [classRes, examsRes] = await Promise.all([
        fetch(`${API()}/teacher/class`, { headers: authHeader(user.token) }).then(r => r.json()),
        fetch(`${API()}/teacher/shared-exams`, { headers: authHeader(user.token) }).then(r => r.json()),
      ]);
      setRoster(classRes.students ?? []);
      setClassCode(classRes.class_code ?? null);
      setSharedExams(examsRes.exams ?? []);
    } catch {
      setError('שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  const handleGenerateCode = async () => {
    if (!user?.token) return;
    setGeneratingCode(true);
    const r = await fetch(`${API()}/teacher/class/generate-code`, { method: 'POST', headers: authHeader(user.token) });
    const d = await r.json();
    setClassCode(d.class_code);
    setGeneratingCode(false);
  };

  const handleCopyCode = () => {
    if (!classCode) return;
    navigator.clipboard.writeText(classCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRemoveStudent = async (studentUid: string) => {
    if (!user?.token) return;
    await fetch(`${API()}/teacher/students/${studentUid}`, { method: 'DELETE', headers: authHeader(user.token) });
    setRoster(prev => prev.filter(s => s.student_uid !== studentUid));
    setSelectedStudent(null);
  };

  const updateExam = (id: string, changes: Partial<SharedExam>) => {
    setSharedExams(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e));
  };

  const filtered = roster.filter(s =>
    s.student_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          token={user?.token ?? ''}
          onClose={() => setSelectedStudent(null)}
          onRemove={() => handleRemoveStudent(selectedStudent.student_uid)}
        />
      )}

      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">ניהול תלמידים</h1>
          <p className="text-muted-foreground">נהל את רשימת התלמידים, ציונים ובחינות משותפות</p>
        </div>

        {error && <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left column: roster */}
            <div className="lg:col-span-2 space-y-4">

              {/* Class code card */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-sm font-semibold text-foreground mb-3">קוד הצטרפות לכיתה</p>
                {classCode ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-center py-3 bg-primary/5 border-2 border-dashed border-primary/30 rounded-xl">
                      <span className="text-3xl font-bold text-primary tracking-[0.3em]">{classCode}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={handleCopyCode} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                        {codeCopied ? '✓ הועתק' : 'העתק'}
                      </button>
                      <button onClick={handleGenerateCode} disabled={generatingCode} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
                        חדש
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleGenerateCode} disabled={generatingCode}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60">
                    {generatingCode ? 'יוצר...' : 'צור קוד הצטרפות'}
                  </button>
                )}
                <p className="text-xs text-muted-foreground mt-2">שתף קוד זה עם התלמידים שלך כדי שיוכלו להצטרף לכיתה.</p>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input type="text" placeholder="חפש תלמיד..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>

              {/* Roster */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">אין תלמידים עדיין</p>
                  <p className="text-sm text-muted-foreground max-w-xs">שתף את קוד הכיתה עם התלמידים שלך וציפה שיצטרפו.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(s => (
                    <div key={s.student_uid}
                      onClick={() => setSelectedStudent(s)}
                      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base flex-shrink-0">
                        {s.student_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.student_email}</p>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="text-xs text-muted-foreground">הצטרף</p>
                        <p className="text-xs font-medium text-foreground">{formatDate(s.joined_at)}</p>
                      </div>
                      {s.notes && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700 flex-shrink-0">📝</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right column: exam control */}
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-sm font-semibold text-foreground mb-3">בחינות משותפות ({sharedExams.length})</p>
                {sharedExams.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">אין בחינות משותפות עדיין</p>
                ) : (
                  <div className="space-y-3">
                    {sharedExams.map(exam => (
                      <ExamRow key={exam.id} exam={exam} token={user?.token ?? ''} onUpdate={updateExam} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Students;