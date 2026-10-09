import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { PostingLineInput } from "./lib/accounting";
import { audit, periodCode, requireRole, requireUser, roundMoney } from "./lib/authz";

const IMPORT_SOURCES = ["LEGACY_EXCEL", "OPENING_EXCEL"];

/** Baris jurnal import: `accountCode` disimpan agar baris bisa ditulis tanpa query akun. */
type ImportLine = PostingLineInput & { accountCode: string };

function accountTypeFor(code: string) {
  return code.startsWith("1") ? "ASSET" : code.startsWith("2") ? "LIABILITY" : code.startsWith("3") ? "NET_ASSET" : code.startsWith("4") ? "REVENUE" : "EXPENSE";
}

/**
 * Import satu file Excel menyentuh ratusan baris jurnal. Convex membatasi 4096 document
 * read per fungsi, jadi semua tabel yang sering diakses (akun, periode, counter, baris
 * jurnal) dibaca SATU kali lalu disimpan di memori, bukan dicari per baris.
 */
type Caches = {
  accounts: Map<string, any>;
  periods: Set<string>;
  counters: Map<string, { id: any; value: number }>;
};

async function loadCaches(ctx: MutationCtx): Promise<Caches> {
  const accounts = new Map<string, any>();
  for (const account of await ctx.db.query("accounts").collect()) accounts.set(account.code, account);
  const periods = new Set<string>();
  for (const period of await ctx.db.query("periods").collect()) periods.add(period.code);
  const counters = new Map<string, { id: any; value: number }>();
  for (const counter of await ctx.db.query("counters").collect()) counters.set(counter.key, { id: counter._id, value: counter.value });
  return { accounts, periods, counters };
}

async function ensureAccountCached(ctx: MutationCtx, caches: Caches, code: string, name: string, fileName: string) {
  const existing = caches.accounts.get(code);
  if (existing) return existing;
  if (!/^[1-5]-\d{3,4}$/.test(code)) return null;
  const accountType = accountTypeFor(code);
  const createdId = await ctx.db.insert("accounts", {
    code,
    name: name || code,
    accountType: accountType as any,
    normalBalance: (accountType === "ASSET" || accountType === "EXPENSE" ? "DEBIT" : "CREDIT") as any,
    isCash: code.startsWith("1-11"),
    isBank: code.startsWith("1-112"),
    active: true,
    isPostable: true,
    legacySource: fileName,
  });
  const created = await ctx.db.get(createdId);
  if (created) caches.accounts.set(code, created);
  return created;
}

async function ensureUnit(ctx: MutationCtx) {
  const existing = await ctx.db.query("units").withIndex("code", (q) => q.eq("code", "PIAT6")).unique();
  if (existing) return existing._id;
  return await ctx.db.insert("units", { code: "PIAT6", name: "PIAT 6", entityType: "EDUCATION", consolidation: true, active: true, description: "Dibuat otomatis saat import Excel konsolidasi" });
}

async function ensurePeriodCached(ctx: MutationCtx, caches: Caches, date: number) {
  const code = periodCode(date);
  if (caches.periods.has(code)) return code;
  const start = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), 1));
  const end = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth() + 1, 0, 23, 59, 59, 999));
  await ctx.db.insert("periods", { code, name: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(start), startDate: start.getTime(), endDate: end.getTime(), status: "OPEN", checklist: [] });
  caches.periods.add(code);
  return code;
}

function bumpCounter(caches: Caches, key: string) {
  const current = caches.counters.get(key) ?? { id: null, value: 0 };
  current.value += 1;
  caches.counters.set(key, current);
  return current.value;
}

async function flushCounters(ctx: MutationCtx, caches: Caches) {
  for (const [key, counter] of caches.counters) {
    if (counter.id) await ctx.db.patch(counter.id, { value: counter.value });
    else await ctx.db.insert("counters", { key, value: counter.value });
  }
}

