import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareExamModal from '@/components/ShareExamModal';

const questions = [{ question: 'q', answer: 'a' }];

describe('ShareExamModal', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('lists the teacher classes on step 1', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ classes: [{ id: 'c1', name: 'כיתה א', code: 'AAA111', students: [] }] }),
    });
    render(<ShareExamModal questions={questions} questionType="open" token="t" defaultTitle="בחינה" onClose={() => {}} />);
    expect(await screen.findByText('כיתה א')).toBeInTheDocument();
  });

  it('shows an empty state when the teacher has no classes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ classes: [] }) });
    render(<ShareExamModal questions={questions} questionType="open" token="t" defaultTitle="בחינה" onClose={() => {}} />);
    expect(await screen.findByText('אין כיתות עדיין')).toBeInTheDocument();
  });

  it('walks class → config → deploy and posts to the class-exams endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'כיתה א', code: 'AAA111', students: [] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'exam-1' }) });
    global.fetch = fetchMock;

    render(<ShareExamModal questions={questions} questionType="multiple" token="t" defaultTitle="בחינה" onClose={() => {}} />);

    fireEvent.click(await screen.findByText('כיתה א'));
    fireEvent.click(screen.getByText('המשך ←'));
    fireEvent.click(await screen.findByText('שתף עם הכיתה'));

    await waitFor(() => expect(screen.getByText('הבחינה שותפה בהצלחה!')).toBeInTheDocument());

    const postCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/classes/c1/exams'));
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.question_type).toBe('multiple');
    expect(body.num_variants).toBe(1);
    expect(body.questions).toHaveLength(1);
    expect(body.open_at).toBeNull(); // scheduling is opt-in / off by default
  });
});
