import type { Question, GradeResult } from '@/types/questions';
import ExportMenu from '@/components/ExportMenu';

interface QuestionsListProps {
  questions: Question[];
  questionType: string;
  answers: string[];
  onAnswerChange: (index: number, answer: string) => void;
  onSubmit: () => void;
  isGrading: boolean;
  gradeResult: GradeResult | null;
}

const QuestionsList = ({ questions, questionType, answers, onAnswerChange, onSubmit, isGrading, gradeResult }: QuestionsListProps) => {
  if (questions.length === 0) return null;

  const allAnswered = answers.length === questions.length && answers.every(a => a.trim() !== '');

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {questions.length === 1 ? 'שאלה אחת נוצרה בהצלחה' : `${questions.length} שאלות נוצרו בהצלחה`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu questions={questions} gradeResult={gradeResult} variant="blank" />
          {gradeResult && (
            <ExportMenu questions={questions} gradeResult={gradeResult} variant="graded" />
          )}
        </div>
      </div>

      {/* Final grade displayed above questions */}
      {gradeResult && (
        <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 mb-6">
          <p className="text-xl font-bold text-primary text-center">
            ציון: {gradeResult.score} / {questions.length} ({Math.round((gradeResult.score / questions.length) * 100)}%)
          </p>
        </div>
      )}

      <ol className="space-y-6">
        {questions.map((question, index) => {
          const feedback = gradeResult?.feedback[index];
          const points = feedback?.points;
          const questionBg =
            points === 1 ? 'bg-green-50 border-green-200' :
            points === 0.5 ? 'bg-yellow-50 border-yellow-200' :
            points === 0 ? 'bg-red-50 border-red-200' :
            'bg-card border-border';

          return (
            <li key={index} className={`flex gap-4 p-4 rounded-xl border transition-all ${questionBg}`}>
              <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div className="flex-1">

                {/* Question text + points badge */}
                <div className="flex justify-between items-start mb-3">
                  <p className="text-foreground leading-relaxed">{question.question}</p>
                  {feedback && (
                    <span className={`ml-3 flex-shrink-0 text-sm font-bold px-2 py-1 rounded-lg ${
                      points === 1 ? 'bg-green-100 text-green-700' :
                      points === 0.5 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {points} / 1
                    </span>
                  )}
                </div>

                {/* Determine the effective type for this question */}
                {(() => {
                  const effectiveType = questionType === 'merged' ? (question.type || 'open') : questionType;
                  return (
                    <>
                      {/* Open question */}
                      {effectiveType === 'open' && (
                        <textarea
                          value={answers[index] || ''}
                          onChange={(e) => onAnswerChange(index, e.target.value)}
                          disabled={!!gradeResult || isGrading}
                          placeholder="כתוב את תשובתך כאן..."
                          className="w-full border border-border rounded-lg p-3 text-sm resize-none h-24 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          dir="rtl"
                        />
                      )}

                      {/* Yes/No question */}
                      {effectiveType === 'yesno' && (
                        <div className="flex gap-3">
                          {['כן', 'לא'].map((option) => (
                            <button
                              key={option}
                              onClick={() => onAnswerChange(index, option)}
                              disabled={!!gradeResult || isGrading}
                              className={`px-6 py-2 rounded-xl border-2 text-sm font-medium transition-all
                                ${answers[index] === option
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/50'}`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Multiple choice question */}
                      {effectiveType === 'multiple' && (
                        <div className="space-y-2">
                          {['א', 'ב', 'ג', 'ד'].map((option) => (
                            <button
                              key={option}
                              onClick={() => onAnswerChange(index, option)}
                              disabled={!!gradeResult || isGrading}
                              className={`w-full text-right px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
                                ${answers[index] === option
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:border-primary/50'}`}
                            >
                              {option}. {question.options?.[option] || ''}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Per-question feedback shown right after the answer */}
                      {feedback && (
                        <div className="mt-3 space-y-1">

                          {/* Correct answer */}
                          <p className="text-sm font-medium text-foreground">
                            התשובה הנכונה: <span className="text-green-700">{question.answer}</span>
                          </p>

                          {/* Explanation */}
                          <p className="text-xs text-muted-foreground">{feedback.explanation}</p>

                          {/* Covered points — open questions only */}
                          {effectiveType === 'open' && feedback.covered_points?.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs font-medium text-green-700">נקודות שכוסו בתשובה:</p>
                              {feedback.covered_points.map((point: string, i: number) => (
                                <p key={i} className="text-xs text-green-600">✓ {point}</p>
                              ))}
                            </div>
                          )}

                          {/* Missed points — open questions only */}
                          {effectiveType === 'open' && feedback.missed_points?.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs font-medium text-red-700">נקודות חסרות בתשובה:</p>
                              {feedback.missed_points.map((point: string, i: number) => (
                                <p key={i} className="text-xs text-red-600">✗ {point}</p>
                              ))}
                            </div>
                          )}

                        </div>
                      )}
                    </>
                  );
                })()}

              </div>
            </li>
          );
        })}
      </ol>

      {!gradeResult && (
        <button
          onClick={onSubmit}
          disabled={!allAnswered || isGrading}
          className={`mt-6 w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all
            ${allAnswered && !isGrading
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
        >
          {isGrading ? 'תשובותך נבדקות...' : 'בדוק את תשובותך'}
        </button>
      )}

    </div>
  );
};

export default QuestionsList;