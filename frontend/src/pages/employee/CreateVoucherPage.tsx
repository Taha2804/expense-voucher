import { useNavigate } from 'react-router-dom';
import { VoucherForm } from '../../components/VoucherForm';

export function CreateVoucherPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create Voucher</h1>
        <p className="mt-1 text-sm text-slate-600">
          Save it as a draft to finish later, or submit it for the Director's approval. A voucher
          number is assigned automatically.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <VoucherForm
          mode="create"
          onSaved={(voucher) => navigate(`/employee/vouchers/${voucher.id}`)}
        />
      </div>
    </div>
  );
}
