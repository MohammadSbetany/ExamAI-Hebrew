import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from '@/components/ExportMenu';
import type { Question, GradeResult } from '@/types/questions';

// ── Mock export functions ─────────────────────────────────────────────────────
vi.mock('@/lib/exportUtils', () => ({
  exportBlankPdf: vi.fn(),
  exportGradedPdf: vi.fn(),
  exportBlankDocx: vi.fn().mockResolvedValue(undefined),
  exportGradedDocx: vi.fn().mockResolvedValue(undefined),
}));

const mockQuestions: Question[] = [
  { question: 'מה זה?', answer: 'תשובה', critical_points: ['נקודה'] },
];

const mockGradeResult: GradeResult = {
  score: 1,
  feedback: [{
    question: 'מה זה?', correct: true, points: 1,
    explanation: 'טוב', covered_points: ['נקודה'], missed_points: [],
  }],
};

describe('ExportMenu — blank variant', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the blank export button', () => {
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />);
    expect(screen.getByText('ייצוא בחינה')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />);
    fireEvent.click(screen.getByText('ייצוא בחינה'));
    expect(screen.getByText('קובץ PDF')).toBeInTheDocument();
    expect(screen.getByText('קובץ Word')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByText('ייצוא בחינה'));
    expect(screen.getByText('קובץ PDF')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('קובץ PDF')).not.toBeInTheDocument();
  });

  it('calls exportBlankPdf when PDF option clicked', async () => {
    const { exportBlankPdf } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />);
    fireEvent.click(screen.getByText('ייצוא בחינה'));
    fireEvent.click(screen.getByText('קובץ PDF'));
    expect(exportBlankPdf).toHaveBeenCalledWith(mockQuestions);
  });

  it('calls exportBlankDocx when Word option clicked', async () => {
    const { exportBlankDocx } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />);
    fireEvent.click(screen.getByText('ייצוא בחינה'));
    fireEvent.click(screen.getByText('קובץ Word'));
    expect(exportBlankDocx).toHaveBeenCalledWith(mockQuestions);
  });
});

describe('ExportMenu — graded variant', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the graded export button', () => {
    render(<ExportMenu questions={mockQuestions} gradeResult={mockGradeResult} variant="graded" />);
    expect(screen.getByText('הורד דוח ציון')).toBeInTheDocument();
  });

  it('calls exportGradedPdf when PDF option clicked', async () => {
    const { exportGradedPdf } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={mockGradeResult} variant="graded" />);
    fireEvent.click(screen.getByText('הורד דוח ציון'));
    fireEvent.click(screen.getByText('קובץ PDF'));
    expect(exportGradedPdf).toHaveBeenCalledWith(mockQuestions, mockGradeResult);
  });

  it('calls exportGradedDocx when Word option clicked', async () => {
    const { exportGradedDocx } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={mockGradeResult} variant="graded" />);
    fireEvent.click(screen.getByText('הורד דוח ציון'));
    fireEvent.click(screen.getByText('קובץ Word'));
    expect(exportGradedDocx).toHaveBeenCalledWith(mockQuestions, mockGradeResult);
  });

  it('does not call graded export when gradeResult is null', async () => {
    const { exportGradedPdf } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="graded" />);
    fireEvent.click(screen.getByText('הורד דוח ציון'));
    fireEvent.click(screen.getByText('קובץ PDF'));
    expect(exportGradedPdf).not.toHaveBeenCalled();
  });
});