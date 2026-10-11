import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import type { DirectorStats } from '../../types';
import { formatAmount } from '../../lib/format';
import { StatCard } from '../../components/StatCard';
import { VoucherTable } from '../../components/VoucherTable';

export function DirectorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DirectorStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi
      .stats()
      .then((s) => setStats(s as DirectorStats))
      .catch(() => setError('Could not load the dashboard.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Director Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Approvals waiting on you, and today's activity.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/director/pending')}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Review pending ({stats.pending})
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Approval" value={stats.pending} accent="warning" />
        <StatCard label="Approved Today" value={stats.approvedToday} accent="success" />
        <StatCard label="Rejected Today" value={stats.rejectedToday} accent="danger" />
        <StatCard
          label="Total Pending Amount"
          value={formatAmount(stats.totalPendingAmount)}
          hint="Awaiting your decision"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Recent voucher activity</h2>
        <VoucherTable
          rows={stats.recentActivity}
          showEmployee
          onRowClick={(v) => navigate(`/director/vouchers/${v.id}`)}
          emptyMessage="No voucher activity yet."
        />
      </section>
    </div>
  );
}
