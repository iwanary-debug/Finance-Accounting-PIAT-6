import { roundMoney } from "./authz";

export type BreakdownLine = { accountCode: string; accountName: string; debit: number; credit: number };
export type BreakdownItem = { accountCode: string; accountName: string; label: string; amount: number };
export type BreakdownGroup = { key: string; label: string; total: number; items: BreakdownItem[] };
export type BreakdownHighlight = { label: string; value: number };

type Rule = { key: string; label: string; test: RegExp };
type CardDef = { title: string; scope: RegExp; rules: Rule[]; sign: "debit" | "credit"; labels: { label: string; test: RegExp }[] };

/** Label bisnis untuk kas & setara kas (dipakai user saat membuka rincian). */
const CASH_LABELS: Record<string, string> = {
  "1-1111": "Uang Cash Bendahara",
  "1-1112": "Tabungan Santri (Saving Student)",
  "1-1113": "Dana BOS SDITQ",
  "1-1114": "Dana BOS MTS",
  "1-1115": "Dana BOS MA",
  "1-1116": "Dana Belum Disetor (Undeposited Funds)",
  "1-1117": "Electronic Clearing Account",
  "1-1118": "Kas Maksof / Unit Usaha",
  "1-1119": "Dana Cadangan (Petty Cash Lainnya)",
  "1-1121": "Giro Bank Muamalat Indonesia",
  "1-1122": "Tabungan Bank Muamalat Indonesia (BMI)",
  "1-1123": "Dana Yayasan (Tabungan BMI Yayasan)",
  "1-1124": "Bank Syariah Indonesia (BSI)",
  "1-1125": "Bank Muamalat III",
  "1-1126": "Bank Tabungan Negara",
  "1-1127": "Bank CIMB Niaga",
  "1-1128": "Bank Jateng SDITQ",
  "1-1129": "BRI - MTS",
  "1-1131": "BRI - MA",
  "1-1133": "Mandiri BOS MA",
  "1-1134": "Bank Jateng Syariah",
  "1-1139": "Bank Lainnya (Other Education Bank)",
  "1-1151": "Cheque Account",
  "1-1152": "Dana Belum Disetor (Besar)",
  "1-1153": "Electronic Clearing Account (Besar)",
};

const RECEIVABLE_LABELS: Record<string, string> = {
  "1-1312": "Piutang Siswa MTS",
  "1-1313": "Piutang Siswa MA",
  "1-1314": "Piutang Siswa IL",
  "1-1331": "Piutang Siswa Eks",
  "1-1411": "Pinjaman Karyawan",
  "1-1420": "Piutang Lainnya Santri",
  "1-1497": "Operasional Yayasan",
};

const INVENTORY_LABELS: Record<string, string> = {
  "1-1511": "Persediaan Buku",
  "1-1512": "Persediaan Seragam",
  "1-1551": "Perlengkapan Tidur",
};

const ASSET_LABELS: Record<string, string> = {
  "1-2311": "Tanah",
  "1-2391": "Konstruksi Berjalan (Bangunan)",
  "1-1654": "Uang Muka Perabot & Fixture",
  "1-1699": "Uang Muka Lainnya",
  "1-1713": "Biaya Dibayar — Sewa Rumah",
  "1-2412": "Akum. Penyusutan Bangunan Kelas & Kantor",
  "1-2413": "Akum. Penyusutan Bangunan Asrama",
  "1-2414": "Akum. Penyusutan Bangunan Housng",
  "1-2415": "Akum. Penyusutan Bangunan Masjid",
  "1-2418": "Akum. Penyusutan Dapur & Laundry",
  "1-2419": "Akum. Penyusutan Bangunan Lainnya",
};

function friendlyLabel(labelMap: Record<string, string>, line: BreakdownLine) {
  return labelMap[line.accountCode] ?? line.accountName;
}

/** Label ramah per kartu, ditumpuk per kode akun. */
export const CARD_ITEM_LABELS: Record<string, Record<string, string>> = {
  cash: CASH_LABELS,
  receivables: RECEIVABLE_LABELS,
  inventory: INVENTORY_LABELS,
  fixedAssets: ASSET_LABELS,
  otherAssets: ASSET_LABELS,
};

