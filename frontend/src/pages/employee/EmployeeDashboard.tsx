import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import { vouchersApi } from '../../api/vouchers';
import { useAuth } from '../../auth/AuthContext';
import type { EmployeeStats, Voucher } from '../../types';
import { formatAmount } from '../../lib/format';
import { StatCard } from '../../components/StatCard';
import { VoucherTable } from '../../components/VoucherTable';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [recent, setRecent] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([dashboardApi.stats(), vouchersApi.list({ pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' })])
      .then(([s, list]) => {
        setStats(s as EmployeeStats);
        setRecent(list.data);
      })
      .catch(() => setError('Could not load your dashboard.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Welcome, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">Your expense vouchers at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/employee/vouchers/new')}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          New voucher
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Vouchers" value={stats.total} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Pending Approval" value={stats.pending} accent="warning" />
        <StatCard label="Approved" value={stats.approved} accent="success" />
        <StatCard label="Rejected" value={stats.rejected} accent="danger" />
        <StatCard
          label="Total Amount Claimed"
          value={formatAmount(stats.totalAmountClaimed)}
          hint="Across every voucher you have raised"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Recent vouchers</h2>
        <VoucherTable
          rows={recent}
          onRowClick={(v) => navigate(`/employee/vouchers/${v.id}`)}
          emptyMessage="You have not raised a voucher yet."
        />
      </section>
    </div>
  );
}
