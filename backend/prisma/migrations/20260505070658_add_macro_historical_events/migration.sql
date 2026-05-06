-- CreateTable
CREATE TABLE "macro_historical_events" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "prevValue" DOUBLE PRECISION,
    "changePct" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "affects" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macro_historical_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "macro_historical_events_date_idx" ON "macro_historical_events"("date");

-- CreateIndex
CREATE INDEX "macro_historical_events_seriesId_idx" ON "macro_historical_events"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "macro_historical_events_seriesId_date_key" ON "macro_historical_events"("seriesId", "date");