export const CARD_DEFS: Record<string, CardDef> = {
  cash: {
    title: "Kas & Setara Kas",
    scope: /^1-11/,
    sign: "debit",
    rules: [
      { key: "yayasan", label: "Uang Yayasan", test: /^1-1123$/ },
      { key: "bank", label: "Kas di Bank (Giro & Tabungan Syariah)", test: /^1-11(2|3|5)/ },
      { key: "onhand", label: "Kas di Tangan (Uang Cash)", test: /^1-111[1267]$/ },
      { key: "bos", label: "Dana BOS (Bantuan Operasional Sekolah)", test: /^1-111[345]$/ },
      { key: "reserve", label: "Dana Cadangan & Kas Unit Usaha", test: /^1-111[89]$/ },
    ],
    labels: [
      { label: "Kas di Bank", test: /^1-11(2|3|5)/ },
      { label: "Kas di Tangan", test: /^1-111/ },
    ],
  },
  receivables: {
    title: "Total Piutang",
    scope: /^1-1[34]/,
    sign: "debit",
    rules: [
      { key: "students", label: "Piutang Siswa & Iuran", test: /^1-131/ },
      { key: "sponsor", label: "Piutang Sponsor", test: /^1-132/ },
      { key: "exit", label: "Piutang Siswa Eks", test: /^1-133/ },
      { key: "doubtful", label: "Piutang Posing & Penyisihan", test: /^1-13[45]/ },
      { key: "contribution", label: "Piutang Kontribusi", test: /^1-136/ },
      { key: "business", label: "Piutang Unit Usaha", test: /^1-137/ },
      { key: "otherActivity", label: "Piutang Kegiatan Lainnya", test: /^1-139/ },
      { key: "other", label: "Piutang Lainnya (Other Receivable)", test: /^1-14/ },
    ],
    labels: [
      { label: "Piutang Kegiatan", test: /^1-13/ },
      { label: "Piutang Lainnya", test: /^1-14/ },
    ],
  },
  inventory: {
    title: "Persediaan",
    scope: /^1-15/,
    sign: "debit",
    rules: [
      { key: "books", label: "Persediaan Buku", test: /^1-151/ },
      { key: "uniform", label: "Persediaan Seragam", test: /^1-152/ },
      { key: "bedding", label: "Perlengkapan Tidur", test: /^1-15[3-5]/ },
    ],
    labels: [{ label: "Nilai Persediaan", test: /^1-15/ }],
  },
  fixedAssets: {
    title: "Aset Tetap",
    scope: /^1-2/,
    sign: "debit",
    rules: [
      { key: "land", label: "Tanah", test: /^1-231/ },
      { key: "building", label: "Bangunan", test: /^1-232/ },
      { key: "equipment", label: "Peralatan & Mesin", test: /^1-233/ },
      { key: "furniture", label: "Perabot & Fixture", test: /^1-234/ },
      { key: "vehicle", label: "Kendaraan", test: /^1-235/ },
      { key: "cip", label: "Konstruksi Berjalan", test: /^1-239/ },
      { key: "depreciation", label: "Akumulasi Penyusutan", test: /^1-24/ },
      { key: "deferred", label: "Biaya Ditangguhkan", test: /^1-27/ },
    ],
    labels: [
      { label: "Nilai Perolehan", test: /^1-23/ },
      { label: "Akumulasi Penyusutan", test: /^1-24/ },
    ],
  },
  otherAssets: {
    title: "Aset Lainnya",
    scope: /^1-1[6-9]/,
    sign: "debit",
    rules: [
      { key: "advance", label: "Uang Muka", test: /^1-16/ },
      { key: "prepaid", label: "Biaya Dibayar", test: /^1-17/ },
      { key: "other", label: "Aset Lancar Lainnya", test: /^1-1[89]/ },
    ],
    labels: [{ label: "Uang Muka & Biaya Dibayar", test: /^1-1[6-9]/ }],
  },
  liabilities: {
    title: "Kewajiban",
    scope: /^2-/,
    sign: "credit",
    rules: [
      { key: "payable", label: "Utang Usaha & Servicios", test: /^2-11/ },
      { key: "deposit", label: "Utang Santri, Tabungan & Deposit", test: /^2-12/ },
      { key: "service", label: "Utang Gaji & Layanan PIAT Pusat", test: /^2-13/ },
      { key: "other", label: "Kewajiban Lainnya", test: /^2-/ },
    ],
    labels: [
      { label: "Utang Usaha", test: /^2-11/ },
      { label: "Utang Santri & Deposit", test: /^2-12/ },
    ],
  },
  equity: {
    title: "Ekuitas",
    scope: /^3-/,
    sign: "credit",
    rules: [
      { key: "capital", label: "Modal & Ekuitas Awal", test: /^3-1/ },
      { key: "previous", label: "Pendapatan Tahun Sebelumnya", test: /^3-2/ },
      { key: "current", label: "Pendapatan Tahun Berjalan", test: /^3-3/ },
      { key: "release", label: "Pelepasan Pendapatan / Beban", test: /^3-5/ },
    ],
    labels: [
      { label: "Modal & Ekuitas Awal", test: /^3-1/ },
      { label: "Hasil Tahun Berjalan", test: /^3-[23]/ },
    ],
  },
  totalAssets: {
    title: "Total Aset",
    scope: /^1-/,
    sign: "debit",
    rules: [
      { key: "cash", label: "Kas & Setara Kas", test: /^1-11/ },
      { key: "receivables", label: "Piutang", test: /^1-1[34]/ },
      { key: "inventory", label: "Persediaan", test: /^1-15/ },
      { key: "fixedAssets", label: "Aset Tetap", test: /^1-2/ },
      { key: "otherAssets", label: "Aset Lainnya", test: /^1-1[6-9]/ },
    ],
    labels: [
      { label: "Aset Lancar", test: /^1-1/ },
      { label: "Aset Tetap", test: /^1-2/ },
    ],
  },
  result: {
    title: "Surplus / Defisit",
    scope: /^[45]-/,
    sign: "debit",
    rules: [
      { key: "revenue", label: "Pendapatan", test: /^4-/ },
      { key: "expense", label: "Beban", test: /^5-/ },
    ],
    labels: [],
  },
};

