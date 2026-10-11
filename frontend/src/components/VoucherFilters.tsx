import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_LABELS, STATUS_LABELS, type ListQuery } from '../types';
import { CATEGORY_VALUES } from '../schemas/voucher';

const STATUS_VALUES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;
const DEBOUNCE_MS = 300;

const field =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const labelClass = 'block text-xs font-medium text-slate-600';

/** An empty control means "no filter", never a filter for the empty string. */
function clean(draft: ListQuery): ListQuery {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out as ListQuery;
}

export function VoucherFilters({
  value,
  onChange,
}: {
  value: ListQuery;
  onChange: (query: ListQuery) => void;
}) {
  const [draft, setDraft] = useState<ListQuery>(value);
  const [, setSearchParams] = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    // Nothing is emitted for the initial value; the parent already has it.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const cleaned = clean(draft);
      onChange(cleaned);
      setSearchParams(
        Object.fromEntries(Object.entries(cleaned).map(([k, v]) => [k, String(v)])),
        { replace: true },
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // onChange and setSearchParams are stable enough for this debounce; adding
    // them would restart the timer on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function set<K extends keyof ListQuery>(key: K, next: ListQuery[K]) {
    setDraft((prev) => ({ ...prev, [key]: next === '' ? undefined : next, page: 1 }));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 print:hidden">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="filter-q">
            Search
          </label>
          <input
            id="filter-q"
            placeholder="Voucher number, title, or employee name"
            value={draft.q ?? ''}
            onChange={(e) => set('q', e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            value={draft.status ?? ''}
            onChange={(e) => set('status', e.target.value as ListQuery['status'])}
            className={field}
          >
            <option value="">All statuses</option>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-category">
            Category
          </label>
          <select
            id="filter-category"
            value={draft.category ?? ''}
            onChange={(e) => set('category', e.target.value as ListQuery['category'])}
            className={field}
          >
            <option value="">All categories</option>
            {CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-department">
            Department
          </label>
          <input
            id="filter-department"
            value={draft.department ?? ''}
            onChange={(e) => set('department', e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-from">
            Expense date from
          </label>
          <input
            id="filter-from"
            type="date"
            value={draft.dateFrom ?? ''}
            onChange={(e) => set('dateFrom', e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="filter-to">
            Expense date to
          </label>
          <input
            id="filter-to"
            type="date"
            value={draft.dateTo ?? ''}
            onChange={(e) => set('dateTo', e.target.value)}
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="filter-min">
              Min amount
            </label>
            <input
              id="filter-min"
              inputMode="decimal"
              value={draft.minAmount ?? ''}
              onChange={(e) => set('minAmount', e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="filter-max">
              Max amount
            </label>
            <input
              id="filter-max"
              inputMode="decimal"
              value={draft.maxAmount ?? ''}
              onChange={(e) => set('maxAmount', e.target.value)}
              className={field}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDraft({ page: 1 })}
        className="mt-3 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        Clear filters
      </button>
    </div>
  );
}
