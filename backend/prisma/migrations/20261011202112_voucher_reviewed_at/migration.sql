-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Voucher_reviewedAt_idx" ON "Voucher"("reviewedAt");
