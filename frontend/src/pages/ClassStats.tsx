import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedExam {
  id: string;
  title: string;
  question_type: string;
  created_at: string;
}

interface QuestionStat {
  index: number;
  question: string;
  success_rate: number;
  avg_points: number;
  answered_count: number;
}

interface StudentRow {
  student_uid: string;
  student_name: string;
  score: number | null;
  pct: number;
  submitted_at: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface DistractorItem {
  index: number;
  question: string;
  correct_answer: string;
  options: Record<string, string>;
  answer_counts: Record<string, number>;
  total_answers: number;
}

interface Analytics {
  exam: { title: string; question_type: string };
  student_count: number;
  submissions: StudentRow[];
  score_stats: { mean: number; median: number; std: number; min: number; max: number; count: number } | null;
  question_stats: QuestionStat[];
  distractor_analysis: DistractorItem[];
  grade_distribution: { label: string; count: number }[];
  ai_recommendations: Recommendation[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

const successColor = (rate: number) => {
  if (rate >= 75) return { bg: 'bg-green-100', text: 'text-green-700', bar: '#22c55e' };
  if (rate >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: '#eab308' };
  return { bg: 'bg-red-100', text: 'text-red-700', bar: '#ef4444' };
};

const pctColor = (pct: number) => {
  if (pct >= 80) return 'text-green-700';
  if (pct >= 60) return 'text-yellow-700';
  return 'text-red-700';
};

const priorityBadge: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const priorityLabel: Record<string, string> = {
  high: 'דחוף', medium: 'בינוני', low: 'נמוך',
};

// ── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-sm" dir="rtl">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} תלמידים</p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ClassStats = () => {
  const { user } = useAuth();
  const [sharedExams, setSharedExams] = useState<SharedExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [examsLoading, setExamsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load shared exams
  useEffect(() => {
    if (!user?.token) return;
    setExamsLoading(true);
    fetch(`${API()}/teacher/shared-exams`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(r => r.json())
      .then(d => setSharedExams(d.exams ?? []))
      .catch(() => setError('שגיאה בטעינת הבחינות'))
      .finally(() => setExamsLoading(false));
  }, [user?.token]);

  // Load analytics when exam selected
  useEffect(() => {
    if (!selectedExamId || !user?.token) return;
    setLoading(true);
    setAnalytics(null);
    setError(null);
    fetch(`${API()}/teacher/analytics/${selectedExamId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(r => r.json())
      .then(setAnalytics)
      .catch(() => setError('שגיאה בטעינת הנתונים'))
      .finally(() => setLoading(false));
  }, [selectedExamId, user?.token]);

  const filteredStudents = (analytics?.submissions ?? []).filter(s =>
    s.student_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-1">סטטיסטיקות כיתה</h1>
          <p className="text-muted-foreground">בחר בחינה משותפת לצפייה בניתוח ביצועי התלמידים</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">{error}</div>
        )}

        {/* Exam selector */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">בחינות משותפות</p>
          {examsLoading ? (
            <div className="flex justify-center py-6"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
          ) : sharedExams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              אין בחינות משותפות עדיין. שתף בחינה מדף יצירת הבחינות.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sharedExams.map(exam => (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                    selectedExamId === exam.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {exam.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {analytics && !loading && (
          <>
            {analytics.student_count === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <p className="text-lg font-semibold text-foreground mb-2">אין נתונים עדיין</p>
                <p className="text-muted-foreground text-sm">שתף את קישור הבחינה עם התלמידים שלך. הנתונים יופיעו כאן לאחר שיגישו את תשובותיהם.</p>
              </div>
            ) : (
              <>
                {/* Score stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'תלמידים', value: analytics.score_stats?.count },
                    { label: 'ממוצע', value: `${analytics.score_stats?.mean}%` },
                    { label: 'חציון', value: `${analytics.score_stats?.median}%` },
                    { label: 'סטיית תקן', value: `${analytics.score_stats?.std}%` },
                    { label: 'טווח', value: `${analytics.score_stats?.min}%–${analytics.score_stats?.max}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                  {/* Grade distribution chart */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h2 className="text-base font-semibold text-foreground mb-4">התפלגות ציונים</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.grade_distribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {analytics.grade_distribution.map((entry, i) => {
                            const mid = (parseInt(entry.label.split('–')[0]) + parseInt(entry.label.split('–')[1])) / 2;
                            return <Cell key={i} fill={mid >= 85 ? '#22c55e' : mid >= 65 ? '#eab308' : '#ef4444'} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* AI Recommendations */}
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                      <span>✨</span> המלצות הוראה
                    </h2>
                    {analytics.ai_recommendations?.length > 0 ? (
                      <div className="space-y-3">
                        {analytics.ai_recommendations.map((rec, i) => (
                          <div key={i} className="p-3 bg-muted/40 rounded-xl border border-border">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${priorityBadge[rec.priority]}`}>
                                {priorityLabel[rec.priority]}
                              </span>
                              <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">אין המלצות זמינות כרגע.</p>
                    )}
                  </div>
                </div>

                {/* Per-question success rate */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-6">
                  <h2 className="text-base font-semibold text-foreground mb-4">אחוז הצלחה לפי שאלה</h2>
                  <div className="space-y-3">
                    {analytics.question_stats.map((qs) => {
                      const c = successColor(qs.success_rate);
                      return (
                        <div key={qs.index} className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {qs.index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate mb-1">{qs.question}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${qs.success_rate}%`, backgroundColor: c.bar }}
                                />
                              </div>
                              <span className={`text-xs font-bold flex-shrink-0 w-10 text-left ${c.text}`}>
                                {qs.success_rate}%
                              </span>
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
                      {analytics.distractor_analysis.map((da) => (
                        <div key={da.index}>
                          <p className="text-sm font-medium text-foreground mb-2">
                            <span className="text-primary font-bold ml-1">שאלה {da.index + 1}:</span>
                            {da.question}
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
                                  <p className={`text-sm font-bold ${isCorrect ? 'text-green-700' : count > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                    {count} ({pct}%)
                                  </p>
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
                      <input
                        type="text"
                        placeholder="חפש תלמיד..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pr-9 pl-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
                      />
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
                        {filteredStudents.map((s) => (
                          <tr key={s.student_uid} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 font-medium text-foreground">{s.student_name}</td>
                            <td className="py-3 px-3 text-foreground">{s.score ?? '—'}</td>
                            <td className={`py-3 px-3 font-bold ${pctColor(s.pct)}`}>{s.pct}%</td>
                            <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(s.submitted_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredStudents.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">לא נמצאו תלמידים</p>
                    )}
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