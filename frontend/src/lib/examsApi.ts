import type { Question, GradeResult } from '@/types/questions';

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

interface SaveExamPayload {
  title: string;
  exam_type: 'generated' | 'digitized';
  question_type: string;
  questions: Question[];
  answers?: string[];
  grade_result?: GradeResult | null;
}

export interface ExamRecord {
  id: string;
  uid: string;
  title: string;
  exam_type: 'generated' | 'digitized';
  question_type: string;
  questions: Question[];
  answers: string[];
  grade_result: GradeResult | null;
  score: number | null;
  total: number;
  created_at: string;
  graded_at: string | null;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export const saveExam = async (token: string, payload: SaveExamPayload): Promise<string> => {
  const r = await fetch(`${API()}/exams/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('שגיאה בשמירת הבחינה');
  const data = await r.json();
  return data.exam_id;
};

export const listExams = async (token: string): Promise<ExamRecord[]> => {
  const r = await fetch(`${API()}/exams`, { headers: authHeader(token) });
  if (!r.ok) throw new Error('שגיאה בטעינת הבחינות');
  const data = await r.json();
  return data.exams;
};

export const getExam = async (token: string, examId: string): Promise<ExamRecord> => {
  const r = await fetch(`${API()}/exams/${examId}`, { headers: authHeader(token) });
  if (!r.ok) throw new Error('הבחינה לא נמצאה');
  return r.json();
};

export const deleteExam = async (token: string, examId: string): Promise<void> => {
  const r = await fetch(`${API()}/exams/${examId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!r.ok) throw new Error('שגיאה במחיקת הבחינה');
};