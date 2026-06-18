import { useRef } from 'react';

export type SegmentDef = { key: string; label: string; color: string };

interface DistributionBarProps {
  total: number;
  segments: SegmentDef[];   // exactly 3
  counts: number[];         // length === segments.length, should sum to total
  onChange: (counts: number[]) => void;
  disabled?: boolean;
}

// Each segment keeps at least this share of the bar, so an option with a value
// of 0 stays visible (small) instead of collapsing between its neighbours.
const FLOOR_PCT = 12;

/**
 * A single horizontal bar split into segments whose widths represent how many
 * questions each option gets. Drag the dividers between segments to reallocate;
 * the segment counts always sum to `total`.
 */
const DistributionBar = ({ total, segments, counts, onChange, disabled }: DistributionBarProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const safeTotal = Math.max(1, total);
  const budget = 100 - FLOOR_PCT * segments.length; // % shared proportionally
  // Display width (%) for a count — floored so every segment stays visible.
  const wpct = (c: number) => FLOOR_PCT + (c / safeTotal) * budget;

  const c0 = counts[0] ?? 0;
  const c1 = counts[1] ?? 0;
  // Cumulative display positions of the two dividers.
  const cumPos = [wpct(c0), wpct(c0) + wpct(c1)];

  const setBoundary = (which: number, valueCount: number) => {
    let b1 = c0;
    let b2 = c0 + c1;
    if (which === 0) b1 = Math.max(0, Math.min(valueCount, b2));
    else b2 = Math.max(b1, Math.min(valueCount, total));
    onChange([b1, b2 - b1, total - b2]);
  };

  const moveTo = (clientX: number) => {
    const el = trackRef.current;
    if (!el || dragging.current === null) return;
    const rect = el.getBoundingClientRect();
    const posPct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100;
    // Invert the floored display mapping back to a count.
    const which = dragging.current;
    const offset = (which + 1) * FLOOR_PCT; // floors accumulated before this divider
    setBoundary(which, Math.round(((posPct - offset) / budget) * total));
  };

  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (disabled) return;
    dragging.current = i;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => moveTo(e.clientX);
  const onUp = (e: React.PointerEvent) => {
    dragging.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  return (
    <div>
      <div
        ref={trackRef}
        dir="ltr"
        className="relative h-11 w-full rounded-xl overflow-hidden border border-border select-none touch-none"
      >
        <div className="absolute inset-0 flex">
          {segments.map((s, i) => (
            <div key={s.key} className={`h-full flex items-center justify-center gap-1 px-1.5 overflow-hidden ${s.color}`} style={{ width: `${wpct(counts[i] ?? 0)}%` }}>
              <span className="text-xs font-medium text-white truncate">{s.label}</span>
              <span className="text-xs font-bold text-white flex-shrink-0">{counts[i] ?? 0}</span>
            </div>
          ))}
        </div>
        {[0, 1].map(d => (
          <div
            key={d}
            onPointerDown={onDown(d)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className={`absolute top-0 h-full w-4 -ml-2 flex items-center justify-center ${disabled ? '' : 'cursor-ew-resize'}`}
            style={{ left: `${cumPos[d]}%` }}
          >
            <div className="w-1 h-7 rounded-full bg-white shadow ring-1 ring-black/15" />
          </div>
        ))}
      </div>
      <div dir="rtl" className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map((s, i) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            {s.label}: <span className="font-semibold text-foreground">{counts[i] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default DistributionBar;
