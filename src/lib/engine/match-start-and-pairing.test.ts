import { describe, expect, it } from "vitest";
import {
  canEditStart,
  courtForScore,
  createMatch,
  EngineError,
  reapplyStart,
  replay,
  START_EDIT_POINT_LIMIT,
  type MatchAction,
  type StartSetup,
} from "./scoring";
import { balancedTeams, playerStrength, seededRng, teammateCounts } from "./tournament";
import { assertTossConsistent, schedulePosition } from "../server/domain";

const initial = () =>
  createMatch({ teamA: ["a1", "a2"], teamB: ["b1", "b2"], format: 1, teamASide: "bottom" });
const start = (setup: Partial<StartSetup> = {}): MatchAction => ({
  type: "SERVER_SELECTED",
  servingTeam: setup.servingTeam ?? "A",
  serverId: setup.serverId ?? "a1",
  receiverId: setup.receiverId ?? "b1",
});
const rallies = (seq: string): MatchAction[] =>
  [...seq].map((c) => ({ type: "RALLY_WON", team: c as "A" | "B" }));

describe("editing the match start (toss, server, receiver)", () => {
  it("is allowed until the point limit and only in game 1", () => {
    for (let n = 0; n < START_EDIT_POINT_LIMIT; n++) {
      const s = replay(initial(), [start(), ...rallies("A".repeat(n))]);
      expect(canEditStart(s)).toBe(true);
    }
    const atLimit = replay(initial(), [start(), ...rallies("A".repeat(START_EDIT_POINT_LIMIT))]);
    expect(canEditStart(atLimit)).toBe(false);
    expect(canEditStart(initial())).toBe(false); // not started
  });

  it("keeps the score and recalculates server/receiver for it", () => {
    const actions = [start(), ...rallies("ABAB")]; // 4 points: A2 B2
    const before = replay(initial(), actions);
    expect(before.score).toEqual({ A: 2, B: 2 });
    const setup: StartSetup = {
      teamASide: "top",
      servingTeam: "B",
      serverId: "b2",
      receiverId: "a1",
    };
    const r = reapplyStart(initial(), actions, setup);
    expect(r.state.score).toEqual(before.score);
    expect(r.state.rallyCount).toBe(before.rallyCount);
    expect(r.state.sides).toEqual({ A: "top", B: "bottom" });
    // Rules still hold for the recalculated position.
    const serving = r.state.servingTeam!;
    expect(r.state.teams[serving]).toContain(r.state.serverId);
    expect(r.state.teams[serving === "A" ? "B" : "A"]).toContain(r.state.receiverId);
    expect(r.state.serviceCourt).toBe(courtForScore(r.state.score[serving]));
    expect(r.state.courts[r.state.serverId!]).toBe(r.state.serviceCourt);
    expect(r.state.courts[r.state.receiverId!]).toBe(r.state.serviceCourt);
  });

  it("changing only the server within the same team moves the server for the same score", () => {
    const actions = [start(), ...rallies("A")]; // A has 1 point, A serves from the left
    const same = reapplyStart(initial(), actions, {
      teamASide: "bottom",
      servingTeam: "A",
      serverId: "a1",
      receiverId: "b1",
    });
    const swapped = reapplyStart(initial(), actions, {
      teamASide: "bottom",
      servingTeam: "A",
      serverId: "a2",
      receiverId: "b2",
    });
    expect(same.state.score).toEqual(swapped.state.score);
    expect(same.state.serverId).not.toBe(swapped.state.serverId);
    expect(swapped.state.teams.A).toContain(swapped.state.serverId);
  });

  it("rejects an edit once the limit is reached or the setup is invalid", () => {
    const actions = [start(), ...rallies("AAAAA")];
    expect(() =>
      reapplyStart(initial(), actions, {
        teamASide: "top",
        servingTeam: "A",
        serverId: "a1",
        receiverId: "b1",
      }),
    ).toThrow(EngineError);
    expect(() =>
      reapplyStart(initial(), [start(), ...rallies("A")], {
        teamASide: "top",
        servingTeam: "A",
        serverId: "b1", // server from the wrong team
        receiverId: "a1",
      }),
    ).toThrow(EngineError);
  });

  it("validates the toss decision against the serving team", () => {
    const ok = {
      tossWinner: "A",
      tossChoice: "SERVE",
      teamASide: "top",
      servingTeam: "A",
      serverId: "a1",
      receiverId: "b1",
    } as const;
    expect(() => assertTossConsistent(ok)).not.toThrow();
    expect(() => assertTossConsistent({ ...ok, tossChoice: "COURT" })).toThrow();
    expect(() =>
      assertTossConsistent({ ...ok, tossChoice: "COURT", servingTeam: "B" }),
    ).not.toThrow();
  });
});

