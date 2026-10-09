import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { assertMoney, audit, nextSequence, periodCode, requirePeriod, roundMoney } from "./authz";

export type PostingLineInput = {
  accountId: Id<"accounts">;
  unitId: Id<"units">;
  debit: number;
  credit: number;
  description: string;
  contactId?: Id<"contacts">;
  programId?: Id<"programs">;
};

type PostInput = {
  date: number;
  sourceType: string;
  sourceId: string;
  description: string;
  createdBy: Id<"users">;
  actor: Doc<"users">;
  lines: PostingLineInput[];
  reversalOfId?: Id<"journalHeaders">;
};

export async function postDoubleEntry(ctx: MutationCtx, input: PostInput): Promise<Id<"journalHeaders">> {
  if (input.lines.length < 2) throw new Error("Jurnal minimal memiliki dua baris.");
  const period = await requirePeriod(ctx, input.date);
  const normalized = input.lines.map((line) => ({
    ...line,
    debit: roundMoney(line.debit),
    credit: roundMoney(line.credit),
  }));
  for (const line of normalized) {
    if (line.debit < 0 || line.credit < 0) throw new Error("Nominal jurnal tidak boleh negatif.");
    if (line.debit > 0 && line.credit > 0) throw new Error("Satu baris jurnal hanya boleh debit atau kredit.");
    if (line.debit === 0 && line.credit === 0) throw new Error("Baris jurnal harus memiliki nominal.");
    const account = await ctx.db.get(line.accountId);
    if (!account || !account.active || !account.isPostable) throw new Error("Akun jurnal tidak valid atau tidak dapat diposting.");
  }
  const totalDebit = roundMoney(normalized.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = roundMoney(normalized.reduce((sum, line) => sum + line.credit, 0));
  if (totalDebit !== totalCredit) throw new Error("Jurnal tidak balance: total debit harus sama dengan total kredit.");

  const sequence = await nextSequence(ctx, `journal:${period.code}`);
  const journalId = await ctx.db.insert("journalHeaders", {
    journalNumber: input.reversalOfId ? `REV-${period.code.replace("-", "")}-${sequence}` : `JRN-${period.code.replace("-", "")}-${String(sequence).padStart(6, "0")}`,
    journalDate: input.date,
    periodCode: period.code,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    description: input.description,
    status: "POSTED",
    reversalOfId: input.reversalOfId,
    createdBy: input.createdBy,
    postedBy: input.actor._id,
    postedAt: Date.now(),
    totalDebit,
    totalCredit,
    createdAt: Date.now(),
  });
  for (const [index, line] of normalized.entries()) {
    const account = await ctx.db.get(line.accountId);
    if (!account) throw new Error("Akun jurnal tidak ditemukan.");
    await ctx.db.insert("journalLines", {
      journalId,
      lineNumber: index + 1,
      accountId: line.accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      cashClass: account.isCash ? "CASH" : account.isBank ? "BANK" : "NONE",
      unitId: line.unitId,
      periodCode: period.code,
      journalDate: input.date,
      debit: line.debit,
      credit: line.credit,
      contactId: line.contactId,
      programId: line.programId,
      description: line.description,
    });
  }
  await audit(ctx, {
    entityType: "journalHeaders",
    entityId: journalId,
    action: "POST",
    actor: input.actor,
    after: { totalDebit, totalCredit, sourceType: input.sourceType, sourceId: input.sourceId },
  });
  return journalId;
}

export async function accountByCode(ctx: MutationCtx, code: string): Promise<Doc<"accounts">> {
  const account = await ctx.db.query("accounts").withIndex("code", (q) => q.eq("code", code)).unique();
  if (!account || !account.active) throw new Error(`Akun ${code} belum dikonfigurasi.`);
  return account;
}

export async function resolveTemplateAccount(
  ctx: MutationCtx,
  token: string,
  transaction: {
    amount: number;
    unitId: Id<"units">;
    cashAccountId?: Id<"cashAccounts">;
    counterCashAccountId?: Id<"cashAccounts">;
  },
): Promise<Doc<"accounts">> {
  const unit = await ctx.db.get(transaction.unitId);
  const unitCode = unit?.code ?? "";
  if (token === "CASH" || token === "FROM_CASH") {
    if (!transaction.cashAccountId) throw new Error("Rekening sumber wajib dipilih.");
    const cash = await ctx.db.get(transaction.cashAccountId);
    if (!cash?.active) throw new Error("Rekening sumber tidak valid.");
    const account = await ctx.db.get(cash.accountId);
    if (!account?.active) throw new Error("Akun rekening sumber tidak valid.");
    return account;
  }
  if (token === "TO_CASH") {
    if (!transaction.counterCashAccountId) throw new Error("Rekening tujuan wajib dipilih.");
    const cash = await ctx.db.get(transaction.counterCashAccountId);
    if (!cash?.active) throw new Error("Rekening tujuan tidak valid.");
    const account = await ctx.db.get(cash.accountId);
    if (!account?.active) throw new Error("Akun rekening sumber tidak valid.");
    return account;
  }
  if (token === "RECEIVABLE_UNIT") {
    const code = unitCode === "MTS" ? "1-1312" : unitCode === "MA" ? "1-1313" : unitCode === "IL" ? "1-1314" : unitCode === "6MART" ? "1-1370" : "1-1400";
    return accountByCode(ctx, code);
  }
  if (token === "PAYABLE_UNIT") {
    const code = unitCode === "6MART" ? "2-1330" : "2-1390";
    return accountByCode(ctx, code);
  }
  if (token === "REVENUE_UNIT") {
    const code = unitCode === "MTS" ? "4-1211" : unitCode === "MA" || unitCode === "IL" ? "4-1311" : unitCode === "6MART" ? "4-4000" : "4-1111";
    return accountByCode(ctx, code);
  }
  if (token === "EXPENSE_UNIT") return accountByCode(ctx, unitCode === "6MART" ? "5-7000" : "5-5000");
  return accountByCode(ctx, token);
}

export function periodFor(date: number): string {
  return periodCode(date);
}

export function validateAmount(amount: number): void {
  assertMoney(amount);
}
