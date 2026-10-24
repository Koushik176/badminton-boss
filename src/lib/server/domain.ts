import { q, exec, uid, transaction, withTransaction, type Stmt } from "./db";
import { HttpError } from "./http";
import {
  applyAction,
  createMatch,
  replay,
  undoLast,
  type MatchAction,
  type MatchState,
  type TeamKey,
  type CourtSide,
} from "../engine/scoring";
import {
  matchPointDiff,
  roundName,
  scheduleLeague,
  standings,
  type Fixture,
  type ResultRow,
  type Rng,
} from "../engine/tournament";

/* ---------------- tournaments ---------------- */

export interface CreateTournamentInput {
  name: string;
  date: string;
  location?: string | undefined;
  type: "KNOCKOUT" | "LEAGUE";
  format: 1 | 3;
  teams: { name: string; players: [string, string] }[];
  /** knockout: first-round slots as team indices (null = bye); league: pairs of team indices */
  fixtures: [number, number | null][];
}

export async function createTournament(input: CreateTournamentInput) {
  const n = input.teams.length;
  if (n < 2) throw new HttpError(400, "At least 2 teams are required to start a tournament.");
  const ids = input.teams.flatMap((t) => t.players);
  if (ids.length !== n * 2)
    throw new HttpError(400, "Each doubles team must contain exactly 2 players.");
  if (new Set(ids).size !== ids.length)
    throw new HttpError(400, "This player is already assigned to another team.");
  const names = input.teams.map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== n)
    throw new HttpError(400, "Team names must be unique within the tournament.");
  const isIdx = (x: unknown): x is number =>
    Number.isInteger(x) && (x as number) >= 0 && (x as number) < n;
  validateFixtures(input, n, isIdx);
  const known = await q<{ id: string }>(
    `SELECT id FROM players WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  if (known.length !== ids.length) throw new HttpError(400, "Unknown player selected.");

  // Everything validated — build all statements, then commit them in one transaction.
  const stmts: Stmt[] = [];
  const tid = uid();
  stmts.push([
    `INSERT INTO tournaments (id,name,date,location,type,format,status) VALUES (?,?,?,?,?,?, 'LIVE')`,
    [tid, input.name, input.date, input.location ?? null, input.type, input.format],
  ]);
  const teamIds = input.teams.map(() => uid());
  input.teams.forEach((t, i) =>
    stmts.push([
      `INSERT INTO teams (id,tournament_id,name,player1_id,player2_id) VALUES (?,?,?,?,?)`,
      [teamIds[i], tid, t.name, t.players[0], t.players[1]],
    ]),
  );

  if (input.type === "LEAGUE") {
    let order = 1;
    for (const [a, b] of input.fixtures)
      stmts.push([
        `INSERT INTO matches (id,tournament_id,kind,round,round_name,team_a_id,team_b_id,status,play_order,format) VALUES (?,?,'LEAGUE',1,'League',?,?,'UPCOMING',?,?)`,
        [uid(), tid, teamIds[a], teamIds[b!], order++, input.format],
      ]);
  } else {
    const size = input.fixtures.length * 2;
    const rounds = Math.log2(size);
    const byRound: string[][] = [];
    for (let r = rounds; r >= 1; r--) {
      byRound[r] = [];
      for (let i = 0; i < size / 2 ** r; i++) byRound[r]![i] = uid();
    }
    // Teams advancing via bye are pre-filled into their next match.
    const prefill = new Map<string, { A?: string; B?: string }>();
    input.fixtures.forEach(([fa, fb], i) => {
      if (fb === null && rounds > 1) {
        const id = byRound[2]![Math.floor(i / 2)]!;
        prefill.set(id, { ...prefill.get(id), [i % 2 === 0 ? "A" : "B"]: teamIds[fa] });
      }
    });
    let order = 1;
    for (let r = 1; r <= rounds; r++) {
      for (let i = 0; i < size / 2 ** r; i++) {
        const id = byRound[r]![i]!;
        const feeds = r < rounds ? byRound[r + 1]![Math.floor(i / 2)]! : null;
        const slot = i % 2 === 0 ? "A" : "B";
        let a: string | null = prefill.get(id)?.A ?? null,
          b: string | null = prefill.get(id)?.B ?? null,
          bye = false;
        if (r === 1) {
          const [fa, fb] = input.fixtures[i]!;
          a = teamIds[fa]!;
          b = fb === null ? null : teamIds[fb]!;
          bye = fb === null;
        }
        stmts.push([
          `INSERT INTO matches (id,tournament_id,kind,round,round_name,slot_index,team_a_id,team_b_id,winner_team_id,status,play_order,feeds_into_match_id,feeds_slot,format)
           VALUES (?,?,'KNOCKOUT',?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id,
            tid,
            r,
            roundName(r, rounds),
            i,
            a,
            b,
            bye ? a : null,
            bye ? "BYE" : "UPCOMING",
            bye ? 0 : order++,
            feeds,
            feeds ? slot : null,
            input.format,
          ],
        ]);
      }
    }
  }
  await transaction(stmts);
  return tid;
}

/** Backend fixture validation — never trusts the client. Throws before any write. */
export function validateFixtures(
  input: Pick<CreateTournamentInput, "type" | "fixtures">,
  n: number,
  isIdx: (x: unknown) => x is number,
) {
  if (input.type === "LEAGUE") {
    const bad = "League fixtures must contain every pairing of the teams exactly once.";
    if (input.fixtures.length !== (n * (n - 1)) / 2) throw new HttpError(400, bad);
    const keys = new Set<string>();
    for (const [a, b] of input.fixtures) {
      if (!isIdx(a) || !isIdx(b))
        throw new HttpError(400, "A fixture refers to a team that does not exist.");
      if (a === b) throw new HttpError(400, "A team cannot play itself.");
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (keys.has(k)) throw new HttpError(400, bad);
      keys.add(k);
    }
  } else {
    const size = input.fixtures.length * 2;
    const bad = "Invalid knockout bracket.";
    if (size < 2 || (size & (size - 1)) !== 0 || size >= n * 2) throw new HttpError(400, bad);
    const used: number[] = [];
    for (const [a, b] of input.fixtures) {
      if (!isIdx(a) || (b !== null && !isIdx(b)))
        throw new HttpError(400, "A fixture refers to a team that does not exist.");
      if (a === b) throw new HttpError(400, "A team cannot play itself.");
      used.push(a);
      if (b !== null) used.push(b);
    }
    if (used.length !== n || new Set(used).size !== n)
      throw new HttpError(400, "Every team must appear exactly once in the bracket.");
  }
}

export async function getTournament(id: string) {
  const [t] = await q(`SELECT * FROM tournaments WHERE id=?`, [id]);
  if (!t) throw new HttpError(404, "Tournament not found");
  const teams = await q(
    `SELECT t.*, p1.name p1name, p2.name p2name FROM teams t JOIN players p1 ON p1.id=t.player1_id JOIN players p2 ON p2.id=t.player2_id WHERE t.tournament_id=? ORDER BY t.name`,
    [id],
  );
  const matches = await q(
    `SELECT id,kind,round,round_name,slot_index,team_a_id,team_b_id,winner_team_id,status,play_order,feeds_into_match_id,feeds_slot,format,games_json,score_a_total,score_b_total,state_json,completed_at
     FROM matches WHERE tournament_id=? ORDER BY play_order, round, slot_index`,
    [id],
  );
  const parsed = matches.map((m) => ({
    ...m,
    games: m.games_json ? JSON.parse(m.games_json) : [],
    live: m.state_json && m.status === "LIVE" ? JSON.parse(m.state_json) : null,
    games_json: undefined,
    state_json: undefined,
  }));
  const table =
    t.type === "LEAGUE"
      ? standings(
          teams.map((x) => x.id),
          parsed.filter((m) => m.kind === "LEAGUE" && m.status === "COMPLETED").map(toResult),
        )
      : [];
  return { tournament: t, teams, matches: parsed, standings: table };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toResult = (m: any): ResultRow => ({
  a: m.team_a_id,
  b: m.team_b_id,
  winner: m.winner_team_id,
  pointsA: Number(m.score_a_total),
  pointsB: Number(m.score_b_total),
  games: m.games,
});

async function finishTournament(tid: string, champion: string, runnerUp: string) {
  await exec(
    `UPDATE tournaments SET status='COMPLETED', champion_team_id=?, runner_up_team_id=? WHERE id=?`,
    [champion, runnerUp, tid],
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advance(m: any, winner: string, loser: string) {
  if (m.kind === "KNOCKOUT") {
    if (m.feeds_into_match_id)
      await exec(
        `UPDATE matches SET ${m.feeds_slot === "A" ? "team_a_id" : "team_b_id"}=? WHERE id=?`,
        [winner, m.feeds_into_match_id],
      );
    else await finishTournament(m.tournament_id, winner, loser);
  } else if (m.kind === "LEAGUE_FINAL") {
    await finishTournament(m.tournament_id, winner, loser);
  } else {
    const [{ c }] = await q(
      `SELECT COUNT(*) c FROM matches WHERE tournament_id=? AND kind='LEAGUE' AND status<>'COMPLETED'`,
      [m.tournament_id],
    );
    const [{ f }] = await q(
      `SELECT COUNT(*) f FROM matches WHERE tournament_id=? AND kind='LEAGUE_FINAL'`,
      [m.tournament_id],
    );
    if (Number(c) === 0 && Number(f) === 0) {
      const { standings: table } = await getTournament(m.tournament_id);
      if (table.length < 2) return;
      const [{ mx }] = await q(`SELECT MAX(play_order) mx FROM matches WHERE tournament_id=?`, [
        m.tournament_id,
      ]);
      await exec(
        `INSERT INTO matches (id,tournament_id,kind,round,round_name,team_a_id,team_b_id,status,play_order,format) VALUES (?,?,'LEAGUE_FINAL',2,'League Final',?,?,'UPCOMING',?,1)`,
        [uid(), m.tournament_id, table[0]!.team, table[1]!.team, Number(mx) + 1],
      );
    }
  }
}

/* ---------------- matches ---------------- */

async function loadRow(id: string) {
  const [m] = await q(`SELECT * FROM matches WHERE id=?`, [id]);
  if (!m) throw new HttpError(404, "Match not found");
  return m;
}

export async function getMatch(id: string) {
  const m = await loadRow(id);
  const teams = await q(
    `SELECT t.id,t.name,t.player1_id,t.player2_id,p1.name p1name,p2.name p2name FROM teams t JOIN players p1 ON p1.id=t.player1_id JOIN players p2 ON p2.id=t.player2_id WHERE t.id IN (?,?)`,
    [m.team_a_id ?? "-", m.team_b_id ?? "-"],
  );
  const [t] = await q(`SELECT id,name,type,status,champion_team_id FROM tournaments WHERE id=?`, [
    m.tournament_id,
  ]);
  const fmt = (tid: string | null) => {
    const x = teams.find((y) => y.id === tid);
    return x
      ? {
          id: x.id,
          name: x.name,
          players: [
            { id: x.player1_id, name: x.p1name },
            { id: x.player2_id, name: x.p2name },
          ],
        }
      : null;
  };
  const initial = m.initial_json ? (JSON.parse(m.initial_json) as MatchState) : null;
  const actions: MatchAction[] = m.actions_json ? JSON.parse(m.actions_json) : [];
  return {
    match: {
      id: m.id,
      kind: m.kind,
      round_name: m.round_name,
      status: m.status,
      format: Number(m.format),
      winner_team_id: m.winner_team_id,
      toss: m.toss_json ? JSON.parse(m.toss_json) : null,
      games: m.games_json ? JSON.parse(m.games_json) : [],
    },
    tournament: t,
    teamA: fmt(m.team_a_id),
    teamB: fmt(m.team_b_id),
    state: initial ? replay(initial, actions) : null,
    seq: Number(m.seq),
  };
}

export interface StartInput {
  tossWinner: TeamKey;
  tossChoice: "SERVE" | "COURT";
  teamASide: CourtSide;
  servingTeam: TeamKey;
  serverId: string;
  receiverId: string;
}

export async function startMatch(id: string, input: StartInput) {
  const m = await loadRow(id);
  if (m.status !== "UPCOMING" && m.status !== "SKIPPED")
    throw new HttpError(400, "This match cannot be started.");
  if (!m.team_a_id || !m.team_b_id)
    throw new HttpError(400, "Both teams must be known before starting.");
  const [{ c }] = await q(
    `SELECT COUNT(*) c FROM matches WHERE tournament_id=? AND status='LIVE'`,
    [m.tournament_id],
  );
  if (Number(c) > 0) throw new HttpError(409, "Another match is already live. Finish it first.");
  const expectServe =
    input.tossChoice === "SERVE" ? input.tossWinner : input.tossWinner === "A" ? "B" : "A";
  if (input.servingTeam !== expectServe)
    throw new HttpError(400, "The serving team does not match the coin toss decision.");
  const teams = await q(`SELECT id,player1_id,player2_id FROM teams WHERE id IN (?,?)`, [
    m.team_a_id,
    m.team_b_id,
  ]);
  const A = teams.find((t) => t.id === m.team_a_id)!,
    B = teams.find((t) => t.id === m.team_b_id)!;
  const initial = createMatch({
    teamA: [A.player1_id, A.player2_id],
    teamB: [B.player1_id, B.player2_id],
    format: m.kind === "LEAGUE_FINAL" ? 1 : (Number(m.format) as 1 | 3),
    teamASide: input.teamASide,
  });
  const action: MatchAction = {
    type: "SERVER_SELECTED",
    servingTeam: input.servingTeam,
    serverId: input.serverId,
    receiverId: input.receiverId,
  };
  const state = applyAction(initial, action);
  await exec(
    `UPDATE matches SET status='LIVE', toss_json=?, initial_json=?, actions_json=?, state_json=?, seq=1, started_at=NOW(), updated_at=NOW() WHERE id=?`,
    [
      JSON.stringify(input),
      JSON.stringify(initial),
      JSON.stringify([action]),
      JSON.stringify(state),
      id,
    ],
  );
  await exec(`INSERT INTO match_events (match_id,seq,action_json,state_json) VALUES (?,?,?,?)`, [
    id,
    1,
    JSON.stringify(action),
    JSON.stringify(state),
  ]);
  return getMatch(id);
}

export async function matchAction(
  id: string,
  action: MatchAction | { type: "UNDO" },
  expectedSeq?: number,
) {
  const m = await loadRow(id);
  if (m.status !== "LIVE") throw new HttpError(400, "This match is not live.");
  const seq = Number(m.seq);
  if (expectedSeq !== undefined && expectedSeq !== seq)
    throw new HttpError(409, "The score changed on another device. Reloading.");
  const initial = JSON.parse(m.initial_json) as MatchState;
  let actions: MatchAction[] = JSON.parse(m.actions_json);
  let state: MatchState;
  let logged: unknown = action;
  if (action.type === "UNDO") {
    const r = undoLast(initial, actions);
    if (!r.removed) throw new HttpError(400, "Nothing to undo.");
    actions = r.actions;
    state = r.state;
    logged = { type: "UNDO", removed: r.removed, dropped: r.dropped };
  } else {
    state = applyAction(replay(initial, actions), action);
    actions = [...actions, action];
  }
  // seq is a monotonic write counter (optimistic lock), independent of action count.
  const next = seq + 1;
  const ok = await exec(
    `UPDATE matches SET actions_json=?, state_json=?, seq=?, updated_at=NOW() WHERE id=? AND seq=?`,
    [JSON.stringify(actions), JSON.stringify(state), next, id, seq],
  );
  if (!ok) throw new HttpError(409, "The score changed on another device. Reloading.");
  // match_events is an append-only audit trail; undo is recorded, not erased.
  await exec(`INSERT INTO match_events (match_id,seq,action_json,state_json) VALUES (?,?,?,?)`, [
    id,
    next,
    JSON.stringify(logged),
    JSON.stringify(state),
  ]);
  return getMatch(id);
}

export async function confirmMatch(id: string, userId?: string) {
  const m = await loadRow(id);
  if (m.status !== "LIVE") throw new HttpError(400, "This match is not live.");
  const state = replay(JSON.parse(m.initial_json), JSON.parse(m.actions_json)) as MatchState;
  if (state.status !== "MATCH_OVER" || !state.winner)
    throw new HttpError(400, "The match is not finished yet.");
  const winner = state.winner === "A" ? m.team_a_id : m.team_b_id;
  const loser = state.winner === "A" ? m.team_b_id : m.team_a_id;
  const totA = state.games.reduce((s, g) => s + g.A, 0),
    totB = state.games.reduce((s, g) => s + g.B, 0);
  await exec(
    `UPDATE matches SET status='COMPLETED', winner_team_id=?, games_json=?, score_a_total=?, score_b_total=?, completed_at=NOW(), updated_at=NOW() WHERE id=?`,
    [winner, JSON.stringify(state.games), totA, totB, id],
  );
  await exec(`INSERT INTO audit_log (user_id,action,entity_id,detail) VALUES (?,?,?,?)`, [
    userId ?? null,
    "MATCH_CONFIRMED",
    id,
    JSON.stringify(state.games),
  ]);
  await advance(m, winner, loser);
  return getMatch(id);
}

export async function scheduleOp(id: string, op: "up" | "down" | "end" | "skip" | "unskip") {
  const m = await loadRow(id);
  if (!["UPCOMING", "SKIPPED"].includes(m.status))
    throw new HttpError(400, "Only upcoming matches can be moved.");
  if (op === "skip") return exec(`UPDATE matches SET status='SKIPPED' WHERE id=?`, [id]);
  if (op === "unskip") return exec(`UPDATE matches SET status='UPCOMING' WHERE id=?`, [id]);
  if (op === "end") {
    const [{ mx }] = await q(`SELECT MAX(play_order) mx FROM matches WHERE tournament_id=?`, [
      m.tournament_id,
    ]);
    return exec(`UPDATE matches SET play_order=?, status='UPCOMING' WHERE id=?`, [
      Number(mx) + 1,
      id,
    ]);
  }
  const [nb] = await q(
    `SELECT id, play_order FROM matches WHERE tournament_id=? AND status IN ('UPCOMING','SKIPPED') AND play_order ${op === "up" ? "<" : ">"} ? ORDER BY play_order ${op === "up" ? "DESC" : "ASC"} LIMIT 1`,
    [m.tournament_id, m.play_order],
  );
  if (!nb) return 0;
  await exec(`UPDATE matches SET play_order=? WHERE id=?`, [nb.play_order, id]);
  return exec(`UPDATE matches SET play_order=? WHERE id=?`, [m.play_order, nb.id]);
}

/* ---------------- stats ---------------- */

export interface PlayerStat {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pd: number;
  winPct: number;
  titles: number;
  runnerUps: number;
  tournaments: number;
}

export async function playerStats(
  filter: { since?: string | undefined; tournamentId?: string | undefined } = {},
) {
  const players = await q(`SELECT id,name,nickname FROM players ORDER BY name`);
  const cond: string[] = ["m.status='COMPLETED'"];
  const params: unknown[] = [];
  if (filter.since) {
    cond.push("t.date >= ?");
    params.push(filter.since);
  }
  if (filter.tournamentId) {
    cond.push("t.id = ?");
    params.push(filter.tournamentId);
  }
  const rows = await q(
    `SELECT m.id, m.tournament_id, m.kind, m.round_name, m.winner_team_id, m.team_a_id, m.team_b_id, m.score_a_total, m.score_b_total, m.games_json, m.completed_at,
      ta.name aname, tb.name bname, ta.player1_id a1, ta.player2_id a2, tb.player1_id b1, tb.player2_id b2, t.name tname, t.date tdate
     FROM matches m JOIN teams ta ON ta.id=m.team_a_id JOIN teams tb ON tb.id=m.team_b_id JOIN tournaments t ON t.id=m.tournament_id
     WHERE ${cond.join(" AND ")} ORDER BY m.completed_at DESC`,
    params,
  );
  const tours = await q(
    `SELECT t.id, t.champion_team_id, t.runner_up_team_id, c.player1_id c1, c.player2_id c2, r.player1_id r1, r.player2_id r2
     FROM tournaments t LEFT JOIN teams c ON c.id=t.champion_team_id LEFT JOIN teams r ON r.id=t.runner_up_team_id
     ${filter.since || filter.tournamentId ? `WHERE ${filter.since ? "t.date >= ?" : "t.id = ?"}` : ""}`,
    filter.since ? [filter.since] : filter.tournamentId ? [filter.tournamentId] : [],
  );
  const tPlayers = await q(`SELECT tournament_id, player1_id, player2_id FROM teams`);
  const map = new Map<string, PlayerStat>(
    players.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pd: 0,
        winPct: 0,
        titles: 0,
        runnerUps: 0,
        tournaments: 0,
      },
    ]),
  );
  for (const r of rows) {
    // Same point-difference rule as the league table (a deuce game counts as one point).
    const diffA = matchPointDiff({
      pointsA: Number(r.score_a_total),
      pointsB: Number(r.score_b_total),
      games: r.games_json ? JSON.parse(r.games_json) : undefined,
    });
    const sides = [
      {
        ids: [r.a1, r.a2],
        team: r.team_a_id,
        pf: Number(r.score_a_total),
        pa: Number(r.score_b_total),
        pd: diffA,
      },
      {
        ids: [r.b1, r.b2],
        team: r.team_b_id,
        pf: Number(r.score_b_total),
        pa: Number(r.score_a_total),
        pd: -diffA,
      },
    ];
    for (const s of sides)
      for (const pid of s.ids) {
        const st = map.get(pid);
        if (!st) continue;
        st.played++;
        if (r.winner_team_id === s.team) st.wins++;
        else st.losses++;
        st.pointsFor += s.pf;
        st.pointsAgainst += s.pa;
        st.pd += s.pd;
      }
  }
  const tourIds = new Set(tours.map((t) => t.id));
  for (const tp of tPlayers)
    if (tourIds.has(tp.tournament_id))
      for (const pid of [tp.player1_id, tp.player2_id]) {
        const st = map.get(pid);
        if (st) st.tournaments++;
      }
  for (const t of tours) {
    for (const pid of [t.c1, t.c2]) if (pid && map.get(pid)) map.get(pid)!.titles++;
    for (const pid of [t.r1, t.r2]) if (pid && map.get(pid)) map.get(pid)!.runnerUps++;
  }
  const stats = [...map.values()].map((s) => ({
    ...s,
    winPct: s.played ? Math.round((s.wins / s.played) * 100) : 0,
  }));
  return { stats, matches: rows };
}

/* ---------------- adding teams / rebalancing (league only) ---------------- */

interface PlanRow {
  id: string;
  kind: string;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  play_order: number;
}

/**
 * Re-orders only eligible matches (UPCOMING league fixtures) inside the slots they already occupy.
 * Completed, live, skipped (organizer-protected) and final matches keep their position and act as
 * rest context. Returns the new play_order for each eligible match id.
 */
export function planRebalance(rows: PlanRow[], rng?: Rng): Map<string, number> {
  const sorted = [...rows].sort((a, b) => a.play_order - b.play_order);
  const eligible = (r: PlanRow) =>
    r.kind === "LEAGUE" && r.status === "UPCOMING" && !!r.team_a_id && !!r.team_b_id;
  const fixed = sorted.map((r): Fixture | null =>
    eligible(r) ? null : [r.team_a_id ?? `-${r.id}`, r.team_b_id ?? `-${r.id}`],
  );
  const free = sorted.filter(eligible).map((r): Fixture => [r.team_a_id!, r.team_b_id!]);
  const ordered = scheduleLeague(free, { fixed, ...(rng ? { rng } : {}) });
  const byPair = new Map<string, PlanRow[]>();
  for (const r of sorted.filter(eligible)) {
    const k = [r.team_a_id, r.team_b_id].sort().join("|");
    byPair.set(k, [...(byPair.get(k) ?? []), r]);
  }
  const out = new Map<string, number>();
  sorted.forEach((slot, i) => {
    if (fixed[i] !== null) return;
    const f = ordered[i]!;
    const row = byPair.get([...f].sort().join("|"))!.shift()!;
    out.set(row.id, slot.play_order);
  });
  return out;
}

/** Backend rules for adding a team. Pure so every rejection is unit-testable. Returns the cleaned name. */
export function validateNewTeam(ctx: {
  tournament: { type: string; status: string } | undefined;
  teams: { name: string; player1_id: string; player2_id: string }[];
  hasFinal: boolean;
  knownPlayerIds: string[];
  name: string;
  players: [string, string];
}): string {
  const { tournament: t } = ctx;
  if (!t) throw new HttpError(404, "Tournament not found");
  if (t.type !== "LEAGUE")
    throw new HttpError(
      409,
      "Teams cannot be added to a knockout tournament after it has started.",
    );
  if (t.status !== "LIVE")
    throw new HttpError(409, "This tournament is finished; teams can no longer be added.");
  if (ctx.hasFinal)
    throw new HttpError(
      409,
      "The League Final is already scheduled; teams can no longer be added.",
    );
  const name = ctx.name.trim();
  if (!name || name.length > 100)
    throw new HttpError(400, "Enter a team name (up to 100 characters).");
  const [p1, p2] = ctx.players;
  if (p1 === p2) throw new HttpError(400, "A team needs two different players.");
  if (!ctx.knownPlayerIds.includes(p1) || !ctx.knownPlayerIds.includes(p2))
    throw new HttpError(400, "Unknown player selected.");
  if (ctx.teams.some((x) => [x.player1_id, x.player2_id].some((id) => id === p1 || id === p2)))
    throw new HttpError(409, "This player is already assigned to another team.");
  if (ctx.teams.some((x) => x.name.trim().toLowerCase() === name.toLowerCase()))
    throw new HttpError(409, "Team names must be unique within the tournament.");
  return name;
}

