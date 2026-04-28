import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import LoadingSpinner from '@/components/LoadingSpinner';
import QuestionsList from '@/components/QuestionsList';
import ErrorMessage from '@/components/ErrorMessage';
import ExamBlueprintPanel from '@/components/ExamBlueprintPanel';
import { useAuth } from '@/context/AuthContext';
import type { Question, GradeResult, ExamBlueprint } from '@/types/questions';
import { defaultBlueprint } from '@/types/questions';
import { gradeLocally } from '@/utils/gradingUtils';

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
  const [blueprint, setBlueprint] = useState<ExamBlueprint>(defaultBlueprint);
  const [recommendedTime, setRecommendedTime] = useState<number | null>(null);
  const { user } = useAuth();

  const handleFilesChange = (files: File[]) => {
    setSelectedFiles(files);
    setError(null);
  };

  /** Convert camelCase blueprint to the snake_case shape the backend expects. */
  const serializeBlueprint = (bp: ExamBlueprint): Record<string, unknown> => ({
    time_mode: bp.timeMode,
    manual_time: bp.manualTime,
    difficulty_distribution: bp.difficultyDistribution,
    format_counts: bp.formatCounts,
  });

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setGradeResult(null);
    setRecommendedTime(null);

    // Determine whether the blueprint has mixed format counts active
    const fc = blueprint.formatCounts;
    const fcTotal = fc.yesno + fc.multiple + fc.open;
    const isMixedMode = fcTotal > 0;
    const activeTypes = Object.entries(fc).filter(([, v]) => v > 0).map(([k]) => k);
    const isTrulyMixed = activeTypes.length > 1;

    // For UI grading: if mixed, set to 'mixed'; if single active type, use that; else use selector
    const effectiveType = isTrulyMixed
      ? 'mixed'
      : activeTypes.length === 1
        ? activeTypes[0]
        : questionType;
    setActiveQuestionType(effectiveType);

    // question_count to send: use fcTotal when format counts are active; otherwise slider
    const effectiveCount = isMixedMode ? fcTotal : questionCount;

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));
      formData.append('question_type', isMixedMode ? 'open' : questionType); // 'open' is a valid placeholder for mixed
      formData.append('question_count', String(effectiveCount));
      formData.append('difficulty', difficulty);
      formData.append('blueprint_json', JSON.stringify(serializeBlueprint(blueprint)));
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
        setQuestions(data.questions);
        if (typeof data.recommended_time === 'number') {
          setRecommendedTime(data.recommended_time);
        }
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
    setBlueprint(defaultBlueprint);
    setRecommendedTime(null);
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
      // Pure yes/no or multiple choice: grade locally — no API call needed
      if (activeQuestionType === 'multiple' || activeQuestionType === 'yesno') {
        setGradeResult(gradeLocally(questions, answers, activeQuestionType as 'multiple' | 'yesno'));
        return;
      }

      // Open questions and mixed exams: send to API
      // For mixed exams the backend uses per-question question_type field for grading
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          questions,
          answers,
          question_type: activeQuestionType === 'mixed' ? 'open' : questionType,
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

  // Compute format-count totals for validation display
  const fc = blueprint.formatCounts;
  const fcTotal = fc.yesno + fc.multiple + fc.open;
  const isMixedMode = fcTotal > 0;
  const isBlueprintValid = !isMixedMode || fcTotal === questionCount;

  return (
    <div className="bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <img src="/favicon.ico" alt="ExamAI" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            מערכת לייצור שאלות 
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            העלה קובץ עם חומר לימוד וקבל שאלות שנוצרות באופן אוטומטי
          </p>
        </header>

        {/* Main Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
          {/* Upload Section */}
          <section className="mb-6">
            <FileUpload
              onFilesChange={handleFilesChange}
              selectedFiles={selectedFiles}
              disabled={isLoading}
            />
          </section>

          {/* Question Type Selector — hidden when blueprint format counts are active */}
          {!isMixedMode && (
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-3">סוג השאלות:</p>
              <div className="flex gap-3">
                {[
                  { value: 'open', label: 'שאלות פתוחות' },
                  { value: 'yesno', label: 'כן / לא' },
                  { value: 'multiple', label: 'רב ברירה' },
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
          )}
          
          {/* Question Count */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">
              מספר השאלות: {isMixedMode ? fcTotal : questionCount}
              {isMixedMode && (
                <span className="mr-2 text-xs text-muted-foreground font-normal">
                  (מחושב מהגדרות Blueprint)
                </span>
              )}
            </p>
            {!isMixedMode && (
              <>
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
              </>
            )}
          </div>

          {/* Difficulty Selector — hidden when blueprint distribution is active */}
          <div className="mb-6">
            <p className="text-sm font-medium text-foreground mb-3">רמת הקושי:</p>
            <div className="flex gap-3">
              {[
                { value: 'easy', label: 'קל', bloom: 'זיכרון והבנה', bloomEn: "Bloom's L1–L2" },
                { value: 'medium', label: 'בינוני', bloom: 'יישום וניתוח', bloomEn: "Bloom's L3–L4" },
                { value: 'hard', label: 'קשה', bloom: 'הערכה ויצירה', bloomEn: "Bloom's L5–L6" },
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
          </div>

          {/* Advanced Blueprint Panel */}
          <ExamBlueprintPanel
            blueprint={blueprint}
            onChange={setBlueprint}
            questionCount={questionCount}
            disabled={isLoading}
          />

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={selectedFiles.length === 0 || isLoading || !isBlueprintValid}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
              ${
                selectedFiles.length > 0 && !isLoading && isBlueprintValid
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            {isLoading ? 'מעבד...' : 'יצירת שאלות'}
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

              {/* Time Banner */}
              {(recommendedTime !== null || blueprint.timeMode === 'manual') && (
                <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5">
                  <span className="text-lg">⏱</span>
                  {recommendedTime !== null ? (
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">זמן מומלץ על ידי AI:</span>{' '}
                      <span className="text-primary font-bold">{recommendedTime} דקות</span>
                    </p>
                  ) : (
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">זמן מבחן:</span>{' '}
                      <span className="text-primary font-bold">{blueprint.manualTime} דקות</span>
                    </p>
                  )}
                </div>
              )}

              <QuestionsList
                questions={questions}
                questionType={activeQuestionType}
                answers={answers}
                onAnswerChange={handleAnswerChange}
                onSubmit={handleGrade}
                isGrading={isGrading}
                gradeResult={gradeResult}
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