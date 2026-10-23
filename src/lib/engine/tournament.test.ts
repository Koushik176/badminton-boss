import { describe, expect, it } from "vitest";
import {
  applyAction,
  createMatch,
  replay,
  undoLast,
  EngineError,
  type MatchAction,
} from "./scoring";
import {
  buildTeams,
  gamePointDiff,
  knockoutBracket,
  resultHeading,
  roundRobin,
  scheduleCost,
  scheduleLeague,
  seededRng,
  standings,
  type Fixture,
  type ResultRow,
} from "./tournament";
import { planRebalance, validateNewTeam } from "../server/domain";
import { HttpError, requireOrganizer } from "../server/http";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `T${i}`);
const key = (f: Fixture) => [...f].sort().join("|");
const backToBack = (seq: Fixture[]) => {
  let n = 0;
  seq.forEach((f, i) => {
    const prev = seq[i - 1];
    if (prev && f.some((t) => prev.includes(t))) n++;
  });
  return n;
};

describe("switch ends", () => {
  const live = () =>
    applyAction(createMatch({ teamA: ["a1", "a2"], teamB: ["b1", "b2"], teamASide: "bottom" }), {
      type: "SERVER_SELECTED",
      servingTeam: "A",
      serverId: "a1",
      receiverId: "b1",
    });
  it("swaps only the sides", () => {
    const s = applyAction(applyAction(live(), { type: "RALLY_WON", team: "A" }), {
      type: "SWITCH_ENDS",
    });
    const before = applyAction(live(), { type: "RALLY_WON", team: "A" });
    expect(s.sides).toEqual({ A: "top", B: "bottom" });
    expect({ ...s, sides: before.sides }).toEqual(before);
  });
  it("is rejected outside a game", () => {
    const setup = createMatch({ teamA: ["a1", "a2"], teamB: ["b1", "b2"] });
    expect(() => applyAction(setup, { type: "SWITCH_ENDS" })).toThrow(EngineError);
  });
  it("replays after a refresh and survives undo of an earlier rally", () => {
    const initial = createMatch({ teamA: ["a1", "a2"], teamB: ["b1", "b2"] });
    const actions: MatchAction[] = [
      { type: "SERVER_SELECTED", servingTeam: "A", serverId: "a1", receiverId: "b1" },
      { type: "RALLY_WON", team: "A" },
      { type: "SWITCH_ENDS" },
    ];
    expect(replay(initial, actions).sides).toEqual({ A: "top", B: "bottom" });
    const u = undoLast(initial, actions);
    expect(u.state.score).toEqual({ A: 0, B: 0 });
    expect(u.state.sides).toEqual({ A: "top", B: "bottom" });
  });
});

describe("league scheduling", () => {
  for (const n of [3, 4, 5, 6, 7, 8, 9]) {
    it(`includes every pairing exactly once for ${n} teams`, () => {
      const pairs = roundRobin(ids(n));
      const seq = scheduleLeague(pairs, { rng: seededRng(1) });
      expect(seq.map(key).sort()).toEqual(pairs.map(key).sort());
    });
  }
  it("avoids consecutive appearances where possible (6+ teams)", () => {
    for (const n of [6, 8, 10])
      expect(backToBack(scheduleLeague(roundRobin(ids(n)), { rng: seededRng(7) }))).toBe(0);
  });
  it("is much better than a random order and deterministic per seed", () => {
    const pairs = roundRobin(ids(8));
    const a = scheduleLeague(pairs, { rng: seededRng(42) });
    expect(scheduleLeague(pairs, { rng: seededRng(42) })).toEqual(a);
    const naive = [...pairs].sort(() => seededRng(3)() - 0.5);
    expect(scheduleCost(a)).toBeLessThan(scheduleCost(naive));
  });
  it("keeps fixed slots untouched when rebalancing", () => {
    const pairs = roundRobin(ids(6));
    const fixed: (Fixture | null)[] = pairs.map((p, i) => (i < 3 || i === 7 ? p : null));
    const free = pairs.filter((_, i) => fixed[i] === null);
    const out = scheduleLeague(free, { fixed, rng: seededRng(5) });
    for (let i = 0; i < pairs.length; i++) if (fixed[i]) expect(out[i]).toEqual(fixed[i]);
    expect(out.map(key).sort()).toEqual(pairs.map(key).sort());
  });
});

