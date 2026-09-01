import { boolean, doublePrecision, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { StoredFile } from "@/lib/types";

export const companies = pgTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  slug: text("slug").notNull().unique(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  created: text("created").notNull(),
});

export const userCompanies = pgTable(
  "user_companies",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.companyId] })],
);

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id),
  created: text("created").notNull(),
  expires: text("expires").notNull(),
  accepted: boolean("accepted").notNull().default(false),
});

export const invitationCompanies = pgTable(
  "invitation_companies",
  {
    invitationId: text("invitation_id")
      .notNull()
      .references(() => invitations.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.invitationId, table.companyId] })],
);

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  expenseType: text("expense_type").notNull(),
  eventProject: text("event_project").notNull().default(""),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(),
  paymentMethod: text("payment_method").notNull(),
  beneficiaryName: text("beneficiary_name").notNull(),
  beneficiaryDocument: text("beneficiary_document").notNull().default(""),
  pixKey: text("pix_key").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  agency: text("agency").notNull().default(""),
  account: text("account").notNull().default(""),
  boletoCode: text("boleto_code").notNull().default(""),
  maxPaymentDate: text("max_payment_date").notNull(),
  receiptJustification: text("receipt_justification").notNull().default(""),
  receipt: jsonb("receipt").$type<StoredFile | null>(),
  paymentProof: jsonb("payment_proof").$type<StoredFile | null>(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  requesterId: text("requester_id")
    .notNull()
    .references(() => users.id),
  approverId: text("approver_id"),
  status: text("status").notNull(),
  scheduledDate: text("scheduled_date"),
  reviewNote: text("review_note").notNull().default(""),
  created: text("created").notNull(),
  updated: text("updated").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  before: text("before").notNull(),
  after: text("after").notNull(),
  created: text("created").notNull(),
});
