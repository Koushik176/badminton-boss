import { describe, expect, it } from "vitest";
import { championsWithoutFinal, decideLeagueFinal, standings, type ResultRow } from "./tournament";

const row = (
  a: string,
  b: string,
  winner: string,
  pointsA: number,
  pointsB: number,
): ResultRow => ({
  a,
  b,
  winner,
  pointsA,
  pointsB,
});
const order = (teams: string[], results: ResultRow[]) =>
  standings(teams, results).map((r) => r.team);

describe("standings tie-break: points, point difference, then head-to-head, then points scored", () => {
  // A and B finish level on wins (1), points (2) and point difference (-1), but B scored more.
  //   A beat B 21-19, A lost to C 18-21, B beat D 21-20.
  const base = [row("A", "B", "A", 21, 19), row("A", "C", "C", 18, 21), row("B", "D", "B", 21, 20)];
  const teams = ["A", "B", "C", "D"];

  it("sets the scenario up as intended: A and B level on wins, points and point difference", () => {
    const t = Object.fromEntries(standings(teams, base).map((r) => [r.team, r]));
    expect(t["A"]).toMatchObject({ w: 1, points: 2, pd: -1, scored: 39 });
    expect(t["B"]).toMatchObject({ w: 1, points: 2, pd: -1, scored: 40 });
  });

  it("the head-to-head winner ranks above a team that merely scored more points", () => {
    expect(order(teams, base)).toEqual(["C", "A", "B", "D"]);
  });

  it("flips when the head-to-head goes the other way, even if the other team scored more", () => {
    // Now B beat A 21-19 and A beat C 21-18 / B lost to D 20-21: A and B are level again.
    const flipped = [
      row("A", "B", "B", 19, 21),
      row("A", "C", "A", 21, 18),
      row("B", "D", "D", 20, 21),
    ];
    const r = standings(teams, flipped);
    const a = r.find((x) => x.team === "A")!;
    const b = r.find((x) => x.team === "B")!;
    expect([a.points, a.pd]).toEqual([b.points, b.pd]);
    expect(r.map((x) => x.team).indexOf("B")).toBeLessThan(r.map((x) => x.team).indexOf("A"));
  });

  it("point difference still comes before head-to-head", () => {
    // B beat A head-to-head but A has the better point difference overall and equal wins.
    const results = [
      row("A", "B", "B", 20, 21),
      row("A", "C", "A", 21, 5),
      row("B", "D", "D", 15, 21),
    ];
    const r = order(["A", "B", "C", "D"], results);
    expect(r.indexOf("A")).toBeLessThan(r.indexOf("B"));
  });

  it("falls back to points scored when the tied teams have not played each other", () => {
    const results = [row("X", "P", "X", 21, 10), row("Y", "Q", "Y", 21, 10)];
    // X and Y are level on 2 points and +11, but Y scored the same: make Y score more via a wider total.
    const more = [row("X", "P", "X", 21, 10), row("Y", "Q", "Y", 30, 19)];
    expect(order(["X", "Y", "P", "Q"], results).slice(0, 2).sort()).toEqual(["X", "Y"]);
    expect(order(["X", "Y", "P", "Q"], more).slice(0, 2)).toEqual(["Y", "X"]);
  });

  it("a three-way tie in a cycle falls back to points scored and stays consistent", () => {
    const results = [
      row("A", "B", "A", 21, 19),
      row("B", "C", "B", 22, 20),
      row("C", "A", "C", 23, 21),
    ];
    const r = standings(["A", "B", "C"], results);
    expect(r.map((x) => x.points)).toEqual([2, 2, 2]);
    // Everyone has one head-to-head win, so points scored decides: C 43, B 41, A 42 → C, A, B.
    expect(r.map((x) => x.team)).toEqual(["C", "A", "B"]);
    expect(order(["A", "B", "C"], [...results].reverse())).toEqual(["C", "A", "B"]);
  });

  it("does not change an untied table", () => {
    const results = [
      row("A", "B", "A", 21, 10),
      row("A", "C", "A", 21, 12),
      row("B", "C", "B", 21, 15),
    ];
    expect(order(["A", "B", "C"], results)).toEqual(["A", "B", "C"]);
  });
});

describe("decideLeagueFinal", () => {
  const table = [{ team: "T1" }, { team: "T2" }, { team: "T3" }];
  const lg = (status: string) => ({ kind: "LEAGUE", status });

  it("creates the final between the top two once every league match is completed", () => {
    expect(decideLeagueFinal([lg("COMPLETED"), lg("COMPLETED")], table)).toEqual({
      action: "create",
      teamA: "T1",
      teamB: "T2",
    });
  });

  it("creates the final when the remaining league matches were skipped", () => {
    expect(decideLeagueFinal([lg("COMPLETED"), lg("SKIPPED")], table)).toMatchObject({
      action: "create",
    });
    expect(decideLeagueFinal([lg("SKIPPED"), lg("SKIPPED"), lg("COMPLETED")], table)).toMatchObject(
      {
        action: "create",
      },
    );
  });

  it("works when every league match was skipped", () => {
    expect(decideLeagueFinal([lg("SKIPPED"), lg("SKIPPED")], table)).toMatchObject({
      action: "create",
      teamA: "T1",
      teamB: "T2",
    });
  });

  it("waits while any league match is upcoming or live", () => {
    expect(decideLeagueFinal([lg("COMPLETED"), lg("UPCOMING"), lg("SKIPPED")], table)).toEqual({
      action: "wait",
    });
    expect(decideLeagueFinal([lg("COMPLETED"), lg("LIVE")], table)).toEqual({ action: "wait" });
  });

  it("never creates a second final", () => {
    expect(
      decideLeagueFinal([lg("COMPLETED"), { kind: "LEAGUE_FINAL", status: "UPCOMING" }], table),
    ).toEqual({ action: "none" });
    expect(
      decideLeagueFinal([lg("COMPLETED"), { kind: "LEAGUE_FINAL", status: "SKIPPED" }], table),
    ).toEqual({ action: "none" });
  });

  it("does nothing without league matches or with fewer than two teams", () => {
    expect(decideLeagueFinal([], table)).toEqual({ action: "none" });
    expect(decideLeagueFinal([{ kind: "KNOCKOUT", status: "COMPLETED" }], table)).toEqual({
      action: "none",
    });
    expect(decideLeagueFinal([lg("COMPLETED")], [{ team: "T1" }])).toEqual({ action: "none" });
  });
});

describe("championsWithoutFinal (a skipped League Final)", () => {
  it("makes the top team the winner and the second the runner-up", () => {
    expect(championsWithoutFinal([{ team: "T1" }, { team: "T2" }, { team: "T3" }])).toEqual({
      champion: "T1",
      runnerUp: "T2",
    });
  });
  it("copes with a single team or none", () => {
    expect(championsWithoutFinal([{ team: "T1" }])).toEqual({ champion: "T1", runnerUp: null });
    expect(championsWithoutFinal([])).toBeNull();
  });
});
