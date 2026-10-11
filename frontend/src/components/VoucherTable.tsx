import { CATEGORY_LABELS, type SortField, type Voucher } from '../types';
import { formatAmount, formatDate } from '../lib/format';
import { StatusBadge } from './StatusBadge';

interface Props {
  rows: Voucher[];
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: SortField) => void;
  showEmployee?: boolean;
  onRowClick: (voucher: Voucher) => void;
  emptyMessage?: string;
}

const COLUMNS: { field: SortField | null; label: string; employeeOnly?: boolean }[] = [
  { field: 'voucherNumber', label: 'Voucher No.' },
  { field: null, label: 'Employee', employeeOnly: true },
  { field: null, label: 'Title' },
  { field: null, label: 'Department' },
  { field: 'expenseDate', label: 'Expense Date' },
  { field: 'amount', label: 'Amount' },
  { field: 'status', label: 'Status' },
];

export function VoucherTable({
  rows,
  sortBy,
  sortOrder,
  onSortChange,
  showEmployee = false,
  onRowClick,
  emptyMessage = 'No vouchers match these filters.',
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const columns = COLUMNS.filter((c) => !c.employeeOnly || showEmployee);

  function sortIndicator(field: SortField | null) {
    if (!field || field !== sortBy) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  }

  return (
    <>
      {/* Table from md up. */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-slate-600"
                >
                  {column.field && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.field!)}
                      className="font-medium hover:text-slate-900"
                    >
                      {column.label}
                      {sortIndicator(column.field)}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((voucher) => (
              <tr
                key={voucher.id}
                onClick={() => onRowClick(voucher)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {voucher.voucherNumber}
                </td>
                {showEmployee && (
                  <td className="px-4 py-3 text-slate-700">{voucher.createdBy.name}</td>
                )}
                <td className="px-4 py-3 text-slate-900">
                  {voucher.title}
                  <span className="block text-xs text-slate-500">
                    {CATEGORY_LABELS[voucher.category]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{voucher.department}</td>
                <td className="px-4 py-3 text-slate-700">{formatDate(voucher.expenseDate)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {formatAmount(voucher.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={voucher.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards below md. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((voucher) => (
          <li key={voucher.id}>
            <button
              type="button"
              onClick={() => onRowClick(voucher)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{voucher.title}</p>
                  <p className="font-mono text-xs text-slate-500">{voucher.voucherNumber}</p>
                </div>
                <StatusBadge status={voucher.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {showEmployee && (
                  <div>
                    <dt className="text-xs text-slate-500">Employee</dt>
                    <dd className="text-slate-800">{voucher.createdBy.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-500">Expense date</dt>
                  <dd className="text-slate-800">{formatDate(voucher.expenseDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Amount</dt>
                  <dd className="font-medium text-slate-900">{formatAmount(voucher.amount)}</dd>
                </div>
              </dl>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
