import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconCreate = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconExams = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconProgress = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const IconFlashcards = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M12 6V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="16" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

const IconStudents = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconStats = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const IconClose = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  isTeacher?: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

// ─── Nav Item Component ───────────────────────────────────────────────────────

const SidebarNavItem = ({ item, collapsed }: { item: NavItem; collapsed: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;

  return (
    <NavLink
      to={item.path}
      title={collapsed ? item.label : undefined}
      className={`
        sidebar-nav-item group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
        text-sm font-medium transition-all duration-150 cursor-pointer select-none
        ${isActive
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
          : 'text-foreground/70 hover:bg-accent hover:text-accent-foreground'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
    >
      <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'}`}>
        {item.icon}
      </span>

      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}

      {/* Tooltip on collapse */}
      {collapsed && (
        <span className="
          sidebar-tooltip absolute right-full mr-3 px-2.5 py-1.5 rounded-lg
          bg-foreground text-background text-xs font-medium whitespace-nowrap
          opacity-0 pointer-events-none translate-x-1
          group-hover:opacity-100 group-hover:translate-x-0
          transition-all duration-150 z-50
        ">
          {item.label}
        </span>
      )}
    </NavLink>
  );
};

// ─── Section Label ────────────────────────────────────────────────────────────

const SectionLabel = ({ label, collapsed }: { label: string; collapsed: boolean }) => (
  <div className={`px-3 mb-1 mt-5 first:mt-0 ${collapsed ? 'flex justify-center' : ''}`}>
    {collapsed
      ? <div className="w-6 h-px bg-border" />
      : <span className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground/60">{label}</span>
    }
  </div>
);

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

const Sidebar = ({ isTeacher }: SidebarProps) => {
  const { user, logout } = useAuth();
  const resolvedIsTeacher = isTeacher ?? user?.role === 'teacher';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);


  const mainItems: NavItem[] = [
    { label: 'לוח בקרה', path: '/dashboard', icon: <IconDashboard /> },
    { label: 'יצירת בחינה', path: '/', icon: <IconCreate /> },
    { label: 'הבחינות שלי', path: '/my-exams', icon: <IconExams /> },
    { label: 'כרטיסיות לימוד', path: '/flashcards', icon: <IconFlashcards /> },
  ];

  const teacherItems: NavItem[] = [
    { label: 'ניהול תלמידים', path: '/students', icon: <IconStudents /> },
    { label: 'סטטיסטיקות כיתה', path: '/class-stats', icon: <IconStats /> },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo + collapse toggle */}
      <div className={`flex items-center h-16 px-4 border-b border-border flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <img src="/favicon.ico" alt="ExamAI" className="w-4 h-4 object-contain" />
            </div>
            <span className="font-bold text-base text-foreground tracking-tight">ExamAI</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <img src="/favicon.ico" alt="ExamAI" className="w-4 h-4 object-contain" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={`hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${collapsed ? 'mt-0' : ''}`}
          title={collapsed ? 'הרחב סרגל צד' : 'כווץ סרגל צד'}
        >
          <IconChevron open={!collapsed} />
        </button>
      </div>

      {/* Nav items — scrollable */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">

        <SectionLabel label="ראשי" collapsed={collapsed} />
        {mainItems.map(item => (
          <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
        ))}

        {resolvedIsTeacher && (
          <>
            <SectionLabel label="מורה" collapsed={collapsed} />
            {teacherItems.map(item => (
              <SidebarNavItem key={item.path} item={item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom pinned */}
      <div className="flex-shrink-0 border-t border-border px-2 py-3 space-y-0.5">
        <SidebarNavItem item={{ label: 'הגדרות', path: '/settings', icon: <IconSettings /> }} collapsed={collapsed} />

        {/* User profile */}
<div
  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1 cursor-pointer hover:bg-accent transition-colors group ${collapsed ? 'justify-center' : ''}`}
  onClick={logout}
  title="התנתק"
>
  <div className="relative flex-shrink-0">
    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">
      {user?.name?.charAt(0) ?? '?'}
    </div>
    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-success border-2 border-card" />
  </div>
  {!collapsed && (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{user?.name ?? ''}</p>
      <p className="text-xs text-muted-foreground truncate">{user?.role === 'teacher' ? 'מורה' : 'תלמיד'}</p>
    </div>
  )}
</div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`
          hidden md:flex flex-col h-screen sticky top-0
          bg-card border-l border-border
          transition-all duration-200 ease-in-out flex-shrink-0
          ${collapsed ? 'w-[68px]' : 'w-[220px]'}
        `}
        style={{ direction: 'rtl' }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4" style={{ direction: 'rtl' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <img src="/favicon.ico" alt="ExamAI" className="w-4 h-4 object-contain" />
          </div>
          <span className="font-bold text-sm text-foreground">ExamAI</span>
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
        >
          {mobileOpen ? <IconClose /> : <IconMenu />}
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`
          md:hidden fixed top-14 right-0 bottom-0 z-40 w-[260px]
          bg-card border-l border-border
          transform transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ direction: 'rtl' }}
        onClick={() => setMobileOpen(false)}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;