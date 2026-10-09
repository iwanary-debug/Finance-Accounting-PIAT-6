import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, FileText, Plus, ReceiptText, Search, Send, Upload, WalletCards } from "lucide-react";
import { api } from "../convexApi";
import { Badge, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select } from "../components/ui";
import { formatDate, formatIDR, statusLabel, todayInput } from "../lib/format";

const TABS = [
  { id: "RECEIPT", label: "Penerimaan", icon: ArrowDownLeft },
  { id: "DISBURSEMENT", label: "Pengeluaran", icon: ArrowUpRight },
  { id: "TRANSFER", label: "Transfer", icon: ArrowLeftRight },
  { id: "MANUAL", label: "Jurnal Umum", icon: FileText },
] as const;

export function TransactionsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("RECEIPT");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayInput());
  const [unitId, setUnitId] = useState("");
  const [mappingCode, setMappingCode] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [counterCashAccountId, setCounterCashAccountId] = useState("");
  const [contactId, setContactId] = useState("");
  const [programId, setProgramId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [manualLines, setManualLines] = useState([{ accountId: "", debit: "", credit: "", description: "" }, { accountId: "", debit: "", credit: "", description: "" }]);

  const range = useMemo(() => ({ paginationOpts: { numItems: 100, cursor: null as string | null }, from: Date.now() - 180 * 86_400_000, to: Date.now() + 86_400_000 }), []);
  const units = useQuery(api.master.listUnits, {});
  const mappings = useQuery(api.master.listMappings, {});
  const cash = useQuery(api.master.listCashAccounts, { unitId: unitId || undefined });
  const contacts = useQuery(api.master.listContacts, { paginationOpts: { numItems: 100, cursor: null }, search: undefined });
  const programs = useQuery(api.master.listPrograms, { unitId: unitId || undefined });
  const accounts = useQuery(api.master.listAccounts, { search: undefined });
  const transactions = useQuery(api.transactions.listTransactions, range);
  const createRoutine = useMutation(api.transactions.createRoutineTransaction);
  const createManual = useMutation(api.transactions.createManualJournal);
  const uploadRequest = useMutation(api.files.createAttachmentUpload);
  const completeUpload = useMutation(api.files.completeAttachment);

  const availableMappings = useMemo(() => (mappings ?? []).filter((mapping) => mapping.category === tab || (tab === "RECEIPT" && mapping.category === "RECEIVABLE") || (tab === "DISBURSEMENT" && ["PAYABLE", "SALE"].includes(mapping.category))), [mappings, tab]);
  const shownTransactions = (transactions?.page ?? []).filter((tx) => !search || `${tx.number} ${tx.description} ${tx.transactionType}`.toLowerCase().includes(search.toLowerCase()));

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      let transactionId: any;
      if (tab === "MANUAL") {
        const lines = manualLines.map((line) => ({ accountId: line.accountId as any, debit: Number(line.debit || 0), credit: Number(line.credit || 0), description: line.description || description }));
        const result = await createManual({ transactionDate: date, unitId: unitId as any, programId: programId || undefined, contactId: contactId || undefined, description, lines, submit: true });
        transactionId = result.transactionId;
      } else {
        if (!mappingCode || !cashAccountId) throw new Error("Pilih jenis transaksi dan rekening.");
        const result = await createRoutine({ transactionType: mappingCode, transactionDate: date, unitId: unitId as any, programId: programId || undefined, contactId: contactId || undefined, cashAccountId: cashAccountId as any, counterCashAccountId: counterCashAccountId || undefined, amount: Number(amount), description, submit: true });
        transactionId = result.transactionId;
      }
      if (file) {
        const url = await uploadRequest({ contentType: file.type, size: file.size });
        await fetch(url, { method: "POST", body: file, headers: { "Content-Type": file.type } });
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer);
        const checksum = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
        await completeUpload({ storageId: url, fileName: file.name, contentType: file.type, size: file.size, checksum, transactionId });
      }
      setMessage("Transaksi tersimpan dan siap direview.");
      setAmount(""); setDescription(""); setFile(null); setManualLines([{ accountId: "", debit: "", credit: "", description: "" }, { accountId: "", debit: "", credit: "", description: "" }]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Transaksi gagal disimpan."); }
    finally { setBusy(false); }
  };

  if (!units || !mappings || !cash || !contacts || !programs || !accounts || !transactions) return <LoadingState />;
  return <div>
    <PageHeader eyebrow="Keuangan" title="Transaksi Harian" description="Input transaksi rutin tanpa memilih akun secara manual. Accounting engine membentuk jurnal saat diposting." actions={<Button onClick={() => document.getElementById("transaction-form")?.scrollIntoView({ behavior: "smooth" })}><Plus className="size-4" /> Transaksi Baru</Button>} />
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{TABS.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { setTab(item.id); setMappingCode(""); }} className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${tab === item.id ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-700/30"}`}><Icon className="size-4" />{item.label}</button>; })}</div>
    {message && <div className={`mb-5 rounded-xl border px-4 py-3 text-xs font-semibold ${message.includes("tersimpan") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message}</div>}
    <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <Card id="transaction-form" className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-950 text-[#d7b45a]"><ReceiptText className="size-4" /></div><div><h2 className="text-base font-extrabold">Input {TABS.find((item) => item.id === tab)?.label}</h2><p className="text-[11px] text-slate-400">Jurnal dibuat otomatis dari mapping aktif.</p></div></div>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Tanggal" required><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field><Field label="Unit" required><Select value={unitId} onChange={(e) => { setUnitId(e.target.value); setCashAccountId(""); setCounterCashAccountId(""); setMappingCode(""); }} required><option value="">Pilih unit</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unit.code} · {unit.name}</option>)}</Select></Field></div>
          {tab !== "MANUAL" ? <><Field label={tab === "RECEIPT" ? "Jenis penerimaan" : tab === "DISBURSEMENT" ? "Jenis pengeluaran" : "Jenis transfer"} required><Select value={mappingCode} onChange={(e) => setMappingCode(e.target.value)} required><option value="">Pilih jenis transaksi</option>{availableMappings.map((mapping) => <option key={mapping._id} value={mapping.code}>{mapping.name}</option>)}</Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label={tab === "TRANSFER" ? "Rekening tujuan" : "Rekening"} required><Select value={tab === "TRANSFER" ? counterCashAccountId : cashAccountId} onChange={(e) => tab === "TRANSFER" ? setCounterCashAccountId(e.target.value) : setCashAccountId(e.target.value)} required><option value="">Pilih rekening</option>{cash.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</Select></Field>{tab !== "TRANSFER" && <Field label="Nominal" required><Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required /></Field>}</div>{tab === "TRANSFER" && <div className="grid gap-4 sm:grid-cols-2"><Field label="Rekening sumber" required><Select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} required><option value="">Pilih rekening</option>{cash.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</Select></Field><Field label="Nominal" required><Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required /></Field></div>}</> : <ManualLines lines={manualLines} accounts={accounts} setLines={setManualLines} description={description} />}
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Pihak terkait" hint="Opsional untuk rekap penjualan."><Select value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">Pilih kontak</option>{contacts.page.map((contact) => <option key={contact._id} value={contact._id}>{contact.name} · {contact.code}</option>)}</Select></Field><Field label="Program / kegiatan" hint="Opsional untuk konsolidasi."><Select value={programId} onChange={(e) => setProgramId(e.target.value)}><option value="">Tanpa program</option>{programs.map((program) => <option key={program._id} value={program._id}>{program.name}</option>)}</Select></Field></div>
          <Field label="Keterangan" required><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: SPP Juni 2027 — asignasi..." required /></Field>
          <Field label="Bukti transaksi" hint="PDF, JPG, PNG, WebP, XLSX, atau CSV · maksimal 10 MB"><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 hover:border-emerald-700/40"><Upload className="size-4 text-emerald-700" />{file ? file.name : "Pilih berkas bukti"}<input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></Field>
          <Button type="submit" disabled={busy} size="lg">{busy ? "Menyimpan..." : "Simpan & kirim review"}<Send className="size-4" /></Button>
          <p className="text-center text-[10px] leading-5 text-slate-400">Setelah disimpan, transaksi mengikuti DRAFT → SUBMITTED → REVIEW → APPROVED → POSTED.</p>
        </form>
      </Card>
      <Card className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-extrabold">Mutasi 6 Bulan</h2><p className="mt-1 text-[11px] text-slate-400">Semua sumber transaksi dan status.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor / keterangan" className="h-9 w-full pl-9 text-xs sm:w-56" /></div></div>{shownTransactions.length === 0 ? <EmptyState icon={<WalletCards className="size-7" />} title="Belum ada mutasi" description="Transaksi baru akan tampil di sini setelah disimpan." /> : <div className="divide-y divide-slate-100">{shownTransactions.map((tx) => <div key={tx._id} className="flex items-start gap-3 p-4 sm:p-5"><div className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${tx.sourceType === "RECEIPT" || tx.sourceType === "RECEIVABLE_PAYMENT" ? "bg-emerald-50 text-emerald-700" : tx.sourceType === "TRANSFER" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{tx.sourceType === "TRANSFER" ? <ArrowLeftRight className="size-4" /> : tx.sourceType === "RECEIPT" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-extrabold text-slate-800">{tx.description}</p><Badge tone={tx.status === "POSTED" ? "green" : tx.status === "REVERSED" ? "red" : "amber"}>{statusLabel[tx.status]}</Badge></div><p className="mt-1 text-[10px] text-slate-400">{tx.number} · {formatDate(tx.transactionDate)}</p></div><p className="text-right text-xs font-black text-slate-800">{formatIDR(tx.amount)}</p></div>)}</div>}</Card>
    </div>
  </div>;
}

function ManualLines({ lines, accounts, setLines, description }: { lines: any[]; accounts: any[]; setLines: (lines: any[]) => void; description: string }) { return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold">Baris jurnal umum</p><p className="text-[10px] text-slate-400">Total debit dan kredit harus sama.</p></div><Button type="button" size="sm" variant="secondary" onClick={() => setLines([...lines, { accountId: "", debit: "", credit: "", description }])}><Plus className="size-3.5" /> Baris</Button></div><div className="grid gap-2">{lines.map((line, index) => <div key={index} className="grid grid-cols-12 gap-2"><Select value={line.accountId} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, accountId: e.target.value } : row))} className="col-span-12 sm:col-span-5"><option value="">Pilih akun</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.code} · {account.name}</option>)}</Select><Input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, debit: e.target.value, credit: "" } : row))} placeholder="Debit" className="col-span-6 sm:col-span-3" /><Input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => setLines(lines.map((row, i) => i === index ? { ...row, credit: e.target.value, debit: "" } : row))} placeholder="Kredit" className="col-span-6 sm:col-span-4" /></div>)}</div></div>; }
