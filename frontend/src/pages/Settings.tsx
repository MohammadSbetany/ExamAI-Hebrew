import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import {
  fetchSettings, fetchProfile, saveSettings, saveProfile, applyTheme, applyFont, applyDirection,
  defaultSettings, type UserSettings,
} from '@/lib/settingsApi';

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
  const { user, refreshUser } = useAuth();
  const { t, isRTL } = useTranslation();
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

  // ── Nav tabs ──────────────────────────────────────────────────────────────────

  type Tab = 'account' | 'appearance';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'account',    label: t('settings.tabAccount'), icon: '👤' },
    { id: 'appearance', label: t('settings.tabAppearance'),  icon: '🎨' },
  ];

  useEffect(() => {
    if (!user?.token) return;
    fetchSettings(user.token).then(s => {
      setSettings(s);
      applyTheme(s.theme);
      applyFont(s.dyslexicFont);
      applyDirection(s.language);
    }).finally(() => setLoading(false));
    // Load the saved profile fields so they show their current values (name,
    // title, institution, …) instead of appearing blank.
    fetchProfile(user.token).then(p => {
      if (p.name) setName(p.name);
      setProfileFields({
        title: p.title ?? '',
        department: p.department ?? '',
        institution: p.institution ?? '',
        field_of_study: p.field_of_study ?? '',
        year_of_study: p.year_of_study ?? '',
        office_hours: p.office_hours ?? '',
      });
    }).catch(() => { /* keep empty defaults on failure */ });
  }, [user?.token]);

  const handleToggle = async (key: keyof UserSettings, value: boolean | string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated as UserSettings);

    // Apply immediately
    if (key === 'theme') applyTheme(value as 'light' | 'dark');
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
    try {
      await saveProfile(user.token, { name, ...profileFields });
      await refreshUser();   // update the in-memory user so the new name shows immediately
      flashSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 6) { setPasswordError(t('settings.passwordTooShort')); return; }
    if (newPassword !== confirmPassword) { setPasswordError(t('settings.passwordMismatch')); return; }
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
      setPasswordError(t('settings.passwordWrong'));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  }

  return (
    <div className="bg-background min-h-screen py-10 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">{t('settings.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('settings.subtitle')}</p>
          </div>
          {saved && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-xl text-sm font-medium">
              <span>✓</span> {t('settings.saved')}
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
                <Section title={t('settings.profileDetails')}>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.fullName')}</label>
                      <TextInput value={name} onChange={setName} placeholder={t('settings.fullNamePlaceholder')} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.email')}</label>
                      <input value={user?.email ?? ''} disabled
                        className="w-full px-3 py-2 rounded-xl border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed" />
                    </div>
                    {isTeacher ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.titleField')}</label>
                          <TextInput value={profileFields.title ?? ''} onChange={v => setProfileFields(p => ({ ...p, title: v }))} placeholder={t('settings.titlePlaceholder')}/>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.institution')}</label>
                          <TextInput value={profileFields.institution ?? ''} onChange={v => setProfileFields(p => ({ ...p, institution: v }))} placeholder={t('settings.institutionPlaceholder')} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.fieldOfStudy')}</label>
                          <TextInput value={profileFields.field_of_study ?? ''} onChange={v => setProfileFields(p => ({ ...p, field_of_study: v }))} placeholder={t('settings.fieldOfStudyPlaceholder')} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.yearOfStudy')}</label>
                          <Select value={profileFields.year_of_study ?? ''} onChange={v => setProfileFields(p => ({ ...p, year_of_study: v }))}
                            options={[{ value: '', label: t('settings.yearSelect') }, { value: '1', label: t('settings.year1') }, { value: '2', label: t('settings.year2') }, { value: '3', label: t('settings.year3') }, { value: '4', label: t('settings.year4') }, { value: '5+', label: t('settings.year5plus') }]} />
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                    {saving ? t('settings.saving') : t('settings.saveProfile')}
                  </button>
                </Section>

                <Section title={t('settings.changePassword')}>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.currentPassword')}</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.newPassword')}</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('settings.newPasswordPlaceholder')} dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('settings.confirmPassword')}</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" dir="ltr"
                        className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    </div>
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    {passwordSuccess && <p className="text-xs text-green-600 dark:text-green-400">{t('settings.passwordChanged')}</p>}
                  </div>
                  <button onClick={handleChangePassword}
                    className="w-full py-2.5 rounded-xl border-2 border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
                    {t('settings.changePasswordBtn')}
                  </button>
                </Section>
              </>
            )}

            {/* ── Appearance tab ── */}
            {activeTab === 'appearance' && (
              <>
                <Section title={t('settings.theme')}>
                  <Row label={t('settings.displayMode')} sub={t('settings.displayModeSub')}>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted rounded-xl">
                      {[{ value: 'light', label: `☀️ ${t('settings.lightMode')}` }, { value: 'dark', label: `🌙 ${t('settings.darkMode')}` }].map(({ value, label }) => (
                        <button key={value} onClick={() => handleToggle('theme', value)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${settings.theme === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </Row>
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
