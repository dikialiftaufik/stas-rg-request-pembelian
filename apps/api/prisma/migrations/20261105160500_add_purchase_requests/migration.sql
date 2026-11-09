-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('pending_review', 'approved', 'ordered', 'in_transit', 'delivered', 'completed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('not_submitted', 'submitted');

-- CreateEnum
CREATE TYPE "replacement_origin_status" AS ENUM ('approved', 'ordered');

-- CreateEnum
CREATE TYPE "replacement_proposal_status" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "purchase_requests" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "research_id" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "required_date" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "request_status" NOT NULL DEFAULT 'pending_review',
    "submission_status" "submission_status" NOT NULL DEFAULT 'not_submitted',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "rab_document_id" TEXT,
    "rab_item_id" TEXT,
    "invoice_number" TEXT,
    "invoice_amount" DECIMAL(18,2),
    "invoice_date" TEXT,
    "invoice_url" TEXT NOT NULL DEFAULT '',
    "invoice_updated_at" TIMESTAMP(3),
    "invoice_updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_history" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "from_status" "request_status" NOT NULL,
    "to_status" "request_status" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_replacement_proposals" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "previous_url" TEXT NOT NULL DEFAULT '',
    "previous_unit_price" DECIMAL(18,2) NOT NULL,
    "origin_status" "replacement_origin_status" NOT NULL,
    "status" "replacement_proposal_status" NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "response" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "request_replacement_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_invoice_files" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_invoice_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_requests_owner_id_idx" ON "purchase_requests"("owner_id");

-- CreateIndex
CREATE INDEX "purchase_requests_research_id_idx" ON "purchase_requests"("research_id");

-- CreateIndex
CREATE INDEX "purchase_requests_status_idx" ON "purchase_requests"("status");

-- CreateIndex
CREATE INDEX "purchase_requests_deleted_created_at_idx" ON "purchase_requests"("deleted", "created_at");

-- CreateIndex
CREATE INDEX "request_status_history_request_id_created_at_idx" ON "request_status_history"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_replacement_proposals_request_id_created_at_idx" ON "request_replacement_proposals"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_invoice_files_request_id_key" ON "request_invoice_files"("request_id");

-- CreateIndex
CREATE INDEX "user_notifications_recipient_id_created_at_idx" ON "user_notifications"("recipient_id", "created_at");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_replacement_proposals" ADD CONSTRAINT "request_replacement_proposals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_invoice_files" ADD CONSTRAINT "request_invoice_files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
