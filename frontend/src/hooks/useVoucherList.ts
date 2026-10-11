import { useCallback, useEffect, useState } from 'react';
import { vouchersApi } from '../api/vouchers';
import { ApiError } from '../api/client';
import type { ListQuery, Pagination, SortField, Voucher } from '../types';

const EMPTY: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 1 };

/**
 * The list state every voucher screen shares: filters, sorting, paging, and
 * the fetch they drive. `fixed` holds the parts a screen pins (the Director's
 * pending list, for instance) and that the filter panel cannot override.
 */
export function useVoucherList(fixed: ListQuery = {}, initial: ListQuery = {}) {
  const [filters, setFilters] = useState<ListQuery>(initial);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Voucher[]>([]);
  const [pagination, setPagination] = useState<Pagination>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fixedKey = JSON.stringify(fixed);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await vouchersApi.list({
        ...filters,
        ...(JSON.parse(fixedKey) as ListQuery),
        sortBy,
        sortOrder,
        page,
      });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load vouchers.');
      setRows([]);
      setPagination(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [filters, fixedKey, sortBy, sortOrder, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeSort(field: SortField) {
    if (field === sortBy) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  }

  function changeFilters(next: ListQuery) {
    setFilters(next);
    setPage(1);
  }

  return {
    rows,
    pagination,
    loading,
    error,
    filters,
    sortBy,
    sortOrder,
    changeSort,
    changeFilters,
    setPage,
    reload: load,
  };
}
