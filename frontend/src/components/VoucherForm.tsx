import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { voucherFormSchema, CATEGORY_VALUES, type VoucherFormValues } from '../schemas/voucher';
import { vouchersApi } from '../api/vouchers';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { CATEGORY_LABELS, type Voucher } from '../types';
import { toDateInput, todayInput } from '../lib/format';
import { SignatureUpload } from './SignatureUpload';

interface Props {
  mode: 'create' | 'edit';
  initial?: Voucher;
  onSaved: (voucher: Voucher) => void;
}

const field =
  'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none';
const labelClass = 'block text-sm font-medium text-slate-700';

export function VoucherForm({ mode, initial, onSaved }: Props) {
  const { user } = useAuth();
  const [signatureId, setSignatureId] = useState<string | null>(initial?.employeeSignatureId ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState<'draft' | 'submit' | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VoucherFormValues>({
    resolver: zodResolver(voucherFormSchema),
    defaultValues: {
      voucherDate: toDateInput(initial?.voucherDate ?? null) || todayInput(),
      expenseDate: toDateInput(initial?.expenseDate ?? null),
      department: initial?.department ?? user?.department ?? '',
      title: initial?.title ?? '',
      category: initial?.category ?? 'OTHER',
      description: initial?.description ?? '',
      amount: initial?.amount ?? '',
    },
  });

  async function save(values: VoucherFormValues, thenSubmit: boolean) {
    setServerError(null);
    setPending(thenSubmit ? 'submit' : 'draft');

    try {
      const payload = {
        ...values,
        description: values.description || undefined,
        employeeSignatureId: signatureId,
      };

      let voucher =
        mode === 'create' && !initial
          ? await vouchersApi.create(payload)
          : await vouchersApi.update(initial!.id, payload);

      if (thenSubmit) voucher = await vouchersApi.submit(voucher.id);

      onSaved(voucher);
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : 'Could not save the voucher. Try again.',
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit((v) => save(v, false))}>
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="title">
            Expense Title
          </label>
          <input id="title" {...register('title')} className={field} />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="department">
            Department
          </label>
          <input id="department" {...register('department')} className={field} />
          {errors.department && (
            <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="expenseDate">
            Expense Date
          </label>
          <input id="expenseDate" type="date" max={todayInput()} {...register('expenseDate')} className={field} />
          {errors.expenseDate && (
            <p className="mt-1 text-sm text-red-600">{errors.expenseDate.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="voucherDate">
            Voucher Date
          </label>
          <input id="voucherDate" type="date" {...register('voucherDate')} className={field} />
        </div>

        <div>
          <label className={labelClass} htmlFor="category">
            Expense Category
          </label>
          <select id="category" {...register('category')} className={field}>
            {CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="amount">
            Amount (INR)
          </label>
          {/* A text input, not number: binding to valueAsNumber would turn the
              decimal string into a float and reintroduce rounding error. */}
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            {...register('amount')}
            className={field}
          />
          {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          Expense Description
        </label>
        <textarea id="description" rows={3} {...register('description')} className={field} />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <SignatureUpload
        value={signatureId}
        onChange={setSignatureId}
        label="Employee Signature"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending !== null}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'draft' ? 'Saving…' : 'Save as Draft'}
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={handleSubmit((v) => save(v, true))}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === 'submit' ? 'Submitting…' : 'Save and Submit for Approval'}
        </button>
      </div>
    </form>
  );
}
