import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './AuthContext';
import type { User } from '../types';

vi.mock('./AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./AuthContext')>('./AuthContext');
  return { ...actual, useAuth: vi.fn() };
});

const mockedUseAuth = vi.mocked(useAuth);

const employee: User = {
  id: 'u1',
  email: 'aarav@abc.com',
  name: 'Aarav Sharma',
  employeeCode: 'EMP-001',
  department: 'Engineering',
  role: 'EMPLOYEE',
};

function renderAt(path: string, roles: User['role'][]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/employee" element={<div>Employee area</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  it('renders nothing route-dependent while loading rather than redirecting', () => {
    mockedUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    renderAt('/employee', ['EMPLOYEE']);

    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.queryByText('Employee area')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated user to /login', () => {
    mockedUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    renderAt('/employee', ['EMPLOYEE']);

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the outlet for an allowed role', () => {
    mockedUseAuth.mockReturnValue({ user: employee, loading: false } as ReturnType<typeof useAuth>);

    renderAt('/employee', ['EMPLOYEE']);

    expect(screen.getByText('Employee area')).toBeInTheDocument();
  });

  it('renders the not-authorized screen, not a redirect, for a disallowed role', () => {
    mockedUseAuth.mockReturnValue({ user: employee, loading: false } as ReturnType<typeof useAuth>);

    renderAt('/employee', ['DIRECTOR']);

    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
  });
});
