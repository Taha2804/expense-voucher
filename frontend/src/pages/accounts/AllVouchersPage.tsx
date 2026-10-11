import { VoucherListScreen } from '../../components/VoucherListScreen';

export function AccountsAllVouchersPage() {
  return (
    <VoucherListScreen
      title="All Vouchers"
      description="Approved vouchers are shown first, since those are the ones to reimburse. Clear the status filter to see everything."
      detailBase="/accounts/vouchers"
      initialFilters={{ status: 'APPROVED' }}
      showEmployee
    />
  );
}
