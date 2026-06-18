// Proportionally rescale `counts` to non-negative integers that sum to `total`.
export const rescaleCounts = (counts: number[], total: number): number[] => {
  const n = counts.length;
  if (n === 0) return [];
  if (total <= 0) return counts.map(() => 0);
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const base = Math.floor(total / n);
    const out = counts.map(() => base);
    let rem = total - base * n;
    for (let i = 0; rem > 0; i = (i + 1) % n, rem--) out[i]++;
    return out;
  }
  const scaled = counts.map(c => (c / sum) * total);
  const out = scaled.map(Math.floor);
  const rem = total - out.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < rem; k++) out[order[k % n].i]++;
  return out;
};
