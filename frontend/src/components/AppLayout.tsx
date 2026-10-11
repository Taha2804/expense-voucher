import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

const NAV: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  EMPLOYEE: [
    { to: '/employee', label: 'Dashboard', end: true },
    { to: '/employee/vouchers', label: 'My Vouchers' },
    { to: '/employee/vouchers/new', label: 'New Voucher' },
  ],
  DIRECTOR: [
    { to: '/director', label: 'Dashboard', end: true },
    { to: '/director/pending', label: 'Pending Approvals' },
    { to: '/director/vouchers', label: 'All Vouchers' },
  ],
  ACCOUNTS: [
    { to: '/accounts', label: 'Dashboard', end: true },
    { to: '/accounts/vouchers', label: 'All Vouchers' },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  DIRECTOR: 'Director',
  ACCOUNTS: 'Accounts Team',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const links = NAV[user.role];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200'
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="rounded-md border border-slate-300 px-2 py-1 text-slate-700 md:hidden"
            >
              ☰
            </button>
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              Expense Vouchers
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>

        {open && (
          <nav className="space-y-1 border-t border-slate-200 px-4 py-3 md:hidden">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
