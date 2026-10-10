-- DropIndex
DROP INDEX "widgets_position_idx";

-- AlterTable
ALTER TABLE "widgets" DROP COLUMN "position";

-- CreateIndex
CREATE INDEX "widgets_createdAt_idx" ON "widgets"("createdAt");

