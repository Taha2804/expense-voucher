import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'TRAVEL',
  'MEALS',
  'ACCOMMODATION',
  'OFFICE_SUPPLIES',
  'CLIENT_ENTERTAINMENT',
  'TRAINING',
  'COMMUNICATION',
  'OTHER',
] as const;

export const VOUCHER_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;

/** The only columns a client may order on. Anything else is a 400. */
export const SORTABLE_FIELDS = [
  'voucherDate',
  'expenseDate',
  'amount',
  'voucherNumber',
  'status',
  'createdAt',
] as const;

/** Today in the server's configured timezone, as YYYY-MM-DD. */
export function todayLocalISO(now: Date = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** Accepts YYYY-MM-DD or a full ISO timestamp; yields UTC midnight of that day. */
const dateOnly = z
  .string()
  .trim()
  .transform((value) => value.slice(0, 10))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format'));

function toUtcMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Amounts are validated by shape rather than by numeric coercion, which is
 * what rejects "1e5" and "0.001": Number("1e5") is a perfectly good 100000,
 * and Decimal(12,2) has no room for a third decimal place.
 */
const amount = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount must be a number with at most two decimal places')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero');

export const createVoucherSchema = z.object({
  voucherDate: dateOnly.optional(),
  expenseDate: dateOnly.refine(
    (value) => value <= todayLocalISO(),
    'Expense date cannot be in the future',
  ),
  department: z.string().trim().min(1, 'Department is required').max(120).optional(),
  title: z.string().trim().min(1, 'Expense title is required').max(200),
  category: z.enum(EXPENSE_CATEGORIES).default('OTHER'),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional(),
  amount,
  employeeSignatureId: z.string().uuid().nullish(),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;

/**
 * Edit accepts the same fields and nothing else. voucherNumber, status,
 * createdById and every approval field are absent from the schema, so they are
 * stripped before the service ever sees them.
 */
export const updateVoucherSchema = createVoucherSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field must be provided',
);

export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;

export const listVouchersQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    status: z.enum(VOUCHER_STATUSES).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    dateFrom: dateOnly.optional(),
    dateTo: dateOnly.optional(),
    minAmount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
    maxAmount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/).optional(),
    sortBy: z.enum(SORTABLE_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1, 'Page must be 1 or greater').default(1),
    // Clamped rather than rejected: an oversized page is a client being
    // greedy, not a client being wrong. A non-numeric value still fails int().
    pageSize: z.coerce
      .number()
      .int()
      .min(1, 'Page size must be 1 or greater')
      .default(20)
      .transform((value) => Math.min(value, 100)),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateFrom'],
        message: 'dateFrom must not be later than dateTo',
      });
    }
    if (value.minAmount && value.maxAmount && Number(value.minAmount) > Number(value.maxAmount)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'minAmount must not be greater than maxAmount',
      });
    }
  });

export type ListVouchersQuery = z.infer<typeof listVouchersQuerySchema>;

export const voucherIdParamSchema = z.object({ id: z.string().uuid('Invalid voucher id') });

export { toUtcMidnight };
