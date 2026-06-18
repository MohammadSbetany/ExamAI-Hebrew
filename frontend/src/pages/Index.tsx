import { useState, useEffect, useRef } from 'react';
import { saveExam } from '@/lib/examsApi';
import FileUpload from '@/components/FileUpload';
import LoadingSpinner from '@/components/LoadingSpinner';
import QuestionsList from '@/components/QuestionsList';
import ErrorMessage from '@/components/ErrorMessage';
import { useAuth } from '@/context/AuthContext';
import type { Question, GradeResult } from '@/types/questions';
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
  const { user } = useAuth();
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // seconds remaining
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleGradeRef = useRef<(() => Promise<void>) | null>(null);
  const [timeMode, setTimeMode] = useState<'manual' | 'ai'>('ai');
  const [difficultyDist, setDifficultyDist] = useState({ easy: 30, medium: 50, hard: 20 });
  const [formatCounts, setFormatCounts] = useState({ yesno: 3, multiple: 4, open: 3 });
  const [recommendedTime, setRecommendedTime] = useState<number | null>(null);
  const [appMode, setAppMode] = useState<'generate' | 'import'>('generate');
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFilesChange = (files: File[]) => {
    setSelectedFiles(files);
    setError(null);
  };

  /** Total timer duration in seconds as set by the manual inputs */
  const timerTotalSeconds = timerHours * 3600 + timerMinutes * 60 + timerSeconds;

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    // Keep timeLeft as-is so the frozen time stays visible
  };

  const startTimer = (totalSeconds: number) => {
    stopTimer(); // clear any existing interval before starting a new one
    setTimeLeft(totalSeconds);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          timerIntervalRef.current = null;
          handleGradeRef.current?.(); // auto-submit when time runs out (always uses latest handleGrade)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    timerIntervalRef.current = interval;
  };

  // Clear the interval when the component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleDigitize = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setGradeResult(null);
    setActiveQuestionType('merged');
    // Clear any previous timer state before starting a new exam
    stopTimer();
    setTimeLeft(null);
    setRecommendedTime(null);

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
        // Start timer for import mode (manual timer only — digitize has no AI recommended_time)
        if (timerEnabled) {
          const total = timerTotalSeconds;
          if (total >= 60) startTimer(total);
        }
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
    // Clear any previous timer/recommendation state before starting a new exam
    stopTimer();
    setTimeLeft(null);
    setRecommendedTime(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));
      formData.append('question_type', questionType);
      formData.append('question_count', String(questionCount));
      formData.append('difficulty', difficulty);
      formData.append('time_mode', timeMode);
      if (timeMode === 'manual') formData.append('manual_minutes', String(Math.ceil(timerTotalSeconds / 60)));
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
        if (timerEnabled) {
          if (timeMode === 'ai' && data.recommended_time) {
            const total = data.recommended_time * 60;
            setRecommendedTime(data.recommended_time);
            startTimer(total);
          } else if (timeMode === 'manual') {
            if (timerTotalSeconds >= 60) startTimer(timerTotalSeconds);
            // if total < 60 the generate button was already disabled, so this branch shouldn't be reached
          }
          // timerEnabled + ai + no recommended_time: timer stays cleared (already reset above)
        } else {
          if (data.recommended_time) setRecommendedTime(data.recommended_time);
          // recommendedTime already cleared at start of handleGenerate
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
    setRecommendedTime(null);
    setTimeMode('ai');
    setDifficultyDist({ easy: 30, medium: 50, hard: 20 });
    setFormatCounts({ yesno: 3, multiple: 4, open: 3 });
    setAppMode('generate');
    setSavedExamId(null);
    stopTimer();
    setTimeLeft(null);
    setTimerEnabled(false);
    setTimerHours(0);
    setTimerMinutes(30);
    setTimerSeconds(0);
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
    stopTimer();
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

  // Keep the ref updated so the timer callback always invokes the latest handleGrade
  handleGradeRef.current = handleGrade;
  
  const handleSave = async () => {
    if (!user?.token || questions.length === 0) return;
    setIsSaving(true);
    try {
      const title = selectedFiles.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ') || 'בחינה';
      const id = await saveExam(user.token, {
        title,
        exam_type: appMode === 'import' ? 'digitized' : 'generated',
        question_type: activeQuestionType,
        questions,
        answers,
        grade_result: gradeResult,
      });
      setSavedExamId(id);
    } catch {
      setError('שגיאה בשמירת הבחינה');
    } finally {
      setIsSaving(false);
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">מספר השאלות</p>
              <input
                type="number"
                min={1}
                max={100}
                value={questionCount}
                onChange={e => setQuestionCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                disabled={isLoading}
                className="w-16 px-2 py-1 rounded-lg border border-input bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
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
          </div>
          </>)}

          {/* Recommended time banner */}
          {recommendedTime && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              זמן מומלץ לבחינה: <strong>{recommendedTime} דקות</strong>
            </div>
          )}

          {/* Timer Section */}
          <div className="mb-6">
            <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${timerEnabled ? 'border-primary/30' : 'border-border'}`}>

              {/* Header row — always visible */}
              <div className={`flex items-center justify-between px-4 py-3 ${timerEnabled ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <div className="flex items-center gap-2.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={timerEnabled ? 'text-primary' : 'text-muted-foreground'}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                 <p className={`text-sm font-medium ${timerEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                    הגבלת זמן לבחינה
                  </p>
                  {timerEnabled && timeMode === 'ai' && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">✨ AI</span>
                  )}
                  {timerEnabled && timeMode === 'manual' && timerTotalSeconds >= 60 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {timerHours > 0 && `${timerHours}ש׳ `}
                      {timerMinutes > 0 && `${timerMinutes}ד׳ `}
                      {timerSeconds > 0 && `${timerSeconds}ש״`}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={timerEnabled}
                  aria-label="הגבלת זמן לבחינה"
                  onClick={() => setTimerEnabled(t => !t)}
                  disabled={isLoading || (questions.length > 0 && !gradeResult)}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${timerEnabled ? 'bg-primary' : 'bg-muted-foreground/30'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${timerEnabled ? 'right-1' : 'right-6'}`} />
                </button>
              </div>

              {/* Time inputs — only when enabled */}
              {timerEnabled && (questions.length === 0 || gradeResult !== null) && (
                <div className="px-4 py-4 bg-card border-t border-primary/20 space-y-4">

                  {/* AI or Manual toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                    {[
                      { value: 'ai', label: '✨ הגדרה אוטומטית על ידי AI' },
                      { value: 'manual', label: '⏱ הגדרה ידנית' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => !gradeResult && setTimeMode(value as 'manual' | 'ai')}
                        className={`py-2 rounded-lg text-xs font-medium transition-all ${
                          timeMode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        } ${gradeResult ? 'cursor-default' : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {gradeResult && timeLeft !== null && (
                    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-muted rounded-lg">
                      <span className="text-xs text-muted-foreground">הבחינה הוגשה בזמן:</span>
                      <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                        {String(Math.floor(timeLeft / 3600)).padStart(2, '0')}:
                        {String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0')}:
                        {String(timeLeft % 60).padStart(2, '0')}
                      </span>
                      <span className="text-xs text-muted-foreground">נותרו</span>
                    </div>
                  )}
                  {!gradeResult && timeMode === 'ai' ? (
                    <p className="text-xs text-muted-foreground bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-center">
                      ה-AI יקבע את משך הזמן המומלץ בהתאם לרמת הקושי וכמות השאלות. הזמן יוצג לאחר יצירת הבחינה.
                    </p>
                  ) : !gradeResult ? (
                    <>
                      <div className="flex items-center justify-center gap-3">
                        {[
                          { value: timerHours, onChange: (v: number) => setTimerHours(Math.max(0, Math.min(23, v))), max: 23, label: 'שעות' },
                          { value: timerMinutes, onChange: (v: number) => setTimerMinutes(Math.max(0, Math.min(59, v))), max: 59, label: 'דקות' },
                          { value: timerSeconds, onChange: (v: number) => setTimerSeconds(Math.max(0, Math.min(59, v))), max: 59, label: 'שניות' },
                        ].map((field, i) => (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => field.onChange(field.value + 1)} className="w-6 h-6 rounded-lg bg-muted hover:bg-muted-foreground/20 text-muted-foreground text-xs font-bold transition-colors">+</button>
                              <input
                                type="number" min={0} max={field.max} value={field.value}
                                onChange={e => field.onChange(Number(e.target.value))}
                                className="w-14 text-center px-1 py-1.5 rounded-xl border border-input bg-background text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                              />
                              <button onClick={() => field.onChange(field.value - 1)} className="w-6 h-6 rounded-lg bg-muted hover:bg-muted-foreground/20 text-muted-foreground text-xs font-bold transition-colors">−</button>
                            </div>
                            <span className="text-xs text-muted-foreground">{field.label}</span>
                          </div>
                        ))}
                      </div>
                      {timerTotalSeconds < 60 && (
                        <p className="text-xs text-destructive text-center">הזמן המינימלי הוא דקה אחת</p>
                      )}
                    </>
                  ) : null}

                  <p className="text-xs text-muted-foreground text-center">
                    הבחינה תוגש אוטומטית כשהזמן יסתיים
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Generate / Digitize Button */}
          {(() => {
            const timerTooShort = timerEnabled && timeMode === 'manual' && timerTotalSeconds < 60;
            const isDisabled = selectedFiles.length === 0 || isLoading || timerTooShort;
            return (
              <button
                onClick={appMode === 'import' ? handleDigitize : handleGenerate}
                disabled={isDisabled}
                className={`
                  w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
                  ${
                    !isDisabled
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                {isLoading ? 'מעבד...' : appMode === 'import' ? 'חלץ שאלות מהבחינה' : 'יצירת שאלות'}
              </button>
            );
          })()}

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

              {/* Countdown timer */}
              {timeLeft !== null && (
                <div className={`mb-6 flex items-center justify-center gap-3 p-4 rounded-xl border-2 ${
                  timeLeft <= 60 ? 'border-destructive/50 bg-destructive/10' :
                  timeLeft <= 300 ? 'border-yellow-400/50 bg-yellow-50' :
                  'border-primary/30 bg-primary/5'
                }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={timeLeft <= 60 ? 'text-destructive' : timeLeft <= 300 ? 'text-yellow-600' : 'text-primary'}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span className={`text-2xl font-bold font-mono tabular-nums ${
                    timeLeft <= 60 ? 'text-destructive' : timeLeft <= 300 ? 'text-yellow-700' : 'text-primary'
                  }`}>
                    {String(Math.floor(timeLeft / 3600)).padStart(2, '0')}:
                    {String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0')}:
                    {String(timeLeft % 60).padStart(2, '0')}
                  </span>
                  {timeLeft <= 60 && <span className="text-xs text-destructive font-semibold">הזמן עומד להסתיים!</span>}
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
                isImported={appMode === 'import'}
              />
              
              <div className="mt-8 flex gap-3">
                {!savedExamId ? (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || questions.length === 0}
                    className="flex-1 py-3 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <><span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />שומר...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeWidth="2" strokeLinecap="round" /><polyline points="17 21 17 13 7 13 7 21" strokeWidth="2" strokeLinecap="round" /><polyline points="7 3 7 8 15 8" strokeWidth="2" strokeLinecap="round" /></svg>שמור בחינה</>
                    )}
                  </button>
                ) : (
                  <div className="flex-1 py-3 px-6 rounded-xl bg-green-100 text-green-700 font-medium flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" /></svg>
                    נשמרה בהצלחה
                  </div>
                )}

                {savedExamId && user?.role === 'teacher' && (
                  <button
                    onClick={async () => {
                      if (!user?.token) return;
                      await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/backend'}/teacher/share-exam`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
                        body: JSON.stringify({
                          title: selectedFiles.map(f => f.name.replace(/\.[^.]+$/, '')).join(', ') || 'בחינה',
                          question_type: activeQuestionType,
                          questions,
                        }),
                      });
                      alert('הבחינה שותפה בהצלחה עם התלמידים!');
                    }}
                    className="w-full py-3 px-6 rounded-xl border-2 border-primary text-primary font-medium hover:bg-primary/5 transition-colors"
                  >
                    שתף בחינה עם תלמידים
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="flex-1 py-3 px-6 rounded-xl border-2 border-border text-foreground font-medium hover:bg-muted transition-colors"
                >
                  התחל מחדש
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;