import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from '@/components/ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the error message text', () => {
    render(<ErrorMessage message="שגיאה בעיבוד הקובץ" />);
    expect(screen.getByText('שגיאה בעיבוד הקובץ')).toBeInTheDocument();
  });

  it('renders the "שגיאה" label', () => {
    render(<ErrorMessage message="some error" />);
    expect(screen.getByText('שגיאה')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorMessage message="error" onDismiss={onDismiss} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(<ErrorMessage message="error" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders different error messages correctly', () => {
    const { rerender } = render(<ErrorMessage message="First error" />);
    expect(screen.getByText('First error')).toBeInTheDocument();
    rerender(<ErrorMessage message="Second error" />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
  });
});