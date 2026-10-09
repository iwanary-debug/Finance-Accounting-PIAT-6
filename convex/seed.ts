import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireRole, requireUser } from "./lib/authz";

type SeedAccount = {
  code: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "NET_ASSET" | "REVENUE" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  isCash?: boolean;
  isBank?: boolean;
  isPostable?: boolean;
  description?: string;
  legacySource?: string;
};

const accounts: SeedAccount[] = [
  { code: "1-0000", name: "ASET", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1000", name: "ASET LANCAR", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1100", name: "KAS DAN SETARA KAS", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1111", name: "Kas Tunai", accountType: "ASSET", normalBalance: "DEBIT", isCash: true },
  { code: "1-1112", name: "Tabungan Santri", accountType: "ASSET", normalBalance: "DEBIT", isCash: true },
  { code: "1-1114", name: "Petty Cash BOS MTS", accountType: "ASSET", normalBalance: "DEBIT", isCash: true },
  { code: "1-1115", name: "Petty Cash BOS MA", accountType: "ASSET", normalBalance: "DEBIT", isCash: true },
  { code: "1-1121", name: "Giro Bank Muamalat Indonesia", accountType: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1-1122", name: "Bank Muamalat Indonesia (BMI)", accountType: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1-1123", name: "Bank Muamalat Indonesia Yayasan", accountType: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1-1124", name: "Bank Syariah Indonesia - BSI", accountType: "ASSET", normalBalance: "DEBIT", isBank: true },
  { code: "1-1300", name: "PIUTANG AKTIVITAS", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1312", name: "Piutang Santri - MTS", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1313", name: "Piutang Santri - MA", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1314", name: "Piutang Santri - IL", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1370", name: "Piutang Usaha Pelengkap", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1400", name: "PIUTANG LAIN-LAIN", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1411", name: "Piutang Pinjaman Pegawai", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1500", name: "PERSEDIAAN", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1511", name: "Persediaan Buku", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1512", name: "Persediaan Seragam", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1522", name: "Persediaan Obat", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1531", name: "Persediaan Beras", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1534", name: "Persediaan Lauk", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1551", name: "Persediaan Perlengkapan Asrama", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1600", name: "UANG MUKA", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1654", name: "Uang Muka Perlengkapan", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1699", name: "Uang Muka Lain-lain", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1700", name: "BEBAN DIBAYAR DIMUKA", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-1713", name: "Beban Dibayar Dimuka Sewa", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2000", name: "ASET TIDAK LANCAR", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2310", name: "Tanah dan Bangunan", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2311", name: "Tanah", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2321", name: "Infrastruktur - Jalan", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2331", name: "Peralatan Komputer dan Audio Visual", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2341", name: "Perabot Meja dan Kursi", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2351", name: "Kendaraan - Mobil", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1-2400", name: "AKUMULASI PENYUSUTAN ASET TETAP", accountType: "ASSET", normalBalance: "CREDIT" },
  { code: "1-2401", name: "Akumulasi Penyusutan", accountType: "ASSET", normalBalance: "CREDIT" },
  { code: "1-2900", name: "ASET LAIN-LAIN", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "2-0000", name: "KEWAJIBAN", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1100", name: "HUTANG PENDIDIKAN", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1111", name: "Hutang Buku PIAT Pusat", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1200", name: "DANA TITIPAN", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1211", name: "Tabungan Santri", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1212", name: "Titipan SPP Santri", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1300", name: "HUTANG LAIN-LAIN", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1311", name: "Hutang Gaji Pegawai", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1330", name: "Hutang Usaha Pelengkap", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1352", name: "Hutang PIAT Pusat", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1390", name: "Hutang Pihak Lain", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1600", name: "PENDAPATAN DITERIMA DIMUKA", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1630", name: "Uang Pendaftaran Diterima Dimuka", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1700", name: "BIAYA MASIH HARUS DIBAYAR", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2-1710", name: "Beban Gaji dan Lembur", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "3-0000", name: "ASET BERSIH", accountType: "NET_ASSET", normalBalance: "CREDIT" },
  { code: "3-1100", name: "Aset Bersih Tidak Terikat", accountType: "NET_ASSET", normalBalance: "CREDIT" },
  { code: "3-2000", name: "Aset Bersih Terikat Temporer", accountType: "NET_ASSET", normalBalance: "CREDIT" },
  { code: "3-4000", name: "Aset Bersih Terikat Permanen", accountType: "NET_ASSET", normalBalance: "CREDIT" },
  { code: "4-0000", name: "PENDAPATAN DAN KEUNTUNGAN", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-1111", name: "Pendapatan Pendidikan PIAT 6", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-1211", name: "Pendapatan Pendidikan MTS", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-1311", name: "Pendapatan Pendidikan MA dan IL", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-2110", name: "Sumbangan dan Bantuan", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-4000", name: "Penjualan dan Layanan 6Mart", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4-9000", name: "Pendapatan Lain-lain", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "5-0000", name: "BEBAN DAN KERUGIAN", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-5000", name: "Beban Operasional Pendidikan", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-5411", name: "Gaji Pegawai Tetap", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-5396", name: "Administrasi Bank", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-5551", name: "Beban BBM", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-6432", name: "Beban Listrik", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-7000", name: "Beban Usaha 6Mart", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-9000", name: "Beban Lain-lain", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-9338", name: "Perlengkapan Kantor", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5-9161", name: "Konsumsi", accountType: "EXPENSE", normalBalance: "DEBIT" },
];

const mappings = [
  { code: "RECEIPT_SPP", name: "Penerimaan Pembayaran SPP", category: "RECEIPT" as const, lines: [{ side: "DEBIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Penerimaan kas SPP" }, { side: "CREDIT" as const, accountCode: "RECEIVABLE_UNIT", amountMode: "AMOUNT" as const, description: "Pengurangan piutang pendidikan" }] },
  { code: "RECEIPT_REGISTRATION", name: "Penerimaan Uang Pendaftaran", category: "RECEIPT" as const, lines: [{ side: "DEBIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Penerimaan pendaftaran" }, { side: "CREDIT" as const, accountCode: "2-1630", amountMode: "AMOUNT" as const, description: "Pendapatan diterima dimuka" }] },
  { code: "RECEIPT_CONTRIBUTION", name: "Penerimaan Sumbangan dan Bantuan", category: "RECEIPT" as const, lines: [{ side: "DEBIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Penerimaan sumbangan" }, { side: "CREDIT" as const, accountCode: "4-2110", amountMode: "AMOUNT" as const, description: "Pendapatan sumbangan" }] },
  { code: "RECEIPT_OTHER", name: "Penerimaan Lain-lain", category: "RECEIPT" as const, lines: [{ side: "DEBIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Penerimaan lain-lain" }, { side: "CREDIT" as const, accountCode: "4-9000", amountMode: "AMOUNT" as const, description: "Pendapatan lain-lain" }] },
  { code: "SALE_6MART", name: "Penjualan 6Mart", category: "SALE" as const, lines: [{ side: "DEBIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Penjualan 6Mart" }, { side: "CREDIT" as const, accountCode: "4-4000", amountMode: "AMOUNT" as const, description: "Pendapatan penjualan" }] },
  { code: "DISBURSE_EXPENSE", name: "Pembayaran Beban Operasional", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "EXPENSE_UNIT", amountMode: "AMOUNT" as const, description: "Pembayaran beban" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "DISBURSE_PAYROLL", name: "Pembayaran Gaji", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "5-5411", amountMode: "AMOUNT" as const, description: "Pembayaran gaji" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "DISBURSE_OFFICE", name: "Pembelian ATK", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "5-9338", amountMode: "AMOUNT" as const, description: "Pembelian perlengkapan kantor" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "DISBURSE_FUEL", name: "Pembayaran BBM", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "5-5551", amountMode: "AMOUNT" as const, description: "Pembayaran BBM" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "DISBURSE_ELECTRICITY", name: "Pembayaran Listrik", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "5-6432", amountMode: "AMOUNT" as const, description: "Pembayaran listrik" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "DISBURSE_6MART", name: "Pengeluaran Usaha 6Mart", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "5-7000", amountMode: "AMOUNT" as const, description: "Beban usaha 6Mart" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pengeluaran kas" }] },
  { code: "TRANSFER_CASH", name: "Transfer Antar Kas dan Bank", category: "TRANSFER" as const, lines: [{ side: "DEBIT" as const, accountCode: "TO_CASH", amountMode: "AMOUNT" as const, description: "Dana masuk rekening tujuan" }, { side: "CREDIT" as const, accountCode: "FROM_CASH", amountMode: "AMOUNT" as const, description: "Dana keluar rekening sumber" }] },
  { code: "PAYMENT_PAYABLE", name: "Pembayaran Hutang", category: "PAYABLE" as const, lines: [{ side: "DEBIT" as const, accountCode: "PAYABLE_UNIT", amountMode: "AMOUNT" as const, description: "Pembayaran hutang" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pembayaran dari kas" }] },
  { code: "ASSET_PURCHASE", name: "Pembelian Aset Tetap", category: "DISBURSEMENT" as const, lines: [{ side: "DEBIT" as const, accountCode: "1-2310", amountMode: "AMOUNT" as const, description: "Perolehan aset tetap" }, { side: "CREDIT" as const, accountCode: "CASH", amountMode: "AMOUNT" as const, description: "Pembayaran aset tetap" }] },
  { code: "REVENUE_RECOGNITION", name: "Pengakuan Pendapatan SPP", category: "RECEIVABLE" as const, lines: [{ side: "DEBIT" as const, accountCode: "RECEIVABLE_UNIT", amountMode: "AMOUNT" as const, description: "Pengakuan piutang pendidikan" }, { side: "CREDIT" as const, accountCode: "REVENUE_UNIT", amountMode: "AMOUNT" as const, description: "Pengakuan pendapatan" }] },
];

const legacySummary = [
  ["NRC", "1-1100", "Kas dan setara kas", 3128425760.58],
  ["NRC", "1-1300", "Piutang aktivitas", 987851350],
  ["NRC", "1-1400", "Piutang lain-lain", 78023803.5],
  ["NRC", "1-1500", "Persediaan", 206952262],
  ["NRC", "1-1600", "Uang muka", 32400000],
  ["NRC", "1-1700", "Beban dibayar dimuka", 9166665.66],
  ["NRC", "1-2000", "Aset tidak lancar", 19265955475.51],
  ["NRC", "2-1100", "Hutang pendidikan", 127867575],
  ["NRC", "2-1200", "Hutang titipan", 434150828],
  ["NRC", "2-1300", "Hutang lain-lain", 370022227],
  ["NRC", "2-1600", "Pendapatan diterima dimuka", 783200000],
  ["NRC", "2-1700", "Biaya masih harus dibayar", 246688431.33],
  ["NRC", "3-1100", "Aset bersih tidak terikat", 14971138668.16],
  ["NRC", "3-2000", "Aset bersih terikat temporer", 337644500],
  ["NRC", "3-4000", "Aset bersih terikat permanen", 6438063087],
] as const;

export const ensureCoreData = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN"]);
    const existing = await ctx.db.query("units").first();
    if (existing) return { initialized: true, alreadyInitialized: true };

    const unitIds = new Map<string, any>();
    for (const unit of [
      { code: "PIAT6", name: "PIAT 6", entityType: "EDUCATION" as const },
      { code: "SDITQ", name: "SDITQ", entityType: "EDUCATION" as const, parent: "PIAT6" },
      { code: "MTS", name: "MTs Al-Irsyad Tengaran", entityType: "MTS" as const, parent: "PIAT6" },
      { code: "MA", name: "MA Al-Irsyad Tengaran", entityType: "MA" as const, parent: "PIAT6" },
      { code: "IL", name: "Ilmu Lanjutan (IL)", entityType: "OTHER" as const, parent: "PIAT6" },
      { code: "6MART", name: "6Mart", entityType: "BUSINESS" as const },
      { code: "YAYASAN", name: "Yayasan An Nawawi Bondowoso", entityType: "YAYASAN" as const },
    ]) {
      const id = await ctx.db.insert("units", { ...unit, parentUnitId: unit.parent ? unitIds.get(unit.parent) : undefined, consolidation: true, active: true });
      unitIds.set(unit.code, id);
    }

    const accountIds = new Map<string, any>();
    for (const account of accounts) {
      const id = await ctx.db.insert("accounts", {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        unitId: account.code.startsWith("6") ? unitIds.get("6MART") : undefined,
        isCash: account.isCash ?? false,
        isBank: account.isBank ?? false,
        active: true,
        isPostable: account.isPostable ?? true,
        description: account.description,
        legacySource: account.legacySource ?? "LK PIAT6_0626_Konsol.xlsx",
      });
      accountIds.set(account.code, id);
    }

    const education = unitIds.get("PIAT6")!;
    for (const [code, name, kind, bankName] of [
      ["1-1111", "Kas Operasional", "CASH", undefined],
      ["1-1114", "Petty Cash BOS MTS", "CASH", undefined],
      ["1-1115", "Petty Cash BOS MA", "CASH", undefined],
      ["1-1121", "Giro BMI", "BANK", "Bank Muamalat Indonesia"],
      ["1-1122", "Operasi BMI", "BANK", "Bank Muamalat Indonesia"],
      ["1-1123", "Operasi BMI Yayasan", "BANK", "Bank Muamalat Indonesia"],
      ["1-1124", "Operasi BSI", "BANK", "Bank Syariah Indonesia"],
    ] as const) {
      await ctx.db.insert("cashAccounts", { accountId: accountIds.get(code)!, unitId: education, name, kind, bankName, currency: "IDR", active: true });
    }

    for (const mapping of mappings) {
      await ctx.db.insert("accountMappings", { code: mapping.code, name: mapping.name, category: mapping.category, templateLines: mapping.lines, active: true, description: "Baseline mapping dari workbook PIAT 6" });
    }

    const now = new Date();
    const currentCode = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!(await ctx.db.query("periods").withIndex("code", (q) => q.eq("code", currentCode)).unique())) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      await ctx.db.insert("periods", { code: currentCode, name: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(start), startDate: start.getTime(), endDate: end.getTime(), status: "OPEN", checklist: [
        { item: "Rekonsiliasi bank dan kas selesai", completed: false },
        { item: "Seluruh transaksi telah diposting", completed: false },
        { item: "Piutang dan hutang telah ditinjau", completed: false },
        { item: "Neraca saldo seimbang", completed: false },
      ] });
    }
    for (const [sourceSheet, accountCode, accountName, amount] of legacySummary) {
      await ctx.db.insert("legacySnapshots", { sourceFile: "1. LK PIAT6_0626_Konsol.xlsx", sourceSheet, referenceDate: Date.UTC(2026, 5, 30), accountCode, accountName, amount, checksum: "LEGACY-JUNE-2026-V1" });
    }
    await audit(ctx, { entityType: "system", entityId: "core-data", action: "INITIALIZE", actor, after: { accounts: accounts.length, units: unitIds.size, mappings: mappings.length, legacySnapshots: legacySummary.length } });
    return { initialized: true, alreadyInitialized: false, accounts: accounts.length, units: unitIds.size, mappings: mappings.length };
  },
});

export const setupStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const accounts = await ctx.db.query("accounts").collect();
    const snapshots = await ctx.db.query("legacySnapshots").collect();
    return { initialized: accounts.length > 0, accountCount: accounts.length, legacySnapshotCount: snapshots.length };
  },
});

export const importPreview = mutation({
  args: { fileName: v.string(), checksum: v.string(), mode: v.string(), totalRows: v.number(), report: v.any() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const id = await ctx.db.insert("importBatches", { ...args, status: "PREVIEWED", importedRows: 0, errorCount: Array.isArray(args.report?.errors) ? args.report.errors.length : 0, createdBy: actor._id, createdAt: Date.now() });
    await audit(ctx, { entityType: "importBatches", entityId: id, action: "PREVIEW", actor, after: args });
    return id;
  },
});

export const validateImport = mutation({
  args: { batchId: v.id("importBatches") },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.createdBy !== actor._id && actor.appRole !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
    const errors = Array.isArray(batch.report?.errors) ? batch.report.errors : [];
    await ctx.db.patch(batch._id, { status: errors.length ? "FAILED" : "VALIDATED" });
    await audit(ctx, { entityType: "importBatches", entityId: batch._id, action: "VALIDATE", actor, before: batch, after: { valid: errors.length === 0, errors: errors.length } });
    return { valid: errors.length === 0, errorCount: errors.length };
  },
});
