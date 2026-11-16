import { describe, expect, it } from "vitest";
import { balancedTeams, repeatPenalty, seededRng, teammateHistory } from "./tournament";

const NOW = Date.parse("2026-11-16");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);
const key = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);
/** The pair each player ended up with, e.g. partners(teams).get("p0") === "p3". */
const partners = (teams: { players: [string, string] }[]) =>
  new Map(teams.flatMap(({ players: [a, b] }) => [[a, b] as const, [b, a] as const]));

const run = (
  players: string[],
  strength: Record<string, number>,
  history: Record<string, [count: number, daysAgo: number]> = {},
  seed = 1,
) => {
  const together = new Map<string, number>();
  const last = new Map<string, string>();
  for (const [k, [count, days]] of Object.entries(history)) {
    together.set(k, count);
    last.set(k, daysAgo(days));
  }
  return balancedTeams(players, {
    strength: new Map(players.map((p) => [p, strength[p] ?? 0.5])),
    together,
    lastTogether: last,
    now: NOW,
    jitter: 0,
    rng: seededRng(seed),
  });
};

describe("repeatPenalty", () => {
  it("is zero for a pair that never played together", () => {
    expect(repeatPenalty(0, null, NOW)).toBe(0);
  });
  it("is highest just after playing together and fades with time", () => {
    const recent = repeatPenalty(1, daysAgo(0), NOW);
    const month = repeatPenalty(1, daysAgo(30), NOW);
    const year = repeatPenalty(1, daysAgo(365), NOW);
    expect(recent).toBeCloseTo(1, 10);
    expect(month).toBeCloseTo(0.5, 10);
    expect(recent).toBeGreaterThan(month);
    expect(month).toBeGreaterThan(year);
    expect(year).toBeGreaterThan(0);
  });
  it("grows a little with repeated pairings but never above 1", () => {
    expect(repeatPenalty(3, daysAgo(60), NOW)).toBeGreaterThan(repeatPenalty(1, daysAgo(60), NOW));
    expect(repeatPenalty(50, daysAgo(0), NOW)).toBe(1);
  });
  it("treats a missing or invalid date as recent", () => {
    expect(repeatPenalty(1, null, NOW)).toBeCloseTo(1, 10);
    expect(repeatPenalty(1, "not-a-date", NOW)).toBeCloseTo(1, 10);
  });
});

describe("teammateHistory", () => {
  it("counts pairings and keeps the latest date", () => {
    const h = teammateHistory([
      { a1: "p0", a2: "p1", b1: "p2", b2: "p3", tdate: "2026-01-10" },
      { a1: "p1", a2: "p0", b1: "p4", b2: "p5", tdate: "2026-03-05" },
      { a1: "p0", a2: "p1", b1: "p2", b2: "p3", tdate: "2026-02-01" },
    ]);
    expect(h.get("p0+p1")).toEqual({ count: 3, last: "2026-03-05" });
    expect(h.get("p2+p3")).toEqual({ count: 2, last: "2026-02-01" });
    expect(h.get("p4+p5")).toEqual({ count: 1, last: "2026-03-05" });
  });
  it("handles rows without a date", () => {
    expect(teammateHistory([{ a1: "a", a2: "b", b1: "c", b2: "d" }]).get("a+b")).toEqual({
      count: 1,
      last: null,
    });
  });
});

describe("balancedTeams: win % first, then longest since last teaming up", () => {
  it("win % balance beats repeat-partner history", () => {
    // A (90%) and B (10%) are the balanced pair, even though they teamed up yesterday, many times.
    const players = ["A", "B", "C", "D"];
    for (let seed = 1; seed <= 8; seed++) {
      const t = run(players, { A: 0.9, B: 0.1, C: 0.5, D: 0.5 }, { [key("A", "B")]: [9, 1] }, seed);
      expect(partners(t).get("A")).toBe("B");
      expect(partners(t).get("C")).toBe("D");
    }
  });

  it("among equally balanced options it avoids the pair who teamed up most recently", () => {
    const players = ["p0", "p1", "p2", "p3"];
    for (let seed = 1; seed <= 8; seed++) {
      const t = run(players, {}, { [key("p0", "p1")]: [1, 2] }, seed);
      expect(partners(t).get("p0")).not.toBe("p1");
    }
  });

  it("prefers the partner not played with for the longest time, and never-played over all", () => {
    const players = ["p0", "p1", "p2", "p3"];
    // p0 played with p1 10 days ago, p2 300 days ago, p3 100 days ago. Their other pairs have no history.
    const longestAgo = run(
      players,
      {},
      {
        [key("p0", "p1")]: [1, 10],
        [key("p0", "p2")]: [1, 300],
        [key("p0", "p3")]: [1, 100],
        [key("p1", "p2")]: [1, 5],
        [key("p1", "p3")]: [1, 5],
        [key("p2", "p3")]: [1, 5],
      },
    );
    expect(partners(longestAgo).get("p0")).toBe("p2");

    const neverPlayed = run(
      players,
      {},
      {
        [key("p0", "p1")]: [1, 400],
        [key("p0", "p2")]: [1, 400],
      },
    );
    expect(partners(neverPlayed).get("p0")).toBe("p3");
  });

  it("treats small win % differences as equal, so history decides between them", () => {
    // Everyone is within a few points of each other: balance is a tie, so recency decides.
    const players = ["p0", "p1", "p2", "p3"];
    const strength = { p0: 0.52, p1: 0.5, p2: 0.47, p3: 0.55 };
    const t = run(players, strength, { [key("p0", "p3")]: [2, 3], [key("p1", "p2")]: [2, 3] });
    expect(partners(t).get("p0")).not.toBe("p3");
    expect(partners(t).get("p1")).not.toBe("p2");
  });

  it("keeps locked pairs and assigns every player once", () => {
    const players = ["p0", "p1", "p2", "p3", "p4", "p5"];
    const t = balancedTeams(players, {
      locked: [["p0", "p1"]],
      strength: new Map(players.map((p) => [p, 0.5])),
      together: new Map(),
      now: NOW,
      rng: seededRng(4),
    });
    expect(t[0]).toEqual({ players: ["p0", "p1"], locked: true });
    expect(t.flatMap((x) => x.players).sort()).toEqual([...players].sort());
  });

  it("still works with counts only (no dates)", () => {
    const players = ["p0", "p1", "p2", "p3"];
    const t = balancedTeams(players, {
      strength: new Map(players.map((p) => [p, 0.5])),
      together: new Map([[key("p0", "p1"), 4]]),
      jitter: 0,
      rng: seededRng(2),
    });
    expect(partners(t).get("p0")).not.toBe("p1");
  });
});
