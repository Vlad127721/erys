-- CreateTable
CREATE TABLE "import_requests" (
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_requests_pkey" PRIMARY KEY ("key")
);
