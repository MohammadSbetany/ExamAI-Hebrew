import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassItem  { id: string; name: string; }
interface QuestionStat { index: number; question: string; success_rate: number; avg_points: number; answered_count: number; }
interface StudentRow  { student_uid: string; student_name: string; score: number | null; pct: number; submitted_at: string; }
interface DistractorItem { index: number; question: string; correct_answer: string; options: Record<string, string>; answer_counts: Record<string, number>; total_answers: number; }
interface Analytics {
  exam: { title: string; question_type: string };
  student_count: number;
  submissions: StudentRow[];
  score_stats: { mean: number; median: number; std: number; min: number; max: number; count: number } | null;
  question_stats: QuestionStat[];
  distractor_analysis: DistractorItem[];
  grade_distribution: { label: string; count: number }[];
  ai_recommendations: unknown[];
}
interface ExamSummary {
  exam_id: string; title: string; created_at: string;
  total_submissions: number; graded_count: number;
  avg_pct: number | null; median_pct: number | null;
  std_pct: number | null; failure_rate: number | null;
  min_pct: number | null; max_pct: number | null;
}
interface TrendPoint { exam_title: string; date: string; avg: number; submissions: number; }
interface Comparative {
  highest_failure_exam: { title: string; rate: number };
  highest_std_exam:     { title: string; std: number };
  best_exam:            { title: string; avg: number };
  worst_exam:           { title: string; avg: number };
}
interface ClassAnalytics {
  class: { id: string; name: string };
  exams_summary: ExamSummary[];
  trend: TrendPoint[];
  comparative: Comparative | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const successColor = (rate: number) => {
  if (rate >= 75) return { bg: 'bg-green-100', text: 'text-green-700', bar: '#22c55e' };
  if (rate >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: '#eab308' };
  return { bg: 'bg-red-100', text: 'text-red-700', bar: '#ef4444' };
};
const pctColor = (pct: number) => pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-yellow-700' : 'text-red-700';

// ── Tooltips ──────────────────────────────────────────────────────────────────

interface TooltipProps { active?: boolean; payload?: { value: number; name?: string }[]; label?: string; }
const BarTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-sm" dir="rtl">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} תלמידים</p>
    </div>
  );
};
const LineTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-sm" dir="rtl">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">{p.name}: {p.value}%</p>
      ))}
    </div>
  );
};

// ── Class view ────────────────────────────────────────────────────────────────

