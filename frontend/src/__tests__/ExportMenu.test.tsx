import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportMenu from '@/components/ExportMenu';
import type { Question, GradeResult } from '@/types/questions';

// ── Mock export functions ─────────────────────────────────────────────────────
vi.mock('@/lib/exportUtils', () => ({
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

  it('calls exportBlankDocx when button clicked', async () => {
    const { exportBlankDocx } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="blank" />);
    fireEvent.click(screen.getByText('ייצוא בחינה'));
    expect(exportBlankDocx).toHaveBeenCalledWith(mockQuestions);
  });
});

describe('ExportMenu — graded variant', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the graded export button', () => {
    render(<ExportMenu questions={mockQuestions} gradeResult={mockGradeResult} variant="graded" />);
    expect(screen.getByText('הורד דוח ציון')).toBeInTheDocument();
  });

  it('calls exportGradedDocx when button clicked', async () => {
    const { exportGradedDocx } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={mockGradeResult} variant="graded" />);
    fireEvent.click(screen.getByText('הורד דוח ציון'));
    expect(exportGradedDocx).toHaveBeenCalledWith(mockQuestions, mockGradeResult);
  });

  it('does not call graded export when gradeResult is null', async () => {
    const { exportGradedDocx } = await import('@/lib/exportUtils');
    render(<ExportMenu questions={mockQuestions} gradeResult={null} variant="graded" />);
    fireEvent.click(screen.getByText('הורד דוח ציון'));
    expect(exportGradedDocx).not.toHaveBeenCalled();
  });
});
