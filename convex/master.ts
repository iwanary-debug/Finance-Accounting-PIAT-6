import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireRole, requireUser } from "./lib/authz";

const appRole = v.union(
  v.literal("SUPER_ADMIN"),
  v.literal("ADMIN_KEUANGAN"),
  v.literal("BENDAHARA"),
  v.literal("REVIEWER"),
  v.literal("MUDIR"),
  v.literal("YAYASAN"),
  v.literal("AUDITOR"),
);

const accountType = v.union(
  v.literal("ASSET"),
  v.literal("LIABILITY"),
  v.literal("NET_ASSET"),
  v.literal("REVENUE"),
  v.literal("EXPENSE"),
);

export const bootstrapState = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return { initialized: (await ctx.db.query("units").first()) !== null, role: user.appRole };
  },
});

export const listUnits = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("units").collect();
    return rows.filter((row) => args.includeInactive || row.active).sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const listAccounts = query({
  args: { includeInactive: v.optional(v.boolean()), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("accounts").collect();
    const search = args.search?.toLowerCase().trim();
    return rows
      .filter((row) => (args.includeInactive || row.active) && (!search || row.code.toLowerCase().includes(search) || row.name.toLowerCase().includes(search)))
      .sort((a, b) => a.code.localeCompare(b.code));
  },
});

export const listCashAccounts = query({
  args: { unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("cashAccounts").collect();
    return rows.filter((row) => row.active && (!args.unitId || row.unitId === args.unitId));
  },
});

export const listMappings = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("accountMappings").collect();
  },
});

export const listContacts = query({
  args: { paginationOpts: paginationOptsValidator, search: v.optional(v.string()), contactType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const result = await ctx.db.query("contacts").withIndex("contactType").paginate(args.paginationOpts);
    const search = args.search?.toLowerCase().trim();
    const page = result.page.filter((row) => row.active && (!args.contactType || row.contactType === args.contactType) && (!search || row.name.toLowerCase().includes(search) || row.code.toLowerCase().includes(search)));
    return { ...result, page };
  },
});

export const listPrograms = query({
  args: { unitId: v.optional(v.id("units")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("programs").collect();
    return rows.filter((row) => row.active && (!args.unitId || row.unitId === args.unitId));
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN"]);
    return await ctx.db.query("users").collect();
  },
});

export const updateMapping = mutation({
  args: { mappingId: v.id("accountMappings"), name: v.string(), active: v.boolean(), templateLines: v.array(v.object({ side: v.union(v.literal("DEBIT"), v.literal("CREDIT")), accountCode: v.string(), amountMode: v.union(v.literal("AMOUNT"), v.literal("ZERO")), description: v.string() })) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) throw new Error("Mapping tidak ditemukan.");
    await ctx.db.patch(args.mappingId, { name: args.name, active: args.active, templateLines: args.templateLines });
    await audit(ctx, { entityType: "accountMappings", entityId: args.mappingId, action: "UPDATE", actor, before: mapping, after: args });
    return args.mappingId;
  },
});

export const createUnit = mutation({
  args: { code: v.string(), name: v.string(), entityType: v.string(), parentUnitId: v.optional(v.id("units")), consolidation: v.boolean(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    if (await ctx.db.query("units").withIndex("code", (q) => q.eq("code", args.code)).unique()) throw new Error("Kode unit sudah digunakan.");
    const id = await ctx.db.insert("units", { ...args, entityType: args.entityType as any, active: true });
    await audit(ctx, { entityType: "units", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const createAccount = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    accountType,
    parentAccountId: v.optional(v.id("accounts")),
    normalBalance: v.union(v.literal("DEBIT"), v.literal("CREDIT")),
    unitId: v.optional(v.id("units")),
    isCash: v.boolean(),
    isBank: v.boolean(),
    isPostable: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    if (await ctx.db.query("accounts").withIndex("code", (q) => q.eq("code", args.code)).unique()) throw new Error("Kode akun sudah digunakan.");
    const id = await ctx.db.insert("accounts", { ...args, active: true });
    await audit(ctx, { entityType: "accounts", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const updateAccount = mutation({
  args: { accountId: v.id("accounts"), name: v.string(), description: v.optional(v.string()), active: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const before = await ctx.db.get(args.accountId);
    if (!before) throw new Error("Akun tidak ditemukan.");
    await ctx.db.patch(args.accountId, { name: args.name, description: args.description, active: args.active });
    await audit(ctx, { entityType: "accounts", entityId: args.accountId, action: "UPDATE", actor, before, after: args });
    return args.accountId;
  },
});

export const createCashAccount = mutation({
  args: { accountId: v.id("accounts"), unitId: v.id("units"), name: v.string(), kind: v.string(), bankName: v.optional(v.string()), accountNumber: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const id = await ctx.db.insert("cashAccounts", { ...args, kind: args.kind as any, currency: "IDR", active: true });
    await audit(ctx, { entityType: "cashAccounts", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const createContact = mutation({
  args: { code: v.string(), name: v.string(), contactType: v.string(), unitId: v.optional(v.id("units")), email: v.optional(v.string()), phone: v.optional(v.string()), address: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN", "BENDAHARA"]);
    if (await ctx.db.query("contacts").withIndex("code", (q) => q.eq("code", args.code)).unique()) throw new Error("Kode kontak sudah digunakan.");
    const id = await ctx.db.insert("contacts", { ...args, contactType: args.contactType as any, active: true });
    await audit(ctx, { entityType: "contacts", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const createProgram = mutation({
  args: { code: v.string(), name: v.string(), unitId: v.id("units"), activity: v.optional(v.string()), costCenter: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN", "ADMIN_KEUANGAN"]);
    const id = await ctx.db.insert("programs", { ...args, active: true });
    await audit(ctx, { entityType: "programs", entityId: id, action: "CREATE", actor, after: args });
    return id;
  },
});

export const updateUserRole = mutation({
  args: { userId: v.id("users"), role: appRole },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    requireRole(actor, ["SUPER_ADMIN"]);
    if (args.userId === actor._id && args.role !== "SUPER_ADMIN") throw new Error("Super Admin tidak dapat menurunkan role dirinya sendiri.");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Pengguna tidak ditemukan.");
    await ctx.db.patch(args.userId, { appRole: args.role });
    await audit(ctx, { entityType: "users", entityId: args.userId, action: "UPDATE_ROLE", actor, before: { appRole: user.appRole }, after: { appRole: args.role } });
    return args.userId;
  },
});