const ClassView = ({ classAnalytics, onDrillDown }: {
  classAnalytics: ClassAnalytics;
  onDrillDown: (examId: string) => void;
}) => {
  const { trend, exams_summary, comparative } = classAnalytics;

  // Reverse trend for RTL (newest on left in Hebrew reading direction)
  const trendRTL = [...trend].reverse();

  const graded = exams_summary.filter(e => e.avg_pct !== null);
  const overallAvg = graded.length > 0
    ? Math.round(graded.reduce((s, e) => s + (e.avg_pct ?? 0), 0) / graded.length)
    : null;

  return (
    <div className="space-y-6">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'בחינות שהוקצו', value: exams_summary.length },
          { label: 'בחינות עם ציונים', value: graded.length },
          { label: 'ממוצע כולל', value: overallAvg !== null ? `${overallAvg}%` : '—' },
          { label: 'הגשות סה״כ', value: exams_summary.reduce((s, e) => s + e.total_submissions, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Trend line chart */}
      {trendRTL.length > 1 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">מגמת ממוצע הכיתה לאורך זמן</h2>
          <p className="text-xs text-muted-foreground mb-4">מהבחינה האחרונה (שמאל) לראשונה (ימין)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendRTL} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="exam_title" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip content={<LineTooltip />} />
              <Legend />
              <Line
                type="monotone" dataKey="avg" name="ממוצע (%)"
                stroke="hsl(var(--primary))" strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparative highlights */}
      {comparative && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: '🏆', label: 'הבחינה הטובה ביותר', value: `${comparative.best_exam.avg}% ממוצע`, title: comparative.best_exam.title, color: 'border-green-200 bg-green-50' },
            { icon: '⚠️', label: 'הבחינה הקשה ביותר', value: `${comparative.worst_exam.avg}% ממוצע`, title: comparative.worst_exam.title, color: 'border-red-200 bg-red-50' },
            { icon: '❌', label: 'שיעור כישלון גבוה ביותר', value: `${comparative.highest_failure_exam.rate}% נכשלו`, title: comparative.highest_failure_exam.title, color: 'border-orange-200 bg-orange-50' },
            { icon: '📊', label: 'פיזור ציונים גבוה ביותר', value: `סטיית תקן ${comparative.highest_std_exam.std}%`, title: comparative.highest_std_exam.title, color: 'border-blue-200 bg-blue-50' },
          ].map(({ icon, label, value, title, color }) => (
            <div key={label} className={`p-4 rounded-xl border-2 ${color}`}>
              <p className="text-xs text-muted-foreground mb-1">{icon} {label}</p>
              <p className="text-sm font-bold text-foreground truncate">{title}</p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Exam matrix table */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">מטריצת בחינות</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">בחינה</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">תאריך</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">הגשות</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">ממוצע</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">כישלון</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">סט״ת</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exams_summary.map(e => (
                <tr key={e.exam_id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-medium text-foreground max-w-[160px] truncate">{e.title}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(e.created_at)}</td>
                  <td className="py-3 px-3 text-foreground">{e.total_submissions}</td>
                  <td className={`py-3 px-3 font-bold ${e.avg_pct !== null ? pctColor(e.avg_pct) : 'text-muted-foreground'}`}>
                    {e.avg_pct !== null ? `${e.avg_pct}%` : '—'}
                  </td>
                  <td className={`py-3 px-3 font-medium ${e.failure_rate !== null && e.failure_rate > 30 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {e.failure_rate !== null ? `${e.failure_rate}%` : '—'}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {e.std_pct !== null ? `${e.std_pct}%` : '—'}
                  </td>
                  <td className="py-3 px-3">
                    <button onClick={() => onDrillDown(e.exam_id)}
                      className="text-xs text-primary hover:underline font-medium whitespace-nowrap">
                      ניתוח מעמיק ←
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {exams_summary.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">אין בחינות עדיין לכיתה זו</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ClassStats = () => {
  const { user } = useAuth();

  // View mode: 'exam' or 'class'
  const [viewMode, setViewMode] = useState<'exam' | 'class'>('class');

  // Shared exams (analytics system)
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examSource, setExamSource] = useState<'shared' | 'class'>('shared');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // Classes (class_manager system)
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics | null>(null);

  const [loading, setLoading] = useState(false);
  const [listsLoading, setListsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load both lists on mount
  useEffect(() => {
    if (!user?.token) return;
    setListsLoading(true);
    fetch(`${API()}/classes`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json())
      .then(d => setClasses((d.classes ?? []).filter((c: ClassItem & { teacher_uid?: string }) => c.id && c.name))).catch(() => setError('שגיאה בטעינת הנתונים'))
      .finally(() => setListsLoading(false));
  }, [user?.token]);

  // Load specific exam analytics
  useEffect(() => {
    if (!selectedExamId || !user?.token || viewMode !== 'exam') return;
    setLoading(true); setAnalytics(null); setError(null);
    const endpoint = examSource === 'class'
      ? `${API()}/teacher/analytics/class-exam/${selectedExamId}`
      : `${API()}/teacher/analytics/${selectedExamId}`;
    fetch(endpoint, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json()).then(setAnalytics)
      .catch(() => setError('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false));
  }, [selectedExamId, user?.token, viewMode, examSource]);

  // Load class analytics
  useEffect(() => {
    if (!selectedClassId || !user?.token || viewMode !== 'class') return;
    setLoading(true); setClassAnalytics(null); setError(null);
    fetch(`${API()}/teacher/analytics/class/${selectedClassId}`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => r.json()).then(setClassAnalytics)
      .catch(() => setError('שגיאה בטעינת נתוני הכיתה'))
      .finally(() => setLoading(false));
  }, [selectedClassId, user?.token, viewMode]);

  // Drill down from class view into specific exam
  const handleDrillDown = (examId: string) => {
    setExamSource('class');
    setViewMode('exam');
    setSelectedExamId(examId);
  };

  const filteredStudents = (analytics?.submissions ?? []).filter(s =>
    s.student_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">סטטיסטיקות כיתה</h1>
          <p className="text-muted-foreground">ניתוח ביצועי תלמידים — לפי כיתה או בחינה ספציפית</p>
        </div>

        {error && <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>}

        {/* Selector */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">בחר כיתה</p>
          {listsLoading ? (
            <div className="flex justify-center py-4"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">אין כיתות עדיין. צור כיתה בדף ניהול התלמידים.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => (
                <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setViewMode('class'); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${selectedClassId === cls.id && viewMode === 'class' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  {cls.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>}

        {/* ── Class view ── */}
        {viewMode === 'class' && classAnalytics && !loading && (
          <ClassView classAnalytics={classAnalytics} onDrillDown={handleDrillDown} />
        )}

        {/* ── Specific exam view ── */}
        {viewMode === 'exam' && analytics && !loading && (
          <>
            {analytics.student_count === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <p className="text-lg font-semibold text-foreground mb-2">אין נתונים עדיין</p>
                <p className="text-muted-foreground text-sm">הנתונים יופיעו לאחר שתלמידים יגישו את תשובותיהם.</p>
              </div>
            ) : (
              <>
                {/* Back to class */}
                {selectedClassId && (
                  <button onClick={() => { setViewMode('class'); }}
                    className="mb-4 flex items-center gap-1 text-sm text-primary hover:underline">
                    ← חזרה לסקירת הכיתה
                  </button>
                )}

                {/* Score stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'תלמידים',   value: analytics.score_stats?.count },
                    { label: 'ממוצע',     value: `${analytics.score_stats?.mean}%` },
                    { label: 'חציון',     value: `${analytics.score_stats?.median}%` },
                    { label: 'סטיית תקן', value: `${analytics.score_stats?.std}%` },
                    { label: 'טווח',      value: `${analytics.score_stats?.min}%–${analytics.score_stats?.max}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-6 mb-6">
                  {/* Grade distribution */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h2 className="text-base font-semibold text-foreground mb-4">התפלגות ציונים</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.grade_distribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <Tooltip content={<BarTooltip />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {analytics.grade_distribution.map((entry, i) => {
                            const mid = (parseInt(entry.label.split('–')[0]) + parseInt(entry.label.split('–')[1])) / 2;
                            return <Cell key={i} fill={mid >= 85 ? '#22c55e' : mid >= 65 ? '#eab308' : '#ef4444'} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Per-question success rate */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-6">
                  <h2 className="text-base font-semibold text-foreground mb-4">אחוז הצלחה לפי שאלה</h2>
                  <div className="space-y-3">
                    {analytics.question_stats.map(qs => {
                      const c = successColor(qs.success_rate);
                      return (
                        <div key={qs.index} className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">{qs.index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate mb-1">{qs.question}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${qs.success_rate}%`, backgroundColor: c.bar }} />
                              </div>
                              <span className={`text-xs font-bold flex-shrink-0 w-10 text-left ${c.text}`}>{qs.success_rate}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Distractor analysis */}
                {analytics.distractor_analysis?.length > 0 && (
                  <div className="bg-card border border-border rounded-2xl p-5 mb-6">
                    <h2 className="text-base font-semibold text-foreground mb-4">ניתוח תשובות שגויות (רב-ברירה)</h2>
                    <div className="space-y-6">
                      {analytics.distractor_analysis.map(da => (
                        <div key={da.index}>
                          <p className="text-sm font-medium text-foreground mb-2">
                            <span className="text-primary font-bold ml-1">שאלה {da.index + 1}:</span>{da.question}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {Object.entries(da.options).map(([key, val]) => {
                              const count = da.answer_counts[key] ?? 0;
                              const pct = da.total_answers ? Math.round((count / da.total_answers) * 100) : 0;
                              const isCorrect = key === da.correct_answer;
                              return (
                                <div key={key} className={`p-3 rounded-xl border-2 ${isCorrect ? 'border-green-300 bg-green-50' : 'border-border bg-muted/30'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-bold ${isCorrect ? 'text-green-700' : 'text-muted-foreground'}`}>{key}</span>
                                    {isCorrect && <span className="text-xs text-green-600">✓</span>}
                                  </div>
                                  <p className="text-xs text-foreground truncate mb-2">{val as string}</p>
                                  <p className={`text-sm font-bold ${isCorrect ? 'text-green-700' : count > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{count} ({pct}%)</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Student table */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h2 className="text-base font-semibold text-foreground">תלמידים ({analytics.student_count})</h2>
                    <div className="relative">
                      <svg className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" strokeWidth="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <input type="text" placeholder="חפש תלמיד..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pr-9 pl-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">תלמיד</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">ציון</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">אחוז</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">הגשה</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredStudents.map(s => (
                          <tr key={s.student_uid} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 font-medium text-foreground">{s.student_name}</td>
                            <td className="py-3 px-3 text-foreground">{s.score ?? '—'}</td>
                            <td className={`py-3 px-3 font-bold ${pctColor(s.pct)}`}>{s.pct}%</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(s.submitted_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredStudents.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו תלמידים</p>}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClassStats;