import { VoucherListScreen } from '../../components/VoucherListScreen';

export function PendingApprovalsPage() {
  return (
    <VoucherListScreen
      title="Pending Approvals"
      description="Vouchers submitted by employees and waiting on your decision."
      detailBase="/director/vouchers"
      // Pinned, so the filter panel cannot widen this screen past its purpose.
      fixed={{ status: 'PENDING_APPROVAL' }}
      showEmployee
      showFilters={false}
      emptyMessage="Nothing is waiting for approval."
    />
  );
}
