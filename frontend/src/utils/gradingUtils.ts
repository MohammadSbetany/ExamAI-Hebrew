import type { Question, GradeResult } from '@/types/questions';

export function gradeLocally(
  questions: Question[],
  answers: string[],
  questionType: 'multiple' | 'yesno'
): GradeResult {
  const feedback = questions.map((q, i) => {
    const studentAnswer = (answers[i] || '').trim();
    const correctAnswer = (q.answer || '').trim();
    const isCorrect = studentAnswer === correctAnswer;

    const explanation = isCorrect
      ? 'תשובה נכונה!'
      : questionType === 'multiple'
        ? `התשובה הנכונה היא: ${correctAnswer}. ${q.options?.[correctAnswer] || ''}`
        : `התשובה הנכונה היא: ${correctAnswer}`;

    return {
      question: q.question,
      points: isCorrect ? 1 : 0,
      correct: isCorrect,
      covered_points: [] as string[],
      missed_points: [] as string[],
      explanation,
    };
  });

  const score = feedback.reduce((sum, f) => sum + f.points, 0);
  return { score, feedback };
}
