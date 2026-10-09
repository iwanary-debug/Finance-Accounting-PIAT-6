import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id, DataModel } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN_KEUANGAN"
  | "BENDAHARA"
  | "REVIEWER"
  | "MUDIR"
  | "YAYASAN"
  | "AUDITOR";

export const PERMISSIONS = {
  createTransaction: ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"],
  reviewTransaction: ["SUPER_ADMIN", "ADMIN_KEUANGAN", "REVIEWER"],
  postTransaction: ["SUPER_ADMIN", "ADMIN_KEUANGAN"],
  reverseTransaction: ["SUPER_ADMIN", "ADMIN_KEUANGAN"],
  manageMaster: ["SUPER_ADMIN", "ADMIN_KEUANGAN"],
  managePeriod: ["SUPER_ADMIN", "ADMIN_KEUANGAN"],
  viewAudit: ["SUPER_ADMIN", "ADMIN_KEUANGAN", "AUDITOR"],
  manageUsers: ["SUPER_ADMIN"],
  importLegacy: ["SUPER_ADMIN", "ADMIN_KEUANGAN"],
} as const satisfies Record<string, readonly AppRole[]>;

type Ctx = QueryCtx | MutationCtx;

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("AUTH_REQUIRED");
  const user = await ctx.db.get(userId);
  if (!user || user.status !== "ACTIVE") throw new Error("FORBIDDEN");
  return user;
}

export function requireRole(user: Doc<"users">, allowed: readonly AppRole[]): void {
  if (!allowed.includes(user.appRole as AppRole)) throw new Error("FORBIDDEN");
}

export function can(role: AppRole, permission: keyof typeof PERMISSIONS): boolean {
  return (PERMISSIONS[permission] as readonly AppRole[]).includes(role);
}

export async function requirePeriod(ctx: MutationCtx, date: number) {
  const code = periodCode(date);
  const existing = await ctx.db
    .query("periods")
    .withIndex("code", (q) => q.eq("code", code))
    .unique();
  if (existing) {
    if (existing.status === "CLOSED") throw new Error("PERIOD_CLOSED");
    return existing;
  }
  const start = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth(), 1));
  const end = new Date(Date.UTC(new Date(date).getUTCFullYear(), new Date(date).getUTCMonth() + 1, 0));
  const createdId = await ctx.db.insert("periods", {
    code,
    name: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(start),
    startDate: start.getTime(),
    endDate: end.getTime(),
    status: "OPEN",
    checklist: [
      { item: "Rekonsiliasi bank dan kas selesai", completed: false },
      { item: "Seluruh transaksi telah diposting", completed: false },
      { item: "Piutang dan hutang telah ditinjau", completed: false },
      { item: "Neraca saldo seimbang", completed: false },
    ],
  });
  return (await ctx.db.get(createdId))!;
}

export function periodCode(date: number): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function assertMoney(value: number, field = "Nominal"): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} harus lebih dari nol.`);
  if (roundMoney(value) !== value) throw new Error(`${field} maksimal 2 angka desimal.`);
}

export async function nextSequence(ctx: MutationCtx, key: string): Promise<number> {
  const current = await ctx.db.query("counters").withIndex("key", (q) => q.eq("key", key)).unique();
  const value = (current?.value ?? 0) + 1;
  if (current) await ctx.db.patch(current._id, { value });
  else await ctx.db.insert("counters", { key, value });
  return value;
}

export async function audit(
  ctx: MutationCtx,
  entry: {
    entityType: string;
    entityId: string;
    action: string;
    actor: Doc<"users">;
    before?: unknown;
    after?: unknown;
    requestId?: string;
    ipHash?: string;
  },
): Promise<Id<"auditLogs">> {
  return ctx.db.insert("auditLogs", {
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    actorId: entry.actor._id,
    actorEmail: entry.actor.email,
    before: entry.before,
    after: entry.after,
    requestId: entry.requestId,
    ipHash: entry.ipHash,
    createdAt: Date.now(),
  });
}

export function assertUnitAndAccount(db: QueryCtx["db"] | MutationCtx["db"], unitId: Id<"units">, accountId: Id<"accounts">) {
  return { unitId, accountId };
}

export type AppDataModel = DataModel;
