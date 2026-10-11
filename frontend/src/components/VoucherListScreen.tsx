import { useNavigate } from 'react-router-dom';
import type { ListQuery } from '../types';
import { useVoucherList } from '../hooks/useVoucherList';
import { VoucherFilters } from './VoucherFilters';
import { VoucherTable } from './VoucherTable';
import { Pagination } from './Pagination';

/**
 * The list screen all three roles share. What differs between them is the
 * heading, the fixed part of the query, and where a row links to.
 */
export function VoucherListScreen({
  title,
  description,
  detailBase,
  fixed = {},
  initialFilters = {},
  showEmployee = false,
  showFilters = true,
  emptyMessage,
}: {
  title: string;
  description?: string;
  detailBase: string;
  fixed?: ListQuery;
  initialFilters?: ListQuery;
  showEmployee?: boolean;
  showFilters?: boolean;
  emptyMessage?: string;
}) {
  const navigate = useNavigate();
  const list = useVoucherList(fixed, initialFilters);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </header>

      {showFilters && <VoucherFilters value={list.filters} onChange={list.changeFilters} />}

      {list.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {list.error}
        </div>
      )}

      {list.loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading vouchers…
        </div>
      ) : (
        <VoucherTable
          rows={list.rows}
          sortBy={list.sortBy}
          sortOrder={list.sortOrder}
          onSortChange={list.changeSort}
          showEmployee={showEmployee}
          onRowClick={(voucher) => navigate(`${detailBase}/${voucher.id}`)}
          emptyMessage={emptyMessage}
        />
      )}

      <Pagination pagination={list.pagination} onPageChange={list.setPage} />
    </div>
  );
}
