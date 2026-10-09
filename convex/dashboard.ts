import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser, roundMoney } from "./lib/authz";
import { buildBreakdown, buildResultBreakdown, CARD_DEFS, CARD_ITEM_LABELS } from "./lib/breakdown";

function monthBounds(date: number) {
  const d = new Date(date);
  return {
    code: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    start: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1),
    end: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function netBalance(lines: any[], filter: (line: any) => boolean) {
  return roundMoney(lines.filter(filter).reduce((sum, line) => sum + line.debit - line.credit, 0));
}

function creditBalance(lines: any[], filter: (line: any) => boolean) {
  return roundMoney(lines.filter(filter).reduce((sum, line) => sum + line.credit - line.debit, 0));
}

export const dashboard = query({
  args: { from: v.optional(v.number()), to: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const allLines = (await ctx.db.query("journalLines").collect()).filter((line) => !args.unitId || line.unitId === args.unitId);
    const latestJournalDate = allLines.reduce((latest, line) => Math.max(latest, line.journalDate), 0);
    const referenceDate = args.to ?? latestJournalDate ?? now;
    const current = monthBounds(referenceDate);
    const from = args.from ?? current.start;
    const to = args.to ?? current.end;
    const activeAt = (line: any) => line.journalDate <= to;
    const inPeriod = (line: any) => line.journalDate >= from && line.journalDate <= to;
    const active = allLines.filter(activeAt);
    const periodLines = allLines.filter(inPeriod);
    const yearStart = Date.UTC(new Date(to).getUTCFullYear(), 0, 1);
    const ytdLines = allLines.filter((line) => line.journalDate >= yearStart && line.journalDate <= to);

    const isCashAccount = (line: any) => line.cashClass !== "NONE" || /^1-11/.test(line.accountCode);
    const cash = netBalance(active, isCashAccount);
    const cashOnHand = netBalance(active, (line) => line.cashClass === "CASH" || /^1-111/.test(line.accountCode));
    const bank = netBalance(active, (line) => line.cashClass === "BANK" || /^1-112/.test(line.accountCode));
    const receivables = netBalance(active, (line) => /^1-13/.test(line.accountCode));
    const otherReceivables = netBalance(active, (line) => /^1-14/.test(line.accountCode));
    const inventory = netBalance(active, (line) => line.accountCode.startsWith("1-15"));
    const fixedAssets = netBalance(active, (line) => line.accountCode.startsWith("1-2"));
    const otherAssets = netBalance(active, (line) => line.accountType === "ASSET" && !/^1-(11|13|14|15|2)/.test(line.accountCode));
    const totalAssets = netBalance(active, (line) => line.accountType === "ASSET");
    const totalLiabilities = creditBalance(active, (line) => line.accountType === "LIABILITY");
    const totalNetAssets = creditBalance(active, (line) => line.accountType === "NET_ASSET");
    const revenue = creditBalance(periodLines, (line) => line.accountType === "REVENUE");
    const expense = netBalance(periodLines, (line) => line.accountType === "EXPENSE");
    const ytdRevenue = creditBalance(ytdLines, (line) => line.accountType === "REVENUE");
    const ytdExpense = netBalance(ytdLines, (line) => line.accountType === "EXPENSE");
    const monthReceipts = netBalance(periodLines, (line) => isCashAccount(line) && line.debit > line.credit);
    const monthDisbursements = netBalance(periodLines, (line) => isCashAccount(line) && line.credit > line.debit);

    const today = new Date();
    const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const todayEnd = todayStart + 86_399_999;
    const todayLines = allLines.filter((line) => line.journalDate >= todayStart && line.journalDate <= todayEnd && (!args.unitId || line.unitId === args.unitId));
    const todayReceipts = netBalance(todayLines, (line) => isCashAccount(line) && line.debit > line.credit);
    const todayDisbursements = netBalance(todayLines, (line) => isCashAccount(line) && line.credit > line.debit);

    const transactions = (await ctx.db.query("transactions").collect()).filter((tx) => !args.unitId || tx.unitId === args.unitId);
    const pendingApprovals = transactions.filter((tx) => ["SUBMITTED", "REVIEW", "APPROVED"].includes(tx.status)).length;
    const budgets = await ctx.db.query("budgets").collect();
    const budget = roundMoney(budgets.filter((row) => row.year === new Date(to).getUTCFullYear() && (!args.unitId || row.unitId === args.unitId)).reduce((sum, row) => sum + row.amount, 0));

    const trend: { month: string; cash: number; revenue: number; expense: number; surplus: number }[] = [];
    const end = new Date(to);
    for (let offset = 11; offset >= 0; offset--) {
      const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1));
      const bounds = monthBounds(d.getTime());
      const lines = allLines.filter((line) => line.journalDate >= bounds.start && line.journalDate <= bounds.end);
      const revenueValue = creditBalance(lines, (line) => line.accountType === "REVENUE");
      const expenseValue = netBalance(lines, (line) => line.accountType === "EXPENSE");
      trend.push({
        month: new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(d),
        cash: netBalance(allLines.filter((line) => line.journalDate <= bounds.end), isCashAccount),
        revenue: revenueValue,
        expense: expenseValue,
        surplus: roundMoney(revenueValue - expenseValue),
      });
    }

    const unitIds = new Set<string>();
    const unitContribution: { unitId: string; surplus: number }[] = [];
    for (const unit of await ctx.db.query("units").collect()) {
      if (!unit.active || (args.unitId && unit._id !== args.unitId)) continue;
      const unitLines = ytdLines.filter((line) => line.unitId === unit._id);
      const unitRevenue = creditBalance(unitLines, (line) => line.accountType === "REVENUE");
      const unitExpense = netBalance(unitLines, (line) => line.accountType === "EXPENSE");
      if (unitRevenue || unitExpense) {
        unitIds.add(unit._id);
        unitContribution.push({ unitId: unit._id, surplus: roundMoney(unitRevenue - unitExpense) });
      }
    }

    return {
      role: user.appRole,
      period: { from, to },
      kpis: {
        cash,
        cashOnHand,
        bank,
        receivables,
        otherReceivables,
        inventory,
        fixedAssets,
        otherAssets,
        totalAssets,
        totalLiabilities,
        totalNetAssets,
        totalEquityWithResult: roundMoney(totalNetAssets + (revenue - expense)),
        monthSurplus: roundMoney(revenue - expense),
        yearSurplus: roundMoney(ytdRevenue - ytdExpense),
        yearRevenue: ytdRevenue,
        yearExpense: ytdExpense,
        todayReceipts,
        todayDisbursements,
        monthReceipts,
        monthDisbursements,
        pendingApprovals,
        budget,
        budgetVariance: roundMoney(budget - ytdExpense),
        realization: budget ? roundMoney((ytdExpense / budget) * 100) : 0,
      },
      assetComposition: [
        { name: "Kas & Bank", value: cash },
        { name: "Piutang", value: receivables },
        { name: "Piutang Lainnya", value: otherReceivables },
        { name: "Persediaan", value: inventory },
        { name: "Aset Tetap", value: fixedAssets },
        { name: "Aset Lainnya", value: otherAssets },
      ],
      trend,
      unitContribution,
      recentTransactions: transactions.sort((a, b) => b.transactionDate - a.transactionDate).slice(0, 8),
    };
  },
});

