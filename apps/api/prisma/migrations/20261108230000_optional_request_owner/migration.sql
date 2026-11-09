-- Data historis hasil impor Admin tidak selalu memiliki Pengaju.
ALTER TABLE "purchase_requests" ALTER COLUMN "owner_id" DROP NOT NULL;
