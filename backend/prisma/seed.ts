/**
 * Seed the database with one user per role and vouchers spanning all four
 * statuses, so every dashboard, filter and signature view has data on a first
 * run. Idempotent: users are upserted by email and the voucher set is rebuilt
 * from scratch each time.
 */
import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { PrismaClient, type Prisma, type User } from '@prisma/client';
import { nextVoucherNumber } from '../src/lib/voucherNumber.js';

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const uploadDir = resolve(backendRoot, process.env.UPLOAD_DIR ?? 'uploads/signatures');
const SEED_PASSWORD = 'Password123!';

/** Copy a sample signature into the upload directory under a fresh UUID. */
function installSignatureFile(assetName: string): { filePath: string; sizeBytes: number } {
  mkdirSync(uploadDir, { recursive: true });
  const source = resolve(here, 'seed-assets', assetName);
  const filePath = `${randomUUID()}.png`;
  copyFileSync(source, resolve(uploadDir, filePath));
  return { filePath, sizeBytes: statSync(source).size };
}

async function upsertUser(input: {
  email: string;
  name: string;
  role: 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS';
  department: string;
  employeeCode: string;
}): Promise<User> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role, department: input.department },
    create: { ...input, passwordHash },
  });
}

async function main(): Promise<void> {
  const director = await upsertUser({
    email: 'director@abc.com',
    name: 'Rohan Mehta',
    role: 'DIRECTOR',
    department: 'Management',
    employeeCode: 'DIR-001',
  });
  const accounts = await upsertUser({
    email: 'accounts@abc.com',
    name: 'Priya Nair',
    role: 'ACCOUNTS',
    department: 'Finance',
    employeeCode: 'ACC-001',
  });
  const employee = await upsertUser({
    email: 'employee@abc.com',
    name: 'Aarav Sharma',
    role: 'EMPLOYEE',
    department: 'Engineering',
    employeeCode: 'EMP-001',
  });
  // A second employee, so the isolation rule is visible in the seeded data.
  const otherEmployee = await upsertUser({
    email: 'employee2@abc.com',
    name: 'Sneha Iyer',
    role: 'EMPLOYEE',
    department: 'Sales',
    employeeCode: 'EMP-002',
  });

  // Rebuild the voucher set so re-seeding does not pile up duplicates.
  await prisma.voucher.deleteMany();
  await prisma.signature.deleteMany();

  const employeeSig = await prisma.signature.create({
    data: { ownerId: employee.id, mimeType: 'image/png', ...installSignatureFile('signature-employee.png') },
  });
  const otherEmployeeSig = await prisma.signature.create({
    data: { ownerId: otherEmployee.id, mimeType: 'image/png', ...installSignatureFile('signature-employee.png') },
  });
  const directorSig = await prisma.signature.create({
    data: { ownerId: director.id, mimeType: 'image/png', ...installSignatureFile('signature-director.png') },
  });

  const day = (offset: number): Date => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };

  type SeedVoucher = Omit<Prisma.VoucherCreateInput, 'voucherNumber' | 'createdBy'> & {
    createdById: string;
  };

  const vouchers: SeedVoucher[] = [
    // Drafts — editable, no signature required yet.
    {
      createdById: employee.id,
      voucherDate: day(-1), expenseDate: day(-2),
      department: 'Engineering', title: 'Team lunch with vendor',
      category: 'MEALS', description: 'Lunch with the hosting vendor during the renewal discussion.',
      amount: '2480.00', status: 'DRAFT',
    },
    {
      createdById: employee.id,
      voucherDate: day(0), expenseDate: day(-5),
      department: 'Engineering', title: 'Mechanical keyboard',
      category: 'OFFICE_SUPPLIES', description: 'Replacement keyboard, old one failed.',
      amount: '5799.00', status: 'DRAFT',
    },
    // Pending approval — submitted with the employee signature.
    {
      createdById: employee.id,
      voucherDate: day(-3), expenseDate: day(-6),
      department: 'Engineering', title: 'Client site visit — Pune',
      category: 'TRAVEL', description: 'Return train fare and local cabs for the Pune deployment.',
      amount: '4350.50', status: 'PENDING_APPROVAL',
      submittedAt: day(-3), employeeSignature: { connect: { id: employeeSig.id } },
    },
    {
      createdById: otherEmployee.id,
      voucherDate: day(-2), expenseDate: day(-4),
      department: 'Sales', title: 'Customer dinner — Q3 renewal',
      category: 'CLIENT_ENTERTAINMENT', description: 'Dinner with the client procurement team.',
      amount: '8900.00', status: 'PENDING_APPROVAL',
      submittedAt: day(-2), employeeSignature: { connect: { id: otherEmployeeSig.id } },
    },
    // Approved — carries both signatures and an approval date.
    {
      createdById: employee.id,
      voucherDate: day(-10), expenseDate: day(-12),
      department: 'Engineering', title: 'Cloud conference ticket',
      category: 'TRAINING', description: 'Conference pass, approved in the training budget.',
      amount: '12000.00', status: 'APPROVED',
      submittedAt: day(-9), approvalDate: day(-8),
      reviewedBy: { connect: { id: director.id } },
      employeeSignature: { connect: { id: employeeSig.id } },
      directorSignature: { connect: { id: directorSig.id } },
    },
    {
      createdById: otherEmployee.id,
      voucherDate: day(-7), expenseDate: day(-9),
      department: 'Sales', title: 'Hotel — Bengaluru roadshow',
      category: 'ACCOMMODATION', description: 'Two nights during the partner roadshow.',
      amount: '15750.25', status: 'APPROVED',
      submittedAt: day(-7), approvalDate: day(-6),
      reviewedBy: { connect: { id: director.id } },
      employeeSignature: { connect: { id: otherEmployeeSig.id } },
      directorSignature: { connect: { id: directorSig.id } },
    },
    // Rejected — carries the reason the employee reads.
    {
      createdById: employee.id,
      voucherDate: day(-15), expenseDate: day(-18),
      department: 'Engineering', title: 'Noise-cancelling headphones',
      category: 'OFFICE_SUPPLIES', description: 'Headphones for focused work.',
      amount: '24999.00', status: 'REJECTED',
      submittedAt: day(-14), rejectionReason: 'Outside the approved IT peripherals budget for this quarter. Please raise an IT asset request instead.',
      reviewedBy: { connect: { id: director.id } },
      employeeSignature: { connect: { id: employeeSig.id } },
    },
    {
      createdById: otherEmployee.id,
      voucherDate: day(-20), expenseDate: day(-22),
      department: 'Sales', title: 'Weekend airport taxi',
      category: 'TRAVEL', description: 'Taxi to the airport on a personal trip.',
      amount: '1899.00', status: 'REJECTED',
      submittedAt: day(-19), rejectionReason: 'Personal travel is not reimbursable under the current expense policy.',
      reviewedBy: { connect: { id: director.id } },
      employeeSignature: { connect: { id: otherEmployeeSig.id } },
    },
  ];

  for (const { createdById, ...data } of vouchers) {
    await prisma.voucher.create({
      data: {
        ...data,
        voucherNumber: await nextVoucherNumber(prisma),
        createdBy: { connect: { id: createdById } },
      },
    });
  }

  console.log(`Seeded ${vouchers.length} vouchers.`);
  console.log('Logins (password for all: %s):', SEED_PASSWORD);
  for (const u of [employee, otherEmployee, director, accounts]) {
    console.log(`  ${u.role.padEnd(9)} ${u.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