describe("match position in the schedule", () => {
  it("gives the 1-based place and total", () => {
    expect(schedulePosition("m2", ["m1", "m2", "m3"])).toEqual({ position: 2, total: 3 });
    expect(schedulePosition("zzz", ["m1"])).toEqual({ position: null, total: 1 });
  });
});

describe("history and strength based pairing", () => {
  const players = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const flat = (t: { players: [string, string] }[]) => t.flatMap((x) => x.players).sort();
  const none = new Map<string, number>();
  const same = new Map(players.map((p) => [p, 0.5]));

  it("counts previous partners and smooths strength", () => {
    const c = teammateCounts([
      { a1: "p0", a2: "p1", b1: "p2", b2: "p3" },
      { a1: "p1", a2: "p0", b1: "p4", b2: "p5" },
    ]);
    expect(c.get("p0+p1")).toBe(2);
    expect(c.get("p2+p3")).toBe(1);
    expect(playerStrength({ played: 0, wins: 0 })).toBe(0.5);
    expect(playerStrength({ played: 10, wins: 10 })).toBeGreaterThan(0.9);
    expect(playerStrength({ played: 10, wins: 0 })).toBeLessThan(0.1);
  });

  it("assigns every player exactly once and keeps locked pairs", () => {
    const t = balancedTeams(players, {
      locked: [["p0", "p1"]],
      strength: same,
      together: none,
      rng: seededRng(3),
    });
    expect(flat(t)).toEqual([...players].sort());
    expect(t[0]).toEqual({ players: ["p0", "p1"], locked: true });
    expect(t.filter((x) => x.locked)).toHaveLength(1);
  });

  it("avoids pairs who have already played together", () => {
    const together = new Map([
      ["p0+p1", 5],
      ["p2+p3", 5],
      ["p4+p5", 5],
      ["p6+p7", 5],
    ]);
    for (let seed = 1; seed <= 10; seed++) {
      const t = balancedTeams(players, { strength: same, together, rng: seededRng(seed) });
      for (const x of t) expect(together.get([...x.players].sort().join("+"))).toBeUndefined();
    }
  });

  it("pairs strong players with weak ones", () => {
    const strength = new Map(
      players.map((p, i) => [p, [0.9, 0.8, 0.7, 0.6, 0.4, 0.3, 0.2, 0.1][i]!]),
    );
    const t = balancedTeams(players, { strength, together: none, jitter: 0, rng: seededRng(7) });
    for (const x of t) {
      const sum = strength.get(x.players[0])! + strength.get(x.players[1])!;
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it("is deterministic for a seed, varies between seeds and avoids the previous pairing", () => {
    const run = (seed: number, previousKey?: string) =>
      balancedTeams(players, { strength: same, together: none, rng: seededRng(seed), previousKey });
    expect(run(11)).toEqual(run(11));
    const first = run(11);
    const key = first
      .map((x) => [...x.players].sort().join("+"))
      .sort()
      .join("|");
    const second = run(11, key);
    const key2 = second
      .map((x) => [...x.players].sort().join("+"))
      .sort()
      .join("|");
    expect(key2).not.toBe(key);
  });

  it("rejects odd player counts and bad locked pairs", () => {
    const opts = { strength: same, together: none };
    expect(() => balancedTeams(players.slice(0, 7), opts)).toThrow();
    expect(() => balancedTeams(players, { ...opts, locked: [["p0", "ghost"]] })).toThrow();
    expect(() =>
      balancedTeams(players, {
        ...opts,
        locked: [
          ["p0", "p1"],
          ["p1", "p2"],
        ],
      }),
    ).toThrow();
  });
});
