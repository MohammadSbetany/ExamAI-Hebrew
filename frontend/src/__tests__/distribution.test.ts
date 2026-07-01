import { describe, it, expect } from 'vitest';
import { rescaleCounts } from '@/utils/distribution';

describe('rescaleCounts', () => {
  it('keeps a distribution that already sums to the total', () => {
    const out = rescaleCounts([1, 3, 1], 5);
    expect(out.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('always sums exactly to the total for arbitrary inputs', () => {
    for (const total of [1, 3, 4, 7, 13, 100]) {
      const out = rescaleCounts([5, 2, 9], total);
      expect(out.reduce((a, b) => a + b, 0)).toBe(total);
      expect(out.every(n => n >= 0 && Number.isInteger(n))).toBe(true);
    }
  });

  it('scales up proportionally', () => {
    const out = rescaleCounts([1, 1, 0], 10);
    expect(out.reduce((a, b) => a + b, 0)).toBe(10);
    expect(out[0]).toBe(out[1]); // equal shares stay equal
    expect(out[2]).toBe(0);      // zero share stays zero
  });

  it('even-splits when every input is zero', () => {
    const out = rescaleCounts([0, 0, 0], 7);
    expect(out.reduce((a, b) => a + b, 0)).toBe(7);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThanOrEqual(1);
  });

  it('returns all zeros when the total is 0', () => {
    expect(rescaleCounts([2, 2, 2], 0)).toEqual([0, 0, 0]);
  });

  it('handles an empty array', () => {
    expect(rescaleCounts([], 5)).toEqual([]);
  });

  it('distributes a remainder to the largest fractional parts', () => {
    // 3 equal parts of 10 -> 4,3,3 (sum 10), remainder goes to first bucket
    const out = rescaleCounts([1, 1, 1], 10);
    expect(out.reduce((a, b) => a + b, 0)).toBe(10);
    expect(Math.max(...out)).toBe(4);
  });
});
