import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import LoadingSpinner from '@/components/LoadingSpinner';
import QuestionsList from '@/components/QuestionsList';
import ErrorMessage from '@/components/ErrorMessage';
import { useAuth } from '@/context/AuthContext';
import type { Question, GradeResult } from '@/types/questions';
import { gradeLocally } from '@/utils/gradingUtils';
import AdvancedSettings from '@/components/AdvancedSettings';

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionType, setQuestionType] = useState<string>('open');
  const [activeQuestionType, setActiveQuestionType] = useState<string>('open');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const { user } = useAuth();
  const [timeMode, setTimeMode] = useState<'manual' | 'ai'>('ai');
  const [manualMinutes, setManualMinutes] = useState<number>(45);
  const [difficultyDist, setDifficultyDist] = useState({ easy: 30, medium: 50, hard: 20 });
  const [formatCounts, setFormatCounts] = useState({ yesno: 3, multiple: 4, open: 3 });
  const [recommendedTime, setRecommendedTime] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<'generate' | 'import'>('generate');

  const handleFilesChange = (files: File[]) => {
    setSelectedFiles(files);
    setError(null);
  };

  const handleDigitize = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setGradeResult(null);
    setActiveQuestionType('merged');

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/digitize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `שגיאה בעיבוד הקובץ (${response.status})`);
      }

      const data = await response.json();
      if (data?.error) throw new Error(data.error);
      if (data?.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        throw new Error('תשובה לא תקינה מהשרת');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setGradeResult(null);
    setActiveQuestionType(questionType);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));
      formData.append('question_type', questionType);
      formData.append('question_count', String(questionCount));
      formData.append('difficulty', difficulty);
      formData.append('time_mode', timeMode);
      if (timeMode === 'manual') formData.append('manual_minutes', String(manualMinutes));
      if (difficulty === 'merged') formData.append('difficulty_dist', JSON.stringify(difficultyDist));
      if (questionType === 'merged') formData.append('format_counts', JSON.stringify(formatCounts));
      console.log("Starting upload for:", selectedFiles.map(f => f.name).join(', '));

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user?.token}` },
        body: formData,
      });

      console.log("Server responded with status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Upload failed (code: ${response.status}). Please try again.`);
      }

      const data = await response.json();
      console.log("Data received from backend:", data);

      if (data && data.error) {
        throw new Error(data.error);
      } else if (data && data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions.slice(0, questionCount));
        if (data.recommended_time) setRecommendedTime(data.recommended_time);
        else setRecommendedTime(null);
      } else {
        console.error("Unexpected JSON structure:", data);
        throw new Error('תשובה לא תקינה מהשרת - המבנה שהתקבל אינו תקין');
      }
    } catch (err) {
      console.error("Full catch-block error:", err);
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setQuestions([]);
    setError(null);
    setQuestionType('open');
    setQuestionCount(5);
    setDifficulty('medium');
    setAnswers([]);
    setGradeResult(null);
    setActiveQuestionType('open');
    setRecommendedTime(null);
    setTimeMode('ai');
    setManualMinutes(45);
    setDifficultyDist({ easy: 30, medium: 50, hard: 20 });
    setFormatCounts({ yesno: 3, multiple: 4, open: 3 });
    setAppMode('generate');
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setAnswers(prev => {
      const updated = [...prev];
      updated[index] = answer;
      return updated;
    });
  };

  const handleGrade = async () => {
    setIsGrading(true);
    try {
      // Yes/No and Multiple choice — grade locally ONLY in generate mode
      if (appMode === 'generate' && (activeQuestionType === 'multiple' || activeQuestionType === 'yesno')) {
        setGradeResult(gradeLocally(questions, answers, activeQuestionType as 'multiple' | 'yesno'));
        return;
      }

      // Open questions or merged exams: send to API
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          questions,
          answers,
          question_type: activeQuestionType,
        }),
      });
      const data = await response.json();
      setGradeResult(data);
    } catch (err) {
      setError('אירעה שגיאה בבדיקת התשובות');
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <img src="/favicon.ico" alt="ExamAI" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {appMode === 'import' ? 'דיגיטציה של בחינה קיימת' : 'מערכת לייצור שאלות'}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {appMode === 'import'
              ? 'העלה קובץ בחינה קיימת — ה-AI יחלץ את השאלות ויאפשר לך לפתור אותן באופן אינטראקטיבי'
              : 'העלה קובץ עם חומר לימוד וקבל שאלות שנוצרות באופן אוטומטי'}
          </p>
        </header>

        {/* Main Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl mb-6">
            {[
              { value: 'generate', label: '✨ יצירת שאלות' },
              { value: 'import', label: '📄 ייבוא בחינה קיימת' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setAppMode(value as 'generate' | 'import'); setQuestions([]); setGradeResult(null); setError(null); }}
                disabled={isLoading}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  appMode === value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Import mode info banner */}
          {appMode === 'import' && (
            <div className="mb-6 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
              העלה קובץ בחינה (PDF, DOCX, TXT). ה-AI יזהה את השאלות אוטומטית, יסווג אותן לפי סוג, ויאפשר לך לפתור ולקבל ציון.
            </div>
          )}

          {/* Upload Section */}
          <section className="mb-6">
            <FileUpload
              onFilesChange={handleFilesChange}
              selectedFiles={selectedFiles}
              disabled={isLoading}
            />
          </section>

          {/* Controls — only shown in generate mode */}
          {appMode === 'generate' && (<>

          {/* Question Type Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">סוג השאלות:</p>
            <div className="flex gap-3">
              {[
                { value: 'open', label: 'שאלות פתוחות' },
                { value: 'yesno', label: 'כן / לא' },
                { value: 'multiple', label: 'רב ברירה' },
                { value: 'merged', label: 'מיזוג' },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setQuestionType(type.value)}
                  disabled={isLoading}
                  className={`
                    flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all
                    ${questionType === type.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'}
                  `}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Question Count */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">מספר השאלות: {questionCount}</p>
            <input
              type="range"
              min={1}
              max={100}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              disabled={isLoading}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>

          {/* Difficulty Selector */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">רמת הקושי:</p>
            <div className="flex gap-3">
              {[
                { value: 'easy', label: 'קל', bloom: 'זיכרון והבנה', bloomEn: "Bloom's L1–L2" },
                { value: 'medium', label: 'בינוני', bloom: 'יישום וניתוח', bloomEn: "Bloom's L3–L4" },
                { value: 'hard', label: 'קשה', bloom: 'הערכה ויצירה', bloomEn: "Bloom's L5–L6" },
                { value: 'merged', label: 'מיזוג', bloom: 'כל הרמות', bloomEn: "Bloom's L1–L6 mixed" },
              ].map((level) => (
                <button
                  key={level.value}
                  onClick={() => setDifficulty(level.value)}
                  disabled={isLoading}
                  title={level.bloomEn}
                  className={`
                    flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5
                    ${difficulty === level.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'}
                  `}
                >
                  <span>{level.label}</span>
                  <span className="text-xs font-normal opacity-70">{level.bloom}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              השאלות מותאמות לרמות טקסונומיית בלום
            </p>
          </div> </>)}

          {/* Advanced Settings */}
          <AdvancedSettings
            questionType={questionType}
            difficulty={difficulty}
            questionCount={questionCount}
            timeMode={timeMode}
            manualMinutes={manualMinutes}
            onTimeModeChange={setTimeMode}
            onManualMinutesChange={setManualMinutes}
            difficultyDist={difficultyDist}
            onDifficultyDistChange={setDifficultyDist}
            formatCounts={formatCounts}
            onFormatCountsChange={setFormatCounts}
            disabled={isLoading}
          />

          {/* Recommended time banner */}
          {recommendedTime && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              זמן מומלץ לבחינה: <strong>{recommendedTime} דקות</strong>
            </div>
          )}

          {/* Generate / Digitize Button */}
          <button
            onClick={appMode === 'import' ? handleDigitize : handleGenerate}
            disabled={selectedFiles.length === 0 || isLoading}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
              ${
                selectedFiles.length > 0 && !isLoading
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            {isLoading ? 'מעבד...' : appMode === 'import' ? 'חלץ שאלות מהבחינה' : 'יצירת שאלות'}
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="mt-8">
              <LoadingSpinner />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6">
              <ErrorMessage message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {/* Questions Display */}
          {questions.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border">
              <QuestionsList
                questions={questions}
                questionType={activeQuestionType}
                answers={answers}
                onAnswerChange={handleAnswerChange}
                onSubmit={handleGrade}
                isGrading={isGrading}
                gradeResult={gradeResult}
                isImported={appMode === 'import'}
              />
              
              <button
                onClick={handleReset}
                className="mt-8 w-full py-3 px-6 rounded-xl border-2 border-border text-foreground font-medium hover:bg-muted transition-colors"
              >
                התחל מחדש
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;