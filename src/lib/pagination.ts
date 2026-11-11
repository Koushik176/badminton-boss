/** Small pure helpers for paging through a list that is already in memory. */

export const pageCount = (total: number, pageSize: number) =>
  Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/** Keeps a page number inside 1..pages, e.g. after filtering leaves fewer pages. */
export const clampPage = (page: number, total: number, pageSize: number) =>
  Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, pageSize));

export interface Page<T> {
  items: T[];
  /** The page actually shown (1-based, clamped). */
  page: number;
  pages: number;
  total: number;
  /** 1-based position of the first and last item shown (0 when the list is empty). */
  from: number;
  to: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  if (!(pageSize > 0)) throw new Error("pageSize must be above zero");
  const p = clampPage(page, items.length, pageSize);
  const start = (p - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page: p,
    pages: pageCount(items.length, pageSize),
    total: items.length,
    from: slice.length ? start + 1 : 0,
    to: start + slice.length,
  };
}

/** How many items to show after revealing another chunk, never more than exist. */
export const revealMore = (visible: number, total: number, chunk: number) =>
  Math.min(total, Math.max(0, visible) + Math.max(1, chunk));
