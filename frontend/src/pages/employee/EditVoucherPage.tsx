import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { vouchersApi } from '../../api/vouchers';
import { ApiError } from '../../api/client';
import type { Voucher } from '../../types';
import { VoucherForm } from '../../components/VoucherForm';

export function EditVoucherPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    vouchersApi
      .get(id)
      .then((v) => {
        // A stale link must not present an editable form for a voucher that
        // has already been submitted — the server would reject the save, and
        // the form would have implied the edit was possible.
        if (v.status !== 'DRAFT') {
          setNotice('This voucher has been submitted and can no longer be edited.');
          setVoucher(null);
          return;
        }
        setVoucher(v);
      })
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 404
            ? 'This voucher does not exist, or you do not have access to it.'
            : 'Could not load this voucher.',
        ),
      );
  }, [id]);

  if (error || notice) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-slate-700">{error ?? notice}</p>
        <button
          type="button"
          onClick={() => navigate(id ? `/employee/vouchers/${id}` : '/employee/vouchers')}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          View voucher
        </button>
      </div>
    );
  }

  if (!voucher) return <p className="text-sm text-slate-500">Loading voucher…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Edit Draft Voucher</h1>
        <p className="font-mono text-sm text-slate-500">{voucher.voucherNumber}</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <VoucherForm
          mode="edit"
          initial={voucher}
          onSaved={(saved) => navigate(`/employee/vouchers/${saved.id}`)}
        />
      </div>
    </div>
  );
}
