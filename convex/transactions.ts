import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertMoney, audit, nextSequence, periodCode, requireRole, requireUser, roundMoney } from "./lib/authz";
import { postDoubleEntry, resolveTemplateAccount } from "./lib/accounting";

const targetStatus = v.union(v.literal("REVIEW"), v.literal("APPROVED"), v.literal("POSTED"));

function transactionDate(value: string): number {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal transaksi tidak valid.");
  return date.getTime();
}

export const listTransactions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    unitId: v.optional(v.id("units")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const source = args.from !== undefined && args.to !== undefined
      ? ctx.db.query("transactions").withIndex("date", (q) => q.gte("transactionDate", args.from!).lte("transactionDate", args.to!))
      : args.from !== undefined
        ? ctx.db.query("transactions").withIndex("date", (q) => q.gte("transactionDate", args.from!))
        : args.to !== undefined
          ? ctx.db.query("transactions").withIndex("date", (q) => q.lte("transactionDate", args.to!))
          : ctx.db.query("transactions").withIndex("date");
    const result = await source.order("desc").paginate(args.paginationOpts);
    const page = result.page.filter((item) => (!args.status || item.status === args.status) && (!args.unitId || item.unitId === args.unitId));
    return { ...result, page, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

export const recentTransactions = query({
  args: { unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const docs = await ctx.db.query("transactions").withIndex("date").order("desc").take(50);
    return docs.filter((doc) => !args.unitId || doc.unitId === args.unitId).slice(0, 10);
  },
});

export const transactionDetail = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaksi tidak ditemukan.");
    const journal = transaction.journalId ? await ctx.db.get(transaction.journalId) : null;
    const lines = journal ? await ctx.db.query("journalLines").withIndex("journalId", (q) => q.eq("journalId", journal._id)).collect() : [];
    const approvals = await ctx.db.query("approvals").withIndex("transactionId", (q) => q.eq("transactionId", transaction._id)).order("asc").collect();
    return { transaction, journal, lines, approvals };
  },
});