const REVENUE_RULES: Rule[] = [
  { key: "tuition", label: "Pendapatan Iuran", test: /^4-1/ },
  { key: "donation", label: "Pendapatan Donasi & Sponsor", test: /^4-2/ },
  { key: "other", label: "Pendapatan Lainnya", test: /^4-/ },
];

const EXPENSE_RULES: Rule[] = [
  { key: "education", label: "Beban Pendidikan", test: /^5-1/ },
  { key: "general", label: "Beban Umum & Administrasi", test: /^5-2/ },
  { key: "finance", label: "Beban Keuangan", test: /^5-3/ },
  { key: "other", label: "Beban Lainnya", test: /^5-/ },
];

export function buildBreakdown(lines: BreakdownLine[], ruleList: Rule[], sign: (line: BreakdownLine) => number, labelMap?: Record<string, string>) {
  const order: string[] = [];
  const byGroup = new Map<string, { label: string; items: Map<string, BreakdownItem & { raw: number }> }>();
  for (const line of lines) {
    const value = sign(line);
    if (Math.abs(value) < 0.005) continue;
    const rule = ruleList.find((entry) => entry.test.test(line.accountCode));
    if (!rule) continue;
    let group = byGroup.get(rule.key);
    if (!group) {
      group = { label: rule.label, items: new Map() };
      byGroup.set(rule.key, group);
      order.push(rule.key);
    }
    const existing = group.items.get(line.accountCode);
    if (existing) existing.raw += value;
    else group.items.set(line.accountCode, { accountCode: line.accountCode, accountName: line.accountName, label: friendlyLabel(labelMap ?? {}, line), amount: 0, raw: value });
  }
  const groups: BreakdownGroup[] = [];
  for (const key of order) {
    const group = byGroup.get(key);
    if (!group) continue;
    const items = [...group.items.values()]
      .map(({ raw, ...rest }) => ({ ...rest, amount: roundMoney(raw) }))
      .filter((item) => Math.abs(item.amount) >= 0.005)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    if (items.length === 0) continue;
    groups.push({ key, label: group.label, total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)), items });
  }
  return { total: roundMoney(groups.reduce((sum, group) => sum + group.total, 0)), groups };
}

export function buildResultBreakdown(periodLines: BreakdownLine[], ytdRevenue: number, ytdExpense: number) {
  const revenue = buildBreakdown(periodLines.filter((line) => line.accountCode.startsWith("4")), REVENUE_RULES, (line) => line.credit - line.debit);
  const expense = buildBreakdown(periodLines.filter((line) => line.accountCode.startsWith("5")), EXPENSE_RULES, (line) => line.debit - line.credit);
  return {
    total: roundMoney(revenue.total - expense.total),
    groups: [...revenue.groups, ...expense.groups.map((group) => ({ ...group, total: -group.total }))],
    highlights: [
      { label: "Total Pendapatan Periode", value: revenue.total },
      { label: "Total Beban Periode", value: expense.total },
      { label: "Surplus / Defisit Periode", value: roundMoney(revenue.total - expense.total) },
      { label: "Surplus / Defisit Tahun Berjalan", value: roundMoney(ytdRevenue - ytdExpense) },
    ] as BreakdownHighlight[],
  };
}
