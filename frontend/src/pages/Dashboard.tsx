import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { ExamRecord } from '@/lib/examsApi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';
const authH = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

const greetingTime = () => {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  return 'ערב טוב';
};

// ── Icons ─────────────────────────────────────────────────────────────────────

const QuickActionCard = ({ icon, label, sublabel, onClick, color }: {
  icon: React.ReactNode; label: string; sublabel: string;
  onClick: () => void; color: string;
}) => (
  <button onClick={onClick}
    className="bg-card border border-border rounded-2xl p-5 text-right hover:border-primary/40 hover:shadow-md transition-all group w-full"
  >
    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <p className="font-semibold text-foreground text-sm">{label}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
  </button>
);

const StatCard = ({ value, label, sub, color, onClick }: { value: string | number; label: string; sub?: string; color: string; onClick?: () => void }) => (
  <div onClick={onClick}
    className={`bg-card border border-border rounded-2xl p-5 ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all' : ''}`}>
    <p className={`text-3xl font-bold ${color} mb-1`}>{value}</p>
    <p className="text-sm font-medium text-foreground">{label}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

// ── Student dashboard ─────────────────────────────────────────────────────────

interface StudentClassExam {
  id: string;
  classId?: string;
  className?: string;
  title: string;
  questions?: unknown[];
  created_at: string;
  open_at: string | null;
  close_at: string | null;
  visible: boolean;
  my_submission?: { submitted_at?: string; grade_result?: { score: number } | null } | null;
}

const isExamOpen = (e: StudentClassExam) => {
  if (!e.visible) return false;
  const now = Date.now();
  if (e.open_at && now < new Date(e.open_at).getTime()) return false;
  if (e.close_at && now > new Date(e.close_at).getTime()) return false;
  return true;
};

const StudentDashboard = ({ user, exams }: { user: { name: string; token: string }; exams: ExamRecord[] }) => {
  const navigate = useNavigate();
  const [classExams, setClassExams] = useState<StudentClassExam[]>([]);
  const [loadingClass, setLoadingClass] = useState(true);

  // Pull every class exam (with the student's own submission) across all their classes
  useEffect(() => {
    const load = async () => {
      try {
        const classesRes = await fetch(`${API()}/student/classes`, { headers: authH(user.token) }).then(r => r.json());
        const classes = classesRes.classes ?? [];
        const perClass = await Promise.all(
          classes.map((c: { id: string; name: string }) =>
            fetch(`${API()}/student/classes/${c.id}/exams`, { headers: authH(user.token) })
              .then(r => (r.ok ? r.json() : { exams: [] }))
              .then(d => (d.exams ?? []).map((e: StudentClassExam) => ({ ...e, classId: c.id, className: c.name })))
              .catch(() => [])
          )
        );
        setClassExams(perClass.flat());
      } catch { /* silent */ } finally {
        setLoadingClass(false);
      }
    };
    load();
  }, [user.token]);

  const examPct = (e: StudentClassExam): number | null => {
    const total = e.questions?.length ?? 0;
    const score = e.my_submission?.grade_result?.score;
    return score != null && total > 0 ? Math.round((score / total) * 100) : null;
  };

  const graded = classExams.filter(e => e.my_submission?.grade_result);
  const notSubmitted = classExams.filter(e => !e.my_submission);
  const openToTake = notSubmitted.filter(isExamOpen);

  const gradedPcts = graded.map(examPct).filter((p): p is number => p !== null);
  const avgScore = gradedPcts.length ? Math.round(gradedPcts.reduce((a, b) => a + b, 0) / gradedPcts.length) : null;

  // Grades across all graded class exams, ordered by date
  const trendData = graded
    .map(e => ({ raw: e.my_submission?.submitted_at || e.created_at, score: examPct(e) }))
    .filter((d): d is { raw: string; score: number } => d.score !== null)
    .sort((a, b) => new Date(a.raw).getTime() - new Date(b.raw).getTime())
    .map(d => ({ date: formatDate(d.raw), score: d.score }));

  const insight = avgScore !== null
    ? avgScore >= 80
      ? `כל הכבוד! ממוצע הציונים שלך בכיתות הוא ${avgScore}%. המשך כך!`
      : avgScore >= 60
        ? `ממוצע הציונים שלך בכיתות הוא ${avgScore}%. עוד קצת מאמץ ותגיע למעלה!`
        : `ממוצע הציונים שלך בכיתות הוא ${avgScore}%. אל תתייאש — תרגול מוביל לשיפור!`
    : classExams.length > 0
      ? 'יש לך בחינות בכיתות. פתור אותן כדי לראות את ההתקדמות שלך כאן.'
      : 'ברוך הבא! הצטרף לכיתה כדי לראות את הבחינות והציונים שלך כאן.';

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-l from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
        <p className="text-lg font-bold text-foreground mb-1">{greetingTime()}, {user.name}! 👋</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
      </div>

      {/* Stat row — based on class exams */}
      {loadingClass ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={classExams.length} label="בחינות בכיתות" color="text-primary" onClick={() => navigate('/my-classes')} />
          <StatCard value={graded.length} label="נבדקו" sub="עם ציון" color="text-green-600 dark:text-green-400" />
          <StatCard value={openToTake.length} label="ממתינות לפתרון" sub="פתוחות להגשה" color="text-yellow-600 dark:text-yellow-400" onClick={() => navigate('/my-classes')} />
          <StatCard value={avgScore !== null ? `${avgScore}%` : '—'} label="ממוצע ציונים" color="text-foreground" />
        </div>
      )}

      {/* Grades trend — full-width, own row, all classes by date */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">מגמת ציונים — כל הכיתות</h2>
        {loadingClass ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
        ) : trendData.length < 2 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-4">
            {trendData.length === 0
              ? 'אין עדיין ציונים. פתור בחינות בכיתות כדי לראות מגמה.'
              : 'פתור עוד בחינה כדי לראות מגמה לאורך זמן.'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'ציון']} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick actions — own row */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">פעולות מהירות</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
            label="יצירת בחינה" sublabel="צור שאלות חדשות" color="bg-primary/10"
            onClick={() => navigate('/')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 6V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}
            label="כרטיסיות" sublabel="חזרה על מושגים" color="bg-purple-100 dark:bg-purple-900/40"
            onClick={() => navigate('/flashcards')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label="הבחינות שלי" sublabel={`${exams.length} בחינות שמורות`} color="bg-blue-100 dark:bg-blue-900/40"
            onClick={() => navigate('/my-exams')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            label="הכיתות שלי" sublabel="בחינות וציונים" color="bg-green-100 dark:bg-green-900/40"
            onClick={() => navigate('/my-classes')}
          />
        </div>
      </div>

      {/* Open class exams to take */}
      {openToTake.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">בחינות פתוחות להגשה ({openToTake.length})</h2>
          <div className="space-y-2">
            {openToTake.slice(0, 3).map(exam => (
              <div key={exam.id} onClick={() => navigate('/my-classes', { state: { classId: exam.classId, examId: exam.id } })}
                className="bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-all"
              >
                <span className="text-lg flex-shrink-0">⏳</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{exam.title}</p>
                    {exam.className && (
                      <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">
                        {exam.className}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{exam.questions?.length ?? 0} שאלות · {formatDate(exam.created_at)}</p>
                </div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex-shrink-0">פתור עכשיו ←</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Teacher dashboard ─────────────────────────────────────────────────────────

interface TeacherData {
  totalStudents: number;
  activeExams: number;
  submissionsToGrade: number;
}

const TeacherDashboard = ({ user, exams }: { user: { name: string; token: string }; exams: ExamRecord[] }) => {
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const classesRes = await fetch(`${API()}/classes`, { headers: authH(user.token) }).then(r => r.json());
        const allClasses = classesRes.classes ?? [];
        const totalStudents = allClasses.reduce((sum: number, c: { students?: { uid: string }[] }) => sum + (c.students?.length ?? 0), 0);

        // Gather all class exams, then count submissions still awaiting grading
        const examsPerClass = await Promise.all(
          allClasses.map((c: { id: string }) =>
            fetch(`${API()}/classes/${c.id}/exams`, { headers: authH(user.token) })
              .then(r => (r.ok ? r.json() : { exams: [] }))
              .then(d => d.exams ?? [])
              .catch(() => [])
          )
        );
        const allClassExams = examsPerClass.flat() as { id: string; visible?: boolean }[];

        const subsPerExam = await Promise.all(
          allClassExams.map(e =>
            fetch(`${API()}/class-exams/${e.id}/submissions`, { headers: authH(user.token) })
              .then(r => (r.ok ? r.json() : { submissions: [] }))
              .then(d => d.submissions ?? [])
              .catch(() => [])
          )
        );
        const submissionsToGrade = subsPerExam.flat()
          .filter((s: { graded_by: string | null }) => !s.graded_by).length;

        setTeacherData({
          totalStudents,
          activeExams: allClassExams.filter(e => e.visible !== false).length,
          submissionsToGrade,
        });
      } catch { /* silent */ } finally {
        setLoadingTeacher(false);
      }
    };
    load();
  }, [user.token]);

  return (
    <div className="space-y-6">

      {/* Welcome */}
      <div className="bg-gradient-to-l from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
        <p className="text-lg font-bold text-foreground mb-1">{greetingTime()}, {user.name}! 📋</p>
        <p className="text-sm text-muted-foreground">כאן תוכל לעקוב אחר ביצועי הכיתה ולנהל את הבחינות שלך.</p>
      </div>

      {/* Stats row */}
      {loadingTeacher ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse bg-muted" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard value={teacherData?.totalStudents ?? 0} label="תלמידים רשומים" sub="בכל הכיתות" color="text-primary" />
          <StatCard value={teacherData?.activeExams ?? 0} label="בחינות פעילות" sub="גלויות לתלמידים" color="text-green-600 dark:text-green-400" />
          <StatCard value={exams.length} label="בחינות שיצרת" sub="כולל טיוטות" color="text-blue-600 dark:text-blue-400" />
          <StatCard value={teacherData?.submissionsToGrade ?? 0} label="ממתינות לבדיקה" sub="הגשות תלמידים" color="text-yellow-600 dark:text-yellow-400" onClick={() => navigate('/students')} />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">פעולות מהירות</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
            label="צור בחינה" sublabel="יצירת שאלות חדשות" color="bg-primary/10"
            onClick={() => navigate('/')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            label="ניהול תלמידים" sublabel="רשימה ופעולות" color="bg-blue-100 dark:bg-blue-900/40"
            onClick={() => navigate('/students')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            label="סטטיסטיקות" sublabel="ביצועי הכיתה" color="bg-purple-100 dark:bg-purple-900/40"
            onClick={() => navigate('/class-stats')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label="הבחינות שלי" sublabel={`${exams.length} בחינות`} color="bg-green-100 dark:bg-green-900/40"
            onClick={() => navigate('/my-exams')}
          />
        </div>
      </div>

      {/* Recent exams created */}
      {exams.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">בחינות שיצרת לאחרונה</h2>
            <button onClick={() => navigate('/my-exams')} className="text-xs text-primary hover:underline">הצג הכל</button>
          </div>
          <div className="space-y-2">
            {exams.slice(0, 4).map(exam => (
              <div key={exam.id} onClick={() => navigate('/my-exams')}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all"
              >
                <span className="text-lg flex-shrink-0">{exam.exam_type === 'digitized' ? '📄' : '✨'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">{exam.total} שאלות · {formatDate(exam.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${exam.exam_type === 'digitized' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-primary/10 text-primary'}`}>
                  {exam.exam_type === 'digitized' ? 'דיגיטציה' : 'נוצרה'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    fetch(`${API()}/exams`, { headers: authH(user.token) })
      .then(r => r.json())
      .then(d => setExams(d.exams ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {user?.role === 'teacher'
          ? <TeacherDashboard user={user} exams={exams} />
          : <StudentDashboard user={user!} exams={exams} />
        }
      </div>
    </div>
  );
};

export default Dashboard;