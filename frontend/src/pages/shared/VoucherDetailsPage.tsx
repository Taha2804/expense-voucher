import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { vouchersApi } from '../../api/vouchers';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { CATEGORY_LABELS, type Voucher } from '../../types';
import { formatAmount, formatDate, formatDateTime } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import { SignatureImage } from '../../components/SignatureImage';
import { ApprovalDialog, RejectionDialog } from '../../components/ApprovalDialog';

export function VoucherDetailsPage({ listPath }: { listPath: string }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      setVoucher(await vouchersApi.get(id));
    } catch (error) {
      setLoadError(
        error instanceof ApiError && error.status === 404
          ? 'This voucher does not exist, or you do not have access to it.'
          : 'Could not load this voucher.',
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-slate-700">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate(listPath)}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to vouchers
        </button>
      </div>
    );
  }

  if (!voucher || !user) {
    return <p className="text-sm text-slate-500">Loading voucher…</p>;
  }

  const isOwner = user.id === voucher.createdBy.id;
  const canEdit = user.role === 'EMPLOYEE' && isOwner && voucher.status === 'DRAFT';
  const canReview = user.role === 'DIRECTOR' && voucher.status === 'PENDING_APPROVAL';

  /** Re-reads the voucher after a write, rather than guessing the new state. */
  async function runAction(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setDialog(null);
      await load();
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.status === 409
            ? 'This voucher has already been reviewed. Reloading it now.'
            : error.message
          : 'The action failed. Try again.',
      );
      if (error instanceof ApiError && error.status === 409) await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this draft voucher? This cannot be undone.')) return;
    await runAction(() => vouchersApi.remove(voucher!.id));
    navigate(listPath);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            ← Back to vouchers
          </button>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {voucher.title}
          </h1>
          <p className="font-mono text-sm text-slate-500">{voucher.voucherNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={voucher.status} />
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Print
          </button>
        </div>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden"
        >
          {actionError}
        </div>
      )}

      {voucher.status === 'REJECTED' && voucher.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">Reason for rejection</h2>
          <p className="mt-1 text-sm text-red-700">{voucher.rejectionReason}</p>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Expense details</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Amount" value={formatAmount(voucher.amount)} emphasis />
          <Field label="Expense category" value={CATEGORY_LABELS[voucher.category]} />
          <Field label="Department" value={voucher.department} />
          <Field label="Expense date" value={formatDate(voucher.expenseDate)} />
          <Field label="Voucher date" value={formatDate(voucher.voucherDate)} />
          <Field label="Status" value={<StatusBadge status={voucher.status} />} />
        </dl>
        {voucher.description && (
          <div className="mt-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Description
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {voucher.description}
            </dd>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Employee</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee name" value={voucher.createdBy.name} />
          <Field label="Employee ID" value={voucher.createdBy.employeeCode ?? '—'} />
          <Field label="Submitted" value={formatDateTime(voucher.submittedAt)} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Approval</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Reviewed by" value={voucher.reviewedBy?.name ?? '—'} />
          <Field label="Approval date" value={formatDateTime(voucher.approvalDate)} />
          <Field label="Last updated" value={formatDateTime(voucher.updatedAt)} />
        </dl>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <SignaturePanel
            title="Employee signature"
            signatureId={voucher.employeeSignatureId}
            missing="Not signed yet"
          />
          <SignaturePanel
            title="Director signature"
            signatureId={voucher.directorSignatureId}
            missing={voucher.status === 'APPROVED' ? 'Missing' : 'Not approved yet'}
          />
        </div>
      </section>

      <footer className="flex flex-wrap gap-3 print:hidden">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => navigate(`${listPath}/${voucher.id}/edit`)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Edit draft
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction(() => vouchersApi.submit(voucher.id))}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Submit for approval
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete()}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Delete draft
            </button>
          </>
        )}

        {canReview && (
          <>
            <button
              type="button"
              onClick={() => setDialog('approve')}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDialog('reject')}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Reject
            </button>
          </>
        )}
      </footer>

      {dialog === 'approve' && (
        <ApprovalDialog
          voucherNumber={voucher.voucherNumber}
          busy={busy}
          error={actionError}
          onCancel={() => setDialog(null)}
          onConfirm={(signatureId) =>
            void runAction(() => vouchersApi.approve(voucher.id, signatureId))
          }
        />
      )}

      {dialog === 'reject' && (
        <RejectionDialog
          voucherNumber={voucher.voucherNumber}
          busy={busy}
          error={actionError}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => void runAction(() => vouchersApi.reject(voucher.id, reason))}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={emphasis ? 'mt-1 text-lg font-semibold text-slate-900' : 'mt-1 text-sm text-slate-800'}>
        {value}
      </dd>
    </div>
  );
}

function SignaturePanel({
  title,
  signatureId,
  missing,
}: {
  title: string;
  signatureId: string | null;
  missing: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2">
        {signatureId ? (
          <SignatureImage signatureId={signatureId} alt={title} />
        ) : (
          <span className="text-sm text-slate-400">{missing}</span>
        )}
      </div>
    </div>
  );
}