describe("planRebalance", () => {
  const row = (
    id: string,
    a: string,
    b: string,
    status: string,
    order: number,
    kind = "LEAGUE",
  ) => ({
    id,
    kind,
    status,
    team_a_id: a,
    team_b_id: b,
    play_order: order,
  });
  it("moves only upcoming league matches, within their own slots", () => {
    const rows = [
      row("m1", "A", "B", "COMPLETED", 1),
      row("m2", "C", "D", "LIVE", 2),
      row("m3", "A", "C", "UPCOMING", 3),
      row("m4", "A", "D", "SKIPPED", 4),
      row("m5", "B", "C", "UPCOMING", 5),
      row("m6", "B", "D", "UPCOMING", 6),
    ];
    const plan = planRebalance(rows, seededRng(9));
    expect([...plan.keys()].sort()).toEqual(["m3", "m5", "m6"]);
    expect([...plan.values()].sort()).toEqual([3, 5, 6]);
  });
});

describe("knockout bracket", () => {
  it("keeps byes and round structure", () => {
    const b = knockoutBracket(ids(6), seededRng(2));
    expect(b.rounds).toBe(3);
    expect(b.slots.filter((s) => s.round === 1 && s.bye)).toHaveLength(2);
    expect(b.slots.filter((s) => s.round > 1 && (s.a || s.b))).toHaveLength(0);
  });
});

describe("point difference", () => {
  const one = (a: number, b: number): ResultRow => ({
    a: "X",
    b: "Y",
    winner: a > b ? "X" : "Y",
    pointsA: a,
    pointsB: b,
    games: [{ A: a, B: b }],
  });
  const pd = (a: number, b: number) =>
    standings(["X", "Y"], [one(a, b)]).find((r) => r.team === "X")!.pd;
  it.each([
    [21, 19, 2],
    [22, 20, 1],
    [23, 21, 1],
    [22, 21, 1],
    [30, 29, 1],
    [21, 10, 11],
  ])("%i-%i gives winner +%i and loser -%i", (w, l, d) => {
    expect(gamePointDiff(w, l)).toBe(d);
    const rows = standings(["X", "Y"], [one(w, l)]);
    expect(rows.find((r) => r.team === "X")!.pd).toBe(d);
    expect(rows.find((r) => r.team === "Y")!.pd).toBe(-d);
    expect(pd(l, w)).toBe(-d);
  });
  it("keeps real points for/against and sums per game in best-of-3", () => {
    const r: ResultRow = {
      a: "X",
      b: "Y",
      winner: "X",
      pointsA: 21 + 19 + 22,
      pointsB: 19 + 21 + 20,
      games: [
        { A: 21, B: 19 },
        { A: 19, B: 21 },
        { A: 22, B: 20 },
      ],
    };
    const x = standings(["X", "Y"], [r])[0]!;
    expect(x).toMatchObject({ team: "X", scored: 62, conceded: 60, pd: 2 - 2 + 1 });
  });
});

