-- pg_trgm indexes (ADR-0006) are unknown to Prisma; their DROP INDEX lines were removed by hand.
-- CreateTable
CREATE TABLE "ProkerEvaluation" (
    "id" TEXT NOT NULL,
    "prokerId" TEXT NOT NULL,
    "wentWell" TEXT NOT NULL,
    "toImprove" TEXT NOT NULL,
    "problems" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "feedbackUrl" TEXT,
    "filledById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProkerEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProkerEvaluation_prokerId_key" ON "ProkerEvaluation"("prokerId");

-- AddForeignKey
ALTER TABLE "ProkerEvaluation" ADD CONSTRAINT "ProkerEvaluation_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProkerEvaluation" ADD CONSTRAINT "ProkerEvaluation_filledById_fkey" FOREIGN KEY ("filledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProkerEvaluation" ADD CONSTRAINT "ProkerEvaluation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
