import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const renderWithRoute = (ui: ReactNode) =>
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderWithRoute(
      <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
    );
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Spinner rendered via animate-spin div
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderWithRoute(
      <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', name: 'Test', role: 'student', email: 'a@b.com', token: 'tok' },
      loading: false,
    });
    renderWithRoute(
      <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects student to / when requireTeacher is true', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', name: 'Student', role: 'student', email: 'a@b.com', token: 'tok' },
      loading: false,
    });
    renderWithRoute(
      <ProtectedRoute requireTeacher><div>Teacher Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Teacher Content')).not.toBeInTheDocument();
  });

  it('renders children for teacher when requireTeacher is true', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: '123', name: 'Teacher', role: 'teacher', email: 'a@b.com', token: 'tok' },
      loading: false,
    });
    renderWithRoute(
      <ProtectedRoute requireTeacher><div>Teacher Content</div></ProtectedRoute>
    );
    expect(screen.getByText('Teacher Content')).toBeInTheDocument();
  });
});