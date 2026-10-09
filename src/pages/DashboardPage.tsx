import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Banknote, Boxes, Building2, CalendarDays, CircleDollarSign, Landmark, ReceiptText, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { api } from "../convexApi";
import { Badge, Card, EmptyState, LoadingState, PageHeader, Select } from "../components/ui";
import { formatDate, formatIDR, statusLabel } from "../lib/format";
import type { PageId } from "../components/Shell";

const COLORS = ["#0f766e", "#d7b45a", "#334155", "#7c3aed", "#e11d48", "#0e7490"];

const round2 = (value: number) => Math.round(value * 100) / 100;

export function DashboardPage({ onNavigate, onOpenCard }: { onNavigate: (page: PageId) => void; onOpenCard: (card: string, range?: { from?: number; to?: number; unitId?: string }) => void }) {
  const [unitId, setUnitId] = useState("");
  const units = useQuery(api.master.listUnits, {});
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [reference, setReference] = useState<number | null>(null);
  const dates = useMemo(() => {
    if (period !== "year") return {} as { from?: number; to?: number };
    const anchor = new Date(reference ?? Date.now());
    const year = anchor.getUTCFullYear();
    return { from: Date.UTC(year, 0, 1), to: Date.UTC(year, 11, 31, 23, 59, 59, 999) };
  }, [period, reference]);
  const data = useQuery(api.dashboard.dashboard, { unitId: unitId || undefined, ...dates });
  const trendData = useQuery(api.dashboard.financialTrend, { unitId: unitId || undefined });
  const serverTo = data?.period?.to ?? null;
  useEffect(() => {
    if (serverTo !== null && serverTo !== reference) setReference(serverTo);
  }, [serverTo, reference]);
  const range = useMemo(() => ({ from: data?.period?.from, to: data?.period?.to, unitId: unitId || undefined }), [data?.period?.from, data?.period?.to, unitId]);
  const openCard = useCallback((card: string) => onOpenCard(card, range), [onOpenCard, range]);

  if (!data) return <LoadingState />;
  const k = data.kpis;
  const periodLabel = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(data.period.from));
  const periodEndLabel = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(data.period.to));
  const scopeLabel = period === "year" ? "Tahun berjalan" : "Bulan berjalan";
  const compactTrend = data.trend.map((row) => ({ ...row, cash: row.cash / 1_000_000_000, revenue: row.revenue / 1_000_000_000, expense: row.expense / 1_000_000_000, surplus: row.surplus / 1_000_000_000 }));
  const executive = ["YAYASAN", "MUDIR", "REVIEWER", "SUPER_ADMIN", "ADMIN_KEUANGAN"].includes(data.role);
  const isYayasan = data.role === "YAYASAN";

  return <div>
    <PageHeader eyebrow="Yayasan An Nawawi Bondowoso" title={isYayasan ? "Dashboard Keuangan PIAT 6" : "Ringkasan Keuangan PIAT 6"} description={executive ? "Kondisi keuangan konsolidasi berdasarkan jurnal berstatus POSTED." : "Posisi kas, transaksi, dan pekerjaan yang perlu tindak lanjut."} actions={<><Select value={period} onChange={(e) => setPeriod(e.target.value as "month" | "year")} className="w-40"><option value="month">Bulan ini</option><option value="year">Tahun berjalan</option></Select><Select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-44"><option value="">Semua unit</option>{units?.map((unit) => <option key={unit._id} value={unit._id}>{unit.code} · {unit.name}</option>)}</Select></>} />

    <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="rounded-lg bg-emerald-950 px-2.5 py-1 font-bold text-[#d7b45a]">{scopeLabel}</span><span>Periode laporan {periodLabel} — {periodEndLabel}</span><span className="text-slate-300">·</span><span>Saldo kas, piutang, aset, dan kewajiban adalah posisi pada {periodEndLabel}</span></div>

    {data.kpis.totalAssets === 0 && data.kpis.cash === 0 ? <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700"/><div><p className="text-sm font-bold text-amber-950">Ledger belum memiliki saldo opening yang disetujui</p><p className="mt-1 text-xs leading-5 text-amber-800">Dashboard sengaja menampilkan nol—bukan angka hardcoded. Gunakan Import Excel atau jurnal opening balance yang telah direkonsiliasi.</p></div></div><button onClick={() => onNavigate("import")} className="shrink-0 text-xs font-extrabold text-amber-900">Buka migrasi <ArrowRight className="ml-1 inline size-3.5"/></button></div> : null}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={Landmark} label="Kas & Setara Kas" value={k.cash} helper={`Tunai ${formatIDR(k.cashOnHand, true)} · Bank ${formatIDR(k.bank, true)}`} onClick={() => openCard("cash")} />
      <KpiCard icon={WalletCards} label="Total Piutang" value={round2(k.receivables + k.otherReceivables)} helper={`Kegiatan ${formatIDR(k.receivables, true)} · lainnya ${formatIDR(k.otherReceivables, true)}`} onClick={() => openCard("receivables")} />
      <KpiCard icon={Building2} label="Total Aset" value={k.totalAssets} helper={`Aset bersih ${formatIDR(k.totalEquityWithResult, true)}`} onClick={() => openCard("totalAssets")} />
      <KpiCard icon={CircleDollarSign} label={period === "year" ? "Surplus / Defisit Tahun" : "Surplus / Defisit Bulan"} value={k.monthSurplus} helper={`Tahun berjalan ${formatIDR(k.yearSurplus, true)}`} tone={k.monthSurplus >= 0 ? "positive" : "negative"} onClick={() => openCard("result")} />
      <KpiCard icon={Boxes} label="Persediaan" value={k.inventory} helper={`${formatIDR(k.inventory, true)} nilai buku`} onClick={() => openCard("inventory")} />
      <KpiCard icon={ReceiptText} label="Kewajiban" value={k.totalLiabilities} helper={`${formatIDR(k.totalLiabilities, true)} tercatat`} onClick={() => openCard("liabilities")} />
      <KpiCard icon={CalendarDays} label="Penerimaan Periode" value={k.monthReceipts} helper={`Hari ini ${formatIDR(k.todayReceipts, true)}`} tone="positive" onClick={() => onNavigate("transactions")} />
      <KpiCard icon={ReceiptText} label="Pengeluaran Periode" value={k.monthDisbursements} helper={`Hari ini ${formatIDR(k.todayDisbursements, true)}`} tone="negative" onClick={() => onNavigate("transactions")} />
    </div>

    <div className="mb-1 mt-3 flex items-center gap-2 text-[11px] text-slate-500"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-600">Klik kartu untuk melihat rincian akun</span><span className="text-slate-300">·</span><span>Kas di Bank, Kas di Tangan, Dana BOS, Piutang per kategori, Aset Tetap, dan Kewajiban</span></div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Card className="p-5 sm:p-6"><ChartHeader title="Tren Kas & Kas Equivalents" subtitle="12 bulan terakhir · akumulasi jurnal posted" action="Rp miliar" /><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={compactTrend} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}><defs><linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.3}/><stop offset="100%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}M`}/><Tooltip formatter={(value) => [`Rp ${Number(value).toFixed(1)} M`, "Saldo kas"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}/><Area type="monotone" dataKey="cash" stroke="#0f766e" strokeWidth={2.5} fill="url(#cashFill)"/></AreaChart></ResponsiveContainer></div></Card>
      <Card className="p-5 sm:p-6"><ChartHeader title="Komposisi Aset" subtitle="Saldo real per klasifikasi akun" /><div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.assetComposition} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>{data.assetComposition.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip formatter={(value) => formatIDR(Number(value), true)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}/></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2">{data.assetComposition.map((row, index) => <div key={row.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px]"><span className="flex items-center gap-1.5 font-semibold text-slate-600"><i className="size-2 rounded-full" style={{ background: COLORS[index] }} />{row.name}</span><strong className="text-slate-800">{formatIDR(row.value, true)}</strong></div>)}</div></Card>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="p-5 sm:p-6"><ChartHeader title="Pendapatan vs Beban" subtitle="Per bulan · Rp miliar" /><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={compactTrend} barGap={3}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }}/><Tooltip formatter={(value, name) => [`Rp ${Number(value).toFixed(1)} M`, name === "revenue" ? "Pendapatan" : "Beban"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}/><Bar dataKey="revenue" fill="#0f766e" radius={[4, 4, 0, 0]}/><Bar dataKey="expense" fill="#d7b45a" radius={[4, 4, 0, 0]}/><Bar dataKey="surplus" fill="#94a3b8" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></Card>
      <Card className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-extrabold">Anggaran vs Realisasi</p><p className="mt-1 text-[11px] text-slate-400">Tahun {new Date().getUTCFullYear()}</p></div><Badge tone={k.realization >= 90 ? "amber" : "green"}>{k.realization.toFixed(1)}%</Badge></div><div className="mt-8"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold text-slate-500">Realisasi beban</p><p className="mt-1 text-2xl font-black tracking-tight">{formatIDR(data.kpis.yearExpense, true)}</p></div><p className="text-right text-xs font-semibold text-slate-500">Anggaran<br/><strong className="text-base text-slate-800">{formatIDR(data.kpis.budget, true)}</strong></p></div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${Math.min(k.realization, 100)}%` }}/></div><div className="mt-3 flex justify-between text-[10px] text-slate-400"><span>Sisa {formatIDR(data.kpis.budgetVariance, true)}</span><span>100%</span></div></div><button onClick={() => onNavigate("reports")} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50">Buka laporan anggaran <ArrowRight className="size-3.5"/></button></Card>
    </div>

    <FinancialTrendSection trend={trendData} onImport={() => onNavigate("import")} />

    <Card className="mt-4 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-sm font-extrabold">Transaksi Terbaru</p><p className="mt-1 text-[11px] text-slate-400">Traceable ke sumber dan jurnal</p></div><button onClick={() => onNavigate("transactions")} className="text-xs font-bold text-emerald-700">Lihat semua <ArrowRight className="ml-1 inline size-3.5"/></button></div>{data.recentTransactions.length === 0 ? <EmptyState icon={<Banknote className="size-7"/>} title="Belum ada transaksi" description="Transaksi yang disimpan akan muncul di sini setelah workflow progresses." action={<button onClick={() => onNavigate("transactions")} className="text-xs font-bold text-emerald-700">Catat transaksi</button>} /> : <div className="divide-y divide-slate-100">{data.recentTransactions.map((tx) => <div key={tx._id} className="flex items-center gap-3 px-5 py-3.5"><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${tx.sourceType === "RECEIPT" || tx.sourceType === "RECEIVABLE_PAYMENT" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{tx.sourceType === "RECEIPT" ? <ArrowDownLeft className="size-4"/> : <ArrowUpRight className="size-4"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{tx.description}</p><p className="mt-0.5 text-[10px] text-slate-400">{tx.number} · {formatDate(tx.transactionDate)}</p></div><div className="text-right"><p className="text-xs font-extrabold">{formatIDR(tx.amount)}</p><Badge tone={tx.status === "POSTED" ? "green" : tx.status === "REVERSED" ? "red" : "amber"}>{statusLabel[tx.status]}</Badge></div></div>)}</div>}</Card>
  </div>;
}

function FinancialTrendSection({ trend, onImport }: { trend: any; onImport: () => void }) {
  const months = trend?.months ?? [];
  const summary = trend?.summary ?? null;
  if (months.length === 0) {
    return <Card className="mt-4 border-dashed p-8"><EmptyState icon={<TrendingUp className="size-8" />} title="Grafik surplus/defisit belum ada" description="Tren bulanan Juli 2025 - Juni 2026 diambil dari sheet Grafik pada workbook Excel konsolidasi. Import satu file untuk mengisinya." action={<button onClick={onImport} className="text-xs font-bold text-emerald-700">Buka Import Excel <ArrowRight className="ml-1 inline size-3.5" /></button>} /></Card>;
  }
  const chart = months.map((month: any) => ({ ...month, revenue: month.revenue / 1_000_000_000, expense: month.expense / 1_000_000_000, surplus: month.surplus / 1_000_000_000 }));
  const excelMonths = months.filter((month: any) => month.source === "EXCEL").length;
  const ledgerMonths = months.filter((month: any) => month.source === "LEDGER").length;
  const hasDeficit = summary && summary.totalSurplus < 0;
  return <div className="mt-4">
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">Surplus / Defisit Bulanan &amp; Tahunan <Badge tone="green">Juli 2025 - Juni 2026</Badge></p>
          <p className="mt-1 text-[11px] text-slate-400">Pendapatan dan beban tiap bulan · garis menunjukkan selisihnya. {summary?.periodLabel ? `Periode ${summary.periodLabel}.` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {ledgerMonths > 0 && <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{ledgerMonths} bulan dari jurnal aplikasi</span>}
          {excelMonths > 0 && <span className="rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-700">{excelMonths} bulan dari sheet Grafik Excel</span>}
        </div>
      </div>

      <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        <TrendStat label="Total Pendapatan" value={summary.totalRevenue} tone="default" />
        <TrendStat label="Total Beban" value={summary.totalExpense} tone="default" />
        <TrendStat label={hasDeficit ? "Total Defisit" : "Total Surplus"} value={summary.totalSurplus} tone={hasDeficit ? "negative" : "positive"} />
        <TrendStat label="Margin Surplus" value={`${summary.marginPercent.toFixed(1)}%`} tone={hasDeficit ? "negative" : "positive"} suffix={`Surplus ${summary.surplusMonths} bulan · Defisit ${summary.deficitMonths} bulan`} />
      </div>

      <div className="p-5 sm:p-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 10, right: 12, left: -12, bottom: 0 }} barGap={2}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={0.95} /><stop offset="100%" stopColor="#0f766e" stopOpacity={0.55} /></linearGradient>
                <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d7b45a" stopOpacity={0.95} /><stop offset="100%" stopColor="#d7b45a" stopOpacity={0.5} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value) => `${value}M`} width={56} />
              <Tooltip cursor={{ fill: "rgba(15,118,110,0.05)" }} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }} formatter={(value: any, name: any) => [`Rp ${Number(value).toFixed(2)} M`, name === "revenue" ? "Pendapatan" : name === "expense" ? "Beban" : "Surplus / Defisit"]} />
              <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700, color: "#475569" }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
              <Bar dataKey="revenue" name="revenue" fill="url(#revenueFill)" radius={[5, 5, 0, 0]} maxBarSize={26} />
              <Bar dataKey="expense" name="expense" fill="url(#expenseFill)" radius={[5, 5, 0, 0]} maxBarSize={26} />
              <Line type="monotone" dataKey="surplus" name="surplus" stroke="#be123c" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: "#be123c" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-800"><TrendingUp className="size-3.5" />{summary.bestSurplus >= 0 ? "Bulan surplus terbaik" : "Defisit terkecil"}</p>
            <p className="mt-1.5 text-lg font-black tracking-tight text-emerald-900">{summary.bestMonth ?? "-"}</p>
            <p className="text-xs font-semibold text-emerald-700">{summary.bestSurplus >= 0 ? "Surplus " : "Defisit "}{formatIDR(Math.abs(summary.bestSurplus))}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-800"><TrendingDown className="size-3.5" />{summary.worstSurplus < 0 ? "Defisit terbesar" : "Surplus terendah"}</p>
            <p className="mt-1.5 text-lg font-black tracking-tight text-rose-900">{summary.worstMonth ?? "-"}</p>
            <p className="text-xs font-semibold text-rose-700">{summary.worstSurplus < 0 ? "Defisit " : "Surplus "}{formatIDR(Math.abs(summary.worstSurplus))}</p>
          </div>
        </div>

        <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-4 py-2.5 font-black">Bulan</th><th className="px-4 py-2.5 text-right font-black">Pendapatan</th><th className="px-4 py-2.5 text-right font-black">Beban</th><th className="px-4 py-2.5 text-right font-black">Surplus / Defisit</th><th className="px-4 py-2.5 text-right font-black">Sumber</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((month: any) => <tr key={month.monthKey} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-2.5 font-bold capitalize text-slate-700">{month.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{formatIDR(month.revenue, true)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{formatIDR(month.expense, true)}</td>
                <td className={`px-4 py-2.5 text-right font-extrabold tabular-nums ${month.surplus >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{month.surplus >= 0 ? "+" : ""}{formatIDR(month.surplus, true)}</td>
                <td className="px-4 py-2.5 text-right"><Badge tone={month.source === "LEDGER" ? "green" : "amber"}>{month.source === "LEDGER" ? "Jurnal" : "Excel"}</Badge></td>
              </tr>)}
              <tr className="bg-slate-50 font-black text-slate-800">
                <td className="px-4 py-2.5">Total 12 bulan</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatIDR(summary.totalRevenue, true)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatIDR(summary.totalExpense, true)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${summary.totalSurplus >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{summary.totalSurplus >= 0 ? "+" : ""}{formatIDR(summary.totalSurplus, true)}</td>
                <td className="px-4 py-2.5 text-right text-[10px] uppercase text-slate-400">Tahunan</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] leading-5 text-slate-400">Baris bertanda <strong>Jurnal</strong> dihitung dari transaksi yang sudah diposting di aplikasi; baris <strong>Excel</strong> diambil dari sheet Grafik pada workbook konsolidasi. Surplus terjadi ketika pendapatan lebih besar dari beban; jika minus, berarti defisit.</p>
      </div>
    </Card>
  </div>;
}

function TrendStat({ label, value, tone, suffix }: { label: string; value: number | string; tone: "default" | "positive" | "negative"; suffix?: string }) {
  return <div className="bg-white px-5 py-4 sm:px-6">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-1 text-xl font-black tracking-[-.03em] ${tone === "negative" ? "text-rose-700" : tone === "positive" ? "text-emerald-800" : "text-slate-950"}`}>{typeof value === "number" ? formatIDR(value, true) : value}</p>
    {suffix && <p className="mt-1 text-[10px] font-semibold text-slate-400">{suffix}</p>}
  </div>;
}

function KpiCard({ icon: Icon, label, value, helper, tone = "default", onClick }: { icon: typeof Banknote; label: string; value: number; helper: string; tone?: "default" | "positive" | "negative"; onClick: () => void }) { return <button onClick={onClick} className="group rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700/25 hover:shadow-md"><div className="flex items-start justify-between"><div className="grid size-9 place-items-center rounded-xl bg-emerald-950 text-[#d7b45a]"><Icon className="size-4"/></div><ArrowRight className="size-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"/></div><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-xl font-black tracking-[-.03em] ${tone === "negative" ? "text-rose-700" : tone === "positive" ? "text-emerald-800" : "text-slate-950"}`}>{formatIDR(value, true)}</p><p className="mt-1 text-[10px] text-slate-400">{helper}</p></button>; }
function ChartHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) { return <div className="mb-4 flex items-start justify-between"><div><p className="text-sm font-extrabold text-slate-900">{title}</p><p className="mt-1 text-[11px] text-slate-400">{subtitle}</p></div>{action && <span className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-400">{action}</span>}</div>; }
