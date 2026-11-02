import { describe, expect, it } from "vitest";
import { balances, duesTotals, filterDues, sortDues, splitEqually, type DueLike } from "./dues";
import { validateDueInput } from "../server/domain";
import { HttpError } from "../server/http";

const sum = (xs: number[]) => xs.reduce((s, x) => s + Math.round(x * 100), 0) / 100;
const status = (fn: () => unknown) => {
  try {
    fn();
    return 200;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
};

describe("splitEqually", () => {
  it("splits evenly among debtors only", () => {
    expect(splitEqually(300, 3, false)).toEqual([100, 100, 100]);
  });
  it("hands leftover cents to the first debtors so the total is exact", () => {
    const parts = splitEqually(100, 3, false);
    expect(parts).toEqual([33.34, 33.33, 33.33]);
    expect(sum(parts)).toBe(100);
  });
  it("counts the payer's own share when asked, and the payer absorbs leftover cents", () => {
    // 4 shares of 25.00: three debtors owe 25 each, the payer keeps the fourth share.
    expect(splitEqually(100, 3, true)).toEqual([25, 25, 25]);
    // 100 / 3 shares = 33.33 each, the payer absorbs the extra cent.
    expect(splitEqually(100, 2, true)).toEqual([33.33, 33.33]);
  });
  it("never lets debtors owe more than the total", () => {
    for (const [total, n, inc] of [
      [99.99, 7, true],
      [1, 3, false],
      [0.05, 4, true],
    ] as const)
      expect(sum(splitEqually(total, n, inc))).toBeLessThanOrEqual(total + 1e-9);
  });
  it("rejects nobody and non-positive totals", () => {
    expect(() => splitEqually(100, 0, true)).toThrow();
    expect(() => splitEqually(0, 2, true)).toThrow();
    expect(() => splitEqually(-5, 2, false)).toThrow();
    expect(() => splitEqually(Number.NaN, 2, false)).toThrow();
  });
});

const due = (
  id: string,
  d: string,
  c: string,
  amount: number,
  paid: boolean,
  date: string,
  reason: string | null = null,
): DueLike => ({
  id,
  debtorId: d.toLowerCase(),
  debtorName: d,
  creditorId: c.toLowerCase(),
  creditorName: c,
  amount,
  paid,
  date,
  reason,
});
const dues = [
  due("1", "Arun", "Rahul", 100, false, "2026-10-01", "New net"),
  due("2", "Kiran", "Rahul", 250.5, false, "2026-10-05", "Shuttle tube"),
  due("3", "Arun", "Kiran", 40, true, "2026-09-20"),
  due("4", "Vijay", "Arun", 60, false, "2026-10-03", "Court booking"),
];

describe("balances and totals", () => {
  it("only counts unpaid dues and nets each player", () => {
    const b = Object.fromEntries(balances(dues).map((x) => [x.name, x]));
    expect(b["Rahul"]).toMatchObject({ owes: 0, owed: 350.5, net: 350.5 });
    expect(b["Arun"]).toMatchObject({ owes: 100, owed: 60, net: -40 });
    expect(b["Kiran"]).toMatchObject({ owes: 250.5, owed: 0, net: -250.5 });
    expect(b["Vijay"]).toMatchObject({ owes: 60, net: -60 });
  });
  it("balances add up to zero across all players", () => {
    expect(Math.round(balances(dues).reduce((s, x) => s + x.net * 100, 0))).toBe(0);
  });
  it("lists the biggest creditor first", () => {
    expect(balances(dues)[0]?.name).toBe("Rahul");
  });
  it("totals outstanding and settled without float drift", () => {
    expect(duesTotals(dues)).toEqual({ outstanding: 410.5, settled: 40, unpaid: 3, paid: 1 });
    expect(duesTotals([])).toEqual({ outstanding: 0, settled: 0, unpaid: 0, paid: 0 });
  });
});

describe("filterDues", () => {
  const ids = (xs: DueLike[]) => xs.map((d) => d.id);
  it("filters by status", () => {
    expect(ids(filterDues(dues, { status: "unpaid" }))).toEqual(["1", "2", "4"]);
    expect(ids(filterDues(dues, { status: "paid" }))).toEqual(["3"]);
    expect(ids(filterDues(dues, { status: "all" }))).toEqual(["1", "2", "3", "4"]);
  });
  it("filters by player and role", () => {
    expect(ids(filterDues(dues, { playerId: "arun" }))).toEqual(["1", "3", "4"]);
    expect(ids(filterDues(dues, { playerId: "arun", role: "debtor" }))).toEqual(["1", "3"]);
    expect(ids(filterDues(dues, { playerId: "arun", role: "creditor" }))).toEqual(["4"]);
  });
  it("searches names and notes, ignoring case", () => {
    expect(ids(filterDues(dues, { search: "NET" }))).toEqual(["1"]);
    expect(ids(filterDues(dues, { search: "kiran" }))).toEqual(["2", "3"]);
    expect(ids(filterDues(dues, { search: "  " }))).toHaveLength(4);
  });
  it("combines filters", () => {
    expect(ids(filterDues(dues, { status: "unpaid", playerId: "arun", role: "debtor" }))).toEqual([
      "1",
    ]);
  });
});

describe("sortDues", () => {
  const ids = (xs: DueLike[]) => xs.map((d) => d.id);
  it("sorts by date", () => {
    expect(ids(sortDues(dues, "newest"))).toEqual(["2", "4", "1", "3"]);
    expect(ids(sortDues(dues, "oldest"))).toEqual(["3", "1", "4", "2"]);
  });
  it("sorts by amount", () => {
    expect(ids(sortDues(dues, "amount_desc"))).toEqual(["2", "1", "4", "3"]);
    expect(ids(sortDues(dues, "amount_asc"))).toEqual(["3", "4", "1", "2"]);
  });
  it("sorts by name, newest first on ties", () => {
    expect(ids(sortDues(dues, "debtor"))).toEqual(["1", "3", "2", "4"]);
    expect(ids(sortDues(dues, "creditor"))).toEqual(["4", "3", "2", "1"]);
  });
  it("puts unpaid first and does not modify the input", () => {
    const before = ids(dues);
    expect(ids(sortDues(dues, "unpaid_first"))).toEqual(["2", "4", "1", "3"]);
    expect(ids(dues)).toEqual(before);
  });
});

describe("validateDueInput", () => {
  const ok = {
    debtorId: "a",
    creditorId: "b",
    amount: 120.5,
    reason: " New net ",
    date: "2026-10-05",
  };
  it("accepts and cleans a valid due", () => {
    expect(validateDueInput(ok)).toEqual({
      debtorId: "a",
      creditorId: "b",
      amount: 120.5,
      reason: "New net",
      date: "2026-10-05",
    });
    expect(validateDueInput({ ...ok, reason: "  ", date: undefined }).reason).toBeNull();
  });
  it("rejects self-debt, missing players, bad amounts, long notes and bad dates", () => {
    expect(status(() => validateDueInput({ ...ok, creditorId: "a" }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, debtorId: "" }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, amount: 0 }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, amount: -3 }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, amount: 1.234 }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, reason: "x".repeat(201) }))).toBe(400);
    expect(status(() => validateDueInput({ ...ok, date: "2026-02-30" }))).toBe(400);
  });
});
