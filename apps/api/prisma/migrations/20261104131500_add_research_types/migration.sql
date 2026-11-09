-- CreateTable
CREATE TABLE "research_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "allocated" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_research_assignments" (
    "user_id" TEXT NOT NULL,
    "research_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_research_assignments_pkey" PRIMARY KEY ("user_id","research_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_types_name_key" ON "research_types"("name");

-- CreateIndex
CREATE INDEX "user_research_assignments_research_id_idx" ON "user_research_assignments"("research_id");

-- AddForeignKey
ALTER TABLE "user_research_assignments" ADD CONSTRAINT "user_research_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_research_assignments" ADD CONSTRAINT "user_research_assignments_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "research_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
