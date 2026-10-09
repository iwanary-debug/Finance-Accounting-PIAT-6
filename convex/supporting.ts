import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { accountByCode, postDoubleEntry } from "./lib/accounting";
import { assertMoney, audit, nextSequence, periodCode, requireRole, requireUser, roundMoney } from "./lib/authz";

export const listReceivables = query({
  args: {},
  handler: async (ctx) => requireUser(ctx).then(() => ctx.db.query("receivables").collect()),
});
export const listPayables = query({
  args: {},
  handler: async (ctx) => requireUser(ctx).then(() => ctx.db.query("payables").collect()),
});
export const listInventoryItems = query({
  args: {},
  handler: async (ctx) => requireUser(ctx).then(() => ctx.db.query("inventoryItems").collect()),
});
export const listInventoryTransactions = query({
  args: { itemId: v.optional(v.id("inventoryItems")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = args.itemId
      ? await ctx.db.query("inventoryTransactions").withIndex("itemId", (q) => q.eq("itemId", args.itemId!)).collect()
      : await ctx.db.query("inventoryTransactions").collect();
    return rows.sort((a, b) => b.transactionDate - a.transactionDate);
  },
});
export const listFixedAssets = query({
  args: {},
  handler: async (ctx) => requireUser(ctx).then(() => ctx.db.query("fixedAssets").collect()),
});
export const listDepreciations = query({
  args: { assetId: v.optional(v.id("fixedAssets")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = args.assetId
      ? await ctx.db.query("assetDepreciations").withIndex("assetId", (q) => q.eq("assetId", args.assetId!)).collect()
      : await ctx.db.query("assetDepreciations").collect();
    return rows.sort((a, b) => b.depreciationDate - a.depreciationDate);
  },
});
export const listBudgets = query({
  args: { year: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("budgets").collect();
    return rows.filter((row) => args.year === undefined || row.year === args.year);
  },
});

export const createReceivable = mutation({
  args: { documentNumber: v.string(), contactId: v.id("contacts"), unitId: v.id("units"), invoiceDate: v.number(), dueDate: v.number(), amount: v.number(), category: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    assertMoney(args.amount);
    const unit = await ctx.db.get(args.unitId);
    const receivableCode = unit?.code === "MTS" ? "1-1312" : unit?.code === "MA" ? "1-1313" : unit?.code === "IL" ? "1-1314" : "1-1400";
    const revenueCode = unit?.code === "MTS" ? "4-1211" : unit?.code === "MA" || unit?.code === "IL" ? "4-1311" : "4-1111";
    const receivable = await accountByCode(ctx, receivableCode);
    const revenue = await accountByCode(ctx, revenueCode);
    const docId = await ctx.db.insert("receivables", { documentNumber: args.documentNumber, contactId: args.contactId, unitId: args.unitId, receivableAccountId: receivable._id, invoiceDate: args.invoiceDate, dueDate: args.dueDate, originalAmount: args.amount, outstandingAmount: args.amount, category: args.category as any, status: "OPEN", createdAt: Date.now() });
    const journalId = await postDoubleEntry(ctx, { date: args.invoiceDate, sourceType: "RECEIVABLE", sourceId: docId, description: args.description ?? `Penagihan ${args.documentNumber}`, createdBy: actor._id, actor, lines: [{ accountId: receivable._id, unitId: args.unitId, debit: args.amount, credit: 0, description: "Pengakuan piutang", contactId: args.contactId }, { accountId: revenue._id, unitId: args.unitId, debit: 0, credit: args.amount, description: "Pengakuan pendapatan", contactId: args.contactId }] });
    await ctx.db.patch(docId, { journalId });
    await audit(ctx, { entityType: "receivables", entityId: docId, action: "CREATE", actor, after: { ...args, journalId } });
    return docId;
  },
});

export const recordReceivablePayment = mutation({
  args: { receivableId: v.id("receivables"), cashAccountId: v.id("cashAccounts"), amount: v.number(), paymentDate: v.number(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    assertMoney(args.amount);
    const doc = await ctx.db.get(args.receivableId);
    if (!doc || doc.outstandingAmount <= 0) throw new Error("Piutang tidak memiliki outstanding.");
    if (args.amount > doc.outstandingAmount) throw new Error("Pembayaran melebihi outstanding piutang.");
    const cash = await ctx.db.get(args.cashAccountId);
    if (!cash) throw new Error("Rekening tidak valid.");
    const cashAccount = await ctx.db.get(cash.accountId);
    if (!cashAccount) throw new Error("Akun kas tidak valid.");
    const journalId = await postDoubleEntry(ctx, { date: args.paymentDate, sourceType: "RECEIVABLE_PAYMENT", sourceId: doc._id, description: args.description ?? `Pembayaran ${doc.documentNumber}`, createdBy: actor._id, actor, lines: [{ accountId: cashAccount._id, unitId: doc.unitId, debit: args.amount, credit: 0, description: "Penerimaan pembayaran", contactId: doc.contactId }, { accountId: doc.receivableAccountId, unitId: doc.unitId, debit: 0, credit: args.amount, description: "Pengurangan piutang", contactId: doc.contactId }] });
    const outstanding = roundMoney(doc.outstandingAmount - args.amount);
    await ctx.db.patch(doc._id, { outstandingAmount: outstanding, status: outstanding === 0 ? "PAID" : "PARTIAL" });
    await insertPostedTransaction(ctx, actor._id, actor, { type: "PAYMENT_RECEIVABLE", date: args.paymentDate, unitId: doc.unitId, contactId: doc.contactId, cashAccountId: args.cashAccountId, amount: args.amount, description: args.description ?? `Pembayaran ${doc.documentNumber}`, sourceType: "RECEIVABLE_PAYMENT", sourceId: doc._id, journalId });
    return { outstanding, journalId };
  },
});

export const createPayable = mutation({
  args: { documentNumber: v.string(), contactId: v.id("contacts"), unitId: v.id("units"), payableAccountId: v.id("accounts"), debitAccountId: v.id("accounts"), invoiceDate: v.number(), dueDate: v.number(), amount: v.number(), category: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    assertMoney(args.amount);
    const docId = await ctx.db.insert("payables", { documentNumber: args.documentNumber, contactId: args.contactId, unitId: args.unitId, payableAccountId: args.payableAccountId, invoiceDate: args.invoiceDate, dueDate: args.dueDate, originalAmount: args.amount, outstandingAmount: args.amount, category: args.category as any, status: "OPEN", createdAt: Date.now() });
    const journalId = await postDoubleEntry(ctx, { date: args.invoiceDate, sourceType: "PAYABLE", sourceId: docId, description: args.description ?? `Hutang ${args.documentNumber}`, createdBy: actor._id, actor, lines: [{ accountId: args.debitAccountId, unitId: args.unitId, debit: args.amount, credit: 0, description: "Pengakuan beban/aset", contactId: args.contactId }, { accountId: args.payableAccountId, unitId: args.unitId, debit: 0, credit: args.amount, description: "Pengakuan utang", contactId: args.contactId }] });
    await ctx.db.patch(docId, { journalId });
    await audit(ctx, { entityType: "payables", entityId: docId, action: "CREATE", actor, after: { ...args, journalId } });
    return docId;
  },
});

export const recordPayablePayment = mutation({
  args: { payableId: v.id("payables"), cashAccountId: v.id("cashAccounts"), amount: v.number(), paymentDate: v.number(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    assertMoney(args.amount);
    const doc = await ctx.db.get(args.payableId);
    if (!doc || args.amount > doc.outstandingAmount) throw new Error("Pembayaran hutang tidak valid.");
    const cash = await ctx.db.get(args.cashAccountId);
    const cashAccount = cash ? await ctx.db.get(cash.accountId) : null;
    if (!cashAccount) throw new Error("Rekening tidak valid.");
    const journalId = await postDoubleEntry(ctx, { date: args.paymentDate, sourceType: "PAYABLE_PAYMENT", sourceId: doc._id, description: args.description ?? `Pembayaran ${doc.documentNumber}`, createdBy: actor._id, actor, lines: [{ accountId: doc.payableAccountId, unitId: doc.unitId, debit: args.amount, credit: 0, description: "Pengurangan utang", contactId: doc.contactId }, { accountId: cashAccount._id, unitId: doc.unitId, debit: 0, credit: args.amount, description: "Pembayaran kas", contactId: doc.contactId }] });
    const outstanding = roundMoney(doc.outstandingAmount - args.amount);
    await ctx.db.patch(doc._id, { outstandingAmount: outstanding, status: outstanding === 0 ? "PAID" : "PARTIAL" });
    await insertPostedTransaction(ctx, actor._id, actor, { type: "PAYMENT_PAYABLE", date: args.paymentDate, unitId: doc.unitId, contactId: doc.contactId, cashAccountId: args.cashAccountId, amount: args.amount, description: args.description ?? `Pembayaran ${doc.documentNumber}`, sourceType: "PAYABLE_PAYMENT", sourceId: doc._id, journalId });
    return { outstanding, journalId };
  },
});

export const createInventoryItem = mutation({
  args: { sku: v.string(), name: v.string(), category: v.string(), unitOfMeasure: v.string(), unitId: v.id("units"), inventoryAccountId: v.id("accounts"), averageCost: v.number(), minimumStock: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const id = await ctx.db.insert("inventoryItems", { ...args, stockQuantity: 0, active: true });
    await audit(ctx, { entityType: "inventoryItems", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const recordInventoryMovement = mutation({
  args: { itemId: v.id("inventoryItems"), transactionDate: v.number(), movementType: v.string(), quantity: v.number(), unitCost: v.number(), counterAccountId: v.id("accounts"), cashAccountId: v.optional(v.id("cashAccounts")), sourceId: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    if (!Number.isFinite(args.quantity) || args.quantity === 0 || args.unitCost < 0) throw new Error("Jumlah atau biaya persediaan tidak valid.");
    const item = await ctx.db.get(args.itemId);
    if (!item?.active) throw new Error("Barang persediaan tidak ditemukan.");
    const total = roundMoney(Math.abs(args.quantity) * args.unitCost);
    let lines;
    if (args.movementType === "PURCHASE") {
      if (!args.cashAccountId) throw new Error("Rekening pembayaran wajib diisi.");
      const cash = await ctx.db.get(args.cashAccountId);
      const cashAccount = cash ? await ctx.db.get(cash.accountId) : null;
      if (!cashAccount) throw new Error("Rekening tidak valid.");
      lines = [{ accountId: item.inventoryAccountId, unitId: item.unitId, debit: total, credit: 0, description: args.description ?? "Pembelian persediaan" }, { accountId: cashAccount._id, unitId: item.unitId, debit: 0, credit: total, description: "Pembayaran persediaan" }];
    } else if (args.movementType === "USAGE" || args.movementType === "SALE") {
      if (item.stockQuantity + args.quantity < 0) throw new Error("Stok tidak mencukupi.");
      lines = [{ accountId: args.counterAccountId, unitId: item.unitId, debit: total, credit: 0, description: args.description ?? "Pemakaian persediaan" }, { accountId: item.inventoryAccountId, unitId: item.unitId, debit: 0, credit: total, description: "Pengurangan persediaan" }];
    } else {
      if (args.quantity < 0) throw new Error("Adjustment bertanda negatif wajib menyertakan akunCNT dan jurnal pengurangan.");
      lines = [{ accountId: item.inventoryAccountId, unitId: item.unitId, debit: total, credit: 0, description: args.description ?? "Penyesuaian persediaan" }, { accountId: args.counterAccountId, unitId: item.unitId, debit: 0, credit: total, description: args.description ?? "Penyesuaian persediaan" }];
    }
    const journalId = await postDoubleEntry(ctx, { date: args.transactionDate, sourceType: "INVENTORY", sourceId: args.sourceId, description: args.description ?? "Mutasi persediaan", createdBy: actor._id, actor, lines });
    const movementId = await ctx.db.insert("inventoryTransactions", { itemId: item._id, transactionDate: args.transactionDate, movementType: args.movementType as any, quantity: args.quantity, unitCost: args.unitCost, totalCost: total, unitId: item.unitId, sourceType: "INVENTORY", sourceId: args.sourceId, journalId, createdBy: actor._id, createdAt: Date.now() });
    await ctx.db.patch(item._id, { stockQuantity: roundMoney(item.stockQuantity + args.quantity), averageCost: args.quantity > 0 && item.stockQuantity + args.quantity > 0 ? roundMoney((item.averageCost * item.stockQuantity + args.unitCost * args.quantity) / (item.stockQuantity + args.quantity)) : item.averageCost });
    await audit(ctx, { entityType: "inventoryTransactions", entityId: movementId, action: "POST", actor, after: args });
    return { movementId, journalId };
  },
});

export const createFixedAsset = mutation({
  args: { code: v.string(), name: v.string(), category: v.string(), unitId: v.id("units"), location: v.optional(v.string()), acquisitionDate: v.number(), acquisitionCost: v.number(), usefulLifeMonths: v.number(), assetAccountId: v.id("accounts"), depreciationAccountId: v.id("accounts") },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    if (args.acquisitionCost <= 0 || args.usefulLifeMonths <= 0) throw new Error("Nilai perolehan dan umur ekonomis harus lebih dari nol.");
    const id = await ctx.db.insert("fixedAssets", { ...args, depreciationMethod: "STRAIGHT_LINE", accumulatedDepreciation: 0, bookValue: args.acquisitionCost, status: "ACTIVE", createdAt: Date.now() });
    await audit(ctx, { entityType: "fixedAssets", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const postAssetDepreciation = mutation({
  args: { assetId: v.id("fixedAssets"), depreciationDate: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.status !== "ACTIVE" || asset.bookValue <= 0) throw new Error("Aset tidak memiliki nilai buku untuk disusutkan.");
    const period = periodCode(args.depreciationDate);
    if (await ctx.db.query("assetDepreciations").withIndex("assetId", (q) => q.eq("assetId", asset._id)).filter((q) => q.eq("periodCode", period)).unique()) throw new Error("Penyusutan periode ini sudah pernah diposting.");
    const amount = roundMoney(Math.min(asset.bookValue, asset.acquisitionCost / asset.usefulLifeMonths));
    const expense = await accountByCode(ctx, "5-5000");
    const journalId = await postDoubleEntry(ctx, { date: args.depreciationDate, sourceType: "DEPRECIATION", sourceId: asset._id, description: `Penyusutan ${asset.code} ${period}`, createdBy: actor._id, actor, lines: [{ accountId: expense._id, unitId: asset.unitId, debit: amount, credit: 0, description: "Beban penyusutan" }, { accountId: asset.depreciationAccountId, unitId: asset.unitId, debit: 0, credit: amount, description: "Akumulasi penyusutan" }] });
    const id = await ctx.db.insert("assetDepreciations", { assetId: asset._id, periodCode: period, depreciationDate: args.depreciationDate, amount, journalId, status: "POSTED", createdAt: Date.now() });
    await ctx.db.patch(asset._id, { accumulatedDepreciation: roundMoney(asset.accumulatedDepreciation + amount), bookValue: roundMoney(asset.bookValue - amount) });
    await audit(ctx, { entityType: "fixedAssets", entityId: asset._id, action: "DEPRECIATION", actor, after: { depreciationId: id, amount, journalId } });
    return { depreciationId: id, journalId, amount };
  },
});

export const saveBudget = mutation({
  args: { year: v.number(), unitId: v.id("units"), programId: v.optional(v.id("programs")), accountId: v.id("accounts"), amount: v.number(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    if (args.amount <= 0) throw new Error("Nilai anggaran harus lebih dari nol.");
    const id = await ctx.db.insert("budgets", { ...args, createdBy: actor._id, createdAt: Date.now() });
    await audit(ctx, { entityType: "budgets", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

async function insertPostedTransaction(ctx: any, createdBy: any, actor: any, args: any) {
  const sequence = await nextSequence(ctx, "transaction");
  const number = `TRX-${new Date(args.date).toISOString().slice(0, 10).replaceAll("-", "")}-${String(sequence).padStart(6, "0")}`;
  const id = await ctx.db.insert("transactions", { number, transactionType: args.type, transactionDate: args.date, periodCode: periodCode(args.date), unitId: args.unitId, contactId: args.contactId, amount: args.amount, description: args.description, status: "POSTED", journalId: args.journalId, cashAccountId: args.cashAccountId, sourceType: args.sourceType, sourceId: args.sourceId, createdBy, postedBy: actor._id, postedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
  await audit(ctx, { entityType: "transactions", entityId: id, action: "POST", actor, after: { number, amount: args.amount, journalId: args.journalId } });
  return id;
}
