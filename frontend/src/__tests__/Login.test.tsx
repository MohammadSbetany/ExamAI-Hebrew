import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/Login';

// ── Mock useAuth ──────────────────────────────────────────────────────────────
const mockLogin = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, user: null, loading: false, logout: vi.fn(), signup: vi.fn() }),
}));

// ── Mock useNavigate ──────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderLogin = () =>
  render(<MemoryRouter><Login /></MemoryRouter>);

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password inputs', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: 'התחבר' })).toBeInTheDocument();
  });

  it('renders a link to signup page', () => {
    renderLogin();
    expect(screen.getByText('הרשם עכשיו')).toBeInTheDocument();
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'התחבר' }).closest('form')!);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('navigates to / after successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'התחבר' }).closest('form')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('shows Hebrew error for wrong credentials', async () => {
    mockLogin.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'התחבר' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('אימייל או סיסמה שגויים')).toBeInTheDocument();
    });
  });

  it('shows Hebrew error for too many requests', async () => {
    mockLogin.mockRejectedValueOnce({ code: 'auth/too-many-requests' });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: '123456' } });
    fireEvent.submit(screen.getByRole('button', { name: 'התחבר' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('יותר מדי ניסיונות. נסה שוב מאוחר יותר')).toBeInTheDocument();
    });
  });
});