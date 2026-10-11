import { z } from 'zod';
import { todayInput } from '../lib/format';

export const CATEGORY_VALUES = [
  'TRAVEL',
  'MEALS',
  'ACCOMMODATION',
  'OFFICE_SUPPLIES',
  'CLIENT_ENTERTAINMENT',
  'TRAINING',
  'COMMUNICATION',
  'OTHER',
] as const;

/**
 * The same rules the backend enforces. Amount stays a string throughout: the
 * form binds it to a text input, so a value like "12.345" is rejected by shape
 * rather than silently rounded by a number input.
 */
export const voucherFormSchema = z.object({
  voucherDate: z.string().optional(),
  expenseDate: z
    .string()
    .min(1, 'Expense date is required')
    .refine((value) => value <= todayInput(), 'Expense date cannot be in the future'),
  department: z.string().trim().min(1, 'Department is required').max(120),
  title: z.string().trim().min(1, 'Expense title is required').max(200),
  category: z.enum(CATEGORY_VALUES),
  description: z.string().trim().max(1000, 'Description must be at most 1000 characters').optional(),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Amount must be a number with at most two decimal places')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
});

export type VoucherFormValues = z.infer<typeof voucherFormSchema>;
