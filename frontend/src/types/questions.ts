export interface Question {
  question: string;
  answer: string;
  options?: Record<string, string>;
  critical_points?: string[];
  /** Per-question type tag added by the backend for mixed exams */
  question_type?: string;
}

export interface GradeFeedbackItem {
  question: string;
  correct: boolean;
  points: number;
  explanation: string;
  covered_points: string[];
  missed_points: string[];
}

export interface GradeResult {
  score: number;
  feedback: GradeFeedbackItem[];
}

export interface ExamBlueprint {
  timeMode: 'manual' | 'ai_estimated';
  manualTime: number;
  difficultyDistribution: { easy: number; medium: number; hard: number };
  formatCounts: { yesno: number; multiple: number; open: number };
}

export const defaultBlueprint: ExamBlueprint = {
  timeMode: 'manual',
  manualTime: 30,
  difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
  formatCounts: { yesno: 0, multiple: 0, open: 0 },
};
