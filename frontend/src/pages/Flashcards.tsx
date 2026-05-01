import React, { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import { useAuth } from '@/context/AuthContext';

interface Flashcard {
  front: string;
  back: string;
}

const API = () => import.meta.env.VITE_API_BASE_URL ?? '/backend';

// ── Icons ─────────────────────────────────────────────────────────────────────

const ShuffleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
    <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
    <line x1="4" y1="4" x2="9" y2="9"/>
  </svg>
);

const ReverseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
  </svg>
);

const ChevronIcon = ({ dir }: { dir: 'right' | 'left' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {dir === 'right' ? <polyline points="9 18 15 12 9 6"/> : <polyline points="15 18 9 12 15 6"/>}
  </svg>
);

// ── Flip Card ─────────────────────────────────────────────────────────────────

interface FlipCardProps {
  card: Flashcard;
  reversed: boolean;
  index: number;
  total: number;
}

const FlipCard = ({ card, reversed, index, total }: FlipCardProps) => {
  const [flipped, setFlipped] = useState(false);
  const front = reversed ? card.back : card.front;
  const back  = reversed ? card.front : card.back;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Card */}
      <div
        onClick={() => setFlipped(f => !f)}
        className="w-full max-w-xl cursor-pointer select-none"
        style={{ perspective: '1000px' }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '260px',
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Front face */}
          <div
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-card border-2 border-primary/30 rounded-2xl shadow-lg shadow-primary/10"
          >
            <p className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-4">
              {reversed ? 'הגדרה' : 'מושג'}
            </p>
            <p className="text-xl font-bold text-foreground text-center leading-relaxed" dir="rtl">
              {front}
            </p>
            <p className="text-xs text-muted-foreground mt-6">לחץ להפוך</p>
          </div>

          {/* Back face */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-primary rounded-2xl shadow-lg shadow-primary/20"
          >
            <p className="text-xs font-semibold text-primary-foreground/60 uppercase tracking-widest mb-4">
              {reversed ? 'מושג' : 'הגדרה'}
            </p>
            <p className="text-lg text-primary-foreground text-center leading-relaxed" dir="rtl">
              {back}
            </p>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <p className="mt-4 text-sm text-muted-foreground">
        {index + 1} / {total}
      </p>
      <div className="w-full max-w-xl mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

const Flashcards = () => {
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reversed, setReversed] = useState(false);

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) return;
    setIsLoading(true);
    setError(null);
    setCards([]);
    setCurrentIndex(0);
    setReversed(false);

    try {
      const formData = new FormData();
      selectedFiles.forEach(f => formData.append('files', f));

      const r = await fetch(`${API()}/flashcards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
        body: formData,
      });

      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || 'שגיאה ביצירת כרטיסיות');
      }

      const data = await r.json();
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.cards) || data.cards.length === 0) {
        throw new Error('לא נמצאו מושגים בחומר. נסה קובץ אחר.');
      }
      setCards(data.cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בלתי צפויה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = useCallback(() => {
    setCards(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
    setCurrentIndex(0);
  }, []);

  const handleReset = () => {
    setCards([]);
    setSelectedFiles([]);
    setError(null);
    setCurrentIndex(0);
    setReversed(false);
  };

  const prev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const next = () => setCurrentIndex(i => Math.min(cards.length - 1, i + 1));

  // ── Deck view ──
  if (cards.length > 0) {
    return (
      <div className="bg-background min-h-screen py-10 px-4" dir="rtl">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">כרטיסיות לימוד</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{cards.length} כרטיסיות נוצרו</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setReversed(r => !r); setCurrentIndex(0); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${reversed ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
              >
                <ReverseIcon /> הפוך סדר
              </button>
              <button
                onClick={handleShuffle}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-border text-sm font-medium text-muted-foreground hover:border-primary/50 transition-all"
              >
                <ShuffleIcon /> ערבב
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-xl border-2 border-border text-sm font-medium text-muted-foreground hover:border-primary/50 transition-all"
              >
                התחל מחדש
              </button>
            </div>
          </div>

          {/* Card */}
          <FlipCard
            card={cards[currentIndex]}
            reversed={reversed}
            index={currentIndex}
            total={cards.length}
          />

          {/* Navigation */}
          <div className="flex items-center justify-center gap-6 mt-8">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronIcon dir="right" />
            </button>
            <span className="text-sm font-medium text-muted-foreground min-w-[60px] text-center">
              {currentIndex + 1} / {cards.length}
            </span>
            <button
              onClick={next}
              disabled={currentIndex === cards.length - 1}
              className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronIcon dir="left" />
            </button>
          </div>

          {/* All cards list */}
          <details className="mt-10">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
              הצג את כל הכרטיסיות ({cards.length})
            </summary>
            <div className="grid grid-cols-1 gap-3 mt-4">
              {cards.map((card, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${i === currentIndex ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <p className="font-semibold text-sm text-foreground mb-1">{card.front}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.back}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ── Upload view ──
  return (
    <div className="bg-background min-h-screen py-12 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">

        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2"/>
              <path d="M12 6V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/>
              <line x1="12" y1="12" x2="12" y2="16"/>
              <line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">כרטיסיות לימוד</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            העלה חומר לימוד וה-AI יחלץ את המושגים המרכזיים לכרטיסיות לחזרה
          </p>
        </header>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8">
          <section className="mb-6">
            <FileUpload
              onFilesChange={files => { setSelectedFiles(files); setError(null); }}
              selectedFiles={selectedFiles}
              disabled={isLoading}
            />
          </section>

          {error && (
            <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={selectedFiles.length === 0 || isLoading}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 ${
              selectedFiles.length > 0 && !isLoading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                יוצר כרטיסיות...
              </span>
            ) : 'צור כרטיסיות'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Flashcards;