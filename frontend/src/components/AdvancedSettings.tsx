import { useState } from 'react';

interface AdvancedSettingsProps {
  questionType: string;
  difficulty: string;
  questionCount: number;
  // Time
  timeMode: 'manual' | 'ai';
  manualMinutes: number;
  onTimeModeChange: (mode: 'manual' | 'ai') => void;
  onManualMinutesChange: (minutes: number) => void;
  // Difficulty distribution (merged difficulty only)
  difficultyDist: { easy: number; medium: number; hard: number };
  onDifficultyDistChange: (dist: { easy: number; medium: number; hard: number }) => void;
  // Format ratios (merged question type only)
  formatCounts: { yesno: number; multiple: number; open: number };
  onFormatCountsChange: (counts: { yesno: number; multiple: number; open: number }) => void;
  disabled?: boolean;
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const AdvancedSettings = ({
  questionType, difficulty, questionCount,
  timeMode, manualMinutes, onTimeModeChange, onManualMinutesChange,
  difficultyDist, onDifficultyDistChange,
  formatCounts, onFormatCountsChange,
  disabled,
}: AdvancedSettingsProps) => {
  const [open, setOpen] = useState(false);

  const difficultyDistSum = difficultyDist.easy + difficultyDist.medium + difficultyDist.hard;
  const difficultyDistValid = difficultyDistSum === 100;

  const formatCountsSum = formatCounts.yesno + formatCounts.multiple + formatCounts.open;
  const formatCountsValid = formatCountsSum === questionCount;

  const handleDiffDist = (key: 'easy' | 'medium' | 'hard', value: number) => {
    onDifficultyDistChange({ ...difficultyDist, [key]: value });
  };

  const handleFormatCount = (key: 'yesno' | 'multiple' | 'open', value: number) => {
    onFormatCountsChange({ ...formatCounts, [key]: value });
  };

  const showDifficultyDist = difficulty === 'merged';
  const showFormatCounts = questionType === 'merged';
  const hasContent = true; // time control always shown

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
      >
        <span className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          הגדרות מתקדמות
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && hasContent && (
        <div className="mt-3 p-4 bg-muted/40 rounded-xl border border-border space-y-6">

          {/* ── Time Control ─────────────────────────────────────────── */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              הגבלת זמן לבחינה
            </p>

            {/* Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl mb-3">
              {[
                { value: 'manual', label: '⏱ ידני' },
                { value: 'ai', label: '✨ הערכת AI' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTimeModeChange(value as 'manual' | 'ai')}
                  disabled={disabled}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                    timeMode === value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {timeMode === 'manual' ? (
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={manualMinutes}
                  onChange={e => onManualMinutesChange(Math.max(1, Math.min(300, Number(e.target.value))))}
                  disabled={disabled}
                  className="w-24 px-3 py-2 rounded-xl border border-input bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <span className="text-sm text-muted-foreground">דקות</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                ה-AI יחשב את משך הזמן המומלץ בהתבסס על מספר השאלות ורמת הקושי שלהן, ויכלול אותו בפלט הבחינה.
              </p>
            )}
          </div>

          {/* ── Difficulty Distribution (merged difficulty only) ───────── */}
          {showDifficultyDist && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                התפלגות רמות קושי (%)
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                סה״כ: {difficultyDistSum}% {!difficultyDistValid && <span className="text-destructive font-medium">— חייב להיות 100%</span>}
              </p>
              {([
                { key: 'easy', label: 'קל (L1–L2)', color: 'bg-green-400' },
                { key: 'medium', label: 'בינוני (L3–L4)', color: 'bg-yellow-400' },
                { key: 'hard', label: 'קשה (L5–L6)', color: 'bg-red-400' },
              ] as const).map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
                  <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
                  <input
                    type="range" min={0} max={100}
                    value={difficultyDist[key]}
                    onChange={e => handleDiffDist(key, Number(e.target.value))}
                    disabled={disabled}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="number" min={0} max={100}
                    value={difficultyDist[key]}
                    onChange={e => handleDiffDist(key, Math.max(0, Math.min(100, Number(e.target.value))))}
                    disabled={disabled}
                    className="w-14 px-2 py-1 rounded-lg border border-input bg-background text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Format Ratios (merged question type only) ─────────────── */}
          {showFormatCounts && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                כמות לפי פורמט
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                סה״כ: {formatCountsSum}/{questionCount}
                {!formatCountsValid && <span className="text-destructive font-medium"> — חייב להיות שווה למספר השאלות הכולל</span>}
              </p>
              {([
                { key: 'yesno', label: 'כן / לא' },
                { key: 'multiple', label: 'רב ברירה' },
                { key: 'open', label: 'פתוחות' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
                  <input
                    type="range" min={0} max={questionCount}
                    value={formatCounts[key]}
                    onChange={e => handleFormatCount(key, Number(e.target.value))}
                    disabled={disabled}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="number" min={0} max={questionCount}
                    value={formatCounts[key]}
                    onChange={e => handleFormatCount(key, Math.max(0, Math.min(questionCount, Number(e.target.value))))}
                    disabled={disabled}
                    className="w-14 px-2 py-1 rounded-lg border border-input bg-background text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">שאלות</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedSettings;