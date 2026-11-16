import { beforeEach, describe, expect, it, vi } from "vitest";

/* A tiny in-memory stand-in for the database, just rich enough for the league-final flow. */
type M = {
  id: string;
  kind: string;
  status: string;
  team_a_id: string;
  team_b_id: string;
  winner_team_id: string | null;
  play_order: number;
  score_a_total: number;
  score_b_total: number;
  tournament_id: string;
};
const db = vi.hoisted(() => ({
  tournament: {} as Record<string, unknown>,
  matches: [] as M[],
}));

vi.mock("./db", () => {
  const rows = (sql: string, p: unknown[]) => {
    if (sql.includes("FROM matches WHERE id=?")) return db.matches.filter((m) => m.id === p[0]);
    if (sql.includes("SELECT type,status FROM tournaments"))
      return [{ type: db.tournament["type"], status: db.tournament["status"] }];
    if (sql.includes("SELECT status FROM tournaments"))
      return [{ status: db.tournament["status"] }];
    if (sql.includes("SELECT * FROM tournaments")) return [db.tournament];
    if (sql.includes("SELECT kind,status FROM matches")) return db.matches;
    if (sql.includes("FROM teams t JOIN players"))
      return ["T1", "T2", "T3"].map((id) => ({ id, name: id, p1name: "a", p2name: "b" }));
    if (sql.includes("FROM matches WHERE tournament_id=? ORDER BY play_order"))
      return [...db.matches].sort((a, b) => a.play_order - b.play_order);
    if (sql.includes("MAX(play_order)"))
      return [{ mx: Math.max(0, ...db.matches.map((m) => m.play_order)) }];
    if (sql.includes("kind='LEAGUE_FINAL' LIMIT 1"))
      return db.matches.filter((m) => m.kind === "LEAGUE_FINAL").slice(0, 1);
    throw new Error("unexpected query: " + sql);
  };
  const run = (sql: string, p: unknown[]) => {
    const byId = (id: unknown) => db.matches.find((m) => m.id === id);
    if (sql.includes("SET play_order=?, status='UPCOMING'")) {
      const row = byId(p[1])!;
      row.play_order = p[0] as number;
      row.status = "UPCOMING";
    } else if (sql.includes("SET status='SKIPPED'")) byId(p[0])!.status = "SKIPPED";
    else if (sql.includes("SET status='UPCOMING' WHERE id=?")) byId(p[0])!.status = "UPCOMING";
    else if (sql.includes("INSERT INTO matches") && sql.includes("NOT EXISTS")) {
      if (!db.matches.some((m) => m.kind === "LEAGUE_FINAL"))
        db.matches.push({
          id: p[0] as string,
          tournament_id: p[1] as string,
          kind: "LEAGUE_FINAL",
          status: "UPCOMING",
          team_a_id: p[2] as string,
          team_b_id: p[3] as string,
          winner_team_id: null,
          play_order: p[4] as number,
          score_a_total: 0,
          score_b_total: 0,
        });
    } else if (sql.includes("SET status='COMPLETED'")) {
      Object.assign(db.tournament, {
        status: "COMPLETED",
        champion_team_id: p[0],
        runner_up_team_id: p[1],
      });
    } else if (sql.includes("SET status='LIVE', champion_team_id=NULL")) {
      if (db.tournament["status"] === "COMPLETED")
        Object.assign(db.tournament, {
          status: "LIVE",
          champion_team_id: null,
          runner_up_team_id: null,
        });
    } else if (sql.includes("DELETE FROM matches")) {
      db.matches = db.matches.filter((m) => !(m.id === p[0] && m.status === "UPCOMING"));
    } else throw new Error("unexpected statement: " + sql);
    return 1;
  };
  return {
    q: async (sql: string, p: unknown[] = []) => rows(sql, p),
    exec: async (sql: string, p: unknown[] = []) => run(sql, p),
    uid: () => crypto.randomUUID(),
    transaction: async () => {},
    withTransaction: async () => {},
  };
});

import { scheduleOp, startMatch } from "./domain";
import { HttpError } from "./http";

const T = "trn";
const m = (
  id: string,
  a: string,
  b: string,
  status: string,
  order: number,
  win: string | null = null,
  pa = 0,
  pb = 0,
): M => ({
  id,
  tournament_id: T,
  kind: "LEAGUE",
  status,
  team_a_id: a,
  team_b_id: b,
  winner_team_id: win,
  play_order: order,
  score_a_total: pa,
  score_b_total: pb,
});
const finalMatch = () => db.matches.find((x) => x.kind === "LEAGUE_FINAL");
const status = (id: string) => db.matches.find((x) => x.id === id)!.status;
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
};

beforeEach(() => {
  db.tournament = {
    id: T,
    type: "LEAGUE",
    status: "LIVE",
    champion_team_id: null,
    runner_up_team_id: null,
  };
  // T1 beat T2 21-15 and T3 21-10, so the table is T1, then T2 (better difference than T3).
  db.matches = [
    m("m1", "T1", "T2", "COMPLETED", 1, "T1", 21, 15),
    m("m2", "T1", "T3", "COMPLETED", 2, "T1", 21, 10),
    m("m3", "T2", "T3", "UPCOMING", 3),
  ];
});

describe("skipping the last league match", () => {
  it("sets up the League Final between the top two teams", async () => {
    await scheduleOp("m3", "skip");
    expect(status("m3")).toBe("SKIPPED");
    expect(finalMatch()).toMatchObject({
      status: "UPCOMING",
      team_a_id: "T1",
      team_b_id: "T2",
      play_order: 4,
    });
  });

  it("does nothing while other league matches are still left to play", async () => {
    db.matches.push(m("m4", "T2", "T3", "UPCOMING", 4));
    await scheduleOp("m3", "skip");
    expect(finalMatch()).toBeUndefined();
    await scheduleOp("m4", "skip"); // now nothing is left
    expect(finalMatch()).toBeDefined();
  });

  it("works when every league match was skipped, and never makes a second final", async () => {
    db.matches = [m("m1", "T1", "T2", "UPCOMING", 1), m("m2", "T1", "T3", "UPCOMING", 2)];
    await scheduleOp("m1", "skip");
    expect(finalMatch()).toBeUndefined();
    await scheduleOp("m2", "skip");
    expect(db.matches.filter((x) => x.kind === "LEAGUE_FINAL")).toHaveLength(1);
  });
});

describe("skipping the League Final", () => {
  beforeEach(async () => {
    await scheduleOp("m3", "skip");
  });

  it("announces the top team in the standings as the winner", async () => {
    const f = finalMatch()!;
    await scheduleOp(f.id, "skip");
    expect(f.status).toBe("SKIPPED");
    expect(db.tournament).toMatchObject({
      status: "COMPLETED",
      champion_team_id: "T1",
      runner_up_team_id: "T2",
    });
  });

  it("can be undone: restoring the skipped final reopens the tournament", async () => {
    const f = finalMatch()!;
    await scheduleOp(f.id, "skip");
    await scheduleOp(f.id, "unskip");
    expect(f.status).toBe("UPCOMING");
    expect(db.tournament).toMatchObject({
      status: "LIVE",
      champion_team_id: null,
      runner_up_team_id: null,
    });
  });
});

describe("restoring a skipped league match", () => {
  it("removes a final that has not started, then sets it up again when nothing is left", async () => {
    await scheduleOp("m3", "skip");
    expect(finalMatch()).toBeDefined();
    await scheduleOp("m3", "unskip");
    expect(status("m3")).toBe("UPCOMING");
    expect(finalMatch()).toBeUndefined();
    await scheduleOp("m3", "skip");
    expect(finalMatch()).toBeDefined();
  });

  it("also works through 'move to end'", async () => {
    await scheduleOp("m3", "skip");
    await scheduleOp("m3", "end");
    expect(finalMatch()).toBeUndefined();
  });

  it("is refused once the final has been decided or started", async () => {
    await scheduleOp("m3", "skip");
    const f = finalMatch()!;
    f.status = "LIVE";
    expect(await code(scheduleOp("m3", "unskip"))).toBe(409);
    f.status = "COMPLETED";
    expect(await code(scheduleOp("m3", "unskip"))).toBe(409);
    expect(status("m3")).toBe("SKIPPED");
  });

  it("is refused after a skipped final decided the tournament", async () => {
    await scheduleOp("m3", "skip");
    await scheduleOp(finalMatch()!.id, "skip");
    expect(await code(scheduleOp("m3", "unskip"))).toBe(409);
  });
});

describe("starting matches once the league is decided", () => {
  const input = {
    tossWinner: "A",
    tossChoice: "SERVE",
    teamASide: "top",
    servingTeam: "A",
    serverId: "x",
    receiverId: "y",
  } as const;

  it("a skipped league match cannot be started once the final exists", async () => {
    await scheduleOp("m3", "skip");
    expect(await code(startMatch("m3", input))).toBe(409);
  });

  it("nothing can be started in a finished tournament", async () => {
    await scheduleOp("m3", "skip");
    const f = finalMatch()!;
    await scheduleOp(f.id, "skip");
    expect(await code(startMatch(f.id, input))).toBe(409);
  });
});
