import { describe, expect, it } from "vitest";
import { clampPage, pageCount, paginate, revealMore } from "./pagination";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("paginate", () => {
  it("returns the requested page with its range", () => {
    const p = paginate(nums(25), 2, 10);
    expect(p.items).toEqual(nums(25).slice(10, 20));
    expect(p).toMatchObject({ page: 2, pages: 3, total: 25, from: 11, to: 20 });
  });
  it("the last page holds the remainder", () => {
    const p = paginate(nums(25), 3, 10);
    expect(p.items).toEqual([21, 22, 23, 24, 25]);
    expect(p).toMatchObject({ from: 21, to: 25 });
  });
  it("shows everything on one page when the list fits", () => {
    expect(paginate(nums(10), 1, 10)).toMatchObject({ pages: 1, from: 1, to: 10 });
    expect(paginate(nums(3), 1, 10).items).toEqual([1, 2, 3]);
  });
  it("handles an empty list", () => {
    expect(paginate([], 1, 10)).toMatchObject({
      items: [],
      page: 1,
      pages: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });
  it("clamps pages that no longer exist, e.g. after filtering", () => {
    expect(paginate(nums(12), 9, 10)).toMatchObject({ page: 2, from: 11, to: 12 });
    expect(paginate(nums(12), 0, 10).page).toBe(1);
    expect(paginate(nums(12), -4, 10).page).toBe(1);
    expect(paginate(nums(12), Number.NaN, 10).page).toBe(1);
  });
  it("every item appears on exactly one page", () => {
    const all = nums(47);
    const seen = Array.from(
      { length: pageCount(47, 10) },
      (_, i) => paginate(all, i + 1, 10).items,
    ).flat();
    expect(seen).toEqual(all);
  });
  it("does not modify the input and rejects a bad page size", () => {
    const src = nums(5);
    paginate(src, 1, 2);
    expect(src).toEqual(nums(5));
    expect(() => paginate(src, 1, 0)).toThrow();
  });
});

describe("pageCount / clampPage", () => {
  it("counts pages", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(pageCount(10, 10)).toBe(1);
    expect(pageCount(11, 10)).toBe(2);
  });
  it("clamps", () => {
    expect(clampPage(5, 25, 10)).toBe(3);
    expect(clampPage(2, 25, 10)).toBe(2);
  });
});

describe("revealMore", () => {
  it("adds a chunk but never beyond the total", () => {
    expect(revealMore(0, 20, 6)).toBe(6);
    expect(revealMore(18, 20, 6)).toBe(20);
    expect(revealMore(20, 20, 6)).toBe(20);
    expect(revealMore(0, 0, 6)).toBe(0);
  });
});
