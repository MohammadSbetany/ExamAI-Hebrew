interface QuestionsListProps {
  questions: string[];
}

const QuestionsList = ({ questions }: QuestionsListProps) => {
  if (questions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
          <svg
            className="w-5 h-5 text-success"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">שאלות פתוחות שנוצרו</h2>
          <p className="text-sm text-muted-foreground">{questions.length} שאלות נוצרו בהצלחה</p>
        </div>
      </div>

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li
            key={index}
            className="question-item animate-fade-in opacity-0 flex gap-4"
          >
            <span className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-question-number">
              {index + 1}
            </span>
            <p className="text-foreground leading-relaxed pt-1">{question}</p>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default QuestionsList;
