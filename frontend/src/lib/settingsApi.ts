const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';
const authH = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface UserSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  language: 'he' | 'en' | 'ar';
  // Accessibility
  dyslexicFont: boolean;
  highContrast: boolean;
  // Export
  defaultExportFormat: 'pdf' | 'docx';
  // Notifications
  notifyNewExam: boolean;
  notifyGrading: boolean;
  notifySystem: boolean;
  // Student
  fieldOfStudy: string;
  yearOfStudy: string;
  institution: string;
  // Teacher
  title: string;
  department: string;
  officeHours: string;
  autoPublish: boolean;
  classSignature: string;
}

export const defaultSettings: UserSettings = {
  theme: 'system',
  language: 'he',
  dyslexicFont: false,
  highContrast: false,
  defaultExportFormat: 'pdf',
  notifyNewExam: true,
  notifyGrading: true,
  notifySystem: false,
  fieldOfStudy: '',
  yearOfStudy: '',
  institution: '',
  title: '',
  department: '',
  officeHours: '',
  autoPublish: false,
  classSignature: '',
};

export const fetchSettings = async (token: string): Promise<UserSettings> => {
  const r = await fetch(`${API()}/settings`, { headers: authH(token) });
  if (!r.ok) return defaultSettings;
  const data = await r.json();
  return { ...defaultSettings, ...data };
};

export const saveSettings = async (token: string, settings: Partial<UserSettings>): Promise<void> => {
  await fetch(`${API()}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authH(token) },
    body: JSON.stringify(settings),
  });
};

export const saveProfile = async (token: string, profile: Record<string, string>): Promise<void> => {
  await fetch(`${API()}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authH(token) },
    body: JSON.stringify(profile),
  });
};

// ── Theme management ──────────────────────────────────────────────────────────

export const applyTheme = (theme: 'light' | 'dark' | 'system') => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // System
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
};

export const applyFont = (dyslexic: boolean) => {
  document.documentElement.style.fontFamily = dyslexic
    ? "'OpenDyslexic', 'Heebo', sans-serif"
    : "'Heebo', sans-serif";
};

export const applyDirection = (language: 'he' | 'en' | 'ar') => {
  const dir = language === 'en' ? 'ltr' : 'rtl';
  document.documentElement.dir = dir;
  document.documentElement.lang = language;
};