describe("buildTeams (locked pairs)", () => {
  const players = ids(8);
  const flat = (t: { players: [string, string] }[]) => t.flatMap((x) => x.players).sort();
  it("keeps one locked pair and assigns everyone once", () => {
    const t = buildTeams(players, [["T0", "T1"]], { rng: seededRng(1) });
    expect(t[0]).toEqual({ players: ["T0", "T1"], locked: true });
    expect(t.filter((x) => !x.locked)).toHaveLength(3);
    expect(flat(t)).toEqual([...players].sort());
  });
  it("keeps several locked pairs unchanged", () => {
    const locked: [string, string][] = [
      ["T0", "T5"],
      ["T2", "T3"],
    ];
    const t = buildTeams(players, locked, { rng: seededRng(2) });
    expect(t.filter((x) => x.locked).map((x) => x.players)).toEqual(locked);
    expect(flat(t)).toEqual([...players].sort());
  });
  it("does not randomize when all pairs are locked", () => {
    const locked: [string, string][] = [
      ["T0", "T1"],
      ["T2", "T3"],
      ["T4", "T5"],
      ["T6", "T7"],
    ];
    const t = buildTeams(players, locked);
    expect(t.map((x) => x.players)).toEqual(locked);
    expect(t.every((x) => x.locked)).toBe(true);
  });
  it("rejects odd counts, duplicate players and unknown players", () => {
    expect(() => buildTeams(ids(5))).toThrow();
    expect(() =>
      buildTeams(players, [
        ["T0", "T1"],
        ["T1", "T2"],
      ]),
    ).toThrow();
    expect(() => buildTeams(players, [["T0", "ZZ"]])).toThrow();
    expect(() => buildTeams(players, [["T0", "T0"]])).toThrow();
  });
});

describe("result heading", () => {
  const ongoing = { status: "LIVE", champion_team_id: null };
  it("league match is a match winner, never the champion", () => {
    expect(
      resultHeading({ kind: "LEAGUE", round_name: "League", winner_team_id: "a" }, ongoing),
    ).toBe("Match Winner");
  });
  it("confirmed league final announces the champion", () => {
    expect(
      resultHeading(
        { kind: "LEAGUE_FINAL", round_name: "League Final", winner_team_id: "a" },
        { status: "COMPLETED", champion_team_id: "a" },
      ),
    ).toBe("Tournament Champion");
  });
  it("knockout rounds keep their round wording", () => {
    expect(
      resultHeading({ kind: "KNOCKOUT", round_name: "Semi Final", winner_team_id: "a" }, ongoing),
    ).toBe("Semi Final · Winner");
  });
});

describe("validateNewTeam", () => {
  const base = {
    tournament: { type: "LEAGUE", status: "LIVE" },
    teams: [{ name: "Aces", player1_id: "p1", player2_id: "p2" }],
    hasFinal: false,
    knownPlayerIds: ["p3", "p4", "p1"],
    name: " Smashers ",
    players: ["p3", "p4"] as [string, string],
  };
  const code = (over: Record<string, unknown>) => {
    try {
      validateNewTeam({ ...base, ...over } as typeof base);
      return 200;
    } catch (e) {
      return (e as HttpError).status;
    }
  };
  it("accepts an eligible league and trims the name", () => {
    expect(validateNewTeam(base)).toBe("Smashers");
  });
  it("rejects a started knockout tournament", () => {
    expect(code({ tournament: { type: "KNOCKOUT", status: "LIVE" } })).toBe(409);
  });
  it("rejects missing, finished, or finalised tournaments", () => {
    expect(code({ tournament: undefined })).toBe(404);
    expect(code({ tournament: { type: "LEAGUE", status: "COMPLETED" } })).toBe(409);
    expect(code({ hasFinal: true })).toBe(409);
  });
  it("rejects bad players and names", () => {
    expect(code({ players: ["p3", "p3"] })).toBe(400);
    expect(code({ players: ["p3", "ghost"] })).toBe(400);
    expect(code({ players: ["p1", "p3"] })).toBe(409);
    expect(code({ name: "  aces " })).toBe(409);
    expect(code({ name: "   " })).toBe(400);
  });
});

describe("organizer-only operations", () => {
  it("rejects requests without a valid organizer token", async () => {
    await expect(requireOrganizer(new Request("http://x/api"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      requireOrganizer(new Request("http://x/api", { headers: { authorization: "Bearer nope" } })),
    ).rejects.toMatchObject({ status: 401 });
  });
});
