export interface Question {
  question: string;
  answer: string;
  options?: Record<string, string>;
  critical_points?: string[];
  type?: string;
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
