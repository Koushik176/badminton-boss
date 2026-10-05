import { describe, expect, it } from "vitest";
import { applyAction, createMatch, replay, undoLast, type MatchAction, type MatchState, isGameWon } from "./scoring";
import { randomTeams, roundRobin, knockoutBracket, standings, pairingKey } from "./tournament";

const base = (format: 1 | 3 = 1) => createMatch({ teamA: ["rahul", "kiran"], teamB: ["arun", "vijay"], format });
const start = (format: 1 | 3 = 1) =>
  applyAction(base(format), { type: "SERVER_SELECTED", servingTeam: "A", serverId: "rahul", receiverId: "arun" });
const pts = (s: MatchState, seq: string) =>
  [...seq].reduce((st, c) => applyAction(st, { type: "RALLY_WON", team: c as "A" | "B" }), s);
const setScore = (s: MatchState, a: number, b: number) => {
  // alternate to avoid an early game end
  let st = s;
  const n = Math.max(a, b);
  for (let i = 0; i < n; i++) {
    if (i < a) st = pts(st, "A");
    if (i < b) st = pts(st, "B");
  }
  return st;
};

describe("scoring", () => {
  it("normal scoring", () => {
    let s = pts(start(), "A");
    expect(s.score).toEqual({ A: 1, B: 0 });
    s = pts(s, "B");
    expect(s.score).toEqual({ A: 1, B: 1 });
  });
  it("20-20 needs two clear points", () => {
    let s = setScore(start(), 20, 20);
    s = pts(s, "A");
    expect(s.status).toBe("LIVE");
    s = pts(s, "A");
    expect(s.status).toBe("MATCH_OVER");
    expect(s.games[0]).toMatchObject({ A: 22, B: 20 });
  });
  it("extended deuce 25-23", () => {
    let s = setScore(start(), 24, 24);
    s = pts(s, "A");
    s = pts(s, "B");
    expect(s.status).toBe("LIVE");
    // 25-25 → need 27-25
    expect(isGameWon(25, 23)).toBe(true);
  });
  it("29-29 next point wins, never 31", () => {
    let s = setScore(start(), 29, 29);
    expect(s.status).toBe("LIVE");
    s = pts(s, "A");
    expect(s.status).toBe("MATCH_OVER");
    expect(s.score).toEqual({ A: 30, B: 29 });
    expect(() => pts(s, "A")).toThrow();
  });
  it("best of 3", () => {
    let s = start(3);
    s = pts(s, "A".repeat(21));
    expect(s.status).toBe("GAME_OVER");
    s = applyAction(s, { type: "GAME_STARTED", serverId: "kiran", receiverId: "vijay" });
    expect(s.servingTeam).toBe("A");
    s = pts(s, "B".repeat(21));
    s = applyAction(s, { type: "GAME_STARTED", serverId: "arun", receiverId: "rahul" });
    s = pts(s, "A".repeat(21));
    expect(s.status).toBe("MATCH_OVER");
    expect(s.winner).toBe("A");
    expect(s.gamesWon).toEqual({ A: 2, B: 1 });
  });
});

describe("serving", () => {
  it("starts right court, receiver diagonal", () => {
    const s = start();
    expect(s.serviceCourt).toBe("right");
    expect(s.courts["rahul"]).toBe("right");
    expect(s.courts["arun"]).toBe("right");
    expect(s.courts["kiran"]).toBe("left");
  });
  it("serving team wins: same server switches court, receiver changes", () => {
    const s = pts(start(), "A");
    expect(s.serverId).toBe("rahul");
    expect(s.courts["rahul"]).toBe("left");
    expect(s.courts["kiran"]).toBe("right");
    expect(s.serviceCourt).toBe("left");
    expect(s.receiverId).toBe("vijay");
    expect(s.courts["arun"]).toBe("right");
  });
  it("receiving team wins: service over, no one moves", () => {
    const s = pts(start(), "B"); // B score 1 → left court
    expect(s.servingTeam).toBe("B");
    expect(s.serverId).toBe("vijay");
    expect(s.serviceCourt).toBe("left");
    expect(s.receiverId).toBe("kiran");
    expect(s.courts["rahul"]).toBe("right");
  });
  it("even right, odd left", () => {
    let s = start();
    for (let i = 1; i <= 6; i++) {
      s = pts(s, "A");
      expect(s.serviceCourt).toBe(i % 2 === 0 ? "right" : "left");
    }
  });
});

describe("undo", () => {
  it("restores full state", () => {
    const init = base();
    const actions: MatchAction[] = [
      { type: "SERVER_SELECTED", servingTeam: "A", serverId: "rahul", receiverId: "arun" },
      { type: "RALLY_WON", team: "A" },
      { type: "RALLY_WON", team: "B" },
    ];
    const before = replay(init, actions.slice(0, 2));
    const { state } = undoLast(init, actions);
    expect(state).toEqual(before);
  });
});

describe("tournament", () => {
  it("rejects odd players", () => {
    expect(() => randomTeams(["a", "b", "c"])).toThrow(/even/);
  });
  it("shuffles avoid repeats", () => {
    const players = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const first = randomTeams(players);
    const second = randomTeams(players, { previousKey: pairingKey(first) });
    expect(pairingKey(second)).not.toBe(pairingKey(first));
  });
  it("round robin n(n-1)/2", () => {
    expect(roundRobin(["a", "b", "c", "d"]).length).toBe(6);
  });
  it("knockout byes for 10 teams", () => {
    const b = knockoutBracket([..."abcdefghij"]);
    expect(b.rounds).toBe(4);
    expect(b.slots.filter((s) => s.bye).length).toBe(6);
  });
  it("cumulative point difference", () => {
    const t = standings(["A", "B", "C"], [
      { a: "A", b: "B", winner: "A", pointsA: 21, pointsB: 17 },
      { a: "A", b: "C", winner: "A", pointsA: 21, pointsB: 15 },
    ]);
    expect(t[0]).toMatchObject({ team: "A", points: 4, pd: 10 });
  });
});
