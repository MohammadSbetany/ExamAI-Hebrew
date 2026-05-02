import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSettings, saveSettings, saveProfile, applyTheme, applyFont, applyDirection,
  defaultSettings, type UserSettings,
} from '@/lib/settingsApi';

// ── Toggle ────────────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-primary' : 'bg-muted'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'right-1' : 'right-6'}`} />
  </button>
);

// ── Section wrapper ───────────────────────────────────────────────────────────

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
    <h3 className="text-base font-semibold text-foreground border-b border-border pb-3">{title}</h3>
    {children}
  </div>
);

const Row = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const TextInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    type="text"
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
  />
);

const Select = ({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const Settings = () => {
  const { user, logout } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields
  const [name, setName] = useState(user?.name ?? '');
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');


  // ── Nav tabs ──────────────────────────────────────────────────────────────────

  type Tab = 'account' | 'appearance' | 'role' | 'privacy';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'account',    label: 'חשבון',     icon: '👤' },
    { id: 'appearance', label: 'מראה',      icon: '🎨' },
    ...(isTeacher ? [{ id: 'role' as Tab, label: 'הגדרות תפקיד', icon: '⚙️' }] : []),
    { id: 'privacy',    label: 'פרטיות',    icon: '🔒' },
  ];

  useEffect(() => {
    if (!user?.token) return;
    fetchSettings(user.token).then(s => {
      setSettings(s);
      applyTheme(s.theme);
      applyFont(s.dyslexicFont);
      applyDirection(s.language);
    }).finally(() => setLoading(false));
  }, [user?.token]);

  const handleToggle = async (key: keyof UserSettings, value: boolean | string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated as UserSettings);

    // Apply immediately
    if (key === 'theme') applyTheme(value as 'light' | 'dark' | 'system');
    if (key === 'dyslexicFont') applyFont(value as boolean);
    if (key === 'language') applyDirection(value as 'he' | 'en' | 'ar');

    if (user?.token) {
      await saveSettings(user.token, { [key]: value });
      flashSaved();
    }
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveProfile = async () => {
    if (!user?.token) return;
    setSaving(true);
    await saveProfile(user.token, { name, ...profileFields });
    flashSaved();
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('הסיסמאות אינן תואמות'); return; }
    // Firebase Auth reauthentication + updatePassword
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser || !user?.email) return;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('הסיסמה הנוכחית שגויה');
    }
  };

  const handleExportData = async () => {
    if (!user?.token) return;
    try {
      const r = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/exams`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await r.json();
      const exams = data.exams ?? [];

      if (exams.length === 0) {
        alert('אין בחינות שמורות להורדה');
        return;
      }

      const { exportBlankPdf } = await import('@/lib/exportUtils');

      for (const exam of exams) {
        if (Array.isArray(exam.questions) && exam.questions.length > 0) {
          await exportBlankPdf(exam.questions);
          // Small delay between downloads to avoid browser blocking
          await new Promise(res => setTimeout(res, 500));
        }
      }
    } catch (e) {
      console.error('Export failed:', e);
      alert('שגיאה בייצוא הנתונים');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">הגדרות</h1>
            <p className="text-muted-foreground text-sm">נהל את פרופיל המשתמש והעדפותיך</p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
              <span>✓</span> נשמר
            </div>
          )}
        </div>

        <div className="flex gap-6 flex-col md:flex-row">

          {/* Sidebar nav */}
          <aside className="md:w-48 flex-shrink-0">
            <div className="bg-card border border-border rounded-2xl p-2 space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-right ${
                    activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 space-y-4">

            {/* ── Account tab ── */}
            {activeTab === 'account' && (
              <>
                <Section title="פרטי פרופיל">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">שם מלא</label>
                      <TextInput value={name} onChange={setName} placeholder="ישראל ישראלי" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">אימייל</label>
                      <input value={user?.email ?? ''} disabled
                        className="w-full px-3 py-2 rounded-xl border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed" />
                    </div>
                    {isTeacher ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">תואר (ד"ר, פרופ')</label>
                          <TextInput value={profileFields.title ?? ''} onChange={v => setProfileFields(p => ({ ...p, title: v }))} placeholder={'ד"ר'}/>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">מחלקה</label>
                          <TextInput value={profileFields.department ?? ''} onChange={v => setProfileFields(p => ({ ...p, department: v }))} placeholder="מדעי המחשב" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">מוסד לימודים</label>
                          <TextInput value={profileFields.institution ?? ''} onChange={v => setProfileFields(p => ({ ...p, institution: v }))} placeholder="אוניברסיטת תל אביב" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">תחום לימוד</label>
                          <TextInput value={profileFields.fieldOfStudy ?? ''} onChange={v => setProfileFields(p => ({ ...p, field_of_study: v }))} placeholder="הנדסת תוכנה" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">שנת לימוד</label>
                          <Select value={profileFields.yearOfStudy ?? ''} onChange={v => setProfileFields(p => ({ ...p, year_of_study: v }))}
                            options={[{ value: '', label: 'בחר' }, { value: '1', label: 'שנה א׳' }, { value: '2', label: 'שנה ב׳' }, { value: '3', label: 'שנה ג׳' }, { value: '4', label: 'שנה ד׳' }, { value: '5+', label: 'שנה ה׳+' }]} />
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saving ? 'שומר...' : 'שמור פרופיל'}
                  </button>
                </Section>

                <Section title="שינוי סיסמה">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">סיסמה נוכחית</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">סיסמה חדשה</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="לפחות 6 תווים" dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">אימות סיסמה חדשה</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    {passwordSuccess && <p className="text-xs text-green-600">הסיסמה שונתה בהצלחה!</p>}
                  </div>
                  <button onClick={handleChangePassword}
                    className="w-full py-2.5 rounded-xl border-2 border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
                    שנה סיסמה
                  </button>
                </Section>
              </>
            )}

            {/* ── Appearance tab ── */}
            {activeTab === 'appearance' && (
              <>
                <Section title="ערכת נושא">
                  <Row label="מצב תצוגה" sub="בחר בין בהיר, כהה, או לפי הגדרות המערכת">
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl">
                      {[{ value: 'light', label: '☀️ בהיר' }, { value: 'dark', label: '🌙 כהה' }, { value: 'system', label: '💻 מערכת' }].map(({ value, label }) => (
                        <button key={value} onClick={() => handleToggle('theme', value)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${settings.theme === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </Row>
                </Section>

                <Section title="התראות">
                  <Row label="בחינה חדשה הוקצתה" sub="התראה כשמורה שיתף איתך בחינה">
                    <Toggle checked={settings.notifyNewExam} onChange={v => handleToggle('notifyNewExam', v)} />
                  </Row>
                  <Row label="בדיקה הושלמה" sub="התראה כשה-AI סיים לבדוק את תשובותיך">
                    <Toggle checked={settings.notifyGrading} onChange={v => handleToggle('notifyGrading', v)} />
                  </Row>
                  <Row label="עדכוני מערכת" sub="התראות על תחזוקה ותכונות חדשות">
                    <Toggle checked={settings.notifySystem} onChange={v => handleToggle('notifySystem', v)} />
                  </Row>
                </Section>
              </>
            )}

            {/* ── Role settings tab ── */}
            {activeTab === 'role' && (
              isTeacher ? (
                <>
                  <Section title="זהות מקצועית">
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">שעות קבלה (גלוי לתלמידים)</label>
                        <textarea value={settings.officeHours} onChange={e => setSettings(s => ({ ...s, officeHours: e.target.value }))}
                          onBlur={() => handleToggle('officeHours', settings.officeHours)}
                          placeholder="ראשון 10:00–12:00, רביעי 14:00–16:00"
                          className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">חתימה לייצוא PDF</label>
                        <TextInput value={settings.classSignature} onChange={v => setSettings(s => ({ ...s, classSignature: v }))}
                          placeholder={'קורס: אלגוריתמים | מרצה: ד"ר כהן | סמסטר א׳'} />
                        <p className="text-xs text-muted-foreground mt-1">יופיע בכותרת התחתונה של כל קובץ PDF מיוצא.</p>
                      </div>
                    </div>
                    <button onClick={() => { handleToggle('officeHours', settings.officeHours); handleToggle('classSignature', settings.classSignature); }}
                      className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                      שמור הגדרות מורה
                    </button>
                  </Section>

                  <Section title="ניהול כיתה">
                    <Row label="פרסום אוטומטי" sub="בחינות חדשות יהיו גלויות מיד לתלמידים (ללא סקירה ידנית)">
                      <Toggle checked={settings.autoPublish} onChange={v => handleToggle('autoPublish', v)} />
                    </Row>
                  </Section>
                </>
                ) : null
            )}

            {/* ── Privacy tab ── */}
            {activeTab === 'privacy' && (
              <>
                <Section title="ייצוא נתונים">
                  <Row label="הורד את כל הנתונים שלי" sub="כולל כל הבחינות, תשובות וציונים בפורמט PDF">
                    <button onClick={handleExportData}
                      className="px-4 py-2 rounded-xl border-2 border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                      הורד PDF
                    </button>
                  </Row>
                </Section>

                <Section title="התנתקות">
                  <Row label="התנתק מהמכשיר הזה" sub="תועבר לדף ההתחברות">
                    <button onClick={logout}
                      className="px-4 py-2 rounded-xl border-2 border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
                      התנתק
                    </button>
                  </Row>
                </Section>

                <Section title="אזור מסוכן">
                  <Row label="מחיקת חשבון" sub="פעולה בלתי הפיכה — כל הנתונים יימחקו לצמיתות">
                    <button onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors">
                      מחק חשבון
                    </button>
                  </Row>

                  {showDeleteConfirm && (
                    <div className="mt-4 p-4 bg-destructive/5 border border-destructive/20 rounded-xl space-y-3">
                      <p className="text-sm font-semibold text-destructive">אישור מחיקת חשבון</p>
                      <p className="text-xs text-muted-foreground">הקלד <strong>מחק את החשבון שלי</strong> לאישור:</p>
                      <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                        placeholder="מחק את החשבון שלי"
                        className="w-full px-3 py-2 rounded-xl border border-destructive/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30" />
                      <div className="flex gap-2">
                        <button
                          disabled={deleteConfirmText !== 'מחק את החשבון שלי'}
                          onClick={async () => {
                            if (deleteConfirmText !== 'מחק את החשבון שלי') return;
                            const { auth } = await import('@/lib/firebase');
                            await auth.currentUser?.delete();
                            await logout();
                          }}
                          className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                          מחק לצמיתות
                        </button>
                        <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                          className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                          ביטול
                        </button>
                      </div>
                    </div>
                  )}
                </Section>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;