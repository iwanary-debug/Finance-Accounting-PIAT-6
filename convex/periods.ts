import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireRole, requireUser } from "./lib/authz";

export const listPeriods = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("periods").collect();
  },
});

export const saveClosingChecklist = mutation({
  args: { periodId: v.id("periods"), checklist: v.array(v.object({ item: v.string(), completed: v.boolean() })) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "REVIEWER"]);
    const period = await ctx.db.get(args.periodId);
    if (!period) throw new Error("Periode tidak ditemukan.");
    if (period.status === "CLOSED") throw new Error("Periode sudah tertutup.");
    await ctx.db.patch(args.periodId, { checklist: args.checklist });
    await audit(ctx, { entityType: "periods", entityId: args.periodId, action: "UPDATE_CHECKLIST", actor, before: period, after: args });
    return args.periodId;
  },
});

export const closePeriod = mutation({
  args: { periodId: v.id("periods"), confirmation: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const period = await ctx.db.get(args.periodId);
    if (!period || period.status !== "OPEN") throw new Error("Periode tidak dalam status OPEN.");
    if (period.checklist.some((item) => !item.completed)) throw new Error("Semua item closing checklist harus selesai.");
    if (args.confirmation !== period.code) throw new Error("Kode konfirmasi periode tidak sesuai.");
    await ctx.db.patch(args.periodId, { status: "CLOSED", closedAt: Date.now(), closedBy: actor._id });
    await audit(ctx, { entityType: "periods", entityId: args.periodId, action: "CLOSE", actor, before: period, after: { status: "CLOSED" } });
    return args.periodId;
  },
});

export const reopenPeriod = mutation({
  args: { periodId: v.id("periods"), reason: v.string(), confirmation: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN"]);
    const period = await ctx.db.get(args.periodId);
    if (!period || period.status !== "CLOSED") throw new Error("Hanya periode CLOSED yang dapat dibuka kembali.");
    if (!args.reason.trim()) throw new Error("Alasan reopen wajib diisi.");
    if (args.confirmation !== `REOPEN ${period.code}`) throw new Error("Konfirmasi reopen tidak sesuai.");
    await ctx.db.patch(args.periodId, { status: "OPEN", reopenedAt: Date.now(), reopenedBy: actor._id });
    await audit(ctx, { entityType: "periods", entityId: args.periodId, action: "REOPEN", actor, before: period, after: { status: "OPEN", reason: args.reason } });
    return args.periodId;
  },
});
