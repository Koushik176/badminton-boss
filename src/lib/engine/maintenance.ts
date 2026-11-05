/** Shared community equipment (racquets, shuttles, nets, ground) and its maintenance expenses. */

export const RESOURCE_CATEGORIES = ["RACQUET", "SHUTTLE", "NET", "COURT", "OTHER"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ResourceCategory, string> = {
  RACQUET: "Racquet",
  SHUTTLE: "Shuttle",
  NET: "Net",
  COURT: "Ground / court",
  OTHER: "Other",
};

export const MAINTENANCE_KINDS = [
  "REPAIR",
  "RESTRING",
  "REPLACEMENT",
  "PURCHASE",
  "CLEANING",
  "OTHER",
] as const;
export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

export const KIND_LABEL: Record<MaintenanceKind, string> = {
  REPAIR: "Repair",
  RESTRING: "Restring",
  REPLACEMENT: "Replacement",
  PURCHASE: "New purchase",
  CLEANING: "Cleaning / upkeep",
  OTHER: "Other",
};

/** Currency shown next to amounts. Amounts are stored as plain numbers, so changing this is cosmetic. */
export const CURRENCY_SYMBOL = "₹";

export const formatMoney = (amount: number) =>
  `${amount < 0 ? "-" : ""}${CURRENCY_SYMBOL}${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Largest amount a single expense may have (matches DECIMAL(10,2)). */
export const MAX_COST = 99_999_999.99;

const toCents = (amount: number) => Math.round(amount * 100);

/**
 * Validates a money amount: a finite number, zero or more, at most two decimals.
 * Returns it rounded to whole cents so floating point noise never reaches the database.
 */
export function parseCost(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isFinite(amount))
    throw new Error("Enter the cost as a number.");
  if (amount < 0) throw new Error("The cost cannot be negative.");
  if (amount > MAX_COST) throw new Error("That cost is too large.");
  if (Math.abs(amount * 100 - toCents(amount)) > 1e-6)
    throw new Error("The cost can have at most two decimal places.");
  return toCents(amount) / 100;
}

/** True for a real calendar date written as YYYY-MM-DD (rejects e.g. 2026-02-30). */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export interface ExpenseRow {
  resourceId: string;
  category: string;
  kind: string;
  cost: number;
  date: string; // YYYY-MM-DD
}

export interface Bucket<K extends string = string> {
  key: K;
  total: number;
  count: number;
}

export interface MaintenanceSummary {
  total: number;
  count: number;
  byCategory: Bucket[];
  byKind: Bucket[];
  byResource: Bucket[];
  /** Newest month first, keys like 2026-10. */
  byMonth: Bucket[];
}

/** Totals by category, kind, resource and month. Adds in whole cents to avoid float drift. */
export function summarize(rows: readonly ExpenseRow[]): MaintenanceSummary {
  const group = (keyOf: (r: ExpenseRow) => string) => {
    const m = new Map<string, { cents: number; count: number }>();
    for (const r of rows) {
      const e = m.get(keyOf(r)) ?? { cents: 0, count: 0 };
      e.cents += toCents(r.cost);
      e.count++;
      m.set(keyOf(r), e);
    }
    return [...m.entries()].map(([key, e]) => ({ key, total: e.cents / 100, count: e.count }));
  };
  const biggestFirst = (a: Bucket, b: Bucket) => b.total - a.total || a.key.localeCompare(b.key);
  return {
    total: rows.reduce((c, r) => c + toCents(r.cost), 0) / 100,
    count: rows.length,
    byCategory: group((r) => r.category).sort(biggestFirst),
    byKind: group((r) => r.kind).sort(biggestFirst),
    byResource: group((r) => r.resourceId).sort(biggestFirst),
    byMonth: group((r) => r.date.slice(0, 7)).sort((a, b) => b.key.localeCompare(a.key)),
  };
}
