import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireRole, requireUser } from "./lib/authz";

export const receiveIntegrationEvent = mutation({
  args: { sourceSystem: v.string(), eventType: v.string(), sourceId: v.string(), idempotencyKey: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const existing = await ctx.db.query("integrationEvents").withIndex("idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) return { eventId: existing._id, status: existing.status, idempotent: true };
    const payloadHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(args.payload)));
    const hash = Array.from(new Uint8Array(payloadHash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const eventId = await ctx.db.insert("integrationEvents", { ...args, payloadHash: hash, status: "RECEIVED", receivedAt: Date.now() });
    await audit(ctx, { entityType: "integrationEvents", entityId: eventId, action: "RECEIVE", actor, after: { sourceSystem: args.sourceSystem, eventType: args.eventType, sourceId: args.sourceId } });
    return { eventId, status: "RECEIVED" as const, idempotent: false };
  },
});

export const markIntegrationProcessed = mutation({
  args: { eventId: v.id("integrationEvents"), transactionId: v.optional(v.id("transactions")) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Integration event tidak ditemukan.");
    if (event.status === "PROCESSED") return { eventId: event._id, status: event.status };
    await ctx.db.patch(event._id, { status: "PROCESSED", resultTransactionId: args.transactionId, processedAt: Date.now() });
    await audit(ctx, { entityType: "integrationEvents", entityId: event._id, action: "PROCESS", actor, after: { transactionId: args.transactionId } });
    return { eventId: event._id, status: "PROCESSED" as const };
  },
});

export const listIntegrationEvents = query({
  args: { sourceSystem: v.optional(v.string()), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "AUDITOR"]);
    const rows = await ctx.db.query("integrationEvents").collect();
    return rows.filter((row) => (!args.sourceSystem || row.sourceSystem === args.sourceSystem) && (!args.status || row.status === args.status)).sort((a, b) => b.receivedAt - a.receivedAt);
  },
});
