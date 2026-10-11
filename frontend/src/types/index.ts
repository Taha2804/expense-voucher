export type Role = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS';

export type VoucherStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type ExpenseCategory =
  | 'TRAVEL'
  | 'MEALS'
  | 'ACCOMMODATION'
  | 'OFFICE_SUPPLIES'
  | 'CLIENT_ENTERTAINMENT'
  | 'TRAINING'
  | 'COMMUNICATION'
  | 'OTHER';

export interface User {
  id: string;
  email: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  role: Role;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  expenseDate: string;
  department: string;
  title: string;
  category: ExpenseCategory;
  description: string | null;
  /** Always a string. Never parsed into a float — see the backend's money.ts. */
  amount: string;
  status: VoucherStatus;
  createdBy: { id: string; name: string; employeeCode: string | null; department: string | null };
  reviewedBy: { id: string; name: string } | null;
  employeeSignatureId: string | null;
  directorSignatureId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvalDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export type SortField =
  | 'voucherDate'
  | 'expenseDate'
  | 'amount'
  | 'voucherNumber'
  | 'status'
  | 'createdAt';

/** Mirrors the backend's listVouchersQuerySchema input. All optional. */
export interface ListQuery {
  q?: string;
  status?: VoucherStatus | '';
  department?: string;
  category?: ExpenseCategory | '';
  dateFrom?: string;
  dateTo?: string;
  minAmount?: string;
  maxAmount?: string;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EmployeeStats {
  role: 'EMPLOYEE';
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmountClaimed: string;
}

export interface DirectorStats {
  role: 'DIRECTOR';
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  totalPendingAmount: string;
  recentActivity: Voucher[];
}

export interface AccountsStats {
  role: 'ACCOUNTS';
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalApprovedAmount: string;
  recentApproved: Voucher[];
}

export type DashboardStats = EmployeeStats | DirectorStats | AccountsStats;

export interface Signature {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export const STATUS_LABELS: Record<VoucherStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL: 'Travel',
  MEALS: 'Meals',
  ACCOMMODATION: 'Accommodation',
  OFFICE_SUPPLIES: 'Office Supplies',
  CLIENT_ENTERTAINMENT: 'Client Entertainment',
  TRAINING: 'Training',
  COMMUNICATION: 'Communication',
  OTHER: 'Other',
};
