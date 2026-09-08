export const CREDIT_HISTORY_PAGE_SIZE = 20;

export const creditHistoryKinds = ["all", "usage", "topup"] as const;
export type CreditHistoryKind = (typeof creditHistoryKinds)[number];

export type CreditLedgerEntryType =
  | "purchase"
  | "generation_debit"
  | "generation_refund"
  | "admin_adjustment"
  | "signup_bonus"
  | "cd_key_redemption";

export type CreditHistoryItem = {
  id: string;
  entryType: CreditLedgerEntryType;
  amount: number;
  balanceAfter: number;
  generationJobId: string | null;
  orderId: string | null;
  note: string | null;
  createdAt: string;
};

export type CreditHistoryResponse = {
  balance: number;
  items: CreditHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function parseCreditHistoryRequest(value: unknown): {
  kind: CreditHistoryKind;
  page: number;
} {
  if (!value || typeof value !== "object") return { kind: "all", page: 1 };
  const input = value as { kind?: unknown; page?: unknown };
  const kind = creditHistoryKinds.includes(input.kind as CreditHistoryKind)
    ? (input.kind as CreditHistoryKind)
    : "all";
  const numericPage =
    typeof input.page === "number" ? input.page : Number(input.page);
  const page =
    Number.isSafeInteger(numericPage) && numericPage > 0 ? numericPage : 1;
  return { kind, page };
}

export function normalizeCreditCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized.startsWith("BAM")) return normalized;
  const body = normalized.slice(3, 19);
  const groups = body.match(/.{1,4}/g) ?? [];
  return ["BAM", ...groups].join("-");
}

export function isCreditCodeShapeValid(value: string) {
  return /^BAM[A-Z0-9]{16}$/.test(
    value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  );
}
