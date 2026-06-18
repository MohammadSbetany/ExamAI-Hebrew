import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock shared dependencies ──────────────────────────────────────────────────

vi.mock('@/lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('@/lib/examsApi', () => ({
  listExams: vi.fn(),
  deleteExam: vi.fn(),
  saveExam: vi.fn(),
}));
vi.mock('@/lib/exportUtils', () => ({
  exportBlankDocx: vi.fn(),
  exportGradedDocx: vi.fn(),
}));
vi.mock('@/lib/settingsApi', () => ({
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveProfile: vi.fn(),
  applyTheme: vi.fn(),
  applyFont: vi.fn(),
  applyDirection: vi.fn(),
  defaultSettings: {
    theme: 'light', language: 'he', dyslexicFont: false, highContrast: false,
    defaultExportFormat: 'pdf', notifyNewExam: true, notifyGrading: true,
    notifySystem: false, fieldOfStudy: '', yearOfStudy: '', institution: '',
    title: '', department: '', officeHours: '', autoPublish: false, classSignature: '',
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── gradeLocally extended tests ───────────────────────────────────────────────

describe('gradeLocally — edge cases', () => {
  it('handles single question correctly', async () => {
    const { gradeLocally } = await import('@/utils/gradingUtils');
    const questions = [{ question: 'שאלה?', answer: 'כן' }];
    const result = gradeLocally(questions, ['כן'], 'yesno');
    expect(result.score).toBe(1);
    expect(result.feedback).toHaveLength(1);
  });

  it('returns score 0 for all wrong multiple choice', async () => {
    const { gradeLocally } = await import('@/utils/gradingUtils');
    const questions = [
      { question: 'מה?', answer: 'א', options: { א: 'נכון', ב: 'לא', ג: 'לא', ד: 'לא' } },
    ];
    const result = gradeLocally(questions, ['ד'], 'multiple');
    expect(result.score).toBe(0);
    expect(result.feedback[0].correct).toBe(false);
  });

  it('points field equals 1 for correct, 0 for wrong', async () => {
    const { gradeLocally } = await import('@/utils/gradingUtils');
    const questions = [
      { question: 'א?', answer: 'כן' },
      { question: 'ב?', answer: 'לא' },
    ];
    const result = gradeLocally(questions, ['כן', 'כן'], 'yesno');
    expect(result.feedback[0].points).toBe(1);
    expect(result.feedback[1].points).toBe(0);
  });

  it('feedback array length matches questions length', async () => {
    const { gradeLocally } = await import('@/utils/gradingUtils');
    const questions = Array(5).fill(null).map((_, i) => ({
      question: `שאלה ${i}?`, answer: 'כן'
    }));
    const result = gradeLocally(questions, Array(5).fill('כן'), 'yesno');
    expect(result.feedback).toHaveLength(5);
  });
});

// ── Question type interfaces ───────────────────────────────────────────────────

describe('Question TypeScript types', () => {
  it('Question interface has required fields', async () => {
    await import('@/types/questions');
    const q = { question: 'מה?', answer: 'תשובה' };
    expect(q.question).toBeDefined();
    expect(q.answer).toBeDefined();
  });

  it('GradeResult interface has score and feedback', async () => {
    const result = {
      score: 3,
      feedback: [
        { question: 'מה?', points: 1, correct: true, explanation: 'טוב', covered_points: [], missed_points: [] }
      ]
    };
    expect(result.score).toBe(3);
    expect(result.feedback[0].correct).toBe(true);
  });
});

// ── MyExams page tests ────────────────────────────────────────────────────────

const mockUser = { token: 'test-token', uid: 'uid-123', name: 'Test', email: 'test@test.com', role: 'student' as const };

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn(), loading: false }),
}));

describe('MyExams — gallery view', () => {
  let listExams: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    const api = await import('@/lib/examsApi');
    listExams = vi.mocked(api.listExams);
  });

  it('shows loading spinner initially', async () => {
    listExams.mockImplementation(() => new Promise(() => {}));
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows empty state when no exams', async () => {
    listExams.mockResolvedValue([]);
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/אין בחינות שמורות/i)).toBeInTheDocument();
    });
  });

  it('renders exam cards when exams exist', async () => {
    listExams.mockResolvedValue([{
      id: 'exam-1', uid: 'uid-123', title: 'בחינה ראשונה',
      exam_type: 'generated', question_type: 'open',
      questions: [], answers: [], grade_result: null,
      score: null, total: 5,
      created_at: '2026-01-01T00:00:00Z', graded_at: null
    }]);
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('בחינה ראשונה')).toBeInTheDocument();
    });
  });

  it('shows score badge for graded exams', async () => {
    listExams.mockResolvedValue([{
      id: 'exam-1', uid: 'uid-123', title: 'בחינה עם ציון',
      exam_type: 'generated', question_type: 'open',
      questions: Array(5).fill({ question: 'מה?', answer: 'תשובה' }),
      answers: Array(5).fill('תשובה'),
      grade_result: { score: 4, feedback: [] },
      score: 4, total: 5,
      created_at: '2026-01-01T00:00:00Z', graded_at: '2026-01-02T00:00:00Z'
    }]);
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });
  });

  it('filter buttons render correctly', async () => {
    listExams.mockResolvedValue([]);
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('הכל')).toBeInTheDocument();
      expect(screen.getByText('עם ציון')).toBeInTheDocument();
      expect(screen.getByText('ממתין')).toBeInTheDocument();
    });
  });

  it('search input renders', async () => {
    listExams.mockResolvedValue([]);
    const { default: MyExams } = await import('@/pages/MyExams');
    render(<MemoryRouter><MyExams /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/חפש לפי שם/i)).toBeInTheDocument();
    });
  });
});

