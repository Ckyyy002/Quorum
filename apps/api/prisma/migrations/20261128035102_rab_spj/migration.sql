-- pg_trgm indexes (ADR-0006) are unknown to Prisma; their DROP INDEX lines were removed by hand.
-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('KONSUMSI', 'PERLENGKAPAN_TRANSPORTASI', 'PUBLIKASI_DOKUMENTASI', 'HONOR', 'BAHAN_HABIS_PAKAI', 'CETAK', 'ATK', 'LAIN_LAIN');

-- CreateEnum
CREATE TYPE "SpjStatus" AS ENUM ('PENDING', 'VERIFIED', 'RETURNED');

-- CreateTable
CREATE TABLE "RabLine" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,

    CONSTRAINT "RabLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpjItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "SpjStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpjItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RabLine_documentId_idx" ON "RabLine"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "SpjItem_fileId_key" ON "SpjItem"("fileId");

-- CreateIndex
CREATE INDEX "SpjItem_documentId_idx" ON "SpjItem"("documentId");

-- AddForeignKey
ALTER TABLE "RabLine" ADD CONSTRAINT "RabLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpjItem" ADD CONSTRAINT "SpjItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpjItem" ADD CONSTRAINT "SpjItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpjItem" ADD CONSTRAINT "SpjItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpjItem" ADD CONSTRAINT "SpjItem_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
