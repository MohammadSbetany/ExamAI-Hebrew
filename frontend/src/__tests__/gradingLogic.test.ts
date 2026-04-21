import { describe, it, expect } from 'vitest';
import type { Question } from '@/types/questions';
import { gradeLocally } from '@/utils/gradingUtils';

// ── Yes/No grading ────────────────────────────────────────────────────────────

describe('Local grading — Yes/No', () => {
  const questions: Question[] = [
    { question: 'שאלה 1?', answer: 'כן' },
    { question: 'שאלה 2?', answer: 'לא' },
    { question: 'שאלה 3?', answer: 'כן' },
  ];

  it('gives full score when all answers are correct', () => {
    const result = gradeLocally(questions, ['כן', 'לא', 'כן'], 'yesno');
    expect(result.score).toBe(3);
    expect(result.feedback.every(f => f.correct)).toBe(true);
  });

  it('gives zero score when all answers are wrong', () => {
    const result = gradeLocally(questions, ['לא', 'כן', 'לא'], 'yesno');
    expect(result.score).toBe(0);
    expect(result.feedback.every(f => !f.correct)).toBe(true);
  });

  it('gives partial score for mixed answers', () => {
    const result = gradeLocally(questions, ['כן', 'כן', 'כן'], 'yesno');
    expect(result.score).toBe(2);
  });

  it('shows correct explanation for wrong answer', () => {
    const result = gradeLocally(questions, ['לא', 'לא', 'כן'], 'yesno');
    expect(result.feedback[0].explanation).toContain('כן');
    expect(result.feedback[0].correct).toBe(false);
  });

  it('shows success explanation for correct answer', () => {
    const result = gradeLocally(questions, ['כן', 'לא', 'כן'], 'yesno');
    expect(result.feedback[0].explanation).toBe('תשובה נכונה!');
  });

  it('trims whitespace from answers before comparing', () => {
    const result = gradeLocally(questions, ['כן ', ' לא', ' כן '], 'yesno');
    expect(result.score).toBe(3);
  });

  it('returns empty covered_points and missed_points', () => {
    const result = gradeLocally(questions, ['כן', 'לא', 'כן'], 'yesno');
    result.feedback.forEach(f => {
      expect(f.covered_points).toEqual([]);
      expect(f.missed_points).toEqual([]);
    });
  });
});

// ── Multiple choice grading ───────────────────────────────────────────────────

describe('Local grading — Multiple Choice', () => {
  const questions: Question[] = [
    { question: 'שאלה 1?', answer: 'א', options: { א: 'אפשרות א', ב: 'אפשרות ב', ג: 'אפשרות ג', ד: 'אפשרות ד' } },
    { question: 'שאלה 2?', answer: 'ג', options: { א: 'אפשרות א', ב: 'אפשרות ב', ג: 'אפשרות ג', ד: 'אפשרות ד' } },
    { question: 'שאלה 3?', answer: 'ד', options: { א: 'אפשרות א', ב: 'אפשרות ב', ג: 'אפשרות ג', ד: 'אפשרות ד' } },
  ];

  it('gives full score when all answers are correct', () => {
    const result = gradeLocally(questions, ['א', 'ג', 'ד'], 'multiple');
    expect(result.score).toBe(3);
  });

  it('gives zero score when all answers are wrong', () => {
    const result = gradeLocally(questions, ['ב', 'א', 'ב'], 'multiple');
    expect(result.score).toBe(0);
  });

  it('gives partial score for mixed answers', () => {
    const result = gradeLocally(questions, ['א', 'א', 'ד'], 'multiple');
    expect(result.score).toBe(2);
  });

  it('includes option text in wrong answer explanation', () => {
    const result = gradeLocally(questions, ['ב', 'ג', 'ד'], 'multiple');
    expect(result.feedback[0].explanation).toContain('א');
    expect(result.feedback[0].explanation).toContain('אפשרות א');
  });

  it('handles empty answer as wrong', () => {
    const result = gradeLocally(questions, ['', 'ג', 'ד'], 'multiple');
    expect(result.feedback[0].correct).toBe(false);
    expect(result.score).toBe(2);
  });

  it('score equals number of correct answers', () => {
    const result = gradeLocally(questions, ['א', 'ג', 'ד'], 'multiple');
    const correctCount = result.feedback.filter(f => f.correct).length;
    expect(result.score).toBe(correctCount);
  });
});