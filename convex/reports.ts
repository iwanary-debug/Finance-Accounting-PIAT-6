import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole, requireUser, roundMoney } from "./lib/authz";

function balance(lines: any[]) {
  return roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0));
}
function credit(lines: any[]) {
  return roundMoney(lines.reduce((sum, line) => sum + line.credit - line.debit, 0));
}

export const trialBalance = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const lines = (await ctx.db.query("journalLines").collect()).filter((line) =>
      (!args.unitId || line.unitId === args.unitId) &&
      (args.from === undefined || line.journalDate >= args.from) &&
      (args.to === undefined || line.journalDate <= args.to),
    );
    const openingLines = (await ctx.db.query("journalLines").collect()).filter((line) =>
      (!args.unitId || line.unitId === args.unitId) && (args.from === undefined || line.journalDate < args.from),
    );
    const map = new Map<string, any>();
    for (const line of lines) {
      const row = map.get(line.accountId) ?? { accountId: line.accountId, code: line.accountCode, name: line.accountName, type: line.accountType, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0 };
      row.debit += line.debit;
      row.credit += line.credit;
      map.set(line.accountId, row);
    }
    for (const line of openingLines) {
      const row = map.get(line.accountId) ?? { accountId: line.accountId, code: line.accountCode, name: line.accountName, type: line.accountType, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0 };
      const opening = line.debit - line.credit;
      if (opening >= 0) row.openingDebit = opening;
      else row.openingCredit = -opening;
      map.set(line.accountId, row);
    }
    const rows = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
    let totalDebit = 0;
    let totalCredit = 0;
    for (const row of rows) {
      const ending = roundMoney((row.openingDebit - row.openingCredit) + row.debit - row.credit);
      row.debitBalance = ending >= 0 ? ending : 0;
      row.creditBalance = ending < 0 ? -ending : 0;
      totalDebit = roundMoney(totalDebit + row.debitBalance);
      totalCredit = roundMoney(totalCredit + row.creditBalance);
    }
    return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  },
});

export const generalLedger = query({
  args: { accountId: v.id("accounts"), from: v.optional(v.number()), to: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error("Akun tidak ditemukan.");
    const all = (await ctx.db.query("journalLines").withIndex("accountId", (q) => q.eq("accountId", args.accountId)).collect())
      .filter((line) => !args.unitId || line.unitId === args.unitId)
      .sort((a, b) => a.journalDate - b.journalDate || a.lineNumber - b.lineNumber);
    const before = all.filter((line) => args.from === undefined || line.journalDate < args.from);
    let running = balance(before);
    const opening = running;
    const rows: any[] = [];
    for (const line of all.filter((line) => args.to === undefined || line.journalDate <= args.to)) {
      if (args.from !== undefined && line.journalDate < args.from) continue;
      running = roundMoney(running + line.debit - line.credit);
      const header = await ctx.db.get(line.journalId);
      rows.push({ ...line, journalNumber: header?.journalNumber, sourceType: header?.sourceType, sourceId: header?.sourceId, runningBalance: running });
    }
    return { account, openingBalance: opening, rows, endingBalance: running };
  },
});

export const listJournals = query({
  args: { paginationOpts: paginationOptsValidator, from: v.optional(v.number()), to: v.optional(v.number()), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const all = (await ctx.db.query("journalHeaders").collect())
      .filter((row) => (args.from === undefined || row.journalDate >= args.from) && (args.to === undefined || row.journalDate <= args.to) && (!args.status || row.status === args.status))
      .sort((a, b) => b.journalDate - a.journalDate || b._creationTime - a._creationTime);
    const start = args.paginationOpts.numItems > 0 ? Number(args.paginationOpts.cursor ?? 0) : 0;
    const end = start + args.paginationOpts.numItems;
    return { page: all.slice(start, end), isDone: end >= all.length, continueCursor: String(end), status: all.length };
  },
});

export const financialStatements = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const all = (await ctx.db.query("journalLines").collect()).filter((line) => !args.unitId || line.unitId === args.unitId);
    const opening = all.filter((line) => args.from === undefined || line.journalDate < args.from);
    const period = all.filter((line) => (args.from === undefined || line.journalDate >= args.from) && (args.to === undefined || line.journalDate <= args.to));
    const assets = opening.filter((line) => line.accountType === "ASSET").map((line) => ({ code: line.accountCode, name: line.accountName, amount: balance([line]) })).filter((row) => row.amount !== 0);
    const liabilities = opening.filter((line) => line.accountType === "LIABILITY").map((line) => ({ code: line.accountCode, name: line.accountName, amount: credit([line]) })).filter((row) => row.amount !== 0);
    const netAssets = opening.filter((line) => line.accountType === "NET_ASSET").map((line) => ({ code: line.accountCode, name: line.accountName, amount: credit([line]) })).filter((row) => row.amount !== 0);
    const revenue = period.filter((line) => line.accountType === "REVENUE").map((line) => ({ code: line.accountCode, name: line.accountName, amount: credit([line]) })).filter((row) => row.amount !== 0);
    const expenses = period.filter((line) => line.accountType === "EXPENSE").map((line) => ({ code: line.accountCode, name: line.accountName, amount: balance([line]) })).filter((row) => row.amount !== 0);
    const totalAssetsValue = roundMoney(assets.reduce((sum, row) => sum + row.amount, 0));
    const totalLiabilitiesValue = roundMoney(liabilities.reduce((sum, row) => sum + row.amount, 0));
    const totalNetAssetsValue = roundMoney(netAssets.reduce((sum, row) => sum + row.amount, 0));
    return {
      balanceSheet: { assets, liabilities, netAssets, totalAssets: totalAssetsValue, totalLiabilities: totalLiabilitiesValue, totalNetAssets: totalNetAssetsValue, balanced: roundMoney(totalAssetsValue - totalLiabilitiesValue - totalNetAssetsValue) === 0 },
      incomeStatement: { revenue, expenses, totalRevenue: roundMoney(revenue.reduce((sum, row) => sum + row.amount, 0)), totalExpense: roundMoney(expenses.reduce((sum, row) => sum + row.amount, 0)) },
      changesInNetAssets: { surplus: roundMoney(credit(period.filter((line) => line.accountType === "REVENUE")) - balance(period.filter((line) => line.accountType === "EXPENSE"))), beginningNetAssets: totalNetAssetsValue },
    };
  },
});

