import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import type { AccountsStats } from '../../types';
import { formatAmount } from '../../lib/format';
import { StatCard } from '../../components/StatCard';
import { VoucherTable } from '../../components/VoucherTable';

export function AccountsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AccountsStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi
      .stats()
      .then((s) => setStats(s as AccountsStats))
      .catch(() => setError('Could not load the dashboard.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Accounts Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Approved vouchers ready for reimbursement, and the organisation's totals.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Vouchers" value={stats.total} />
        <StatCard label="Pending Approval" value={stats.pending} accent="warning" />
        <StatCard label="Approved" value={stats.approved} accent="success" />
        <StatCard label="Rejected" value={stats.rejected} accent="danger" />
        <StatCard
          label="Total Approved Expense"
          value={formatAmount(stats.totalApprovedAmount)}
          hint="Payable across all approved vouchers"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Recently approved</h2>
        <VoucherTable
          rows={stats.recentApproved}
          showEmployee
          onRowClick={(v) => navigate(`/accounts/vouchers/${v.id}`)}
          emptyMessage="No vouchers have been approved yet."
        />
      </section>
    </div>
  );
}
