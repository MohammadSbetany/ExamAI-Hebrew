import { describe, it, expect } from 'vitest';
import type { Question, GradeFeedbackItem, GradeResult } from '@/types/questions';

// These tests verify that the type definitions are structurally correct
// by constructing valid objects and checking their shape at runtime.

describe('Question type', () => {
  it('accepts a minimal open question', () => {
    const q: Question = { question: 'מה זה?', answer: 'תשובה' };
    expect(q.question).toBe('מה זה?');
    expect(q.answer).toBe('תשובה');
    expect(q.options).toBeUndefined();
    expect(q.critical_points).toBeUndefined();
  });

  it('accepts a multiple choice question with options', () => {
    const q: Question = {
      question: 'מה זה?',
      answer: 'א',
      options: { א: 'אפשרות א', ב: 'אפשרות ב', ג: 'אפשרות ג', ד: 'אפשרות ד' },
    };
    expect(q.options?.['א']).toBe('אפשרות א');
  });

  it('accepts an open question with critical_points', () => {
    const q: Question = {
      question: 'הסבר את המושג',
      answer: 'תשובה מפורטת',
      critical_points: ['נקודה 1', 'נקודה 2', 'נקודה 3'],
    };
    expect(q.critical_points).toHaveLength(3);
  });

  it('accepts a merged question with a type field', () => {
    const q: Question = {
      question: 'כן או לא?',
      answer: 'כן',
      type: 'yesno',
    };
    expect(q.type).toBe('yesno');
  });

  it('type field is optional', () => {
    const q: Question = { question: 'מה זה?', answer: 'תשובה' };
    expect(q.type).toBeUndefined();
  });
});

describe('GradeFeedbackItem type', () => {
  it('accepts a correct feedback item', () => {
    const item: GradeFeedbackItem = {
      question: 'שאלה?',
      correct: true,
      points: 1,
      explanation: 'מצוין',
      covered_points: ['נקודה 1'],
      missed_points: [],
    };
    expect(item.correct).toBe(true);
    expect(item.points).toBe(1);
  });

  it('accepts a partial credit feedback item', () => {
    const item: GradeFeedbackItem = {
      question: 'שאלה?',
      correct: false,
      points: 0.5,
      explanation: 'חלקי',
      covered_points: ['נקודה 1'],
      missed_points: ['נקודה 2'],
    };
    expect(item.points).toBe(0.5);
    expect(item.missed_points).toHaveLength(1);
  });

  it('accepts a zero score feedback item', () => {
    const item: GradeFeedbackItem = {
      question: 'שאלה?',
      correct: false,
      points: 0,
      explanation: 'לא נכון',
      covered_points: [],
      missed_points: ['נקודה 1', 'נקודה 2'],
    };
    expect(item.points).toBe(0);
    expect(item.covered_points).toHaveLength(0);
  });
});

describe('GradeResult type', () => {
  it('accepts a valid grade result', () => {
    const result: GradeResult = {
      score: 2.5,
      feedback: [
        { question: 'ש1', correct: true, points: 1, explanation: 'טוב', covered_points: [], missed_points: [] },
        { question: 'ש2', correct: false, points: 0.5, explanation: 'חלקי', covered_points: ['נ1'], missed_points: ['נ2'] },
        { question: 'ש3', correct: false, points: 0, explanation: 'שגוי', covered_points: [], missed_points: ['נ1'] },
      ],
    };
    expect(result.score).toBe(2.5);
    expect(result.feedback).toHaveLength(3);
  });

  it('accepts empty feedback array', () => {
    const result: GradeResult = { score: 0, feedback: [] };
    expect(result.feedback).toHaveLength(0);
  });
});