import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convex } from "./lib/convex";
import App from "./App";
import "./index.css";

/** Mencegah satu halaman error membuat seluruh aplikasi tampil putih. */
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Render error:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 520, border: "1px solid #e2e8f0", borderRadius: 20, padding: 24, background: "white" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Terjadi kesalahan saat menampilkan halaman</h1>
        <p style={{ margin: "8px 0 16px", fontSize: 13, lineHeight: 1.7, color: "#64748b" }}>Data Anda aman. Muat ulang halaman, atau kembali ke dashboard.</p>
        <pre style={{ margin: 0, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 11, color: "#be123c", background: "#fff1f2", borderRadius: 12, padding: 12 }}>{this.state.error.message}</pre>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => window.location.reload()} style={{ borderRadius: 12, background: "#0f766e", color: "white", padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Muat ulang</button>
          <button onClick={() => { window.location.href = "/dashboard"; }} style={{ borderRadius: 12, border: "1px solid #e2e8f0", background: "white", color: "#0f172a", padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ke dashboard</button>
        </div>
      </div>
    </div>;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ConvexAuthProvider client={convex}><App /></ConvexAuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
