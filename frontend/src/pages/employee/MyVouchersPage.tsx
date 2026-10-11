import { VoucherListScreen } from '../../components/VoucherListScreen';

export function MyVouchersPage() {
  return (
    <VoucherListScreen
      title="My Vouchers"
      description="Every voucher you have raised, and where each one stands."
      detailBase="/employee/vouchers"
      emptyMessage="You have not raised a voucher yet."
    />
  );
}
