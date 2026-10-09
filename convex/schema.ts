import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const role = v.union(
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
const workflowStatus = v.union(
  v.literal("DRAFT"),
  v.literal("SUBMITTED"),
  v.literal("REVIEW"),
  v.literal("APPROVED"),
  v.literal("POSTED"),
  v.literal("REVERSED"),
  v.literal("VOID"),
);
const money = v.number();

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    appRole: role,
    status: v.union(v.literal("ACTIVE"), v.literal("INACTIVE")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("appRole", ["appRole"]),

  units: defineTable({
    code: v.string(),
    name: v.string(),
    entityType: v.union(
      v.literal("EDUCATION"),
      v.literal("MTS"),
      v.literal("MA"),
      v.literal("SANTRI"),
      v.literal("BUSINESS"),
      v.literal("YAYASAN"),
      v.literal("OTHER"),
    ),
    parentUnitId: v.optional(v.id("units")),
    consolidation: v.boolean(),
    active: v.boolean(),
    description: v.optional(v.string()),
  })
    .index("code", ["code"])
    .index("entityType", ["entityType"]),

  accounts: defineTable({
    code: v.string(),
    name: v.string(),
    accountType,
    parentAccountId: v.optional(v.id("accounts")),
    normalBalance: v.union(v.literal("DEBIT"), v.literal("CREDIT")),
    unitId: v.optional(v.id("units")),
    isCash: v.boolean(),
    isBank: v.boolean(),
    active: v.boolean(),
    isPostable: v.boolean(),
    description: v.optional(v.string()),
    legacySource: v.optional(v.string()),
  })
    .index("code", ["code"])
    .index("accountType", ["accountType"])
    .index("unitAndType", ["unitId", "accountType"]),

  cashAccounts: defineTable({
    accountId: v.id("accounts"),
    unitId: v.id("units"),
    name: v.string(),
    kind: v.union(v.literal("CASH"), v.literal("BANK"), v.literal("WALLET")),
    bankName: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    currency: v.string(),
    active: v.boolean(),
  })
    .index("accountId", ["accountId"])
    .index("unitId", ["unitId"]),

  contacts: defineTable({
    code: v.string(),
    name: v.string(),
    contactType: v.union(
      v.literal("SANTRI"),
      v.literal("WALI"),
      v.literal("SUPPLIER"),
      v.literal("CUSTOMER"),
      v.literal("EMPLOYEE"),
      v.literal("OTHER"),
    ),
    unitId: v.optional(v.id("units")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("code", ["code"])
    .index("contactType", ["contactType"])
    .index("name", ["name"]),

  programs: defineTable({
    code: v.string(),
    name: v.string(),
    unitId: v.id("units"),
    activity: v.optional(v.string()),
    costCenter: v.optional(v.string()),
    active: v.boolean(),
  })
    .index("code", ["code"])
    .index("unitId", ["unitId"]),

  periods: defineTable({
    code: v.string(),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    status: v.union(v.literal("OPEN"), v.literal("CLOSED")),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
    reopenedAt: v.optional(v.number()),
    reopenedBy: v.optional(v.id("users")),
    checklist: v.array(v.object({ item: v.string(), completed: v.boolean() })),
  })
    .index("code", ["code"])
    .index("status", ["status"]),

  accountMappings: defineTable({
    code: v.string(),
    name: v.string(),
    category: v.union(
      v.literal("RECEIPT"),
      v.literal("DISBURSEMENT"),
      v.literal("TRANSFER"),
      v.literal("RECEIVABLE"),
      v.literal("PAYABLE"),
      v.literal("SALE"),
    ),
    templateLines: v.array(
      v.object({
        side: v.union(v.literal("DEBIT"), v.literal("CREDIT")),
        accountCode: v.string(),
        amountMode: v.union(v.literal("AMOUNT"), v.literal("ZERO")),
        description: v.string(),
      }),
    ),
    active: v.boolean(),
    description: v.optional(v.string()),
  })
    .index("code", ["code"]),

  transactions: defineTable({
    number: v.string(),
    transactionType: v.string(),
    transactionDate: v.number(),
    periodCode: v.string(),
    unitId: v.id("units"),
    programId: v.optional(v.id("programs")),
    contactId: v.optional(v.id("contacts")),
    amount: money,
    description: v.string(),
    status: workflowStatus,
    journalId: v.optional(v.id("journalHeaders")),
    cashAccountId: v.optional(v.id("cashAccounts")),
    counterCashAccountId: v.optional(v.id("cashAccounts")),
    sourceType: v.string(),
    sourceId: v.string(),
    manualLines: v.optional(
      v.array(
        v.object({
          accountId: v.id("accounts"),
          debit: money,
          credit: money,
          description: v.string(),
        }),
      ),
    ),
    attachmentId: v.optional(v.id("attachments")),
    createdBy: v.id("users"),
    postedBy: v.optional(v.id("users")),
    postedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("number", ["number"])
    .index("date", ["transactionDate"])
    .index("status", ["status"])
    .index("unitAndDate", ["unitId", "transactionDate"])
    .index("typeAndDate", ["transactionType", "transactionDate"])
    .index("source", ["sourceType", "sourceId"]),

  journalHeaders: defineTable({
    journalNumber: v.string(),
    journalDate: v.number(),
    periodCode: v.string(),
    sourceType: v.string(),
    sourceId: v.string(),
    description: v.string(),
    status: workflowStatus,
    reversalOfId: v.optional(v.id("journalHeaders")),
    createdBy: v.id("users"),
    postedBy: v.optional(v.id("users")),
    postedAt: v.optional(v.number()),
    totalDebit: money,
    totalCredit: money,
    createdAt: v.number(),
  })
    .index("journalNumber", ["journalNumber"])
    .index("date", ["journalDate"])
    .index("periodAndStatus", ["periodCode", "status"])
    .index("source", ["sourceType", "sourceId"]),

  journalLines: defineTable({
    journalId: v.id("journalHeaders"),
    lineNumber: v.number(),
    accountId: v.id("accounts"),
    accountCode: v.string(),
    accountName: v.string(),
    accountType,
    cashClass: v.union(v.literal("NONE"), v.literal("CASH"), v.literal("BANK"), v.literal("WALLET")),
    unitId: v.id("units"),
    periodCode: v.string(),
    journalDate: v.number(),
    debit: money,
    credit: money,
    contactId: v.optional(v.id("contacts")),
    programId: v.optional(v.id("programs")),
    description: v.string(),
  })
    .index("journalId", ["journalId"])
    .index("accountId", ["accountId"])
    .index("date", ["journalDate"])
    .index("period", ["periodCode"])
    .index("periodAndType", ["periodCode", "accountType"])
    .index("unitAndPeriod", ["unitId", "periodCode"]),

  approvals: defineTable({
    transactionId: v.id("transactions"),
    fromStatus: workflowStatus,
    toStatus: workflowStatus,
    action: v.union(v.literal("SUBMIT"), v.literal("REVIEW"), v.literal("APPROVE"), v.literal("POST"), v.literal("REVERSE")),
    actorId: v.id("users"),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("transactionId", ["transactionId"])
    .index("createdAt", ["createdAt"]),

  attachments: defineTable({
    storageId: v.optional(v.string()),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    checksum: v.string(),
    transactionId: v.optional(v.id("transactions")),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  })
    .index("transactionId", ["transactionId"])
    .index("uploadedAt", ["uploadedAt"]),

  auditLogs: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    action: v.string(),
    actorId: v.id("users"),
    actorEmail: v.optional(v.string()),
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    requestId: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("entity", ["entityType", "entityId"])
    .index("actorAndDate", ["actorId", "createdAt"])
    .index("createdAt", ["createdAt"]),

  receivables: defineTable({
    documentNumber: v.string(),
    contactId: v.id("contacts"),
    unitId: v.id("units"),
    receivableAccountId: v.id("accounts"),
    invoiceDate: v.number(),
    dueDate: v.number(),
    originalAmount: money,
    outstandingAmount: money,
    category: v.union(v.literal("EDUCATION"), v.literal("OTHER"), v.literal("BUSINESS")),
    status: v.union(v.literal("OPEN"), v.literal("PARTIAL"), v.literal("PAID")),
    journalId: v.optional(v.id("journalHeaders")),
    createdAt: v.number(),
  })
    .index("contactId", ["contactId"])
    .index("dueDate", ["dueDate"])
    .index("status", ["status"]),

  payables: defineTable({
    documentNumber: v.string(),
    contactId: v.id("contacts"),
    unitId: v.id("units"),
    payableAccountId: v.id("accounts"),
    invoiceDate: v.number(),
    dueDate: v.number(),
    originalAmount: money,
    outstandingAmount: money,
    category: v.union(v.literal("EDUCATION"), v.literal("OPERATIONAL"), v.literal("BUSINESS")),
    status: v.union(v.literal("OPEN"), v.literal("PARTIAL"), v.literal("PAID")),
    journalId: v.optional(v.id("journalHeaders")),
    createdAt: v.number(),
  })
    .index("contactId", ["contactId"])
    .index("dueDate", ["dueDate"])
    .index("status", ["status"]),

  inventoryItems: defineTable({
    sku: v.string(),
    name: v.string(),
    category: v.string(),
    unitOfMeasure: v.string(),
    unitId: v.id("units"),
    inventoryAccountId: v.id("accounts"),
    averageCost: money,
    stockQuantity: v.number(),
    minimumStock: v.number(),
    active: v.boolean(),
  })
    .index("sku", ["sku"])
    .index("unitId", ["unitId"]),

  inventoryTransactions: defineTable({
    itemId: v.id("inventoryItems"),
    transactionDate: v.number(),
    movementType: v.union(v.literal("PURCHASE"), v.literal("USAGE"), v.literal("ADJUSTMENT"), v.literal("SALE")),
    quantity: v.number(),
    unitCost: money,
    totalCost: money,
    unitId: v.id("units"),
    sourceType: v.string(),
    sourceId: v.string(),
    journalId: v.optional(v.id("journalHeaders")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("itemId", ["itemId"])
    .index("date", ["transactionDate"]),

  fixedAssets: defineTable({
    code: v.string(),
    name: v.string(),
    category: v.string(),
    unitId: v.id("units"),
    location: v.optional(v.string()),
    acquisitionDate: v.number(),
    acquisitionCost: money,
    usefulLifeMonths: v.number(),
    depreciationMethod: v.union(v.literal("STRAIGHT_LINE"), v.literal("DECLINING_BALANCE")),
    accumulatedDepreciation: money,
    bookValue: money,
    status: v.union(v.literal("ACTIVE"), v.literal("DISPOSED")),
    assetAccountId: v.id("accounts"),
    depreciationAccountId: v.id("accounts"),
    createdAt: v.number(),
  })
    .index("code", ["code"])
    .index("unitId", ["unitId"])
    .index("status", ["status"]),

  assetDepreciations: defineTable({
    assetId: v.id("fixedAssets"),
    periodCode: v.string(),
    depreciationDate: v.number(),
    amount: money,
    journalId: v.optional(v.id("journalHeaders")),
    status: v.union(v.literal("SCHEDULED"), v.literal("POSTED")),
    createdAt: v.number(),
  })
    .index("assetId", ["assetId"])
    .index("periodCode", ["periodCode"]),

  budgets: defineTable({
    year: v.number(),
    unitId: v.id("units"),
    programId: v.optional(v.id("programs")),
    accountId: v.id("accounts"),
    amount: money,
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("yearUnit", ["year", "unitId"])
    .index("accountId", ["accountId"]),

  importBatches: defineTable({
    fileName: v.string(),
    checksum: v.string(),
    mode: v.string(),
    status: v.union(v.literal("PREVIEWED"), v.literal("VALIDATED"), v.literal("IMPORTED"), v.literal("FAILED")),
  totalRows: v.number(),
  importedRows: v.number(),
  errorCount: v.number(),
  report: v.optional(v.any()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  })
    .index("createdAt", ["createdAt"]),

  reconciliationRuns: defineTable({
    name: v.string(),
    referenceDate: v.number(),
    status: v.union(v.literal("OPEN"), v.literal("BALANCED"), v.literal("DIFFERENCE")),
    report: v.any(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("createdAt", ["createdAt"]),

  integrationEvents: defineTable({
    idempotencyKey: v.string(),
    sourceSystem: v.string(),
    eventType: v.string(),
    sourceId: v.string(),
    status: v.union(v.literal("RECEIVED"), v.literal("PROCESSED"), v.literal("REJECTED")),
    payloadHash: v.string(),
    resultTransactionId: v.optional(v.id("transactions")),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("idempotencyKey", ["idempotencyKey"])
    .index("sourceAndId", ["sourceSystem", "sourceId"]),

  notifications: defineTable({
    userId: v.optional(v.id("users")),
    role: v.optional(role),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("userAndDate", ["userId", "createdAt"])
    .index("roleAndDate", ["role", "createdAt"]),

  counters: defineTable({
    key: v.string(),
    value: v.number(),
  }).index("key", ["key"]),

  legacySnapshots: defineTable({
    sourceFile: v.string(),
    sourceSheet: v.string(),
    referenceDate: v.number(),
    accountCode: v.string(),
    accountName: v.string(),
    amount: money,
    checksum: v.string(),
  })
    .index("sheetAndAccount", ["sourceSheet", "accountCode"])
    .index("referenceDate", ["referenceDate"]),

  financialTrend: defineTable({
    sourceFile: v.string(),
    checksum: v.string(),
    monthKey: v.string(),
    label: v.string(),
    revenue: money,
    expense: money,
    surplus: money,
    referenceDate: v.number(),
  }).index("monthKey", ["monthKey"]),
});

export default schema;
