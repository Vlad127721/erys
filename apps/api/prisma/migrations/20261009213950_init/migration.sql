-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('LINE', 'BAR', 'STACKED_BAR', 'PIE', 'TEXT');

-- CreateTable
CREATE TABLE "widgets" (
    "id" UUID NOT NULL,
    "type" "WidgetType" NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widgets_sourceKey_key" ON "widgets"("sourceKey");

-- CreateIndex
CREATE INDEX "widgets_position_idx" ON "widgets"("position");
