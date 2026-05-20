-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "avatar_color" TEXT NOT NULL,
    "upi_id" TEXT,
    "is_pro" INTEGER NOT NULL DEFAULT 0,
    "is_current_user" INTEGER NOT NULL DEFAULT 0,
    "budget_amount" DOUBLE PRECISION,
    "password_hash" TEXT,
    "push_token" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT DEFAULT 'other',
    "cover_image" TEXT,
    "created_by" TEXT,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT DEFAULT 'INR',
    "category" TEXT DEFAULT 'general',
    "split_type" TEXT DEFAULT 'equal',
    "receipt_uri" TEXT,
    "notes" TEXT,
    "recurring_type" TEXT DEFAULT 'none',
    "recurring_last_generated" BIGINT,
    "is_recurring_parent" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayer" (
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExpensePayer_pkey" PRIMARY KEY ("expense_id","user_id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "share_amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("expense_id","user_id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "payee_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseComment" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "ExpenseComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayer" ADD CONSTRAINT "ExpensePayer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_payee_id_fkey" FOREIGN KEY ("payee_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseComment" ADD CONSTRAINT "ExpenseComment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
