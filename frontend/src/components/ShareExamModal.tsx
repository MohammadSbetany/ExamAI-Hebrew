import { useState, useEffect } from 'react';
import type { Question } from '@/types/questions';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

interface ClassItem { id: string; name: string; code: string; students?: unknown[] }

interface ShareExamModalProps {
  questions: Question[];
  questionType: string;
  token: string;
  defaultTitle: string;
  onClose: () => void;
}

const Spinner = () => <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />;

/**
 * Teacher-only step-by-step flow to deploy a generated (sandbox) exam to a class:
 *   1. pick one of the teacher's classes
 *   2. set a title, optional open/close schedule and instructions
 *   3. deploy as a class_exam
 */
const ShareExamModal = ({ questions, questionType, token, defaultTitle, onClose }: ShareExamModalProps) => {
  const [step, setStep] = useState<'class' | 'config' | 'done'>('class');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const [title, setTitle] = useState(defaultTitle || 'בחינה');
  const [scheduled, setScheduled] = useState(false);
  const [openAt, setOpenAt] = useState('');
  const [closeAt, setCloseAt] = useState('');
  const [comment, setComment] = useState('');

  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API()}/classes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setClasses((d.classes ?? []).filter((c: ClassItem) => c.id && c.name && Array.isArray(c.students)) as ClassItem[]))
      .catch(() => setError('שגיאה בטעינת הכיתות'))
      .finally(() => setLoading(false));
  }, [token]);

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null;

  const deploy = async () => {
    if (!selectedClassId) return;
    setDeploying(true);
    setError(null);
    try {
      const r = await fetch(`${API()}/classes/${selectedClassId}/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim() || 'בחינה',
          questions,
          question_type: questionType,
          num_variants: 1,
          open_at: scheduled && openAt ? new Date(openAt).toISOString() : null,
          close_at: scheduled && closeAt ? new Date(closeAt).toISOString() : null,
          comment: comment.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || 'שגיאה בשיתוף הבחינה');
      }
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשיתוף הבחינה');
    } finally {
      setDeploying(false);
    }
  };

  const StepDot = ({ active, done, label }: { active: boolean; done: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-primary border border-primary' : 'bg-muted text-muted-foreground'}`}>
        {done ? '✓' : label}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl my-8" onClick={e => e.stopPropagation()} dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">שיתוף בחינה עם תלמידים</h2>
            {step !== 'done' && (
              <div className="flex items-center gap-1.5">
                <StepDot active={step === 'class'} done={step === 'config'} label="1" />
                <span className="w-4 h-px bg-border" />
                <StepDot active={step === 'config'} done={false} label="2" />
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Step 1 — choose class */}
        {step === 'class' && (
          <div className="p-5">
            <p className="text-sm text-muted-foreground mb-3">בחר את הכיתה שאליה תרצה לשתף את הבחינה ({questions.length} שאלות).</p>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-4xl mb-2">🏫</p>
                <p className="font-medium">אין כיתות עדיין</p>
                <p className="text-sm">צור כיתה בדף ניהול הכיתות כדי לשתף בחינות.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {classes.map(cls => (
                  <button key={cls.id} onClick={() => setSelectedClassId(cls.id)}
                    className={`w-full text-right p-4 rounded-xl border-2 transition-all flex items-center justify-between ${selectedClassId === cls.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                    <div>
                      <p className="font-semibold text-foreground">{cls.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cls.students?.length ?? 0} תלמידים · קוד {cls.code}</p>
                    </div>
                    {selectedClassId === cls.id && (
                      <span className="text-primary"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-xs text-destructive mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setStep('config')} disabled={!selectedClassId}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                המשך ←
              </button>
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">ביטול</button>
            </div>
          </div>
        )}

        {/* Step 2 — schedule + config */}
        {step === 'config' && (
          <div className="p-5 space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              כיתה נבחרת: <span className="font-semibold text-foreground">{selectedClass?.name}</span>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">שם הבחינה</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="שם הבחינה"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scheduled}
                  onChange={e => { setScheduled(e.target.checked); if (!e.target.checked) { setOpenAt(''); setCloseAt(''); } }}
                  className="w-4 h-4 accent-primary" />
                <span className="text-sm font-medium text-foreground">תזמון בחינה (זמני פתיחה וסגירה)</span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                {scheduled ? 'קבע מתי הבחינה תיפתח ותיסגר.' : 'ללא תזמון — הבחינה זמינה מיד וללא מגבלת זמן.'}
              </p>
              {scheduled && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">פתיחה</label>
                    <input type="datetime-local" dir="ltr" value={openAt} onChange={e => setOpenAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-left focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">סגירה</label>
                    <input type="datetime-local" dir="ltr" value={closeAt} onChange={e => setCloseAt(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm text-left focus:outline-none" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">הוראות לתלמידים (אופציונלי)</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder="לדוגמה: מותר להיעזר בסיכומים. בהצלחה!"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={deploy} disabled={deploying}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {deploying ? <><Spinner /> משתף...</> : 'שתף עם הכיתה'}
              </button>
              <button onClick={() => setStep('class')} className="px-5 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">→ חזרה</button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">הבחינה שותפה בהצלחה!</h3>
            <p className="text-muted-foreground text-sm mb-6">
              "{title.trim() || 'בחינה'}" זמינה כעת לתלמידי הכיתה <span className="font-semibold text-foreground">{selectedClass?.name}</span>{scheduled ? '' : ' — מיד וללא מגבלת זמן'}.
            </p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90">סיום</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareExamModal;
