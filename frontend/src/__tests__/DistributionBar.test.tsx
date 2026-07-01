import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DistributionBar from '@/components/DistributionBar';

const segments = [
  { key: 'yesno', label: 'כןלא', color: 'bg-blue-500' },
  { key: 'multiple', label: 'רבברירה', color: 'bg-violet-500' },
  { key: 'open', label: 'פתוחות', color: 'bg-emerald-500' },
];

describe('DistributionBar', () => {
  it('renders each segment label', () => {
    render(<DistributionBar total={5} segments={segments} counts={[2, 2, 1]} onChange={() => {}} />);
    expect(screen.getAllByText('פתוחות').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('רבברירה').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('כןלא').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the count of a zero-value segment instead of hiding it', () => {
    render(<DistributionBar total={4} segments={segments} counts={[4, 0, 0]} onChange={() => {}} />);
    // both the "4" and the two "0"s are rendered (segment counts + legend)
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);
  });

  it('has two draggable divider handles when enabled', () => {
    const { container } = render(
      <DistributionBar total={6} segments={segments} counts={[2, 2, 2]} onChange={() => {}} />,
    );
    expect(container.querySelectorAll('.cursor-ew-resize').length).toBe(2);
  });

  it('does not render a resize cursor when disabled', () => {
    const { container } = render(
      <DistributionBar total={6} segments={segments} counts={[2, 2, 2]} onChange={() => {}} disabled />,
    );
    expect(container.querySelectorAll('.cursor-ew-resize').length).toBe(0);
  });

  it('renders segment widths proportional to their counts (floored so 0 stays visible)', () => {
    const { container } = render(
      <DistributionBar total={4} segments={segments} counts={[4, 0, 0]} onChange={() => {}} />,
    );
    const bars = Array.from(container.querySelectorAll('[style*="width"]')) as HTMLElement[];
    // the first (count 4) segment is the widest; the two zero segments keep a small floor
    const widths = bars.map(b => parseFloat(b.style.width));
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(0); // 0-count segment still has a visible floor width
  });
});
