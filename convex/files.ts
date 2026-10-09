import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireRole, requireUser } from "./lib/authz";

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const createAttachmentUpload = mutation({
  args: { contentType: v.string(), size: v.number() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    if (!allowedTypes.has(args.contentType)) throw new Error("Format bukti tidak diizinkan.");
    if (args.size <= 0 || args.size > 10 * 1024 * 1024) throw new Error("Ukuran bukti harus antara 1 byte dan 10 MB.");
    return ctx.storage.generateUploadUrl();
  },
});

export const completeAttachment = mutation({
  args: { storageId: v.string(), fileName: v.string(), contentType: v.string(), size: v.number(), checksum: v.string(), transactionId: v.optional(v.id("transactions")) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    if (!allowedTypes.has(args.contentType) || args.size <= 0 || args.size > 10 * 1024 * 1024) throw new Error("Metadata berkas tidak valid.");
    if (args.transactionId) {
      const transaction = await ctx.db.get(args.transactionId);
      if (!transaction) throw new Error("Transaksi tidak ditemukan.");
      if (transaction.status === "POSTED" || transaction.status === "REVERSED") throw new Error("Bukti transaksi yang telah diposting tidak dapat diganti.");
    }
    const id = await ctx.db.insert("attachments", { storageId: args.storageId, fileName: args.fileName, contentType: args.contentType, size: args.size, checksum: args.checksum, transactionId: args.transactionId, uploadedBy: actor._id, uploadedAt: Date.now() });
    if (args.transactionId) await ctx.db.patch(args.transactionId, { attachmentId: id, updatedAt: Date.now() });
    await audit(ctx, { entityType: "attachments", entityId: id, action: "UPLOAD", actor, after: { fileName: args.fileName, contentType: args.contentType, size: args.size, transactionId: args.transactionId } });
    return id;
  },
});

export const getAttachmentUrl = query({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment?.storageId) throw new Error("Lampiran tidak ditemukan.");
    return ctx.storage.getUrl(attachment.storageId);
  },
});
