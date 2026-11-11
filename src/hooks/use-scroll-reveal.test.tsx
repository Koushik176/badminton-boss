import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollReveal } from "./use-scroll-reveal";

type Callback = (entries: { isIntersecting: boolean }[]) => void;
class FakeObserver {
  static all: FakeObserver[] = [];
  disconnected = false;
  constructor(public cb: Callback) {
    FakeObserver.all.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  static live() {
    return FakeObserver.all.filter((o) => !o.disconnected);
  }
}

function Harness(props: { total: number; base?: number; chunk?: number }) {
  const { visible, hasMore, sentinelRef, loadMore } = useScrollReveal(props);
  return (
    <div>
      <span data-testid="visible">{visible}</span>
      {hasMore && <div ref={sentinelRef} data-testid="sentinel" />}
      <button onClick={loadMore}>more</button>
    </div>
  );
}
const visible = () => Number(screen.getByTestId("visible").textContent);
const sentinelSeen = () =>
  act(() => {
    for (const o of FakeObserver.live()) o.cb([{ isIntersecting: true }]);
  });

describe("useScrollReveal", () => {
  beforeEach(() => {
    FakeObserver.all = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows only the base items until the user scrolls", () => {
    render(<Harness total={20} base={0} chunk={6} />);
    expect(visible()).toBe(0);
    expect(FakeObserver.live()).toHaveLength(0); // nothing is watched before scrolling
    sentinelSeen();
    expect(visible()).toBe(0);
  });

  it("reveals a chunk each time the sentinel comes into view after scrolling", () => {
    render(<Harness total={20} chunk={6} />);
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(FakeObserver.live()).toHaveLength(1);
    sentinelSeen();
    expect(visible()).toBe(6);
    sentinelSeen();
    expect(visible()).toBe(12);
  });

  it("also arms from touch scrolling and the mouse wheel", () => {
    render(<Harness total={20} chunk={6} />);
    act(() => void window.dispatchEvent(new Event("touchmove")));
    expect(FakeObserver.live()).toHaveLength(1);
    cleanup();
    FakeObserver.all = [];
    render(<Harness total={20} chunk={6} />);
    act(() => void window.dispatchEvent(new Event("wheel")));
    expect(FakeObserver.live()).toHaveLength(1);
  });

  it("stops at the total and removes the sentinel", () => {
    render(<Harness total={8} chunk={6} />);
    act(() => void window.dispatchEvent(new Event("scroll")));
    sentinelSeen();
    sentinelSeen();
    expect(visible()).toBe(8);
    expect(screen.queryByTestId("sentinel")).toBeNull();
    expect(FakeObserver.live()).toHaveLength(0);
  });

  it("always shows the base items, then adds chunks on top", () => {
    render(<Harness total={20} base={6} chunk={6} />);
    expect(visible()).toBe(6);
    act(() => void window.dispatchEvent(new Event("scroll")));
    sentinelSeen();
    expect(visible()).toBe(12);
  });

  it("has a manual fallback that works without scrolling", () => {
    render(<Harness total={20} chunk={6} />);
    fireEvent.click(screen.getByText("more"));
    expect(visible()).toBe(6);
    fireEvent.click(screen.getByText("more"));
    expect(visible()).toBe(12);
  });

  it("copes with a base larger than the total", () => {
    render(<Harness total={3} base={6} chunk={6} />);
    expect(visible()).toBe(3);
    expect(screen.queryByTestId("sentinel")).toBeNull();
  });

  it("does not break when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Harness total={20} chunk={6} />);
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(visible()).toBe(0);
    fireEvent.click(screen.getByText("more"));
    expect(visible()).toBe(6);
  });
});