/** Posting jurnal tanpa query per baris; akun sudah ada di cache. */
async function bulkPost(
  ctx: MutationCtx,
  input: { date: number; sourceType: string; sourceId: string; description: string; actor: any; unitId: any; lines: ImportLine[]; caches: Caches },
) {
  const period = await ensurePeriodCached(ctx, input.caches, input.date);
  const totalDebit = roundMoney(input.lines.reduce((sum, line) => sum + roundMoney(line.debit), 0));
  const totalCredit = roundMoney(input.lines.reduce((sum, line) => sum + roundMoney(line.credit), 0));
  if (totalDebit !== totalCredit) throw new Error("Jurnal tidak balance: total debit harus sama dengan total kredit.");
  const sequence = bumpCounter(input.caches, `journal:${period}`);
  const journalId = await ctx.db.insert("journalHeaders", {
    journalNumber: `JRN-${period.replace("-", "")}-${String(sequence).padStart(6, "0")}`,
    journalDate: input.date,
    periodCode: period,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    description: input.description,
    status: "POSTED",
    createdBy: input.actor._id,
    postedBy: input.actor._id,
    postedAt: Date.now(),
    totalDebit,
    totalCredit,
    createdAt: Date.now(),
  });
  for (const [index, line] of input.lines.entries()) {
    const account = input.caches.accounts.get((line as any).accountCode) ?? null;
    await ctx.db.insert("journalLines", {
      journalId,
      lineNumber: index + 1,
      accountId: line.accountId,
      accountCode: (account as any)?.code ?? "",
      accountName: (account as any)?.name ?? "",
      accountType: ((account as any)?.accountType ?? "ASSET") as any,
      cashClass: (account as any)?.isCash ? "CASH" : (account as any)?.isBank ? "BANK" : "NONE",
      unitId: line.unitId,
      periodCode: period,
      journalDate: input.date,
      debit: roundMoney(line.debit),
      credit: roundMoney(line.credit),
      description: line.description,
    });
  }
  return journalId;
}

/**
 * Hapus seluruh jurnal hasil import sebelumnya agar hasil import baru selalu deterministik.
 * Baris jurnal ikut dihapus dari snapshot `allLines` yang sudah dibaca sekali di memory.
 */
async function purgeImportedJournals(ctx: MutationCtx, allLines: any[]) {
  let journals = 0;
  let lines = 0;
  const purgedJournalIds = new Set<any>();
  for (const sourceType of IMPORT_SOURCES) {
    const headers = await ctx.db.query("journalHeaders").withIndex("source", (q) => q.eq("sourceType", sourceType)).collect();
    for (const header of headers) purgedJournalIds.add(header._id);
    for (const line of allLines) {
      if (!purgedJournalIds.has(line.journalId)) continue;
      await ctx.db.delete(line._id);
      lines++;
    }
    for (const header of headers) {
      await ctx.db.delete(header._id);
      journals++;
    }
    for (const transaction of await ctx.db.query("transactions").withIndex("source", (q) => q.eq("sourceType", sourceType)).collect()) {
      await ctx.db.delete(transaction._id);
    }
  }
  return { journals, lines, purgedJournalIds };
}

export const listImportBatches = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "AUDITOR"]);
    return await ctx.db.query("importBatches").withIndex("createdAt").order("desc").collect();
  },
});

export const legacyStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const legacy = await ctx.db.query("journalHeaders").withIndex("source", (q) => q.eq("sourceType", "LEGACY_EXCEL")).collect();
    const opening = await ctx.db.query("journalHeaders").withIndex("source", (q) => q.eq("sourceType", "OPENING_EXCEL")).collect();
    return {
      legacyJournalCount: legacy.length,
      legacyAmount: roundMoney(legacy.reduce((sum, header) => sum + header.totalDebit, 0)),
      openingJournalCount: opening.length,
      openingDates: opening.map((header) => header.journalDate),
    };
  },
});

