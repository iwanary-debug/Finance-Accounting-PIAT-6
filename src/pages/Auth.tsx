import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useConvexAuth, useAuthActions } from "@convex-dev/auth/react";
import { Button, Input } from "../components/ui";
import { backendWarning } from "../lib/convex";

export function Auth({ onNavigate, returnTo = "/dashboard" }: { onNavigate: (path: string) => void; returnTo?: string }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (isAuthenticated) onNavigate(returnTo); }, [isAuthenticated, returnTo, onNavigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const params: Record<string, string> = { flow, email: email.trim().toLowerCase(), password };
      if (flow === "signUp" && name.trim()) params.name = name.trim();
      await Promise.race([
        signIn("password", params),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Server autentikasi belum dapat diakses. Periksa deployment Convex atau hubungi Super Admin.")), 15_000)),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autentikasi gagal. Periksa kembali data Anda.");
    } finally { setBusy(false); }
  };

  return <div className="grid min-h-screen bg-[#f3f1e8] lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden bg-[#0b3b36] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-40 -top-40 size-[620px] rounded-full border-[90px] border-[#d7b45a]/7" />
      <button onClick={() => onNavigate("/")} className="relative flex items-center gap-3 text-left"><div className="grid size-11 place-items-center rounded-xl bg-[#d7b45a] font-black text-emerald-950">P6</div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-200/60">PIAT 6 Bondowoso</p><p className="text-sm font-extrabold">Finance & Accounting</p></div></button>
      <div className="relative max-w-xl"><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#d7b45a]">Ruang Kerja Terproteksi</p><h1 className="mt-4 text-5xl font-black leading-[1.03] tracking-[-.05em]">Akses yang tepat untuk setiap peran keuangan.</h1><p className="mt-6 max-w-lg leading-8 text-emerald-100/60">RBAC, sesi terenkripsi, jejak audit, dan kontrol periode dijalankan di backend Convex—bukan sekadar disembunyikan di antarmuka.</p><div className="mt-9 grid gap-3 sm:grid-cols-2"><AuthPoint icon={ShieldCheck} text="Otorisasi server-side" /><AuthPoint icon={LockKeyhole} text="Kata sandi di-hash Scrypt" /><AuthPoint icon={CheckCircle2} text="Posted reversal only" /><AuthPoint icon={CheckCircle2} text="Audit trail immutable UI" /></div></div>
      <p className="relative text-[10px] font-semibold text-emerald-100/35">Yayasan An Nawawi Bondowoso · Indonesia</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <button onClick={() => onNavigate("/")} className="mb-8 flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 lg:hidden"><ArrowLeft className="size-4" />Kembali</button>
        <div className="rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_24px_80px_rgba(11,59,54,.1)] sm:p-9">
          {backendWarning && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">Preview ini masih terhubung ke Convex lokal. Login tidak dapat diproses sampai deployment Convex produksi dikonfigurasi.</div>}
          <div className="mb-7"><div className="mb-5 grid size-12 place-items-center rounded-2xl bg-emerald-950 text-[#d7b45a]"><LockKeyhole className="size-5" /></div><h2 className="text-2xl font-black tracking-[-.03em] text-slate-950">{flow === "signIn" ? "Masuk ke ruang keuangan" : "Buat akun pengguna"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{flow === "signIn" ? "Gunakan akun yang telah terdaftar untuk melanjutkan." : "Pengguna pertama menjadi Super Admin. Registrasi berikutnya memperoleh akses Bendahara dan dapat diubah oleh Super Admin."}</p></div>
          <form onSubmit={submit} className="grid gap-4">
            {flow === "signUp" && <label className="grid gap-1.5"><span className="text-xs font-bold text-slate-700">Nama lengkap</span><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama pengguna" required autoComplete="name" /></label>}
            <label className="grid gap-1.5"><span className="text-xs font-bold text-slate-700">Email</span><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@piat6.sch.id" required autoComplete="email" /></label>
            <label className="grid gap-1.5"><span className="text-xs font-bold text-slate-700">Kata sandi</span><div className="relative"><Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required autoComplete={flow === "signIn" ? "current-password" : "new-password"} className="pr-11" /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{flow === "signUp" && <span className="text-[10px] text-slate-400">Minimal 10 karakter, huruf besar/kecil, dan angka.</span>}</label>
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-medium leading-5 text-rose-700">{error}</div>}
            <Button type="submit" size="lg" disabled={busy || isLoading}>{busy ? "Memproses..." : flow === "signIn" ? "Masuk" : "Buat akun"}<ArrowRight className="size-4" /></Button>
          </form>
          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-100"/><span className="text-[10px] font-bold text-slate-400">PIAT 6 ACCESS</span><div className="h-px flex-1 bg-slate-100"/></div>
          <button onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(""); }} className="w-full text-center text-xs font-bold text-emerald-800 hover:text-emerald-950">{flow === "signIn" ? "Belum memiliki akun? Daftar pengguna" : "Sudah memiliki akun? Masuk"}</button>
        </div>
        <p className="mt-5 text-center text-[10px] leading-5 text-slate-400">Dengan mengakses aplikasi, Anda menyatakan akan menggunakan sistem ini sesuai kebijakan internal PIAT 6..</p>
      </div>
    </section>
  </div>;
}

function AuthPoint({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) { return <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-xs font-semibold text-emerald-50/75"><Icon className="size-4 text-[#d7b45a]" />{text}</div>; }
