import { useState } from 'react';
import { SignatureUpload } from './SignatureUpload';

/**
 * Approval requires the Director's signature, so Confirm stays disabled until
 * one is attached. The backend enforces the same rule; this only keeps the
 * user from making a request that cannot succeed.
 */
export function ApprovalDialog({
  voucherNumber,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  voucherNumber: string;
  busy: boolean;
  error: string | null;
  onConfirm: (signatureId: string) => void;
  onCancel: () => void;
}) {
  const [signatureId, setSignatureId] = useState<string | null>(null);

  return (
    <Dialog title={`Approve ${voucherNumber}`} onCancel={onCancel}>
      <p className="text-sm text-slate-600">
        Approving records your signature against this voucher and makes it visible to the Accounts
        Team for reimbursement. It cannot be undone.
      </p>

      <div className="mt-4">
        <SignatureUpload value={signatureId} onChange={setSignatureId} label="Director Signature" />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <Actions
        onCancel={onCancel}
        confirmLabel={busy ? 'Approving…' : 'Approve voucher'}
        confirmClass="bg-emerald-700 hover:bg-emerald-800"
        disabled={busy || !signatureId}
        onConfirm={() => signatureId && onConfirm(signatureId)}
      />
    </Dialog>
  );
}

export function RejectionDialog({
  voucherNumber,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  voucherNumber: string;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const tooShort = trimmed.length < 10;

  return (
    <Dialog title={`Reject ${voucherNumber}`} onCancel={onCancel}>
      <p className="text-sm text-slate-600">
        The employee will see this reason on the voucher, so say what would need to change.
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="rejection-reason">
        Reason for rejection
      </label>
      <textarea
        id="rejection-reason"
        rows={4}
        maxLength={500}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />
      <p className="mt-1 text-xs text-slate-500">
        {tooShort ? `At least ${10 - trimmed.length} more character(s) needed.` : `${500 - trimmed.length} characters left.`}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <Actions
        onCancel={onCancel}
        confirmLabel={busy ? 'Rejecting…' : 'Reject voucher'}
        confirmClass="bg-red-700 hover:bg-red-800"
        disabled={busy || tooShort}
        onConfirm={() => onConfirm(trimmed)}
      />
    </Dialog>
  );
}

function Dialog({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Actions({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmClass,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmClass: string;
  disabled: boolean;
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${confirmClass}`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
