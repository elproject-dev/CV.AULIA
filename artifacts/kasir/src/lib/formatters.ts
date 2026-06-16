export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRupiahValue(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    const day = date.getDate();
    const month = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(date);
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year} jam ${hour}.${minute}`;
  } catch (error) {
    return '-';
  }
}

export function formatInvoiceNumber(id: number): string {
  return `TRX-ID${String(id).padStart(5, '0')}`;
}

export function formatMembershipStatus(
  customerType?: string | null,
  membershipType?: string | null
): string {
  const type = (customerType || membershipType || "non_member").toLowerCase();
  return type === "member" ? "Member" : "Reguler";
}

export function formatPaymentMethod(method?: string): string {
  switch (method) {
    case "cash":
      return "Tunai";
    case "debit_card":
      return "Debit";
    case "credit_card":
      return "Kredit";
    case "transfer":
      return "Transfer";
    case "qris":
      return "QRIS";
    case "e_wallet":
      return "Transfer";
    default:
      return method?.replace(/_/g, " ") || "-";
  }
}
