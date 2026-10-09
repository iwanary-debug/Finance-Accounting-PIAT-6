import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole, requireUser } from "./lib/authz";

export const listAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireRole(user, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "AUDITOR"]);
    const logs = (await ctx.db.query("auditLogs").withIndex("createdAt").order("desc").collect())
      .filter((log) =>
        (!args.entityType || log.entityType === args.entityType) &&
        (!args.entityId || log.entityId === args.entityId) &&
        (args.from === undefined || log.createdAt >= args.from) &&
        (args.to === undefined || log.createdAt <= args.to),
      );
    const cursor = args.paginationOpts.cursor ? Number(args.paginationOpts.cursor) : 0;
    const page = logs.slice(cursor, cursor + args.paginationOpts.numItems);
    return { page, isDone: cursor + page.length >= logs.length, continueCursor: String(cursor + page.length), total: logs.length };
  },
});
