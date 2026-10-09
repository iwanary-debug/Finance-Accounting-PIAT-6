export const formatIDR = (value: number, compact = false) => {
  if (compact) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
};

export const formatDate = (value: number) =>
  new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export const formatDateTime = (value: number) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));

export const todayInput = () => new Date().toISOString().slice(0, 10);

export const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_KEUANGAN: "Admin Keuangan",
  BENDAHARA: "Bendahara",
  REVIEWER: "Kepala Keuangan",
  MUDIR: "Mudir",
  YAYASAN: "Yayasan",
  AUDITOR: "Auditor",
};

export const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Menunggu review",
  REVIEW: "Dalam review",
  APPROVED: "Disetujui",
  POSTED: "Diposting",
  REVERSED: "Dikoreksi",
  VOID: "Dibatalkan",
};
