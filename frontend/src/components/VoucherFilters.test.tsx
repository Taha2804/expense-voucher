import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { VoucherFilters } from './VoucherFilters';
import type { ListQuery } from '../types';

/** Surfaces the router's current query string so a test can assert on it. */
function LocationProbe() {
  return <span data-testid="search">{useLocation().search}</span>;
}

function renderFilters(onChange: (q: ListQuery) => void, value: ListQuery = {}) {
  return render(
    <MemoryRouter>
      <VoucherFilters value={value} onChange={onChange} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('VoucherFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces the search input to one onChange after 300 ms', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    renderFilters(onChange);

    await user.type(screen.getByLabelText(/search/i), 'pune');

    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'pune' }));
  });

  it('clears a filter back to undefined rather than an empty string', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    renderFilters(onChange, { status: 'APPROVED' });

    await user.selectOptions(screen.getByLabelText(/status/i), '');

    vi.advanceTimersByTime(300);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const latest = onChange.mock.calls.at(-1)![0] as ListQuery;
    expect(latest.status).toBeUndefined();
  });

  it('writes the active filters into the query string', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderFilters(vi.fn());

    await user.selectOptions(screen.getByLabelText(/status/i), 'APPROVED');

    vi.advanceTimersByTime(300);
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toContain('status=APPROVED'),
    );
  });
});
