import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../types';

export function ProtectedRoute({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // A wrong role is shown a message rather than redirected: sending them to
  // their own dashboard would look like the link was broken.
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">You are not authorized</h1>
        <p className="mt-2 text-slate-600">
          This page is not available to the {user.role.toLowerCase()} role.
        </p>
        <a
          href={user.role === 'EMPLOYEE' ? '/employee' : user.role === 'DIRECTOR' ? '/director' : '/accounts'}
          className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Go to your dashboard
        </a>
      </div>
    );
  }

  return <Outlet />;
}
