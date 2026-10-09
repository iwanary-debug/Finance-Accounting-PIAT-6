import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Boxes, Building2, Check, ClipboardList, FileSpreadsheet, History, Landmark, LockKeyhole, Package, Plus, Receipt, RefreshCw, Save, Search, Settings2, ShieldCheck, Upload, UserRound, WalletCards, X } from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../convexApi";
import { Badge, Button, Card, EmptyState, Field, Input, LoadingState, PageHeader, Select } from "../components/ui";
import { formatDate, formatIDR, roleLabel, statusLabel, todayInput } from "../lib/format";

export function ReceivablesPage() {
  const [kind, setKind] = useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
  const [number, setNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayInput());
  const [payment, setPayment] = useState<any | null>(null);
  const [cashId, setCashId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [message, setMessage] = useState("");
  const receivables = useQuery(api.supporting.listReceivables, {});
  const payables = useQuery(api.supporting.listPayables, {});
  const contacts = useQuery(api.master.listContacts, { paginationOpts: { numItems: 100, cursor: null } });
  const units = useQuery(api.master.listUnits, {});
  const cash = useQuery(api.master.listCashAccounts, {});
  const accounts = useQuery(api.master.listAccounts, {});
  const createReceivable = useMutation(api.supporting.createReceivable);
  const createPayable = useMutation(api.supporting.createPayable);
  const payReceivable = useMutation(api.supporting.recordReceivablePayment);
  const payPayable = useMutation(api.supporting.recordPayablePayment);
  const rows = kind === "RECEIVABLE" ? receivables ?? [] : payables ?? [];
  const submit = async (event: FormEvent) => { event.preventDefault(); setMessage(""); try { const args = { documentNumber: number, contactId: contactId as any, unitId: unitId as any, amount: Number(amount), invoiceDate: Date.now(), dueDate: new Date(`${dueDate}T12:00:00Z`).getTime(), category: kind === "RECEIVABLE" ? "EDUCATION" : "OPERATIONAL" }; if (kind === "RECEIVABLE") await createReceivable(args); else await createPayable({ ...args, payableAccountId: (accounts ?? []).find((a) => a.code === "2-1390")?._id as any, debitAccountId: (accounts ?? []).find((a) => a.code === "5-5000")?._id as any }); setMessage("Dokumen tersimpan dan jurnal pengakuan telah dibuat."); setNumber(""); setAmount(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Dokumen gagal disimpan."); } };
  const doPayment = async () => { if (!payment || !cashId) return; try { const args = { [kind === "RECEIVABLE" ? "receivableId" : "payableId"]: payment._id, cashAccountId: cashId as any, amount: Number(payAmount), paymentDate: Date.now() }; if (kind === "RECEIVABLE") await payReceivable(args); else await payPayable(args); setMessage("Pembayaran tersimpan dan jurnal dibuat."); setPayment(null); setPayAmount(""); } catch (error) { setMessage(error instanceof Error ? error.message : "Pembayaran gagal."); } };
  if (!receivables || !payables || !contacts || !units || !cash || !accounts) return <LoadingState />;
  return <div><PageHeader eyebrow="Keuangan" title="Piutang & Hutang" description="Kartu outstanding, aging, dan pembayaran yang selalu terhubung ke jurnal." actions={<Badge tone="blue"><WalletCards className="mr-1 size-3" />{formatIDR((kind === "RECEIVABLE" ? receivables : payables).reduce((sum: number, row: any) => sum + row.outstandingAmount, 0), true)}</Badge>} /><div className="mb-5 flex gap-2"><Button variant={kind === "RECEIVABLE" ? "primary" : "secondary"} onClick={() => setKind("RECEIVABLE")}>Piutang</Button><Button variant={kind === "PAYABLE" ? "primary" : "secondary"} onClick={() => setKind("PAYABLE")}>Hutang</Button></div>{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Card className="p-5"><h2 className="text-base font-extrabold">Buat dokumen {kind === "RECEIVABLE" ? "piutang" : "hutang"}</h2><form onSubmit={submit} className="mt-5 grid gap-4"><Field label="Nomor dokumen" required><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="INV-2026-001" required /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Pihak" required><Select value={contactId} onChange={(e) => setContactId(e.target.value)} required><option value="">Pilih</option>{contacts.page.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field><Field label="Unit" required><Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required><option value="">Pilih</option>{units.map((u) => <option key={u._id} value={u._id}>{u.code}</option>)}</Select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Nominal" required><Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field><Field label="Jatuh tempo" required><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></Field></div><Button type="submit"><Plus className="size-4" /> Simpan & buat jurnal</Button></form></Card><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-base font-extrabold">Outstanding {kind === "RECEIVABLE" ? "Piutang" : "Hutang"}</h2><p className="mt-1 text-[11px] text-slate-400">Klik pembayaran untuk membuat jurnal.</p></div></div>{rows.length === 0 ? <EmptyState icon={<WalletCards className="size-7" />} title="Belum ada dokumen" description="Dokumen yang dibuat akan tampil dengan status outstanding." /> : <div className="divide-y divide-slate-100">{rows.map((row: any) => <div key={row._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><p className="text-xs font-extrabold">{row.documentNumber}</p><p className="mt-1 text-[10px] text-slate-400">Jatuh tempo {formatDate(row.dueDate)}</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="text-xs font-black">{formatIDR(row.outstandingAmount)}</p><Badge tone={row.status === "PAID" ? "green" : "amber"}>{row.status}</Badge></div>{row.outstandingAmount > 0 && <Button size="sm" variant="secondary" onClick={() => { setPayment(row); setPayAmount(String(row.outstandingAmount)); }}>Bayar</Button>}</div></div>)}</div>}</Card></div>{payment && <Card className="mt-4 border-emerald-200 bg-emerald-50/50 p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Pembayaran {payment.documentNumber}</p><button onClick={() => setPayment(null)}><X className="size-4" /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Rekening" required><Select value={cashId} onChange={(e) => setCashId(e.target.value)}><option value="">Pilih rekening</option>{cash.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field><Field label="Nominal" required><Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></Field><div className="flex items-end"><Button onClick={doPayment}><Check className="size-4" /> Catat pembayaran</Button></div></div></Card>}</div>;
}

export function SupportingPage() {
  const [tab, setTab] = useState<"INVENTORY" | "ASSET">("INVENTORY");
  const [message, setMessage] = useState("");
  const items = useQuery(api.supporting.listInventoryItems, {});
  const movements = useQuery(api.supporting.listInventoryTransactions, {});
  const assets = useQuery(api.supporting.listFixedAssets, {});
  const units = useQuery(api.master.listUnits, {});
  const accounts = useQuery(api.master.listAccounts, {});
  const createItem = useMutation(api.supporting.createInventoryItem);
  const createMovement = useMutation(api.supporting.recordInventoryMovement);
  const createAsset = useMutation(api.supporting.createFixedAsset);
  const depreciate = useMutation(api.supporting.postAssetDepreciation);
  const [item, setItem] = useState({ sku: "", name: "", category: "", unitOfMeasure: "pcs", unitId: "", accountId: "", cost: "0", min: "0" });
  const [movement, setMovement] = useState({ itemId: "", type: "PURCHASE", quantity: "", cost: "", accountId: "", cashId: "" });
  const [asset, setAsset] = useState({ code: "", name: "", category: "", unitId: "", accountId: "", depreciationId: "", cost: "", life: "60" });
  const submitItem = async (e: FormEvent) => { e.preventDefault(); try { await createItem({ sku: item.sku, name: item.name, category: item.category, unitOfMeasure: item.unitOfMeasure, unitId: item.unitId as any, inventoryAccountId: item.accountId as any, averageCost: Number(item.cost), minimumStock: Number(item.min) }); setMessage("Barang persediaan ditambahkan."); setItem({ ...item, sku: "", name: "" }); } catch (err) { setMessage(errorMessage(err)); } };
  const submitMovement = async (e: FormEvent) => { e.preventDefault(); try { await createMovement({ itemId: movement.itemId as any, transactionDate: Date.now(), movementType: movement.type as any, quantity: Number(movement.quantity), unitCost: Number(movement.cost), counterAccountId: movement.accountId as any, cashAccountId: movement.cashId ? movement.cashId as any : undefined, sourceId: `UI-${Date.now()}`, description: movement.type }); setMessage("Mutasi persediaan dan jurnal berhasil disimpan."); setMovement({ ...movement, quantity: "", cost: "" }); } catch (err) { setMessage(errorMessage(err)); } };
  const submitAsset = async (e: FormEvent) => { e.preventDefault(); try { await createAsset({ code: asset.code, name: asset.name, category: asset.category, unitId: asset.unitId as any, acquisitionDate: Date.now(), acquisitionCost: Number(asset.cost), usefulLifeMonths: Number(asset.life), assetAccountId: asset.accountId as any, depreciationAccountId: (accounts ?? []).find((a) => a.code === "1-2401")?._id as any }); setMessage("Aset tetap berhasil didaftarkan."); } catch (err) { setMessage(errorMessage(err)); } };
  if (!items || !movements || !assets || !units || !accounts) return <LoadingState />;
  return <div><PageHeader eyebrow="Supporting Accounting" title="Persediaan & Aset Tetap" description="Modul 6Mart dan asetorkspace menggunakan akun dan jurnal yang sama." actions={<Badge tone="green"><ShieldCheck className="mr-1 size-3" />Integrated ledger</Badge>} /><div className="mb-5 flex gap-2"><Button variant={tab === "INVENTORY" ? "primary" : "secondary"} onClick={() => setTab("INVENTORY")}><Boxes className="size-4" /> Persediaan</Button><Button variant={tab === "ASSET" ? "primary" : "secondary"} onClick={() => setTab("ASSET")}><Building2 className="size-4" /> Aset tetap</Button></div>{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}{tab === "INVENTORY" ? <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Card className="p-5"><h2 className="text-base font-extrabold">Master barang</h2><form onSubmit={submitItem} className="mt-4 grid gap-3"><Field label="SKU" required><Input value={item.sku} onChange={(e) => setItem({ ...item, sku: e.target.value })} required /></Field><Field label="Nama barang" required><Input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Kategori"><Input value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })} /></Field><Field label="Satuan"><Input value={item.unitOfMeasure} onChange={(e) => setItem({ ...item, unitOfMeasure: e.target.value })} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Unit"><Select value={item.unitId} onChange={(e) => setItem({ ...item, unitId: e.target.value })}><option value="">Pilih</option>{units.map((u) => <option key={u._id} value={u._id}>{u.code}</option>)}</Select></Field><Field label="Akun persediaan"><Select value={item.accountId} onChange={(e) => setItem({ ...item, accountId: e.target.value })}><option value="">Pilih</option>{accounts.filter((a) => a.code.startsWith("1-15")).map((a) => <option key={a._id} value={a._id}>{a.code} · {a.name}</option>)}</Select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Biaya rata-rata"><Input type="number" value={item.cost} onChange={(e) => setItem({ ...item, cost: e.target.value })} /></Field><Field label="Stok minimum"><Input type="number" value={item.min} onChange={(e) => setItem({ ...item, min: e.target.value })} /></Field></div><Button type="submit"><Plus className="size-4" /> Tambah barang</Button></form></Card><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-base font-extrabold">Mutasi persediaan</h2><p className="text-[11px] text-slate-400">Nilai movement mengikuti rata-rata.</p></div><Badge tone="blue">{items.length} SKU</Badge></div><div className="p-5"><form onSubmit={submitMovement} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Barang"><Select value={movement.itemId} onChange={(e) => setMovement({ ...movement, itemId: e.target.value })}><option value="">Pilih</option>{items.map((i) => <option key={i._id} value={i._id}>{i.sku} · {i.name}</option>)}</Select></Field><Field label="Jenis"><Select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })}><option value="PURCHASE">Pembelian</option><option value="USAGE">Pemakaian</option><option value="ADJUSTMENT">Adjustment</option></Select></Field><Field label="Qty"><Input type="number" value={movement.quantity} onChange={(e) => setMovement({ ...movement, quantity: e.target.value })} /></Field><Field label="Biaya satuan"><Input type="number" value={movement.cost} onChange={(e) => setMovement({ ...movement, cost: e.target.value })} /></Field><Field label="Akun lawannya"><Select value={movement.accountId} onChange={(e) => setMovement({ ...movement, accountId: e.target.value })}><option value="">Pilih</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.code}</option>)}</Select></Field><div className="sm:col-span-2 lg:col-span-5"><Button type="submit"><Package className="size-4" /> Catat mutasi</Button></div></form></div><SimpleTable headers={["SKU", "Barang", "Stok", "Rata-rata", "Status"]} rows={items.map((i) => [i.sku, i.name, `${i.stockQuantity} ${i.unitOfMeasure}`, formatIDR(i.averageCost), i.stockQuantity <= i.minimumStock ? "Perlu restock" : "Aman"])} /></Card></div> : <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><Card className="p-5"><h2 className="text-base font-extrabold">Daftar aset tetap</h2><form onSubmit={submitAsset} className="mt-4 grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Kode aset"><Input value={asset.code} onChange={(e) => setAsset({ ...asset, code: e.target.value })} required /></Field><Field label="Nama aset"><Input value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })} required /></Field></div><Field label="Kategori"><Input value={asset.category} onChange={(e) => setAsset({ ...asset, category: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Unit"><Select value={asset.unitId} onChange={(e) => setAsset({ ...asset, unitId: e.target.value })}><option value="">Pilih</option>{units.map((u) => <option key={u._id} value={u._id}>{u.code}</option>)}</Select></Field><Field label="Akun aset"><Select value={asset.accountId} onChange={(e) => setAsset({ ...asset, accountId: e.target.value })}><option value="">Pilih</option>{accounts.filter((a) => a.code.startsWith("1-23")).map((a) => <option key={a._id} value={a._id}>{a.code}</option>)}</Select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Nilai perolehan"><Input type="number" value={asset.cost} onChange={(e) => setAsset({ ...asset, cost: e.target.value })} required /></Field><Field label="Umur (bulan)"><Input type="number" value={asset.life} onChange={(e) => setAsset({ ...asset, life: e.target.value })} /></Field></div><Button type="submit"><Plus className="size-4" /> Daftarkan aset</Button></form></Card><Card className="overflow-hidden"><SimpleTable headers={["Kode", "Aset", "Perolehan", "Akum. Penyusutan", "Nilai buku", "Aksi"]} rows={assets.map((a) => [a.code, a.name, formatIDR(a.acquisitionCost), formatIDR(a.accumulatedDepreciation), formatIDR(a.bookValue), <Button key={a._id} size="sm" variant="secondary" onClick={async () => { try { await depreciate({ assetId: a._id, depreciationDate: Date.now() }); setMessage("Penyusutan berhasil diposting."); } catch (err) { setMessage(errorMessage(err)); } }}>Susut</Button>])} /></Card></div>}</div>;
}

export function MasterPage() {
  const [tab, setTab] = useState("ACCOUNTS");
  const [search, setSearch] = useState("");
  const accounts = useQuery(api.master.listAccounts, { search: search || undefined });
  const units = useQuery(api.master.listUnits, {});
  const cash = useQuery(api.master.listCashAccounts, {});
  const mappings = useQuery(api.master.listMappings, {});
  const contacts = useQuery(api.master.listContacts, { paginationOpts: { numItems: 100, cursor: null }, search: search || undefined });
  const createAccount = useMutation(api.master.createAccount);
  const createUnit = useMutation(api.master.createUnit);
  const createContact = useMutation(api.master.createContact);
  const updateMapping = useMutation(api.master.updateMapping);
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState({ code: "", name: "", type: "ASSET", balance: "DEBIT", cash: false, bank: false });
  const [unit, setUnit] = useState({ code: "", name: "", type: "EDUCATION" });
  const [contact, setContact] = useState({ code: "", name: "", type: "SANTRI" });
  const submit = async (e: FormEvent) => { e.preventDefault(); try { if (tab === "ACCOUNTS") await createAccount({ ...account, accountType: account.type as any, normalBalance: account.balance as any, isCash: account.cash, isBank: account.bank, isPostable: true }); if (tab === "UNITS") await createUnit({ ...unit, entityType: unit.type as any, consolidation: true }); if (tab === "CONTACTS") await createContact({ ...contact, contactType: contact.type as any }); setMessage("Master data berhasil disimpan."); setAccount({ ...account, code: "", name: "" }); setUnit({ ...unit, code: "", name: "" }); setContact({ ...contact, code: "", name: "" }); } catch (err) { setMessage(errorMessage(err)); } };
  if (!accounts || !units || !cash || !mappings || !contacts) return <LoadingState />;
  return <div><PageHeader eyebrow="Master Data" title="Data Referensi PIAT 6" description="COA, unit, rekening, kontak, dan mapping akun yang dapat dikonfigurasi." actions={<Badge tone="green">{accounts.length} akun aktif</Badge>} /><div className="mb-5 flex flex-wrap gap-2">{["ACCOUNTS", "UNITS", "CASH", "MAPPINGS", "CONTACTS"].map((item) => <Button key={item} size="sm" variant={tab === item ? "primary" : "secondary"} onClick={() => setTab(item)}>{item}</Button>)}</div>{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}<div className="grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Card className="p-5"><h2 className="text-base font-extrabold">Tambah {tab.toLowerCase()}</h2><form onSubmit={submit} className="mt-4 grid gap-3">{tab === "ACCOUNTS" && <><Field label="Kode akun"><Input value={account.code} onChange={(e) => setAccount({ ...account, code: e.target.value })} placeholder="1-1111" required /></Field><Field label="Nama akun"><Input value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></Field><Field label="Jenis"><Select value={account.type} onChange={(e) => setAccount({ ...account, type: e.target.value })}><option>ASSET</option><option>LIABILITY</option><option>NET_ASSET</option><option>REVENUE</option><option>EXPENSE</option></Select></Field><Field label="Normal"><Select value={account.balance} onChange={(e) => setAccount({ ...account, balance: e.target.value })}><option>DEBIT</option><option>CREDIT</option></Select></Field></>}{tab === "UNITS" && <><Field label="Kode unit"><Input value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} required /></Field><Field label="Nama unit"><Input value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} required /></Field><Field label="Entitas"><Select value={unit.type} onChange={(e) => setUnit({ ...unit, type: e.target.value })}><option>EDUCATION</option><option>MTS</option><option>MA</option><option>BUSINESS</option><option>YAYASAN</option><option>OTHER</option></Select></Field></>}{tab === "CONTACTS" && <><Field label="Kode kontak"><Input value={contact.code} onChange={(e) => setContact({ ...contact, code: e.target.value })} required /></Field><Field label="Nama kontak"><Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} required /></Field><Field label="Jenis kontak"><Select value={contact.type} onChange={(e) => setContact({ ...contact, type: e.target.value })}><option>SANTRI</option><option>WALI</option><option>SUPPLIER</option><option>CUSTOMER</option><option>EMPLOYEE</option><option>OTHER</option></Select></Field></>}{tab === "CASH" && <div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">Rekening dibuat melalui master akun kas dengan menandai akun sebagai Cash atau Bank. Gunakan mapping untuk memilih rekening sumber.</div>}{tab === "MAPPINGS" && <div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">Template baris mapping ditampilkan di tabel. Status aktif dapat dinonaktifkan Admin Keuangan; perubahan baris dilakukan melalui API master mapping.</div>}{tab !== "CASH" && tab !== "MAPPINGS" && <Button type="submit"><Save className="size-4" /> Simpan master</Button>}</form></Card><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-extrabold">Daftar {tab}</h2><p className="text-[11px] text-slate-400">Data aktif dari database.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9 text-xs sm:w-56" placeholder="Cari..." /></div></div></div>{tab === "ACCOUNTS" ? <SimpleTable headers={["Kode", "Nama akun", "Jenis", "Normal", "Status"]} rows={accounts.map((a) => [a.code, a.name, a.accountType, a.normalBalance, a.active ? "Aktif" : "Nonaktif"])} /> : tab === "UNITS" ? <SimpleTable headers={["Kode", "Unit", "Entitas", "Konsolidasi"]} rows={units.map((u) => [u.code, u.name, u.entityType, u.consolidation ? "Ya" : "Tidak"])} /> : tab === "CASH" ? <SimpleTable headers={["Rekening", "Jenis", "Bank", "Unit"]} rows={cash.map((c) => [c.name, c.kind, c.bankName ?? "-", c.unitId.slice(-6)])} /> : tab === "MAPPINGS" ? <SimpleTable headers={["Kode", "Nama mapping", "Kategori", "Baris", "Status", "Aksi"]} rows={mappings.map((m) => [m.code, m.name, m.category, m.templateLines.length, m.active ? "Aktif" : "Nonaktif", <Button key={m._id} size="sm" variant="secondary" onClick={async () => { try { await updateMapping({ mappingId: m._id, name: m.name, active: !m.active, templateLines: m.templateLines }); setMessage("Status mapping diperbarui."); } catch (err) { setMessage(errorMessage(err)); } }}>{m.active ? "Nonaktifkan" : "Aktifkan"}</Button>])} /> : <SimpleTable headers={["Kode", "Nama", "Jenis", "Status"]} rows={contacts.page.map((c) => [c.code, c.name, c.contactType, c.active ? "Aktif" : "Nonaktif"])} />}</Card></div></div>;
}

export function ClosingPage() {
  const periods = useQuery(api.periods.listPeriods, {});
  const [selected, setSelected] = useState<any | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation(api.periods.saveClosingChecklist);
  const close = useMutation(api.periods.closePeriod);
  const reopen = useMutation(api.periods.reopenPeriod);
  const [message, setMessage] = useState("");
  if (!periods) return <LoadingState />;
  const toggle = async (period: any, index: number) => { const checklist = period.checklist.map((item: any, i: number) => i === index ? { ...item, completed: !item.completed } : item); await save({ periodId: period._id, checklist }); setMessage("Checklist closing diperbarui."); };
  return <div><PageHeader eyebrow="Accounting Period" title="Periode & Closing" description="Periode tertutup melindungi transaksi dari perubahan dan koreksi." actions={<Badge tone="blue"><LockKeyhole className="mr-1 size-3" />Period lock</Badge>} />{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}<div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-extrabold">Daftar periode</h2><p className="text-[11px] text-slate-400">Status OPEN menerima transaksi; CLOSED dilindungi.</p></div><SimpleTable headers={["Periode", "Status", "Checklist", "Aksi"]} rows={periods.map((period) => [period.code, <Badge key={period._id} tone={period.status === "OPEN" ? "green" : "slate"}>{period.status}</Badge>, `${period.checklist.filter((item: any) => item.completed).length}/${period.checklist.length}`, <Button key={period._id} size="sm" variant="secondary" onClick={() => setSelected(period)}>Kelola</Button>])} /></Card><Card className="p-5">{selected ? <><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Closing checklist</p><h2 className="mt-1 text-lg font-extrabold">{selected.code}</h2></div><button onClick={() => setSelected(null)}><X className="size-5" /></button></div><div className="mt-5 grid gap-2">{(selected.checklist.length ? selected.checklist : [{ item: "Belum ada checklist", completed: false }]).map((item: any, index: number) => <label key={`${item.item}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-semibold"><input type="checkbox" checked={item.completed} onChange={() => toggle(selected, index)} disabled={selected.status === "CLOSED"} className="size-4 accent-emerald-800" />{item.item}</label>)}</div>{selected.status === "OPEN" ? <><Field label="Konfirmasi kode periode"><Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={selected.code} /></Field><Button className="mt-3 w-full" onClick={async () => { try { await close({ periodId: selected._id, confirmation }); setMessage("Periode berhasil ditutup."); setSelected(null); } catch (err) { setMessage(errorMessage(err)); } }}><LockKeyhole className="size-4" /> Tutup periode</Button></> : <><div className="mt-5 grid gap-3"><Field label="Alasan reopen"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wajib untuk audit" /></Field><Field label="Konfirmasi"><Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={`REOPEN ${selected.code}`} /></Field><Button variant="danger" onClick={async () => { try { await reopen({ periodId: selected._id, reason, confirmation }); setMessage("Periode berhasil dibuka kembali."); setSelected(null); } catch (err) { setMessage(errorMessage(err)); } }}><RefreshCw className="size-4" /> Reopen periode</Button></div></>}</> : <div className="flex min-h-80 flex-col items-center justify-center text-center"><ClipboardList className="size-9 text-slate-300"/><p className="mt-3 text-sm font-bold">Pilih periode</p><p className="mt-1 text-xs text-slate-400">Checklist dan kontrol closing tampil di sini.</p></div>}</Card></div></div>;
}

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState<"read" | "import" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const runImport = useMutation(api.imports.importWorkbook);
  const batches = useQuery(api.imports.listImportBatches, {});
  const legacy = useQuery(api.imports.legacyStatus, {});
  const readFile = async (e: FormEvent) => { e.preventDefault(); if (!file) return; setError(""); setMessage(""); setBusy("read"); try { const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true }); const coa = parseLegacyCoa(workbook); const opening = parseLegacyOpening(workbook); const journals = parseLegacyJournals(workbook); const trend = parseLegacyTrend(workbook); setReport({ coa: coa.rows, opening: opening.rows, journals: journals.rows, trend: trend.rows, blocking: opening.errors, warnings: [...coa.errors, ...journals.errors, ...trend.errors] }); setMessage("File terbaca. Periksa rincian di samping, lalu klik Import Semua Data."); } catch (err) { setError(errorMessage(err)); } finally { setBusy(""); } };
  const doImport = async () => { if (!report || !file) return; setError(""); setBusy("import"); try { const result = await runImport({ fileName: file.name, checksum: `${file.name}-${file.size}`, coa: report.coa, opening: report.opening, journals: report.journals, trend: report.trend }); setMessage(`Import selesai. ${result.accounts} akun COA, ${result.journals} jurnal historis${result.journalSkipped ? ` (${result.journalSkipped} dilewati karena tidak balance)` : ""}, dan ${result.openingRows} saldo awal per ${result.asOfLabel} (total ${formatIDR(result.totalDebit)})${result.trendRows ? `, ${result.trendRows} bulan tren surplus/defisit` : ""}.${result.replacedJournals ? ` ${result.replacedJournals} jurnal import sebelumnya diganti.` : ""} Dashboard kini mengikuti Neraca.`); setReport(null); setFile(null); } catch (err) { setError(errorMessage(err)); } finally { setBusy(""); } };
  return <div><PageHeader eyebrow="Data Migration" title="Import Excel" description="Satu file Excel untuk seluruh laporan keuangan. File asli tidak diubah." actions={<Badge tone="amber"><FileSpreadsheet className="mr-1 size-3" />Safe migration</Badge>} />{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}{error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"><AlertTriangle className="mr-1.5 inline size-3.5" />{error}</div>}<div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card className="p-5"><h2 className="text-base font-extrabold">Unggah workbook</h2><p className="mt-1 text-xs leading-6 text-slate-500">Unggah <strong>1. LK PIAT6_0626_Konsol.xlsx</strong>. File ini sudah berisi COA, saldo awal dari Neraca, dan jurnal historis. Semuanya terbaca otomatis sehingga kas, piutang, persediaan, aset, dan kewajiban di dashboard sama persis dengan Excel.</p><form onSubmit={readFile} className="mt-5 grid gap-4"><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center hover:border-emerald-700/40"><Upload className="size-7 text-emerald-700" /><strong className="mt-3 text-sm">{file?.name ?? "Pilih file Excel"}</strong><span className="mt-1 text-xs text-slate-400">XLSX · maksimal 25 MB untuk import</span><input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><Button type="submit" disabled={busy === "read"}><FileSpreadsheet className="size-4" /> {busy === "read" ? "Membaca file..." : "Baca File Excel"}</Button></form></Card><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-extrabold">Rincian file</h2><p className="text-[11px] text-slate-400">Tidak ada data yang masuk sebelum tombol Import ditekan.</p></div>{report ? <div className="p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Stat label="Akun COA" value={`${report.coa.length} akun`} tone="green"/><Stat label="Saldo awal (Neraca)" value={`${report.opening.length} akun`} tone="green"/><Stat label="Jurnal historis" value={`${report.journals.length} jurnal`}/><Stat label="Tren bulanan" value={`${report.trend.length} bulan`}/><Stat label="Posisi saldo" value={report.opening[0] ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(report.opening[0].referenceDate)) : "Tidak terbaca"} tone={report.opening.length ? "default" : "red"}/></div>{(report.blocking.length > 0 || report.warnings.length > 0) && <div className="mt-4 grid gap-2">{report.blocking.map((item: string) => <div key={item} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><AlertTriangle className="mr-1.5 inline size-3.5" />{item}</div>)}{report.warnings.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>{report.warnings.length} catatan jurnal historis</strong> dilewati otomatis. Saldo akhir tetap mengikuti Neraca.<ul className="mt-1 list-disc pl-4">{report.warnings.slice(0, 4).map((item: string) => <li key={item}>{item}</li>)}</ul></div> : null}</div>}<div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-100"><SimpleTable headers={["Kode akun", "Nama akun", "Saldo di Neraca", "Sisi"]} rows={report.opening.slice(0, 100).map((row: any) => [row.accountCode, row.accountName, formatIDR(row.amount), row.side])} /></div><div className="mt-5"><Button disabled={report.blocking.length > 0 || busy === "import"} onClick={doImport}><FileSpreadsheet className="size-4" /> {busy === "import" ? "Mengimpor..." : "Import Semua Data"}</Button><p className="mt-3 text-[10px] leading-5 text-slate-400">Satu klik mengisi COA, saldo awal dari Neraca, dan jurnal historis sekaligus. Jurnal hasil import sebelumnya otomatis diganti agar angka dashboard selalu sama dengan Excel.</p></div></div> : <EmptyState icon={<FileSpreadsheet className="size-8" />} title="File belum dibaca" description="Pilih file Excel lalu klik Baca File Excel. Satu file sudah cukup untuk seluruh laporan keuangan." />}</Card></div><Card className="mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-extrabold">Status data di server</h2><p className="mt-1 text-[11px] text-slate-400">Saldo dashboard mengikuti jurnal pembuka dari Neraca.</p></div><div className="p-5"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Jurnal pembuka (Neraca)" value={legacy?.openingJournalCount ? `${legacy.openingJournalCount} jurnal` : "Belum ada"} tone={legacy?.openingJournalCount ? "green" : "red"} /><Stat label="Jurnal historis" value={legacy?.legacyJournalCount ?? "-"} /><Stat label="Nilai jurnal historis" value={formatIDR(legacy?.legacyAmount ?? 0, true)} /></div></div></Card><Card className="mt-5 overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-extrabold">Riwayat batch import</h2></div>{batches?.length ? <SimpleTable headers={["File", "Mode", "Status", "Baris", "Dibuat"]} rows={batches.map((batch) => [batch.fileName, batch.mode, batch.status, `${batch.importedRows}/${batch.totalRows}`, formatDate(batch.createdAt)])} /> : <EmptyState title="Belum ada batch" description="Riwayat import akan tersimpan di audit trail." />}</Card></div>;
}

export function ReconciliationPage() {
  const report = useQuery(api.reports.legacyReconciliation, {});
  const [message, setMessage] = useState("");
  if (!report) return <LoadingState />;
  return <div><PageHeader eyebrow="Accounting Reconciliation" title="Rekonsiliasi dengan Excel" description="Bandingkan jurnal aplikasi dengan baseline LK Juni 2026. Difference harus dijelaskan sebelum go-live." actions={<Badge tone={report.balanced ? "green" : "amber"}><RefreshCw className="mr-1 size-3" />{report.balanced ? "Balanced" : "Perlu review"}</Badge>} />{message && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}<div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat label="Total difference" value={formatIDR(report.totalDifference)} tone={report.totalDifference === 0 ? "green" : "red"}/><Stat label="Reference" value="30 Jun 2026"/><Stat label="Source" value="LK PIAT6_0626_Konsol"/></div><Card className="overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-base font-extrabold">Account reconciliation</h2><p className="text-[11px] text-slate-400">Perbedaan belum otomatis dianggap error; opening migration yang belum diimpor akan terlihat di sini.</p></div><SimpleTable headers={["Sheet", "Kode", "Nama", "Excel", "Aplikasi", "Selisih", "Status"]} rows={report.rows.map((row: any) => [row.sourceSheet, row.accountCode, row.accountName, formatIDR(row.amount), formatIDR(row.currentAmount), formatIDR(row.difference), <Badge key={row._id} tone={row.status === "MATCH" ? "green" : "amber"}>{row.status}</Badge>])} /></Card><Card className="mt-4 flex items-start gap-3 border-amber-200 bg-amber-50 p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700"/><p className="text-xs leading-6 text-amber-900"><strong>Go-live gate:</strong> selesaikan import saldo awal yang balance, konfirmasi rekening bank, lalu lakukan parallel run minimal satu siklus sebelum periode pertama ditutup.</p></Card></div>;
}

export function AuditPage() {
  const [search, setSearch] = useState("");
  const logs = useQuery(api.audit.listAuditLogs, { paginationOpts: { numItems: 100, cursor: null }, entityType: search || undefined });
  if (!logs) return <LoadingState />;
  return <div><PageHeader eyebrow="Governance" title="Audit Trail" description="Jejak perubahan penting. User tidak dapat mengedit log melalui API aplikasi." actions={<Badge tone="slate"><History className="mr-1 size-3" />Read-only</Badge>} /><Card className="mb-4 p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Filter entity type..." /></div></Card><Card className="overflow-hidden"><SimpleTable headers={["Waktu", "Entity", "Aksi", "Actor", "Perubahan"]} rows={logs.page.map((log: any) => [formatDate(log.createdAt), `${log.entityType}/${log.entityId}`, log.action, log.actorEmail ?? log.actorId, log.before || log.after ? "Tersimpan" : "-"])} /></Card></div>;
}

export function UsersPage() {
  const users = useQuery(api.master.listUsers, {});
  const updateRole = useMutation(api.master.updateUserRole);
  const [message, setMessage] = useState("");
  if (!users) return <LoadingState />;
  return <div><PageHeader eyebrow="Access Control" title="Pengguna & Akses" description="Role menentukan izin backend. Frontend bukan sumber kebenaran keamanan." actions={<Badge tone="green"><ShieldCheck className="mr-1 size-3" />RBAC backend</Badge>} />{message && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}<Card className="overflow-hidden"><SimpleTable headers={["Pengguna", "Email", "Role", "Status", "Aksi"]} rows={users.map((user) => [user.name ?? "Pengguna", user.email ?? "-", <Select key={user._id} value={user.appRole} onChange={async (e) => { try { await updateRole({ userId: user._id, role: e.target.value as any }); setMessage("Role pengguna diperbarui."); } catch (err) { setMessage(errorMessage(err)); } }} className="h-9 min-w-40 text-xs"><option value="SUPER_ADMIN">Super Admin</option><option value="ADMIN_KEUANGAN">Admin Keuangan</option><option value="BENDAHARA">Bendahara</option><option value="REVIEWER">Reviewer</option><option value="MUDIR">Mudir</option><option value="YAYASAN">Yayasan</option><option value="AUDITOR">Auditor</option></Select>, user.status, ""])} /></Card></div>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: any[][] }) { return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-5 py-3 font-black">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={headers.length} className="px-5 py-12 text-center text-slate-400">Belum ada data.</td></tr> : rows.map((row, index) => <tr key={index} className="hover:bg-slate-50/70">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-3 text-slate-600">{cell}</td>)}</tr>)}</tbody></table></div>; }
