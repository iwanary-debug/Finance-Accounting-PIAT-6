import { type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { LoaderCircle } from "lucide-react";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-emerald-900 text-white shadow-sm hover:bg-emerald-800 active:translate-y-px",
        variant === "secondary" && "border border-emerald-900/15 bg-white text-emerald-950 hover:border-emerald-800/30 hover:bg-emerald-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        variant === "danger" && "bg-rose-700 text-white hover:bg-rose-800",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={clsx("h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10 disabled:bg-slate-100", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return <select ref={ref} className={clsx("h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10", className)} {...props}>{children}</select>;
});

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className="grid gap-1.5"><span className="text-xs font-semibold text-slate-700">{label}{required && <span className="text-rose-600"> *</span>}</span>{children}{hint && <span className="text-[11px] leading-4 text-slate-400">{hint}</span>}</label>;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)]", className)} {...props} />;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" | "blue" }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold", tone === "slate" && "bg-slate-100 text-slate-600", tone === "green" && "bg-emerald-50 text-emerald-700", tone === "amber" && "bg-amber-50 text-amber-700", tone === "red" && "bg-rose-50 text-rose-700", tone === "blue" && "bg-sky-50 text-sky-700")}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-emerald-700">{eyebrow}</p>}<h1 className="text-2xl font-extrabold tracking-[-.03em] text-slate-950 sm:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}

export function LoadingState({ label = "Memuat data keuangan..." }: { label?: string }) {
  return <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin text-emerald-700" />{label}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center"><div className="mb-3 text-emerald-800">{icon}</div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}