export const createRoutineTransaction = mutation({
  args: {
    transactionType: v.string(),
    transactionDate: v.string(),
    unitId: v.id("units"),
    programId: v.optional(v.id("programs")),
    contactId: v.optional(v.id("contacts")),
    cashAccountId: v.id("cashAccounts"),
    counterCashAccountId: v.optional(v.id("cashAccounts")),
    amount: v.number(),
    description: v.string(),
    attachmentId: v.optional(v.id("attachments")),
    submit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    assertMoney(args.amount);
    if (!args.description.trim()) throw new Error("Keterangan transaksi wajib diisi.");
    const mapping = await ctx.db.query("accountMappings").withIndex("code", (q) => q.eq("code", args.transactionType)).unique();
    if (!mapping?.active) throw new Error("Jenis transaksi belum memiliki mapping akuntansi yang aktif.");
    if (mapping.category === "TRANSFER" && (!args.counterCashAccountId || args.counterCashAccountId === args.cashAccountId)) {
      throw new Error("Transfer harus memiliki rekening tujuan yang berbeda.");
    }
    const date = transactionDate(args.transactionDate);
    const unit = await ctx.db.get(args.unitId);
    if (!unit?.active) throw new Error("Unit tidak valid.");
    const sequence = await nextSequence(ctx, "transaction");
    const datePart = new Date(date).toISOString().slice(0, 10).replaceAll("-", "");
    const number = `TRX-${datePart}-${String(sequence).padStart(6, "0")}`;
    const id = await ctx.db.insert("transactions", {
      number,
      transactionType: mapping.code,
      transactionDate: date,
      periodCode: periodCode(date),
      unitId: args.unitId,
      programId: args.programId,
      contactId: args.contactId,
      amount: roundMoney(args.amount),
      description: args.description.trim(),
      status: args.submit ? "SUBMITTED" : "DRAFT",
      cashAccountId: args.cashAccountId,
      counterCashAccountId: args.counterCashAccountId,
      sourceType: mapping.category,
      sourceId: "pending",
      attachmentId: args.attachmentId,
      createdBy: actor._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(id, { sourceId: id });
    await audit(ctx, { entityType: "transactions", entityId: id, action: "CREATE", actor, after: { number, amount: args.amount, transactionType: args.transactionType, submit: args.submit } });
    return { transactionId: id, number };
  },
});

export const createManualJournal = mutation({
  args: {
    transactionDate: v.string(),
    unitId: v.id("units"),
    programId: v.optional(v.id("programs")),
    contactId: v.optional(v.id("contacts")),
    description: v.string(),
    lines: v.array(v.object({ accountId: v.id("accounts"), debit: v.number(), credit: v.number(), description: v.string() })),
    submit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    if (args.lines.length < 2) throw new Error("Jurnal umum minimal memiliki dua baris.");
    const total = args.lines.reduce((sum, line) => ({ debit: sum.debit + line.debit, credit: sum.credit + line.credit }), { debit: 0, credit: 0 });
    if (roundMoney(total.debit) !== roundMoney(total.credit) || total.debit <= 0) throw new Error("Jurnal umum harus balance dan bernilai lebih dari nol.");
    const date = transactionDate(args.transactionDate);
    const sequence = await nextSequence(ctx, "transaction");
    const number = `GJ-${new Date(date).toISOString().slice(0, 10).replaceAll("-", "")}-${String(sequence).padStart(6, "0")}`;
    const id = await ctx.db.insert("transactions", {
      number,
      transactionType: "MANUAL_JOURNAL",
      transactionDate: date,
      periodCode: periodCode(date),
      unitId: args.unitId,
      programId: args.programId,
      contactId: args.contactId,
      amount: roundMoney(total.debit),
      description: args.description.trim() || "Jurnal umum",
      status: args.submit ? "SUBMITTED" : "DRAFT",
      manualLines: args.lines.map((line) => ({ ...line, debit: roundMoney(line.debit), credit: roundMoney(line.credit) })),
      sourceType: "MANUAL_JOURNAL",
      sourceId: "pending",
      createdBy: actor._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(id, { sourceId: id });
    await audit(ctx, { entityType: "transactions", entityId: id, action: "CREATE_MANUAL_JOURNAL", actor, after: { number, total } });
    return { transactionId: id, number };
  },
});

export const transitionTransaction = mutation({
  args: { transactionId: v.id("transactions"), targetStatus: targetStatus, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) throw new Error("Transaksi tidak ditemukan.");
    const allowed: Record<typeof args.targetStatus, { from: string[]; roles: any[]; action: "REVIEW" | "APPROVE" | "POST" }> = {
      REVIEW: { from: ["SUBMITTED"], roles: ["SUPER_ADMIN", "ADMIN_KEUANGAN", "REVIEWER"], action: "REVIEW" },
      APPROVED: { from: ["REVIEW"], roles: ["SUPER_ADMIN", "ADMIN_KEUANGAN", "REVIEWER"], action: "APPROVE" },
      POSTED: { from: ["APPROVED"], roles: ["SUPER_ADMIN", "ADMIN_KEUANGAN"], action: "POST" },
    };
    const transition = allowed[args.targetStatus];
    if (!transition.from.includes(transaction.status)) throw new Error(`Status tidak dapat berubah dari ${transaction.status} ke ${args.targetStatus}.`);
    requireRole(actor, transition.roles);

    let journalId = transaction.journalId;
    if (args.targetStatus === "POSTED") {
      if (transaction.transactionType === "MANUAL_JOURNAL") {
        if (!transaction.manualLines) throw new Error("Baris jurnal umum tidak ditemukan.");
        journalId = await postDoubleEntry(ctx, {
          date: transaction.transactionDate,
          sourceType: transaction.sourceType,
          sourceId: transaction._id,
          description: transaction.description,
          createdBy: transaction.createdBy,
          actor,
          lines: transaction.manualLines.map((line) => ({ ...line, unitId: transaction.unitId, contactId: transaction.contactId, programId: transaction.programId })),
        });
      } else {
        const mapping = await ctx.db.query("accountMappings").withIndex("code", (q) => q.eq("code", transaction.transactionType)).unique();
        if (!mapping?.active) throw new Error("Mapping akuntansi transaksi tidak aktif.");
        const lines = await Promise.all(mapping.templateLines.map(async (line) => {
          const account = await resolveTemplateAccount(ctx, line.accountCode, transaction);
          return { accountId: account._id, unitId: transaction.unitId, debit: line.side === "DEBIT" ? transaction.amount : 0, credit: line.side === "CREDIT" ? transaction.amount : 0, description: line.description, contactId: transaction.contactId, programId: transaction.programId };
        }));
        journalId = await postDoubleEntry(ctx, { date: transaction.transactionDate, sourceType: transaction.sourceType, sourceId: transaction._id, description: transaction.description, createdBy: transaction.createdBy, actor, lines });
      }
    }
    await ctx.db.patch(transaction._id, { status: args.targetStatus, journalId, postedBy: args.targetStatus === "POSTED" ? actor._id : undefined, postedAt: args.targetStatus === "POSTED" ? Date.now() : undefined, updatedAt: Date.now() });
    await ctx.db.insert("approvals", { transactionId: transaction._id, fromStatus: transaction.status as any, toStatus: args.targetStatus, action: transition.action, actorId: actor._id, note: args.note, createdAt: Date.now() });
    await audit(ctx, { entityType: "transactions", entityId: transaction._id, action: transition.action, actor, before: { status: transaction.status }, after: { status: args.targetStatus, journalId } });
    return { transactionId: transaction._id, status: args.targetStatus, journalId };
  },
});

export const reverseTransaction = mutation({
  args: { transactionId: v.id("transactions"), reason: v.string(), journalDate: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction || transaction.status !== "POSTED" || !transaction.journalId) throw new Error("Hanya transaksi POSTED yang dapat dikoreksi.");
    if (!args.reason.trim()) throw new Error("Alasan koreksi wajib diisi.");
    const original = await ctx.db.get(transaction.journalId);
    if (!original || original.status !== "POSTED") throw new Error("Jurnal sumber tidak dapat dikoreksi.");
    const sourceLines = await ctx.db.query("journalLines").withIndex("journalId", (q) => q.eq("journalId", original._id)).collect();
    const reversalId = await postDoubleEntry(ctx, {
      date: args.journalDate ?? Date.now(),
      sourceType: "REVERSAL",
      sourceId: transaction._id,
      description: `Koreksi: ${args.reason.trim()}`,
      createdBy: transaction.createdBy,
      actor,
      reversalOfId: original._id,
      lines: sourceLines.map((line) => ({ accountId: line.accountId, unitId: line.unitId, debit: line.credit, credit: line.debit, description: `Reversal: ${line.description}`, contactId: line.contactId, programId: line.programId })),
    });
    await ctx.db.patch(original._id, { status: "REVERSED" });
    await ctx.db.patch(transaction._id, { status: "REVERSED", updatedAt: Date.now() });
    await ctx.db.insert("approvals", { transactionId: transaction._id, fromStatus: "POSTED", toStatus: "REVERSED", action: "REVERSE", actorId: actor._id, note: args.reason, createdAt: Date.now() });
    await audit(ctx, { entityType: "transactions", entityId: transaction._id, action: "REVERSE", actor, before: { journalId: original._id }, after: { reversalId, reason: args.reason } });
    return { reversalId };
  },
});

