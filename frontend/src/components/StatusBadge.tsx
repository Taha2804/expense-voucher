import { STATUS_LABELS, type VoucherStatus } from '../types';

const STYLES: Record<VoucherStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-800 ring-red-200',
};

export function StatusBadge({ status }: { status: VoucherStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