function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "green" | "red" }) { return <Card className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${tone === "green" ? "text-emerald-800" : tone === "red" ? "text-rose-700" : "text-slate-900"}`}>{value}</p></Card>; }
function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  // Convex menutupi pesan server dengan teks generik; beri petunjuk yang bisa ditindaklanjuti.
  if (/server error|internal error|called by client/i.test(raw)) {
    return "Server gagal memproses import. Coba ulang sekali. Jika masih gagal, hubungi admin untuk memeriksa log server.";
  }
  return raw || "Terjadi kesalahan. Silakan coba kembali.";
}

function parseLegacyCoa(workbook: any) {
  const accounts = new Map<string, any>();
  for (const sheetName of ["BS", "RL", "GL"]) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    for (const row of XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: "" })) {
      const code = String(row?.[0] ?? "");
      if (!/^[1-5]-\d{3,4}$/.test(code) || !String(row?.[1] ?? "").trim()) continue;
      if (!accounts.has(code)) {
        accounts.set(code, { code, name: String(row[1]), accountType: code.startsWith("1") ? "ASSET" : code.startsWith("2") ? "LIABILITY" : code.startsWith("3") ? "NET_ASSET" : code.startsWith("4") ? "REVENUE" : "EXPENSE", isCash: code.startsWith("1-11"), isBank: code.startsWith("1-112"), sourceSheet: sheetName });
      }
    }
  }
  return { rows: Array.from(accounts.values()), errors: accounts.size ? [] : ["Tidak ada baris COA dengan kode akun yang valid."] };
}

function parseLegacyOpening(workbook: any) {
  const sheet = workbook.Sheets["BS"];
  if (!sheet) return { rows: [], errors: ["Sheet BS tidak ditemukan pada workbook."] };
  const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null });
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  let referenceDate = Date.UTC(2026, 5, 30, 23, 59, 59, 999);
  for (let index = 0; index < Math.min(data.length, 15); index++) {
    for (const cell of data[index] ?? []) {
      const match = String(cell ?? "").match(/as of\s+([a-z]+)\s+(\d{4})/i);
      if (!match) continue;
      const monthIndex = monthNames.indexOf(match[1].toLowerCase());
      if (monthIndex < 0) continue;
      referenceDate = Date.UTC(Number(match[2]), monthIndex + 1, 0, 23, 59, 59, 999);
    }
  }
  const toAmount = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.replace(/[^0-9,.-]/g, "").replace(/,/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const leaves: any[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let groupFloor = 0;
  for (const row of data) {
    const code = String(row?.[0] ?? "").trim();
    if (!/^[1-5]-\d{4}$/.test(code)) continue;
    const name = String(row?.[1] ?? "").trim();
    if (!name) continue;
    const amount = toAmount(row?.[2]);
    if (amount === null) {
      groupFloor = leaves.length;
      continue;
    }
    if (name.toLowerCase().startsWith("total")) {
      while (leaves.length > groupFloor) leaves.pop();
      if (Math.abs(amount) >= 0.01 && !seen.has(code)) {
        seen.add(code);
        leaves.push({ code, name, amount });
      }
      continue;
    }
    if (!code.startsWith("1") && !code.startsWith("2") && !code.startsWith("3")) continue;
    if (Math.abs(amount) < 0.01 || seen.has(code)) continue;
    seen.add(code);
    leaves.push({ code, name, amount });
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = leaves.map((leaf) => {
    const accountType = leaf.code.startsWith("1") ? "ASSET" : leaf.code.startsWith("2") ? "LIABILITY" : "NET_ASSET";
    const debitNormal = accountType === "ASSET";
    const isDebit = debitNormal === leaf.amount > 0;
    const magnitude = Math.round(Math.abs(leaf.amount) * 100) / 100;
    if (isDebit) totalDebit += magnitude;
    else totalCredit += magnitude;
    return { accountCode: leaf.code, accountName: leaf.name, accountType, amount: magnitude, side: isDebit ? "Debit" : "Kredit", sourceSheet: "BS", referenceDate };
  });
  if (rows.length === 0) errors.push("Sheet BS tidak memiliki baris saldo akun yang dapat diimpor.");
  if (Math.round((totalDebit - totalCredit) * 100) !== 0) errors.push(`Neraca tidak balance: total debit ${Math.round(totalDebit)} vs total kredit ${Math.round(totalCredit)}.`);
  return { rows, errors };
}

const MONTH_INDEX: Record<string, number> = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, nopember: 11, november: 11, desember: 12 };

/** Tren surplus/defisit bulanan dari sheet Grafik (mis. Juli 2025 - Juni 2026). */
function parseLegacyTrend(workbook: any) {
  const sheet = workbook.Sheets["Grafik"] ?? workbook.Sheets["Grafik 1"];
  if (!sheet) return { rows: [], errors: ["Sheet Grafik tidak ditemukan pada workbook."] };
  const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null });
  const toNumber = (value: unknown) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = String(value ?? "").trim();
    if (!text || text === "-" || text === "–") return null;
    const parsed = Number(text.replace(/[^0-9,.-]/g, "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  let headerIndex = -1;
  let columns: { index: number; monthKey: string; label: string }[] = [];
  for (let index = 0; index < data.length; index++) {
    const found: { index: number; monthKey: string; label: string }[] = [];
    (data[index] ?? []).forEach((cell, cellIndex) => {
      const match = String(cell ?? "").match(/(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|Nopember|November|Desember)\s+(\d{4})/i);
      if (!match) return;
      const month = MONTH_INDEX[match[1].toLowerCase()];
      if (!month) return;
      found.push({ index: cellIndex, monthKey: `${match[2]}-${String(month).padStart(2, "0")}`, label: `${match[1]} ${match[2]}` });
    });
    if (found.length >= 6) {
      headerIndex = index;
      columns = found;
      break;
    }
  }
  if (headerIndex < 0) return { rows: [], errors: ["Header bulan tren surplus/defisit tidak ditemukan di sheet Grafik."] };
  const findRow = (test: RegExp) => {
    for (let index = headerIndex + 1; index < data.length; index++) {
      const label = String(data[index]?.[0] ?? "").trim();
      if (label && test.test(label)) return data[index] ?? [];
    }
    return null;
  };
  const revenueRow = findRow(/revenue/i);
  const expenseRow = findRow(/expense/i);
  const surplusRow = findRow(/increase|decrease/i);
  const errors: string[] = [];
  if (!revenueRow) errors.push("Baris pendapatan bulanan tidak ditemukan di sheet Grafik.");
  if (!expenseRow) errors.push("Baris beban bulanan tidak ditemukan di sheet Grafik.");
  const rows = columns.map((column) => {
    const revenue = toNumber(revenueRow?.[column.index]) ?? 0;
    const expense = toNumber(expenseRow?.[column.index]) ?? 0;
    const surplus = toNumber(surplusRow?.[column.index]);
    return { monthKey: column.monthKey, label: column.label, revenue: Math.round(revenue * 100) / 100, expense: Math.round(expense * 100) / 100, surplus: surplus === null ? Math.round((revenue - expense) * 100) / 100 : Math.round(surplus * 100) / 100 };
  });
  if (rows.length === 0) errors.push("Tren bulanan tidak memiliki data.");
  return { rows, errors };
}

function parseLegacyJournalDate(value: unknown): string | null {
  const match = String(value ?? "").trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

function parseLegacyJournals(workbook: any) {
  const rows: any[] = [];
  const errors: string[] = [];
  for (const sheetName of ["CR", "CD", "JM"]) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      errors.push(`Sheet ${sheetName} tidak ditemukan.`);
      continue;
    }
    const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: "" });
    for (let index = 0; index < data.length; index++) {
      const header = data[index];
      if (!["CR", "CD", "GJ"].includes(String(header?.[0] ?? ""))) continue;
      const date = parseLegacyJournalDate(header?.[1]);
      if (!date) {
        errors.push(`Tanggal jurnal ${sheetName} baris ${index + 1} tidak valid.`);
        continue;
      }
      const lines: any[] = [];
      let sourceNumber = "";
      let cursor = index + 1;
      for (; cursor < data.length && !["CR", "CD", "GJ"].includes(String(data[cursor]?.[0] ?? "")); cursor++) {
        const line = data[cursor];
        const accountCode = String(line?.[3] ?? "");
        if (!/^[1-5]-\d{3,4}$/.test(accountCode)) continue;
        const debit = Number(line?.[5] ?? 0);
        const credit = Number(line?.[6] ?? 0);
        if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
          errors.push(`Nominal jurnal ${sheetName} baris ${cursor + 1} tidak valid.`);
          continue;
        }
        if (!sourceNumber && line?.[2]) sourceNumber = String(line[2]);
        lines.push({ accountCode, debit, credit, description: String(line?.[4] ?? "") });
      }
      const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
      if (lines.length < 2) errors.push(`Jurnal ${sheetName} baris ${index + 1} tidak memiliki minimal dua baris.`);
      if (Math.round(totalDebit - totalCredit) !== 0) errors.push(`Jurnal ${sheetName} ${sourceNumber || index + 1} tidak balance.`);
      rows.push({ number: `LEGACY-${sheetName}-${sourceNumber || index + 1}`, sourceId: `${sheetName}:${sourceNumber || index + 1}`, date, description: String(header?.[2] ?? `Impor jurnal ${sheetName}`), lines });
      index = cursor - 1;
    }
  }
  return { rows, errors };
}