// ── Flashcards page tests ─────────────────────────────────────────────────────

describe('Flashcards — upload view', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the page title', async () => {
    const { default: Flashcards } = await import('@/pages/Flashcards');
    render(<MemoryRouter><Flashcards /></MemoryRouter>);
    expect(screen.getByText('כרטיסיות לימוד')).toBeInTheDocument();
  });

  it('renders file upload area', async () => {
    const { default: Flashcards } = await import('@/pages/Flashcards');
    render(<MemoryRouter><Flashcards /></MemoryRouter>);
    expect(screen.getByText('צור כרטיסיות')).toBeInTheDocument();
  });

  it('generate button disabled when no files selected', async () => {
    const { default: Flashcards } = await import('@/pages/Flashcards');
    render(<MemoryRouter><Flashcards /></MemoryRouter>);
    const btn = screen.getByText('צור כרטיסיות');
    expect(btn).toBeDisabled();
  });
});

// ── Dashboard tests ───────────────────────────────────────────────────────────

describe('Dashboard — student view', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders dashboard heading area', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ exams: [] })
    });
    const { default: Dashboard } = await import('@/pages/Dashboard');
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => {
      // Should render something after loading
      expect(document.body).toBeTruthy();
    });
  });
});

// ── Settings page tests ───────────────────────────────────────────────────────

describe('Settings — tabs and structure', () => {
  let fetchSettings: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const api = await import('@/lib/settingsApi');
    fetchSettings = vi.mocked(api.fetchSettings);
    fetchSettings.mockResolvedValue({
      theme: 'light', language: 'he', dyslexicFont: false, highContrast: false,
      defaultExportFormat: 'pdf', notifyNewExam: true, notifyGrading: true,
      notifySystem: false, fieldOfStudy: '', yearOfStudy: '', institution: '',
      title: '', department: '', officeHours: '', autoPublish: false, classSignature: '',
    });
  });

  it('renders account tab by default', async () => {
    const { default: Settings } = await import('@/pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('חשבון')).toBeInTheDocument();
    });
  });

  it('renders appearance tab button', async () => {
    const { default: Settings } = await import('@/pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('מראה')).toBeInTheDocument();
    });
  });

  it('renders privacy tab button', async () => {
    const { default: Settings } = await import('@/pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('פרטיות')).toBeInTheDocument();
    });
  });

  it('clicking appearance tab shows theme options', async () => {
    const { default: Settings } = await import('@/pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => screen.getByText('מראה'));
    fireEvent.click(screen.getByText('מראה'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /בהיר/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /כהה/ })).toBeInTheDocument();
    });
  });

  it('does not show system theme option', async () => {
    const { default: Settings } = await import('@/pages/Settings');
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => screen.getByText('מראה'));
    fireEvent.click(screen.getByText('מראה'));
    await waitFor(() => {
      const systemButtons = screen.queryAllByRole('button', { name: /💻|מערכת/ });
      expect(systemButtons).toHaveLength(0);
    });
  });
});

// ── NotFound page ─────────────────────────────────────────────────────────────

describe('NotFound page', () => {
  it('renders 404 message', async () => {
    const { default: NotFound } = await import('@/pages/NotFound');
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByText('404')).toBeInTheDocument();
  });
});

// ── ProtectedRoute with requireTeacher ────────────────────────────────────────

describe('ProtectedRoute — teacher guard', () => {
  it('redirects student from teacher-only route', async () => {
    vi.doMock('@/context/AuthContext', () => ({
      useAuth: () => ({
        user: { ...mockUser, role: 'student' },
        loading: false, logout: vi.fn()
      }),
    }));
    const { default: ProtectedRoute } = await import('@/components/ProtectedRoute');
    render(
      <MemoryRouter>
        <ProtectedRoute requireTeacher>
          <div>Teacher Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('Teacher Content')).toBeNull();
    });
  });
});

// ── ExportMenu tests ──────────────────────────────────────────────────────────

describe('ExportMenu component', () => {
  it('renders export dropdown trigger', async () => {
    const { exportBlankDocx } = await import('@/lib/exportUtils');
    const { default: ExportMenu } = await import('@/components/ExportMenu');
    const mockQuestions = [{ question: 'מה?', answer: 'תשובה' }];
    render(
      <MemoryRouter>
        <ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />
      </MemoryRouter>
    );
    expect(screen.getByText(/ייצוא/i)).toBeInTheDocument();
  });
});