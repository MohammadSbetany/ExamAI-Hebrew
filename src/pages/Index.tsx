import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import LoadingSpinner from '@/components/LoadingSpinner';
import QuestionsList from '@/components/QuestionsList';
import ErrorMessage from '@/components/ErrorMessage';

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);
    setQuestions([]);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // 1. ADDED: Initial log to verify the request starts
      console.log("Starting upload for:", selectedFile.name);

      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      // 2. ADDED: Log the status code for debugging
      console.log("Server responded with status:", response.status);

      if (!response.ok) {
        // IMPROVED: Capture the specific status code in the error message
        throw new Error(`שגיאה בהעלאת הקובץ (קוד: ${response.status}). אנא נסה שנית.`);
      }

      const data = await response.json();
      
      // 3. ADDED: Log the actual data received from DeepSeek
      console.log("Data received from backend:", data);
      
      // Expecting the response to have a "questions" array
      if (data && data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      } else {
        // 4. ADDED: Detailed error if the JSON structure is unexpected
        console.error("Unexpected JSON structure:", data);
        throw new Error('תשובה לא תקינה מהשרת - המבנה שהתקבל אינו תקין');
      }
    } catch (err) {
      // 5. ADDED: Log the full error object for better troubleshooting
      console.error("Full catch-block error:", err);
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בלתי צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setQuestions([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <svg
              className="w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            מערכת לייצור שאלות פתוחות
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            העלה קובץ PDF עם חומר לימוד וקבל שאלות פתוחות שנוצרות באופן אוטומטי
          </p>
        </header>

        {/* Main Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
          {/* Upload Section */}
          <section className="mb-6">
            <FileUpload
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              disabled={isLoading}
            />
          </section>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!selectedFile || isLoading}
            className={`
              w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
              ${
                selectedFile && !isLoading
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
              <QuestionsList questions={questions} />
              
              <button
                onClick={handleReset}
                className="mt-8 w-full py-3 px-6 rounded-xl border-2 border-border text-foreground font-medium hover:bg-muted transition-colors"
              >
                התחל מחדש
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <p>העלה קובץ PDF בלבד • המערכת תעבד את התוכן ותייצר שאלות פתוחות</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;