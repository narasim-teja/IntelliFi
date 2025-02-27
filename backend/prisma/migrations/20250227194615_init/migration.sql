-- CreateTable
CREATE TABLE "SpendNote" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "leafHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleRoot" (
    "id" TEXT NOT NULL,
    "root" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerkleRoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpendNote_leafHash_key" ON "SpendNote"("leafHash");

-- CreateIndex
CREATE INDEX "SpendNote_walletAddress_idx" ON "SpendNote"("walletAddress");

-- CreateIndex
CREATE INDEX "SpendNote_nullifier_idx" ON "SpendNote"("nullifier");

-- CreateIndex
CREATE INDEX "MerkleRoot_root_idx" ON "MerkleRoot"("root");