const DEBIT = (line: any) => line.debit - line.credit;
const CREDIT = (line: any) => line.credit - line.debit;
const money = (lines: any[], sign: (line: any) => number) => roundMoney(lines.reduce((sum, line) => sum + sign(line), 0));

/** Rincian per kartu dashboard: saldo akun real dikelompokkan ke label bisnis. */
export const cardBreakdown = query({
  args: { card: v.string(), from: v.optional(v.number()), to: v.optional(v.number()), unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const allLines = (await ctx.db.query("journalLines").collect()).filter((line) => !args.unitId || line.unitId === args.unitId);
    const latestJournalDate = allLines.reduce((latest, line) => Math.max(latest, line.journalDate), 0);
    const to = args.to ?? latestJournalDate ?? Date.now();
    const from = args.from ?? monthBounds(to).start;
    const active = allLines.filter((line) => line.journalDate <= to);
    const periodLines = allLines.filter((line) => line.journalDate >= from && line.journalDate <= to);
    const ytdLines = allLines.filter((line) => line.journalDate >= Date.UTC(new Date(to).getUTCFullYear(), 0, 1) && line.journalDate <= to);

    if (args.card === "result") {
      const result = buildResultBreakdown(periodLines, money(ytdLines, CREDIT), money(ytdLines, DEBIT));
      return { card: args.card, title: "Surplus / Defisit", asOf: to, from, to, unitId: args.unitId ?? null, total: result.total, groups: result.groups, highlights: result.highlights };
    }

    const def = CARD_DEFS[args.card];
    if (!def) throw new Error("Rincian untuk kartu ini belum tersedia.");
    const scoped = active.filter((line) => def.scope.test(line.accountCode));
    const sign = def.sign === "credit" ? CREDIT : DEBIT;
    const breakdown = buildBreakdown(scoped, def.rules, sign, CARD_ITEM_LABELS[args.card]);
    return {
      card: args.card,
      title: def.title,
      asOf: to,
      from,
      to,
      unitId: args.unitId ?? null,
      total: breakdown.total,
      groups: breakdown.groups,
      highlights: def.labels.map((entry) => ({ label: entry.label, value: money(scoped.filter((line) => entry.test.test(line.accountCode)), sign) })),
    };
  },
});


