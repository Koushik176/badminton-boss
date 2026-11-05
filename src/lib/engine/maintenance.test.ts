import { describe, expect, it } from "vitest";
import {
  MAX_COST,
  formatMoney,
  isValidDate,
  parseCost,
  summarize,
  type ExpenseRow,
} from "./maintenance";
import { validateMaintenanceInput, validateResourceInput } from "../server/domain";
import { HttpError } from "../server/http";

const status = (fn: () => unknown) => {
  try {
    fn();
    return 200;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
};

describe("parseCost", () => {
  it("accepts zero, whole and two-decimal amounts", () => {
    expect(parseCost(0)).toBe(0);
    expect(parseCost(350)).toBe(350);
    expect(parseCost(12.5)).toBe(12.5);
    expect(parseCost(0.1 + 0.2 - 0.2)).toBeCloseTo(0.1, 10); // float noise does not matter here
    expect(parseCost(MAX_COST)).toBe(MAX_COST);
  });
  it("rejects negatives, extra decimals, huge and non-numeric values", () => {
    expect(() => parseCost(-1)).toThrow();
    expect(() => parseCost(1.234)).toThrow();
    expect(() => parseCost(MAX_COST + 1)).toThrow();
    expect(() => parseCost(Number.NaN)).toThrow();
    expect(() => parseCost(Infinity)).toThrow();
    expect(() => parseCost("100")).toThrow();
    expect(() => parseCost(null)).toThrow();
  });
});

describe("isValidDate", () => {
  it("accepts real dates only", () => {
    expect(isValidDate("2026-10-31")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("31-10-2026")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("shows the currency symbol with two decimals", () => {
    expect(formatMoney(1234.5)).toBe("₹1,234.50");
    expect(formatMoney(0)).toBe("₹0.00");
    expect(formatMoney(-400)).toBe("-₹400.00");
    expect(formatMoney(-0)).toBe("₹0.00");
  });
});

describe("summarize", () => {
  const rows: ExpenseRow[] = [
    { resourceId: "r1", category: "RACQUET", kind: "RESTRING", cost: 350, date: "2026-10-03" },
    { resourceId: "r1", category: "RACQUET", kind: "REPAIR", cost: 0.1, date: "2026-10-20" },
    { resourceId: "r1", category: "RACQUET", kind: "REPAIR", cost: 0.2, date: "2026-09-02" },
    { resourceId: "r2", category: "NET", kind: "REPLACEMENT", cost: 1200, date: "2026-10-11" },
    { resourceId: "r3", category: "COURT", kind: "CLEANING", cost: 500, date: "2026-08-30" },
  ];
  const s = summarize(rows);
  it("totals everything without floating point drift", () => {
    expect(s.total).toBe(2050.3);
    expect(s.count).toBe(5);
    expect(s.byCategory.find((c) => c.key === "RACQUET")).toMatchObject({ total: 350.3, count: 3 });
  });
  it("groups by category, kind and resource, biggest first", () => {
    expect(s.byCategory.map((c) => c.key)).toEqual(["NET", "COURT", "RACQUET"]);
    expect(s.byResource[0]).toMatchObject({ key: "r2", total: 1200 });
    expect(s.byKind.find((k) => k.key === "REPAIR")).toMatchObject({ total: 0.3, count: 2 });
  });
  it("groups by month, newest first", () => {
    expect(s.byMonth.map((m) => m.key)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(s.byMonth[0]).toMatchObject({ total: 1550.1, count: 3 });
  });
  it("handles no expenses", () => {
    expect(summarize([])).toMatchObject({ total: 0, count: 0, byCategory: [], byMonth: [] });
  });
});

describe("server validation of equipment and expenses", () => {
  const ok = {
    resourceId: "r1",
    kind: "RESTRING",
    description: "  Strings broken, restrung  ",
    cost: 350,
    incurredOn: "2026-10-03",
    paidBy: " Rahul ",
  };
  it("accepts and cleans a valid expense", () => {
    expect(validateMaintenanceInput(ok)).toMatchObject({
      description: "Strings broken, restrung",
      paidBy: "Rahul",
      cost: 350,
    });
    expect(validateMaintenanceInput({ ...ok, paidBy: "  " }).paidBy).toBeNull();
  });
  it("rejects bad type, description, cost and date with 400", () => {
    expect(status(() => validateMaintenanceInput({ ...ok, kind: "SABOTAGE" }))).toBe(400);
    expect(status(() => validateMaintenanceInput({ ...ok, description: "   " }))).toBe(400);
    expect(status(() => validateMaintenanceInput({ ...ok, description: "x".repeat(501) }))).toBe(
      400,
    );
    expect(status(() => validateMaintenanceInput({ ...ok, cost: -5 }))).toBe(400);
    expect(status(() => validateMaintenanceInput({ ...ok, cost: 1.999 }))).toBe(400);
    expect(status(() => validateMaintenanceInput({ ...ok, incurredOn: "2026-02-30" }))).toBe(400);
    expect(status(() => validateMaintenanceInput({ ...ok, paidBy: "x".repeat(101) }))).toBe(400);
  });
  it("validates equipment name, category and notes", () => {
    expect(
      validateResourceInput({ name: " Racquet 3 ", category: "RACQUET", notes: "  " }),
    ).toEqual({
      name: "Racquet 3",
      category: "RACQUET",
      notes: null,
    });
    expect(status(() => validateResourceInput({ name: "  ", category: "NET" }))).toBe(400);
    expect(status(() => validateResourceInput({ name: "Net", category: "TABLE" }))).toBe(400);
    expect(
      status(() => validateResourceInput({ name: "Net", category: "NET", notes: "x".repeat(501) })),
    ).toBe(400);
  });
});
