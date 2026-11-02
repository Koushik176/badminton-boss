/**
 * Manual cost splitting between players ("dues"). Nothing here is derived from recorded
 * maintenance expenses: the organizer decides who owes whom and how much.
 */

const toCents = (amount: number) => Math.round(amount * 100);

export interface DueLike {
  id: string;
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  paid: boolean;
  date: string; // YYYY-MM-DD the due was recorded for
  reason: string | null;
}

/**
 * Splits `total` into equal shares in whole cents. Returns one amount per debtor.
 * With `includePayer` the payer also carries a share (not returned, because they do not owe
 * themselves); the payer absorbs any leftover cents, so debtors never pay more than their share.
 * Without it, leftover cents go one each to the first debtors. The amounts plus the payer's
 * share always add up to exactly `total`.
 */
export function splitEqually(total: number, debtors: number, includePayer: boolean): number[] {
  if (!Number.isInteger(debtors) || debtors < 1) throw new Error("Pick at least one player.");
  const cents = toCents(total);
  if (!Number.isFinite(total) || cents <= 0) throw new Error("Enter an amount above zero.");
  const shares = debtors + (includePayer ? 1 : 0);
  const base = Math.floor(cents / shares);
  const rest = cents - base * shares;
  if (includePayer) return Array.from({ length: debtors }, () => base / 100);
  return Array.from({ length: debtors }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

export interface Balance {
  playerId: string;
  name: string;
  /** Unpaid total this player has to pay others. */
  owes: number;
  /** Unpaid total others have to pay this player. */
  owed: number;
  /** owed - owes: positive means they are net owed money. */
  net: number;
}

/** Outstanding (unpaid) position of every player involved in a due. Sorted by biggest net first. */
export function balances(dues: readonly DueLike[]): Balance[] {
  const m = new Map<string, { name: string; owes: number; owed: number }>();
  const row = (id: string, name: string) => {
    const e = m.get(id) ?? { name, owes: 0, owed: 0 };
    m.set(id, e);
    return e;
  };
  for (const d of dues) {
    if (d.paid) continue;
    row(d.debtorId, d.debtorName).owes += toCents(d.amount);
    row(d.creditorId, d.creditorName).owed += toCents(d.amount);
  }
  return [...m.entries()]
    .map(([playerId, e]) => ({
      playerId,
      name: e.name,
      owes: e.owes / 100,
      owed: e.owed / 100,
      net: (e.owed - e.owes) / 100,
    }))
    .sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
}

export function duesTotals(dues: readonly DueLike[]) {
  let outstanding = 0;
  let settled = 0;
  let unpaid = 0;
  let paid = 0;
  for (const d of dues) {
    if (d.paid) {
      settled += toCents(d.amount);
      paid++;
    } else {
      outstanding += toCents(d.amount);
      unpaid++;
    }
  }
  return { outstanding: outstanding / 100, settled: settled / 100, unpaid, paid };
}

export type DueStatus = "all" | "unpaid" | "paid";
export interface DueFilter {
  status?: DueStatus;
  /** Show dues where this player owes or is owed. */
  playerId?: string;
  /** Show only what this player owes (debtor) or is owed (creditor), instead of either. */
  role?: "any" | "debtor" | "creditor";
  /** Case-insensitive match on names and reason. */
  search?: string;
}

export function filterDues<T extends DueLike>(dues: readonly T[], f: DueFilter): T[] {
  const needle = f.search?.trim().toLowerCase();
  return dues.filter((d) => {
    if (f.status === "unpaid" && d.paid) return false;
    if (f.status === "paid" && !d.paid) return false;
    if (f.playerId) {
      const role = f.role ?? "any";
      const asDebtor = d.debtorId === f.playerId;
      const asCreditor = d.creditorId === f.playerId;
      if (
        role === "debtor"
          ? !asDebtor
          : role === "creditor"
            ? !asCreditor
            : !(asDebtor || asCreditor)
      )
        return false;
    }
    if (needle) {
      const hay = `${d.debtorName} ${d.creditorName} ${d.reason ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export type DueSort =
  "newest" | "oldest" | "amount_desc" | "amount_asc" | "debtor" | "creditor" | "unpaid_first";

export const DUE_SORT_LABEL: Record<DueSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  amount_desc: "Amount: high to low",
  amount_asc: "Amount: low to high",
  debtor: "Who owes (A–Z)",
  creditor: "Owed to (A–Z)",
  unpaid_first: "Unpaid first",
};

/** Returns a sorted copy. Ties keep newest first, so the order is always stable and predictable. */
export function sortDues<T extends DueLike>(dues: readonly T[], sort: DueSort): T[] {
  const newest = (a: T, b: T) => b.date.localeCompare(a.date);
  const by: Record<DueSort, (a: T, b: T) => number> = {
    newest,
    oldest: (a, b) => a.date.localeCompare(b.date),
    amount_desc: (a, b) => b.amount - a.amount,
    amount_asc: (a, b) => a.amount - b.amount,
    debtor: (a, b) => a.debtorName.localeCompare(b.debtorName),
    creditor: (a, b) => a.creditorName.localeCompare(b.creditorName),
    unpaid_first: (a, b) => Number(a.paid) - Number(b.paid),
  };
  return [...dues].sort((a, b) => by[sort](a, b) || newest(a, b));
}
