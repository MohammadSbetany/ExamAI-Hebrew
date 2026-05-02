import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from '@/pages/Signup';

const mockSignup = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ signup: mockSignup, user: null, loading: false, logout: vi.fn(), login: vi.fn() }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderSignup = () =>
  render(<MemoryRouter><Signup /></MemoryRouter>);

const fillForm = (overrides: Record<string, string> = {}) => {
  const defaults = {
    name: 'ישראל ישראלי',
    email: 'test@example.com',
    password: 'password123',
    confirm: 'password123',
  };
  const values = { ...defaults, ...overrides };

  fireEvent.change(screen.getByPlaceholderText('ישראל ישראלי'), { target: { value: values.name } });
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: values.email } });
  const passwordInputs = screen.getAllByPlaceholderText(/תווים|password/i);
  fireEvent.change(passwordInputs[0], { target: { value: values.password } });
  fireEvent.change(screen.getByPlaceholderText('הקלד שוב את הסיסמה'), { target: { value: values.confirm } });
};

describe('Signup page', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders all form fields', () => {
    renderSignup();
    expect(screen.getByPlaceholderText('ישראל ישראלי')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('הקלד שוב את הסיסמה')).toBeInTheDocument();
  });

  it('renders role toggle buttons', () => {
    renderSignup();
    expect(screen.getByText('🎓 תלמיד')).toBeInTheDocument();
    expect(screen.getByText('📚 מורה')).toBeInTheDocument();
  });

  it('renders a link to login page', () => {
    renderSignup();
    expect(screen.getByText('התחבר')).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    renderSignup();
    fillForm({ confirm: 'differentpassword' });
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('הסיסמאות אינן תואמות')).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    renderSignup();
    fillForm({ password: '123', confirm: '123' });
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('הסיסמה חלשה מדי — השתמש ב-6 תווים לפחות')).toBeInTheDocument();
    });
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('calls signup with correct arguments on valid submission', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    renderSignup();
    fillForm();
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('test@example.com', 'password123', 'ישראל ישראלי', 'student');
    });
  });

  it('navigates to / after successful signup', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    renderSignup();
    fillForm();
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows Hebrew error when email already in use', async () => {
    mockSignup.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    renderSignup();
    fillForm();
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('כתובת האימייל כבר בשימוש')).toBeInTheDocument();
    });
  });

  it('submits with teacher role when teacher is selected', async () => {
    mockSignup.mockResolvedValueOnce(undefined);
    renderSignup();
    fireEvent.click(screen.getByText('📚 מורה'));
    fillForm();
    fireEvent.submit(screen.getByRole('button', { name: 'צור חשבון' }).closest('form')!);

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.any(String), 'teacher');
    });
  });
});