function agingBucket(days: number) {
  if (days < 0) return "BELUM_JATUH_TEMPO";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return ">90";
}

export const receivablesAging = query({
  args: { asOf: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const asOf = args.asOf ?? Date.now();
    const rows: any[] = [];
    for (const doc of await ctx.db.query("receivables").collect()) {
      if (doc.outstandingAmount <= 0 || (args.unitId && doc.unitId !== args.unitId)) continue;
      const contact = await ctx.db.get(doc.contactId);
      const days = Math.floor((asOf - doc.dueDate) / 86_400_000);
      rows.push({ ...doc, contactName: contact?.name ?? "-", daysOverdue: days, bucket: agingBucket(days) });
    }
    return { rows, total: roundMoney(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)) };
  },
});

export const payablesAging = query({
  args: { asOf: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const asOf = args.asOf ?? Date.now();
    const rows: any[] = [];
    for (const doc of await ctx.db.query("payables").collect()) {
      if (doc.outstandingAmount <= 0 || (args.unitId && doc.unitId !== args.unitId)) continue;
      const contact = await ctx.db.get(doc.contactId);
      const days = Math.floor((asOf - doc.dueDate) / 86_400_000);
      rows.push({ ...doc, contactName: contact?.name ?? "-", daysOverdue: days, bucket: agingBucket(days) });
    }
    return { rows, total: roundMoney(rows.reduce((sum, row) => sum + row.outstandingAmount, 0)) };
  },
});

export const budgetReport = query({
  args: { year: v.number(), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const lines = (await ctx.db.query("journalLines").collect()).filter((line) => new Date(line.journalDate).getUTCFullYear() === args.year && (!args.unitId || line.unitId === args.unitId) && line.accountType === "EXPENSE");
    const rows: any[] = [];
    for (const budget of (await ctx.db.query("budgets").collect()).filter((row) => row.year === args.year && (!args.unitId || row.unitId === args.unitId))) {
      const account = await ctx.db.get(budget.accountId);
      const actual = roundMoney(lines.filter((line) => line.accountId === budget.accountId).reduce((sum, line) => sum + line.debit - line.credit, 0));
      rows.push({ ...budget, accountCode: account?.code, accountName: account?.name, actual, variance: roundMoney(budget.amount - actual), realization: budget.amount ? roundMoney((actual / budget.amount) * 100) : 0 });
    }
    return rows;
  },
});

export const legacyReconciliation = query({
  args: { referenceDate: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const referenceDate = args.referenceDate ?? Date.UTC(2026, 5, 30);
    const lines = (await ctx.db.query("journalLines").collect()).filter((line) => line.journalDate < referenceDate + 86_400_000);
    const snapshots = await ctx.db.query("legacySnapshots").withIndex("referenceDate", (q) => q.eq("referenceDate", referenceDate)).collect();
    const rows = snapshots.map((snapshot) => {
      const current = roundBalance(lines.filter((line) => line.accountCode === snapshot.accountCode || isInAccountGroup(line.accountCode, snapshot.accountCode)));
      const normalFactor = snapshot.accountCode.startsWith("2-") || snapshot.accountCode.startsWith("3-") || snapshot.accountCode.startsWith("4-") ? -1 : 1;
      const currentComparable = roundMoney(current * normalFactor);
      return { ...snapshot, currentAmount: currentComparable, difference: roundMoney(currentComparable - snapshot.amount), status: Math.abs(currentComparable - snapshot.amount) < 0.01 ? "MATCH" : "DIFFERENCE" };
    });
    return { referenceDate, rows, totalDifference: roundMoney(rows.reduce((sum, row) => sum + row.difference, 0)), balanced: rows.every((row) => row.status === "MATCH") };
  },
});

function isInAccountGroup(code: string, group: string) {
  if (group.endsWith("0000")) return code.startsWith(group.slice(0, 1));
  if (group === "1-1100") return code.startsWith("1-11");
  if (group === "1-1300") return code.startsWith("1-13");
  if (group === "1-1400") return code.startsWith("1-14");
  if (group === "1-1500") return code.startsWith("1-15");
  if (group === "1-1600") return code.startsWith("1-16");
  if (group === "1-1700") return code.startsWith("1-17");
  if (group === "1-2000") return code.startsWith("1-2");
  if (group === "2-1100") return code.startsWith("2-11");
  if (group === "2-1200") return code.startsWith("2-12");
  if (group === "2-1300") return code.startsWith("2-13");
  if (group === "2-1600") return code.startsWith("2-16");
  if (group === "2-1700") return code.startsWith("2-17");
  if (group === "3-1100") return code.startsWith("3-11");
  if (group === "3-2000") return code.startsWith("3-2");
  if (group === "3-4000") return code.startsWith("3-4");
  return false;
}

function roundBalance(lines: any[]) {
  return roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0));
}
