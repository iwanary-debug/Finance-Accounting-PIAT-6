import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, Layers, PieChart, Receipt } from "lucide-react";
import { api } from "../convexApi";
import { Badge, Button, Card, EmptyState, LoadingState, PageHeader } from "../components/ui";
import { formatIDR } from "../lib/format";

type Props = { card: string; from?: number; to?: number; unitId?: string; onBack: () => void; onOpenCard?: (card: string) => void };

const CARD_LABELS: Record<string, string> = {
  cash: "Kas & Setara Kas",
  receivables: "Total Piutang",
  inventory: "Persediaan",
  fixedAssets: "Aset Tetap",
  otherAssets: "Aset Lainnya",
  liabilities: "Kewajiban",
  equity: "Ekuitas",
  totalAssets: "Total Aset",
  result: "Surplus / Defisit",
};

const dateLabel = (value: number) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export function DetailPage({ card, from, to, unitId, onBack, onOpenCard }: Props) {
  const args = useMemo(() => ({ card, from, to, unitId: unitId || undefined }), [card, from, to, unitId]);
  const data = useQuery(api.dashboard.cardBreakdown, args);
  if (!data) return <LoadingState label="Menyusun rincian akun..." />;
  if (!data.groups.length) return <div><PageHeader eyebrow="Rincian Kartu" title={data.title} description={`Posisi per ${dateLabel(data.asOf)}`} actions={<Button variant="secondary" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Dashboard</Button>} /><EmptyState icon={<Layers className="size-7" />} title="Belum ada akun pada kartu ini" description="Jalankan Import Excel agar Neraca dan jurnal masuk, lalu rincian ini akan terisi otomatis." action={<Button size="sm" onClick={onBack}>Kembali ke dashboard</Button>} /></div>;

  return <div>
    <PageHeader eyebrow="Rincian Kartu Dashboard" title={data.title} description={`Disusun dari saldo akun real per ${dateLabel(data.asOf)}.${data.from !== data.to ? ` Surplus/defisit dihitung ${dateLabel(data.from)} — ${dateLabel(data.to)}.` : ""}`} actions={<Button variant="secondary" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Kembali</Button>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {data.highlights.map((item) => <Card key={item.label} className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p><p className={`mt-1 text-lg font-black ${item.value < 0 ? "text-rose-700" : "text-slate-950"}`}>{formatIDR(item.value, true)}</p></Card>)}
      <Card className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total {data.title}</p><p className="mt-1 text-lg font-black text-emerald-900">{formatIDR(data.total, true)}</p><p className="mt-1 text-[10px] text-slate-400">{data.groups.reduce((sum, group) => sum + group.items.length, 0)} akun</p></Card>
    </div>

    <div className="grid gap-4">
      {data.groups.map((group) => {
        const share = data.total !== 0 ? (group.total / data.total) * 100 : 0;
        return <Card key={group.key} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div><p className="text-sm font-extrabold text-slate-900">{group.label}</p><p className="mt-1 text-[11px] text-slate-400">{group.items.length} akun · {share.toFixed(1)}% dari total</p></div>
            <div className="flex items-center gap-2"><Badge tone="blue">{share.toFixed(1)}%</Badge><strong className="text-sm font-black text-slate-900">{formatIDR(group.total, true)}</strong></div>
          </div>
          <div className="h-1.5 bg-slate-50"><div className="h-full bg-emerald-700" style={{ width: `${Math.min(Math.abs(share), 100)}%` }} /></div>
          <div className="divide-y divide-slate-100">
            {group.items.map((item) => <div key={item.accountCode} className="flex items-center gap-3 px-5 py-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-400"><Receipt className="size-3.5" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{item.label}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.accountCode} · {item.accountName}</p></div>
              <div className="text-right"><p className={`text-xs font-extrabold ${item.amount < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatIDR(item.amount, true)}</p><p className="text-[10px] text-slate-400">{data.total !== 0 ? `${((item.amount / data.total) * 100).toFixed(1)}%` : "-"}</p></div>
            </div>)}
          </div>
        </Card>;
      })}
    </div>

    <Card className="mt-4 flex items-start gap-3 border-emerald-900/10 bg-emerald-50/60 p-4">
      <PieChart className="mt-0.5 size-5 shrink-0 text-emerald-800" />
      <p className="text-xs leading-6 text-emerald-900">Rincian dihitung dari jurnal berstatus posted per akun, bukan angka manual. Ubah periode atau unit di dashboard untuk melihat posisi yang berbeda.</p>
    </Card>
    {onOpenCard ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rincian lain</span>{["cash", "receivables", "inventory", "fixedAssets", "liabilities", "equity", "totalAssets", "result"].filter((item) => item !== card).map((item) => <Button key={item} size="sm" variant="secondary" onClick={() => onOpenCard(item)}>{CARD_LABELS[item]}</Button>)}</div> : null}
  </div>;
}
