import { VoucherListScreen } from '../../components/VoucherListScreen';

export function DirectorAllVouchersPage() {
  return (
    <VoucherListScreen
      title="All Vouchers"
      description="Every voucher raised across the organisation."
      detailBase="/director/vouchers"
      showEmployee
    />
  );
}
