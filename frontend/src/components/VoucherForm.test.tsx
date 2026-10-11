import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoucherForm } from './VoucherForm';
import { vouchersApi } from '../api/vouchers';
import type { Voucher } from '../types';

vi.mock('../api/vouchers', () => ({
  vouchersApi: { create: vi.fn(), update: vi.fn(), submit: vi.fn() },
}));

vi.mock('./SignatureUpload', () => ({
  SignatureUpload: () => <div data-testid="signature-upload" />,
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'aarav@abc.com',
      name: 'Aarav Sharma',
      employeeCode: 'EMP-001',
      department: 'Engineering',
      role: 'EMPLOYEE',
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

const mockedApi = vi.mocked(vouchersApi);

const existing: Voucher = {
  id: 'v1',
  voucherNumber: 'VCH-2026-000001',
  voucherDate: '2026-03-01T00:00:00.000Z',
  expenseDate: '2026-02-20T00:00:00.000Z',
  department: 'Engineering',
  title: 'Client site visit',
  category: 'TRAVEL',
  description: 'Return cab fare.',
  amount: '1250.00',
  status: 'DRAFT',
  createdBy: { id: 'u1', name: 'Aarav Sharma', employeeCode: 'EMP-001', department: 'Engineering' },
  reviewedBy: null,
  employeeSignatureId: null,
  directorSignatureId: null,
  submittedAt: null,
  reviewedAt: null,
  approvalDate: null,
  rejectionReason: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

function futureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

describe('VoucherForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a required-field message for each of department, title, expenseDate, amount', async () => {
    const user = userEvent.setup();
    render(<VoucherForm mode="create" onSaved={vi.fn()} />);

    // Clear the department, which is pre-filled from the user's profile.
    await user.clear(screen.getByLabelText(/department/i));
    await user.click(screen.getByRole('button', { name: /save as draft/i }));

    expect(await screen.findByText('Department is required')).toBeInTheDocument();
    expect(screen.getByText('Expense title is required')).toBeInTheDocument();
    expect(screen.getByText('Expense date is required')).toBeInTheDocument();
    expect(screen.getByText('Amount is required')).toBeInTheDocument();
  });

  it.each(['0', '-5'])('rejects amount %s with "Amount must be greater than zero"', async (amount) => {
    const user = userEvent.setup();
    render(<VoucherForm mode="edit" initial={existing} onSaved={vi.fn()} />);

    const field = screen.getByLabelText(/amount/i);
    await user.clear(field);
    await user.type(field, amount);
    await user.click(screen.getByRole('button', { name: /save as draft/i }));

    expect(await screen.findByText(/amount must be/i)).toBeInTheDocument();
    expect(mockedApi.update).not.toHaveBeenCalled();
  });

  it('rejects an amount with three decimal places', async () => {
    const user = userEvent.setup();
    render(<VoucherForm mode="edit" initial={existing} onSaved={vi.fn()} />);

    const field = screen.getByLabelText(/amount/i);
    await user.clear(field);
    await user.type(field, '12.345');
    await user.click(screen.getByRole('button', { name: /save as draft/i }));

    expect(
      await screen.findByText('Amount must be a number with at most two decimal places'),
    ).toBeInTheDocument();
  });

  it('rejects a future expense date', async () => {
    const user = userEvent.setup();
    render(<VoucherForm mode="edit" initial={existing} onSaved={vi.fn()} />);

    const field = screen.getByLabelText(/expense date/i);
    await user.clear(field);
    await user.type(field, futureDate());
    await user.click(screen.getByRole('button', { name: /save as draft/i }));

    expect(await screen.findByText('Expense date cannot be in the future')).toBeInTheDocument();
  });

  it('does not call the API when validation fails', async () => {
    const user = userEvent.setup();
    render(<VoucherForm mode="create" onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /save as draft/i }));

    await screen.findByText('Expense title is required');
    expect(mockedApi.create).not.toHaveBeenCalled();
  });

  it('in edit mode, pre-fills every field from the initial voucher', () => {
    render(<VoucherForm mode="edit" initial={existing} onSaved={vi.fn()} />);

    expect(screen.getByLabelText(/department/i)).toHaveValue('Engineering');
    expect(screen.getByLabelText(/expense title/i)).toHaveValue('Client site visit');
    expect(screen.getByLabelText(/expense date/i)).toHaveValue('2026-02-20');
    expect(screen.getByLabelText(/amount/i)).toHaveValue('1250.00');
    expect(screen.getByLabelText(/category/i)).toHaveValue('TRAVEL');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Return cab fare.');
  });

  it('disables submit while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve: (v: Voucher) => void = () => {};
    mockedApi.update.mockReturnValue(new Promise<Voucher>((r) => { resolve = r; }));

    render(<VoucherForm mode="edit" initial={existing} onSaved={vi.fn()} />);
    const button = screen.getByRole('button', { name: /save as draft/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    resolve(existing);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
