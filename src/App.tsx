import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { api } from "./convexApi";
import { Shell, type PageId } from "./components/Shell";
import { Landing } from "./pages/Landing";
import { Auth } from "./pages/Auth";
import { DashboardPage } from "./pages/DashboardPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { DetailPage } from "./pages/DetailPage";
import { AuditPage, ClosingPage, ImportPage, MasterPage, ReconciliationPage, ReceivablesPage, SupportingPage, UsersPage } from "./pages/OperationsPages";
import { Button } from "./components/ui";

function currentPath() { return window.location.pathname + window.location.search; }
function navigate(to: string) { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); window.scrollTo({ top: 0, behavior: "smooth" }); }

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [path, setPath] = useState(currentPath());
  useEffect(() => { const onPop = () => setPath(currentPath()); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  const url = new URL(path, window.location.origin);
  const returnTo = url.searchParams.get("returnTo") ?? "/dashboard";
  if (isLoading) return <Splash />;
  if (url.pathname === "/") return <Landing onNavigate={navigate} />;
  if (url.pathname === "/auth") return <Auth onNavigate={navigate} returnTo={returnTo} />;
  if (!isAuthenticated) return <Auth onNavigate={navigate} returnTo={url.pathname.startsWith("/dashboard") ? `${url.pathname}${url.search}` : "/dashboard"} />;
  return <Workspace path={path} />;
}

function Workspace({ path }: { path: string }) {
  const me = useQuery(api.me.me, {});
  const bootstrap = useQuery(api.master.bootstrapState, {});
  const ensureCore = useMutation(api.seed.ensureCoreData);
  const [initialized, setInitialized] = useState(false);
  const url = new URL(path, window.location.origin);
  const requested = url.searchParams.get("page") as PageId | null;
  const active = requested && ["dashboard", "transactions", "approvals", "receivables", "supporting", "reports", "reconciliation", "master", "closing", "import", "audit", "users", "detail"].includes(requested) ? requested : "dashboard";
  const numberParam = (value: string | null) => (value && Number.isFinite(Number(value)) ? Number(value) : undefined);
  useEffect(() => { if (bootstrap && !bootstrap.initialized && bootstrap.role === "SUPER_ADMIN" && !initialized) { ensureCore().then(() => setInitialized(true)).catch(() => setInitialized(true)); } }, [bootstrap, ensureCore, initialized]);
  useEffect(() => { if (url.pathname !== "/dashboard") navigate(`/dashboard?page=${active}`); }, [url.pathname, active]);
  if (!me || !bootstrap) return <Splash />;
  if (!bootstrap.initialized && !initialized) return <SetupNotice />;
  const onNavigate = (page: PageId) => navigate(`/dashboard?page=${page}`);
  const onOpenCard = (card: string, range?: { from?: number; to?: number; unitId?: string }) => {
    const params = new URLSearchParams({ page: "detail", card });
    if (range?.from) params.set("from", String(range.from));
    if (range?.to) params.set("to", String(range.to));
    if (range?.unitId) params.set("unit", range.unitId);
    navigate(`/dashboard?${params.toString()}`);
  };
  let content: React.ReactNode;
  if (active === "transactions") content = <TransactionsPage />;
  else if (active === "approvals") content = <ApprovalsPage />;
  else if (active === "receivables") content = <ReceivablesPage />;
  else if (active === "supporting") content = <SupportingPage />;
  else if (active === "reports") content = <ReportsPage />;
  else if (active === "reconciliation") content = <ReconciliationPage />;
  else if (active === "master") content = <MasterPage />;
  else if (active === "closing") content = <ClosingPage />;
  else if (active === "import") content = <ImportPage />;
  else if (active === "audit") content = <AuditPage />;
  else if (active === "users") content = <UsersPage />;
  else if (active === "detail") content = <DetailPage card={url.searchParams.get("card") ?? "cash"} from={numberParam(url.searchParams.get("from"))} to={numberParam(url.searchParams.get("to"))} unitId={url.searchParams.get("unit") ?? undefined} onBack={() => navigate("/dashboard?page=dashboard")} onOpenCard={onOpenCard} />;
  else content = <DashboardPage onNavigate={onNavigate} onOpenCard={onOpenCard} />;
  return <Shell active={active} onNavigate={onNavigate} role={me.role} name={me.name}>{content}</Shell>;
}

function Splash() { return <div className="grid min-h-screen place-items-center bg-[#f3f1e8]"><div className="text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-950 text-lg font-black text-[#d7b45a]">P6</div><div className="mx-auto mt-5 h-1.5 w-28 overflow-hidden rounded-full bg-emerald-950/10"><div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-700"/></div><p className="mt-4 text-xs font-bold text-emerald-950/45">Menyiapkan ruang keuangan...</p></div></div>; }
function SetupNotice() { return <div className="grid min-h-screen place-items-center bg-[#f3f1e8] p-5"><div className="max-w-md rounded-3xl border border-emerald-950/10 bg-white p-8 text-center shadow-xl"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-950 text-[#d7b45a]"><ShieldIcon /></div><h1 className="mt-5 text-xl font-black">Inisialisasi PIAT 6</h1><p className="mt-2 text-sm leading-6 text-slate-500">COA, unit PIAT 6, rekening, mapping, dan periode akan dibuat dari baseline Excel. Proses ini idempotent dan hanya dapat dilakukan Super Admin.</p><Button className="mt-6" onClick={() => window.location.reload()}>Muat ulang status</Button></div></div>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6"><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>; }
