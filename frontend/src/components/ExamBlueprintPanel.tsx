import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ExamBlueprint } from '@/types/questions';

interface ExamBlueprintPanelProps {
  blueprint: ExamBlueprint;
  onChange: (bp: ExamBlueprint) => void;
  questionCount: number;
  disabled?: boolean;
}

const ExamBlueprintPanel = ({ blueprint, onChange, questionCount, disabled }: ExamBlueprintPanelProps) => {
  const { timeMode, manualTime, difficultyDistribution: dist, formatCounts: fc } = blueprint;

  // ── helpers ──────────────────────────────────────────────────────────────
  const update = (partial: Partial<ExamBlueprint>) => onChange({ ...blueprint, ...partial });

  /** Adjust distribution sliders so they always sum to 100. */
  const handleDistChange = (key: 'easy' | 'medium' | 'hard', raw: number) => {
    const value = Math.min(100, Math.max(0, raw));
    const others = (['easy', 'medium', 'hard'] as const).filter(k => k !== key);
    const remaining = 100 - value;
    const currentOtherSum = others.reduce((s, k) => s + dist[k], 0);

    let newDist = { ...dist, [key]: value };
    if (currentOtherSum === 0) {
      // Split remaining equally
      const half = Math.floor(remaining / 2);
      newDist[others[0]] = half;
      newDist[others[1]] = remaining - half;
    } else {
      // Scale the other two proportionally
      others.forEach(k => {
        newDist[k] = Math.round((dist[k] / currentOtherSum) * remaining);
      });
      // Fix rounding drift
      const drift = 100 - Object.values(newDist).reduce((s, v) => s + v, 0);
      newDist[others[1]] = newDist[others[1]] + drift;
    }
    update({ difficultyDistribution: newDist });
  };

  const handleFormatCount = (key: 'yesno' | 'multiple' | 'open', raw: string) => {
    const value = Math.max(0, parseInt(raw) || 0);
    update({ formatCounts: { ...fc, [key]: value } });
  };

  const distSum = dist.easy + dist.medium + dist.hard;
  const fcTotal = fc.yesno + fc.multiple + fc.open;
  const isMixedMode = fcTotal > 0;
  const fcValid = !isMixedMode || fcTotal === questionCount;

  return (
    <Accordion type="single" collapsible className="border border-border rounded-xl overflow-hidden mb-6">
      <AccordionItem value="blueprint" className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 rounded-t-xl">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>⚙️</span>
            <span>הגדרות מתקדמות — Blueprint מבחן</span>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4 pt-2 space-y-6">

          {/* ── Time Management ──────────────────────────────────────── */}
          <section>
            <p className="text-sm font-semibold text-foreground mb-3">⏱ ניהול זמן מבחן</p>
            <div className="flex gap-3 mb-3">
              {[
                { value: 'manual', label: 'ידני', desc: 'הגדר זמן בעצמך' },
                { value: 'ai_estimated', label: 'המלצת AI', desc: 'AI יעריך את הזמן' },
              ].map(opt => (
                <button
                  key={opt.value}
                  disabled={disabled}
                  onClick={() => update({ timeMode: opt.value as ExamBlueprint['timeMode'] })}
                  className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-0.5
                    ${timeMode === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'}`}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs font-normal opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>

            {timeMode === 'manual' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">זמן (דקות):</label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={manualTime}
                  disabled={disabled}
                  onChange={e => update({ manualTime: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-24 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">דקות</span>
              </div>
            )}

            {timeMode === 'ai_estimated' && (
              <p className="text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
                ✨ ה-AI ינתח את השאלות שנוצרו ויציע זמן מומלץ על בסיס הרמה הקוגניטיבית וכמות השאלות.
              </p>
            )}
          </section>

          {/* ── Difficulty Distribution ─────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">📊 התפלגות רמות קושי</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                distSum === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {distSum === 100 ? `✓ סה"כ 100%` : `✗ סה"כ ${distSum}%`}
              </span>
            </div>

            {([
              { key: 'easy', label: 'קל', bloom: "Bloom's L1–L2", color: 'text-green-600' },
              { key: 'medium', label: 'בינוני', bloom: "Bloom's L3–L4", color: 'text-yellow-600' },
              { key: 'hard', label: 'קשה', bloom: "Bloom's L5–L6", color: 'text-red-600' },
            ] as const).map(({ key, label, bloom, color }) => (
              <div key={key} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-medium ${color}`}>{label} <span className="text-muted-foreground font-normal">({bloom})</span></span>
                  <span className="text-sm font-semibold text-foreground">{dist[key]}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={dist[key]}
                  disabled={disabled}
                  onChange={e => handleDistChange(key, parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              הסליידרים מתאימים אוטומטית כך שהסכום תמיד יהיה 100%.
            </p>
          </section>

          {/* ── Format Counts ───────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">📝 מספר שאלות לפי סוג</p>
              {isMixedMode && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  fcValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {fcValid ? `✓ סה"כ ${fcTotal}` : `✗ סה"כ ${fcTotal} / ${questionCount}`}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'open', label: 'פתוחות' },
                { key: 'yesno', label: 'כן / לא' },
                { key: 'multiple', label: 'רב ברירה' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">{label}</label>
                  <input
                    type="number"
                    min={0}
                    max={questionCount}
                    value={fc[key]}
                    disabled={disabled}
                    onChange={e => handleFormatCount(key, e.target.value)}
                    className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {isMixedMode
                ? `מצב מעורב פעיל — סכום הסוגים חייב להיות שווה למספר השאלות (${questionCount}).`
                : 'השאר 0 בכל השדות כדי להשתמש בסוג השאלה שנבחר למעלה.'}
            </p>
          </section>

        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ExamBlueprintPanel;
