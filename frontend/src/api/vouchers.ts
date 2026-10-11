import { api, type QueryParams } from './client';
import type { ListQuery, Paginated, Voucher } from '../types';

export interface VoucherPayload {
  voucherDate?: string;
  expenseDate: string;
  department: string;
  title: string;
  category: string;
  description?: string;
  /** A string all the way down; never a number. */
  amount: string;
  employeeSignatureId?: string | null;
}

export const vouchersApi = {
  list: (query: ListQuery) =>
    api.get<Paginated<Voucher>>('/api/vouchers', query as QueryParams),

  get: (id: string) => api.get<{ voucher: Voucher }>(`/api/vouchers/${id}`).then((r) => r.voucher),

  create: (payload: VoucherPayload) =>
    api.post<{ voucher: Voucher }>('/api/vouchers', payload).then((r) => r.voucher),

  update: (id: string, payload: Partial<VoucherPayload>) =>
    api.patch<{ voucher: Voucher }>(`/api/vouchers/${id}`, payload).then((r) => r.voucher),

  remove: (id: string) => api.del(`/api/vouchers/${id}`),

  submit: (id: string) =>
    api.post<{ voucher: Voucher }>(`/api/vouchers/${id}/submit`).then((r) => r.voucher),

  approve: (id: string, signatureId: string) =>
    api.post<{ voucher: Voucher }>(`/api/vouchers/${id}/approve`, { signatureId }).then((r) => r.voucher),

  reject: (id: string, rejectionReason: string) =>
    api.post<{ voucher: Voucher }>(`/api/vouchers/${id}/reject`, { rejectionReason }).then((r) => r.voucher),
};
