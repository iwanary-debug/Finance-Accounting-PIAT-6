import { type ReactNode } from "react";
import { BarChart3, BookOpenCheck, Boxes, Building2, ClipboardCheck, FileClock, FileSpreadsheet, Landmark, LayoutDashboard, Menu, ReceiptText, Search, Settings2, ShieldCheck, WalletCards, X } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { clsx } from "clsx";
import { Button } from "./ui";
import { roleLabel } from "../lib/format";

export const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "UTAMA" },
  { id: "transactions", label: "Transaksi", icon: ReceiptText, group: "KEUANGAN" },
  { id: "approvals", label: "Persetujuan", icon: ClipboardCheck, group: "KEUANGAN" },
  { id: "receivables", label: "Piutang & Hutang", icon: WalletCards, group: "KEUANGAN" },
  { id: "supporting", label: "Persediaan & Aset", icon: Boxes, group: "KEUANGAN" },
  { id: "reports", label: "Laporan", icon: BarChart3, group: "PELAPORAN" },
  { id: "reconciliation", label: "Rekonsiliasi Excel", icon: FileSpreadsheet, group: "PELAPORAN" },
  { id: "master", label: "Master Data", icon: BookOpenCheck, group: "PENGATURAN" },
  { id: "closing", label: "Periode & Closing", icon: FileClock, group: "PENGATURAN" },
  { id: "import", label: "Import Excel", icon: Landmark, group: "PENGATURAN" },
  { id: "audit", label: "Audit Trail", icon: ShieldCheck, group: "PENGATURAN" },
  { id: "users", label: "Pengguna & Akses", icon: Settings2, group: "PENGATURAN" },
] as const;

export type PageId = typeof navigation[number]["id"] | "detail";

/** Lima menu utama pada navigasi bawah HP: ikon saja, keterangan muncul saat disentuh. */
const BOTTOM_NAV = (["dashboard", "transactions", "approvals", "reports", "closing"] as const).map((id) => navigation.find((item) => item.id === id)!);

export function Shell({ active, onNavigate, role, name, children }: { active: PageId; onNavigate: (id: PageId) => void; role: string; name: string; children: ReactNode }) {
  const { signOut } = useAuthActions();
  const [open, setOpen] = React.useState(false);
  const [peek, setPeek] = React.useState<string | null>(null);
  const peekTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const groups = [...new Set(navigation.map((item) => item.group))];
  const go = (id: PageId) => { onNavigate(id); setOpen(false); };
  /** Nama fungsi muncul sebentar di atas ikon ketika tombol disentuh. */
  const showPeek = (id: string) => {
    setPeek(id);
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(null), 1800);
  };
  return <div className="min-h-screen bg-[#f6f7f3] text-slate-900">
    {open && <button className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu" />}
    <aside className={clsx("fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-emerald-950/10 bg-[#0b3b36] text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <button onClick={() => go("dashboard")} className="flex items-center gap-3 text-left">
          <div className="grid size-10 place-items-center rounded-xl bg-[#d7b45a] font-black text-emerald-950">P6</div>
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-200/70">PIAT 6 Bondowoso</p><p className="text-sm font-extrabold">Finance & Accounting</p></div>
        </button>
        <button className="text-white/70 lg:hidden" onClick={() => setOpen(false)}><X className="size-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => <div key={group} className="mb-4"><p className="mb-1.5 px-3 text-[9px] font-black tracking-[.2em] text-emerald-200/45">{group}</p><div className="grid gap-0.5">{navigation.filter((item) => item.group === group).map((item) => {
          const Icon = item.icon;
          const allowed = !["users"].includes(item.id) || role === "SUPER_ADMIN";
          if (!allowed) return null;
          return <button key={item.id} onClick={() => go(item.id)} className={clsx("flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition", active === item.id || (active === "detail" && item.id === "dashboard") ? "bg-white/12 text-white shadow-sm" : "text-emerald-50/65 hover:bg-white/7 hover:text-white")}><Icon className="size-[17px]" />{item.label}</button>;
        })}</div></div>)}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/7 p-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d7b45a] text-xs font-black text-emerald-950">{name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{name}</p><p className="truncate text-[10px] text-emerald-100/55">{roleLabel[role] ?? role}</p></div><button onClick={() => signOut()} className="text-[10px] font-bold text-emerald-100/60 hover:text-white">Keluar</button></div>
      </div>
    </aside>
    <div className="lg:pl-[270px]">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <button className="mr-3 grid size-10 place-items-center rounded-xl border border-slate-200 lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
        <div className="relative hidden max-w-md flex-1 sm:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="h-10 w-full rounded-xl bg-slate-100 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-700/15" placeholder="Cari transaksi, akun, atau laporan..." /></div>
        <div className="ml-auto flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-xs font-bold text-slate-800">Yayasan An Nawawi</p><p className="text-[10px] text-slate-400">Bondowoso ·Single source of truth</p></div><div className="grid size-9 place-items-center rounded-xl bg-emerald-900 text-xs font-black text-white">P6</div></div>
      </header>
      <main className="mx-auto max-w-[1540px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
    <nav aria-label="Navigasi utama" className="fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-between gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur lg:hidden" style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }}>
      {BOTTOM_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id || (active === "detail" && item.id === "dashboard");
        return <button key={item.id} type="button" aria-label={item.label} title={item.label} onClick={() => { showPeek(item.id); go(item.id); }} className={clsx("relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2.5 transition active:scale-95", isActive ? "bg-emerald-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}>
          <Icon className="size-5 shrink-0" />
          {isActive && <span className="absolute bottom-1.5 size-1 rounded-full bg-[#d7b45a]" />}
          {peek === item.id && <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-emerald-950 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg">{item.label}</span>}
        </button>;
      })}
    </nav>
  </div>;
}

import * as React from "react";