/**
 * Import satu file Excel tanpa memilih mode: COA, jurnal historis (CR/CD/JM), dan saldo
 * awal dari Neraca (BS) sekaligus. Jurnal hasil import sebelumnya otomatis diganti, dan
 * saldo awal dihitung sebagai selisih Neraca terhadap jurnal yang sudah masuk supaya
 * posisi akhir setiap akun sama persis dengan Excel.
 */
export const importWorkbook = mutation({
  args: {
    fileName: v.string(),
    checksum: v.string(),
    coa: v.array(v.any()),
    opening: v.array(v.any()),
    journals: v.optional(v.array(v.any())),
    trend: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const openingRows = args.opening.filter((row: any) => row?.accountCode && Number.isFinite(Number(row.amount)));
    if (openingRows.length === 0) throw new Error("Sheet Neraca (BS) tidak memiliki saldo akun yang bisa dibaca.");
    const journalRows = args.journals ?? [];

    // Tabel besar dibaca satu kali, lalu dipakai dari memori (lihat catatan loadCaches).
    const caches = await loadCaches(ctx);
    const allLines = await ctx.db.query("journalLines").collect();
    const purged = await purgeImportedJournals(ctx, allLines);
    const unitId = await ensureUnit(ctx);

    // Movement = seluruh baris jurnal yang TIDAK ikut terhapus, ditambah jurnal baru di bawah.
    const movement = new Map<string, number>();
    for (const line of allLines) {
      if (purged.purgedJournalIds.has(line.journalId)) continue;
      movement.set(line.accountId, roundMoney((movement.get(line.accountId) ?? 0) + line.debit - line.credit));
    }

    // 1. Chart of Accounts
    let accounts = 0;
    for (const row of args.coa) {
      if (!row?.code || !row?.name || !row?.accountType) continue;
      const existing = caches.accounts.get(String(row.code));
      const values = {
        code: String(row.code),
        name: String(row.name),
        accountType: row.accountType as "ASSET" | "LIABILITY" | "NET_ASSET" | "REVENUE" | "EXPENSE",
        normalBalance: (row.accountType === "ASSET" || row.accountType === "EXPENSE" ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
        isCash: row.isCash === true,
        isBank: row.isBank === true,
        active: true,
        isPostable: row.isPostable !== false,
        legacySource: args.fileName,
      };
      if (existing) {
        // Lewati patch bila tidak ada perubahan: menghemat ratusan write pada import ulang.
        const changed = (Object.keys(values) as (keyof typeof values)[]).some((key) => (existing as any)[key] !== (values as any)[key]);
        if (changed) {
          await ctx.db.patch(existing._id, values);
          caches.accounts.set(String(row.code), { ...existing, ...values, _id: existing._id });
        }
      } else {
        const createdId = await ctx.db.insert("accounts", values);
        const created = await ctx.db.get(createdId);
        if (created) caches.accounts.set(String(row.code), created);
      }
      accounts++;
    }

    // 2. Jurnal historis
    let journals = 0;
    let journalSkipped = 0;
    for (const row of journalRows) {
      if (!row?.date || !Array.isArray(row.lines) || row.lines.length < 2) continue;
      const date = new Date(String(row.date)).getTime();
      if (!Number.isFinite(date)) continue;
      const totalDebit = roundMoney(row.lines.reduce((sum: number, line: any) => sum + Number(line.debit ?? 0), 0));
      const totalCredit = roundMoney(row.lines.reduce((sum: number, line: any) => sum + Number(line.credit ?? 0), 0));
      if (totalDebit <= 0 || totalDebit !== totalCredit) {
        journalSkipped++;
        continue;
      }
      await ensurePeriodCached(ctx, caches, date);
      const journalSourceId = String(row.sourceId ?? `${args.checksum}-${journals}`);
      {
        const resolvedLines: ImportLine[] = [];
        for (const line of row.lines) {
          const account = await ensureAccountCached(ctx, caches, String(line.accountCode), String(line.description ?? line.accountCode), args.fileName);
          if (!account) continue;
          resolvedLines.push({ accountId: account._id as any, accountCode: String(line.accountCode), unitId, debit: Number(line.debit ?? 0), credit: Number(line.credit ?? 0), description: String(line.description ?? "Impor jurnal PIAT 6") });
        }
        if (resolvedLines.length < 2) {
          journalSkipped++;
          continue;
        }
        const journalId = await bulkPost(ctx, { date, sourceType: "LEGACY_EXCEL", sourceId: journalSourceId, description: String(row.description ?? "Impor jurnal PIAT 6"), actor, unitId, lines: resolvedLines, caches });
        for (const line of resolvedLines) movement.set(line.accountId, roundMoney((movement.get(line.accountId) ?? 0) + line.debit - line.credit));
        const sequence = bumpCounter(caches, `import:${args.fileName}`);
        await ctx.db.insert("transactions", { number: String(row.number ?? `IMP-${sequence}`), transactionType: "LEGACY_IMPORT", transactionDate: date, periodCode: periodCode(date), unitId, amount: totalDebit, description: String(row.description ?? "Impor jurnal PIAT 6"), status: "POSTED", journalId, sourceType: "LEGACY_EXCEL", sourceId: journalSourceId, createdBy: actor._id, postedBy: actor._id, postedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
      }
      journals++;
    }

    // 3. Saldo awal dari Neraca (diletakkan di akhir periode sebelumnya agar arus periode tidak tercampur)
    const asOf = Number(openingRows[0].referenceDate ?? Date.UTC(2026, 5, 30, 23, 59, 59, 999));
    const asOfLabel = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(asOf));
    const openingDate = Date.UTC(new Date(asOf).getUTCFullYear(), new Date(asOf).getUTCMonth(), 1) - 1;
    await ensurePeriodCached(ctx, caches, asOf);
    await ensurePeriodCached(ctx, caches, openingDate);
    const sourceId = `BS:${new Date(asOf).toISOString().slice(0, 10)}`;
    const openingLines: ImportLine[] = [];
    for (const row of openingRows) {
      const account = await ensureAccountCached(ctx, caches, String(row.accountCode), String(row.accountName ?? row.accountCode), args.fileName);
      if (!account) continue;
      const opening = roundMoney(roundMoney(Number(row.amount)) - (movement.get(account._id) ?? 0));
      if (Math.abs(opening) < 0.01) continue;
      openingLines.push({ accountId: account._id as any, accountCode: String(row.accountCode), unitId, debit: opening > 0 ? opening : 0, credit: opening < 0 ? -opening : 0, description: `Saldo awal per ${asOfLabel}` });
    }
    const totalDebit = roundMoney(openingLines.reduce((sum, line) => sum + line.debit, 0));
    const residual = roundMoney(totalDebit - roundMoney(openingLines.reduce((sum, line) => sum + line.credit, 0)));
    if (Math.abs(residual) >= 0.01) {
      const equity = await ensureAccountCached(ctx, caches, "3-1199", "Surplus/Defisit Periode Berjalan", args.fileName);
      if (!equity) throw new Error("Akun penyimbang 3-1199 tidak dapat dibuat.");
      openingLines.push({ accountId: equity._id as any, accountCode: "3-1199", unitId, debit: residual < 0 ? -residual : 0, credit: residual > 0 ? residual : 0, description: "Penyeimbang hasil periode sebelum snapshot" });
    }
    if (openingLines.length < 2) throw new Error("Snapshot saldo awal tidak menghasilkan jurnal yang balance.");
    const openingJournalId = await bulkPost(ctx, {
      date: openingDate,
      sourceType: "OPENING_EXCEL",
      sourceId,
      description: `Saldo awal PIAT 6 per ${asOfLabel} (Neraca)`,
      actor,
      unitId,
      lines: openingLines,
      caches,
    });
    bumpCounter(caches, `import:${args.fileName}`);
    await ctx.db.insert("transactions", { number: `OPENING-${periodCode(asOf).replace("-", "")}`, transactionType: "OPENING_BALANCE", transactionDate: openingDate, periodCode: periodCode(openingDate), unitId, amount: totalDebit, description: `Saldo awal PIAT 6 per ${asOfLabel} (Neraca)`, status: "POSTED", journalId: openingJournalId, sourceType: "OPENING_EXCEL", sourceId, createdBy: actor._id, postedBy: actor._id, postedAt: Date.now(), createdAt: Date.now(), updatedAt: Date.now() });
    const snapshotDate = Date.UTC(new Date(asOf).getUTCFullYear(), new Date(asOf).getUTCMonth(), new Date(asOf).getUTCDate());
    const snapshots = new Map<string, any>();
    for (const snapshot of await ctx.db.query("legacySnapshots").collect()) snapshots.set(`${snapshot.sourceSheet}:${snapshot.accountCode}`, snapshot);
    for (const row of openingRows) {
      const values = { sourceFile: args.fileName, sourceSheet: "BS", referenceDate: snapshotDate, accountCode: String(row.accountCode), accountName: String(row.accountName ?? row.accountCode), amount: roundMoney(Number(row.amount)), checksum: args.checksum };
      const existing = snapshots.get(`BS:${String(row.accountCode)}`);
      if (existing) await ctx.db.patch(existing._id, values);
      else await ctx.db.insert("legacySnapshots", values);
    }

    // 4. Tren surplus/defisit bulanan dari sheet Grafik
    for (const row of await ctx.db.query("financialTrend").collect()) await ctx.db.delete(row._id);
    const trendRows = (args.trend ?? []).filter((row: any) => row?.monthKey && Number.isFinite(Number(row.surplus)));
    for (const row of trendRows) {
      const [year, month] = String(row.monthKey).split("-").map(Number);
      if (!year || !month) continue;
      await ctx.db.insert("financialTrend", { sourceFile: args.fileName, checksum: args.checksum, monthKey: String(row.monthKey), label: String(row.label ?? row.monthKey), revenue: roundMoney(Number(row.revenue ?? 0)), expense: roundMoney(Number(row.expense ?? 0)), surplus: roundMoney(Number(row.surplus)), referenceDate: Date.UTC(year, month - 1, 1) });
    }

    const batchId = await ctx.db.insert("importBatches", { fileName: args.fileName, checksum: args.checksum, mode: "FULL", status: "IMPORTED", totalRows: openingRows.length + journalRows.length, importedRows: accounts + journals + openingLines.length, errorCount: 0, report: { accounts, journals, journalSkipped, openingRows: openingRows.length, trendRows: trendRows.length, referenceDate: asOf, openingDate, replacedJournals: purged.journals }, createdBy: actor._id, createdAt: Date.now(), completedAt: Date.now() });
    await flushCounters(ctx, caches);
    await audit(ctx, { entityType: "importBatches", entityId: batchId, action: "IMPORT_WORKBOOK", actor, after: { accounts, journals, journalSkipped, openingRows: openingRows.length, trendRows: trendRows.length, replacedJournals: purged.journals } });
    return { accounts, journals, journalSkipped, openingRows: openingRows.length, openingLines: openingLines.length, trendRows: trendRows.length, referenceDate: asOf, asOfLabel, replacedJournals: purged.journals, totalDebit, batchId };
  },
});

export const purgeLegacyJournals = mutation({
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN"]);
    if (args.confirmation.trim().toUpperCase() !== "HAPUS JURNAL LEGACY") throw new Error("Ketik HAPUS JURNAL LEGACY untuk mengonfirmasi.");
    const purged = await purgeImportedJournals(ctx, await ctx.db.query("journalLines").collect());
    await audit(ctx, { entityType: "journalHeaders", entityId: "IMPORT_SOURCES", action: "PURGE_IMPORTED_JOURNALS", actor, after: purged });
    return { journals: purged.journals, lines: purged.lines };
  },
});
