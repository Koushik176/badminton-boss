import { useCallback, useEffect, useRef, useState } from "react";
import { revealMore } from "@/lib/pagination";

/**
 * Reveals a long list a chunk at a time as the user scrolls down.
 *
 * `base` items are always shown. More appear only once the user has actually scrolled (so the
 * extra items are not pulled in just because the page loaded) and the sentinel element, placed
 * after the list, comes into view. Works the same with touch scrolling on phones and the wheel or
 * scrollbar on desktop. `loadMore` is a manual fallback for screens that cannot scroll or
 * browsers without IntersectionObserver.
 */
export function useScrollReveal({
  total,
  base = 0,
  chunk = 6,
}: {
  total: number;
  base?: number;
  chunk?: number;
}) {
  const [revealed, setRevealed] = useState(0);
  const [armed, setArmed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const visible = Math.min(total, base + revealed);
  const hasMore = visible < total;

  // Arm on the first sign of scrolling (scrollbar, wheel or touch).
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    const events = ["scroll", "wheel", "touchmove"] as const;
    for (const e of events) window.addEventListener(e, arm, { passive: true, once: true });
    return () => {
      for (const e of events) window.removeEventListener(e, arm);
    };
  }, [armed]);

  const loadMore = useCallback(
    () => setRevealed((r) => Math.max(0, revealMore(base + r, total, chunk) - base)),
    [base, total, chunk],
  );

  // While the sentinel is on screen, keep revealing chunks until it is pushed out of view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!armed || !hasMore || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "0px 0px 240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed, hasMore, loadMore, visible]);

  return { visible, hasMore, sentinelRef, loadMore };
}