export async function addTeam(
  tournamentId: string,
  input: { name: string; players: [string, string] },
  rng?: Rng,
) {
  const teamId = await withTransaction(async (tx) => {
    // Lock the tournament row so concurrent/retried requests are serialised and re-validated.
    const [t] = await tx.execute(
      `SELECT id,type,status,format FROM tournaments WHERE id=? FOR UPDATE`,
      [tournamentId],
    );
    const teams = await tx.execute(
      `SELECT id,name,player1_id,player2_id FROM teams WHERE tournament_id=?`,
      [tournamentId],
    );
    const matches: PlanRow[] = await tx.execute(
      `SELECT id,kind,status,team_a_id,team_b_id,play_order FROM matches WHERE tournament_id=?`,
      [tournamentId],
    );
    const known = await tx.execute(`SELECT id FROM players WHERE id IN (?,?)`, input.players);
    const name = validateNewTeam({
      tournament: t,
      teams,
      hasFinal: matches.some((m) => m.kind === "LEAGUE_FINAL"),
      knownPlayerIds: known.map((p: { id: string }) => p.id),
      name: input.name,
      players: input.players,
    });
    const newId = uid();
    await tx.execute(
      `INSERT INTO teams (id,tournament_id,name,player1_id,player2_id) VALUES (?,?,?,?,?)`,
      [newId, tournamentId, name, input.players[0], input.players[1]],
    );
    // One new fixture per existing team, appended and then balanced among the upcoming slots.
    let order = matches.reduce((mx, m) => Math.max(mx, Number(m.play_order)), 0);
    const fresh: PlanRow[] = teams.map((x: { id: string }) => ({
      id: uid(),
      kind: "LEAGUE",
      status: "UPCOMING",
      team_a_id: x.id,
      team_b_id: newId,
      play_order: ++order,
    }));
    const plan = planRebalance(
      [...matches.map((m) => ({ ...m, play_order: Number(m.play_order) })), ...fresh],
      rng,
    );
    for (const f of fresh)
      await tx.execute(
        `INSERT INTO matches (id,tournament_id,kind,round,round_name,team_a_id,team_b_id,status,play_order,format) VALUES (?,?,'LEAGUE',1,'League',?,?,'UPCOMING',?,?)`,
        [
          f.id,
          tournamentId,
          f.team_a_id,
          f.team_b_id,
          plan.get(f.id) ?? f.play_order,
          Number(t.format),
        ],
      );
    for (const m of matches) {
      const next = plan.get(m.id);
      if (next !== undefined && next !== Number(m.play_order))
        await tx.execute(`UPDATE matches SET play_order=? WHERE id=? AND status='UPCOMING'`, [
          next,
          m.id,
        ]);
    }
    return newId;
  });
  return { id: teamId, ...(await getTournament(tournamentId)) };
}

export async function rebalanceUpcoming(tournamentId: string, rng?: Rng) {
  await withTransaction(async (tx) => {
    const [t] = await tx.execute(`SELECT id,type,status FROM tournaments WHERE id=? FOR UPDATE`, [
      tournamentId,
    ]);
    if (!t) throw new HttpError(404, "Tournament not found");
    if (t.type !== "LEAGUE") throw new HttpError(409, "Only league schedules can be rebalanced.");
    if (t.status !== "LIVE") throw new HttpError(409, "This tournament is finished.");
    const matches: PlanRow[] = await tx.execute(
      `SELECT id,kind,status,team_a_id,team_b_id,play_order FROM matches WHERE tournament_id=?`,
      [tournamentId],
    );
    const plan = planRebalance(
      matches.map((m) => ({ ...m, play_order: Number(m.play_order) })),
      rng,
    );
    for (const m of matches) {
      const next = plan.get(m.id);
      if (next !== undefined && next !== Number(m.play_order))
        await tx.execute(`UPDATE matches SET play_order=? WHERE id=? AND status='UPCOMING'`, [
          next,
          m.id,
        ]);
    }
  });
  return getTournament(tournamentId);
}
