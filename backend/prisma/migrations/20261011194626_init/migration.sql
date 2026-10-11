-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'DIRECTOR', 'ACCOUNTS');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'MEALS', 'ACCOMMODATION', 'OFFICE_SUPPLIES', 'CLIENT_ENTERTAINMENT', 'TRAINING', 'COMMUNICATION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT,
    "department" TEXT,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "voucherDate" DATE NOT NULL,
    "expenseDate" DATE NOT NULL,
    "department" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "employeeSignatureId" TEXT,
    "directorSignatureId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvalDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Signature_ownerId_idx" ON "Signature"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");

-- CreateIndex
CREATE INDEX "Voucher_createdById_status_idx" ON "Voucher"("createdById", "status");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_expenseDate_idx" ON "Voucher"("expenseDate");

-- CreateIndex
CREATE INDEX "Voucher_amount_idx" ON "Voucher"("amount");

-- CreateIndex
CREATE INDEX "Voucher_department_idx" ON "Voucher"("department");

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_employeeSignatureId_fkey" FOREIGN KEY ("employeeSignatureId") REFERENCES "Signature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_directorSignatureId_fkey" FOREIGN KEY ("directorSignatureId") REFERENCES "Signature"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
