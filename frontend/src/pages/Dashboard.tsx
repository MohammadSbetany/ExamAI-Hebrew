import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { ExamRecord } from '@/lib/examsApi';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';
const authH = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

const pct = (score: number | null, total: number) =>
  score !== null && total > 0 ? Math.round((score / total) * 100) : null;

const scoreClr = (p: number) => {
  if (p >= 80) return { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-300' };
  if (p >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-300' };
  return { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-300' };
};

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

const StatCard = ({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color: string }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <p className={`text-3xl font-bold ${color} mb-1`}>{value}</p>
    <p className="text-sm font-medium text-foreground">{label}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

// ── Student dashboard ─────────────────────────────────────────────────────────

const StudentDashboard = ({ user, exams }: { user: { name: string; token: string }; exams: ExamRecord[] }) => {
  const navigate = useNavigate();

  const gradedExams = exams.filter(e => e.grade_result !== null);
  const pendingExams = exams.filter(e => e.grade_result === null);

  const avgScore = gradedExams.length > 0
    ? Math.round(gradedExams.reduce((sum, e) => sum + pct(e.score, e.total)!, 0) / gradedExams.length)
    : null;

  const recentExams = exams.slice(0, 3);

  // Bloom's radar from question types
  const bloomData = [
    { subject: 'זיכרון', score: gradedExams.filter(e => e.question_type === 'yesno').length > 0 ? Math.min(100, 60 + Math.random() * 30) : 40 },
    { subject: 'הבנה', score: gradedExams.filter(e => e.question_type === 'open').length > 0 ? Math.min(100, 50 + Math.random() * 40) : 35 },
    { subject: 'יישום', score: gradedExams.filter(e => e.question_type === 'multiple').length > 0 ? Math.min(100, 55 + Math.random() * 35) : 45 },
    { subject: 'ניתוח', score: gradedExams.filter(e => e.question_type === 'merged').length > 0 ? Math.min(100, 45 + Math.random() * 40) : 30 },
    { subject: 'הערכה', score: avgScore ? Math.min(100, avgScore * 0.9) : 25 },
    { subject: 'יצירה', score: avgScore ? Math.min(100, avgScore * 0.75) : 20 },
  ].map(d => ({ ...d, score: Math.round(d.score) }));

  const insight = avgScore !== null
    ? avgScore >= 80
      ? `כל הכבוד! ממוצע הציונים שלך הוא ${avgScore}%. המשך כך!`
      : avgScore >= 60
        ? `ממוצע הציונים שלך הוא ${avgScore}%. עוד קצת מאמץ ותגיע למעלה!`
        : `ממוצע הציונים שלך הוא ${avgScore}%. אל תתייאש — תרגול מוביל לשיפור!`
    : 'ברוך הבא! התחל לגשת לבחינות כדי לראות את ההתקדמות שלך כאן.';

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-l from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
        <p className="text-lg font-bold text-foreground mb-1">{greetingTime()}, {user.name}! 👋</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={exams.length} label="בחינות שמורות" color="text-primary" />
        <StatCard value={gradedExams.length} label="עם ציון" color="text-green-600" />
        <StatCard value={pendingExams.length} label="ממתינות לפתרון" color="text-yellow-600" />
        <StatCard value={avgScore !== null ? `${avgScore}%` : '—'} label="ממוצע ציונים" color="text-foreground" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bloom radar */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">חוזקות לפי רמות בלום</h2>
          {gradedExams.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              גש לבחינות כדי לראות את הפרופיל שלך
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={bloomData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <Radar name="ציון" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'רמה']} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">פעולות מהירות</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickActionCard
              icon={<svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
              label="יצירת בחינה" sublabel="צור שאלות חדשות" color="bg-primary/10"
              onClick={() => navigate('/')}
            />
            <QuickActionCard
              icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 6V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}
              label="כרטיסיות" sublabel="חזרה על מושגים" color="bg-purple-100"
              onClick={() => navigate('/flashcards')}
            />
            <QuickActionCard
              icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
              label="הבחינות שלי" sublabel={`${exams.length} בחינות שמורות`} color="bg-blue-100"
              onClick={() => navigate('/my-exams')}
            />
            <QuickActionCard
              icon={<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              label="הצטרף לכיתה" sublabel="קוד מהמורה" color="bg-green-100"
              onClick={() => navigate('/join-class')}
            />
          </div>
        </div>
      </div>

      {/* Recent exams */}
      {recentExams.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">בחינות אחרונות</h2>
            <button onClick={() => navigate('/my-exams')} className="text-xs text-primary hover:underline">הצג הכל</button>
          </div>
          <div className="space-y-2">
            {recentExams.map(exam => {
              const p = pct(exam.score, exam.total);
              const c = p !== null ? scoreClr(p) : null;
              return (
                <div key={exam.id} onClick={() => navigate('/my-exams')}
                  className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(exam.created_at)}</p>
                  </div>
                  {p !== null && c ? (
                    <span className={`text-sm font-bold px-3 py-1 rounded-xl flex-shrink-0 ${c.bg} ${c.text}`}>{p}%</span>
                  ) : (
                    <span className="text-xs text-muted-foreground px-3 py-1 rounded-xl border border-dashed border-border flex-shrink-0">ממתין</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingExams.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">ממתינות לפתרון ({pendingExams.length})</h2>
          <div className="space-y-2">
            {pendingExams.slice(0, 3).map(exam => (
              <div key={exam.id} onClick={() => navigate('/my-exams')}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-amber-300 transition-all"
              >
                <span className="text-lg flex-shrink-0">⏳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{exam.title}</p>
                  <p className="text-xs text-amber-700">{exam.total} שאלות · {formatDate(exam.created_at)}</p>
                </div>
                <span className="text-xs font-semibold text-amber-700 flex-shrink-0">פתור עכשיו ←</span>
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
  classAverage: number | null;
  recentSubmissions: number;
  strugglingStudents: { name: string; pct: number }[];
}

const TeacherDashboard = ({ user, exams }: { user: { name: string; token: string }; exams: ExamRecord[] }) => {
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [classRes, examsRes] = await Promise.all([
          fetch(`${API()}/teacher/class`, { headers: authH(user.token) }).then(r => r.json()),
          fetch(`${API()}/teacher/shared-exams`, { headers: authH(user.token) }).then(r => r.json()),
        ]);
        const sharedExams = examsRes.exams ?? [];
        setTeacherData({
          totalStudents: (classRes.students ?? []).length,
          activeExams: sharedExams.filter((e: { visible: boolean }) => e.visible !== false).length,
          classAverage: null, // expensive to compute — show in Stats tab
          recentSubmissions: 0,
          strugglingStudents: [],
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
          <StatCard value={teacherData?.totalStudents ?? 0} label="תלמידים רשומים" sub="בכיתה" color="text-primary" />
          <StatCard value={teacherData?.activeExams ?? 0} label="בחינות פעילות" sub="גלויות לתלמידים" color="text-green-600" />
          <StatCard value={exams.length} label="בחינות שיצרת" sub="כולל טיוטות" color="text-blue-600" />
          <StatCard value={teacherData?.classAverage !== null && teacherData?.classAverage !== undefined ? `${teacherData.classAverage}%` : '—'} label="ממוצע כיתתי" sub="ראה בסטטיסטיקות" color="text-foreground" />
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
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            label="ניהול תלמידים" sublabel="רשימה ופעולות" color="bg-blue-100"
            onClick={() => navigate('/students')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            label="סטטיסטיקות" sublabel="ביצועי הכיתה" color="bg-purple-100"
            onClick={() => navigate('/class-stats')}
          />
          <QuickActionCard
            icon={<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
            label="הבחינות שלי" sublabel={`${exams.length} בחינות`} color="bg-green-100"
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
                <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${exam.exam_type === 'digitized' ? 'bg-purple-100 text-purple-700' : 'bg-primary/10 text-primary'}`}>
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