/**
 * Surplus/defisit bulanan 12 bulan. Sumber: jurnal aplikasi bila tersedia, jika tidak
 * memakai tren bulanan dari sheet Grafik pada workbook Excel konsolidasi.
 */
export const financialTrend = query({
  args: { unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const lines = (await ctx.db.query("journalLines").collect()).filter((line) => !args.unitId || line.unitId === args.unitId);
    const snapshots = await ctx.db.query("financialTrend").withIndex("monthKey").collect();
    const keys = new Set<string>([...snapshots.map((row) => row.monthKey)]);
    for (const line of lines) {
      if (line.accountType !== "REVENUE" && line.accountType !== "EXPENSE") continue;
      const d = new Date(line.journalDate);
      keys.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const months: { monthKey: string; label: string; shortLabel: string; revenue: number; expense: number; surplus: number; source: "LEDGER" | "EXCEL" | "NONE" }[] = [];
    for (const monthKey of [...keys].sort()) {
      const [year, month] = monthKey.split("-").map(Number);
      const start = Date.UTC(year, month - 1, 1);
      const end = Date.UTC(year, month, 0, 23, 59, 59, 999);
      const monthLines = lines.filter((line) => line.journalDate >= start && line.journalDate <= end);
      const ledgerRevenue = money(monthLines.filter((line) => line.accountType === "REVENUE"), CREDIT);
      const ledgerExpense = money(monthLines.filter((line) => line.accountType === "EXPENSE"), DEBIT);
      const snapshot = snapshots.find((row) => row.monthKey === monthKey);
      const fromLedger = ledgerRevenue !== 0 || ledgerExpense !== 0;
      const revenue = fromLedger ? ledgerRevenue : snapshot?.revenue ?? 0;
      const expense = fromLedger ? ledgerExpense : snapshot?.expense ?? 0;
      months.push({
        monthKey,
        label: snapshot?.label ?? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(start)),
        shortLabel: new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(new Date(start)),
        revenue,
        expense,
        surplus: roundMoney(revenue - expense),
        source: fromLedger ? "LEDGER" : snapshot ? "EXCEL" : "NONE",
      });
    }
    const withData = months.filter((month) => month.source !== "NONE");
    const totalRevenue = roundMoney(withData.reduce((sum, month) => sum + month.revenue, 0));
    const totalExpense = roundMoney(withData.reduce((sum, month) => sum + month.expense, 0));
    const deficitMonths = withData.filter((month) => month.surplus < 0);
    const best = withData.reduce<typeof withData[number] | null>((top, month) => (!top || month.surplus > top.surplus ? month : top), null);
    const worst = withData.reduce<typeof withData[number] | null>((low, month) => (!low || month.surplus < low.surplus ? month : low), null);
    return {
      months: withData,
      summary: {
        totalRevenue,
        totalExpense,
        totalSurplus: roundMoney(totalRevenue - totalExpense),
        averageSurplus: withData.length ? roundMoney((totalRevenue - totalExpense) / withData.length) : 0,
        marginPercent: totalRevenue ? roundMoney(((totalRevenue - totalExpense) / totalRevenue) * 100) : 0,
        surplusMonths: withData.length - deficitMonths.length,
        deficitMonths: deficitMonths.length,
        bestMonth: best?.label ?? null,
        bestSurplus: best?.surplus ?? 0,
        worstMonth: worst?.label ?? null,
        worstSurplus: worst?.surplus ?? 0,
        periodLabel: withData.length ? `${withData[0].label} — ${withData[withData.length - 1].label}` : null,
      },
    };
  },
});
