import { q, exec, uid } from "./db";
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
import { roundName, standings, type ResultRow } from "../engine/tournament";

/* ---------------- tournaments ---------------- */

export interface CreateTournamentInput {
  name: string;
  date: string;
  location?: string;
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
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "A player cannot be in two teams.");
  const known = await q<{ id: string }>(
    `SELECT id FROM players WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  if (known.length !== ids.length) throw new HttpError(400, "Unknown player selected.");

  const tid = uid();
  await exec(`INSERT INTO tournaments (id,name,date,location,type,format,status) VALUES (?,?,?,?,?,?, 'LIVE')`, [
    tid,
    input.name,
    input.date,
    input.location ?? null,
    input.type,
    input.type === "LEAGUE" ? input.format : input.format,
  ]);
  const teamIds = input.teams.map(() => uid());
  for (let i = 0; i < n; i++) {
    const t = input.teams[i]!;
    await exec(`INSERT INTO teams (id,tournament_id,name,player1_id,player2_id) VALUES (?,?,?,?,?)`, [
      teamIds[i],
      tid,
      t.name,
      t.players[0],
      t.players[1],
    ]);
  }

  const used = input.fixtures.flatMap((f) => f.filter((x): x is number => x !== null));
  if (input.type === "LEAGUE") {
    const keys = new Set(input.fixtures.map(([a, b]) => [a, b].sort().join("-")));
    if (keys.size !== (n * (n - 1)) / 2 || input.fixtures.some(([a, b]) => b === null || a === b))
      throw new HttpError(400, "League fixtures must contain every pairing once.");
    let order = 1;
    for (const [a, b] of input.fixtures) {
      await exec(
        `INSERT INTO matches (id,tournament_id,kind,round,round_name,team_a_id,team_b_id,status,play_order,format) VALUES (?,?,'LEAGUE',1,'League',?,?,'UPCOMING',?,?)`,
        [uid(), tid, teamIds[a], teamIds[b!], order++, input.format],
      );
    }
  } else {
    const size = input.fixtures.length * 2;
    if ((size & (size - 1)) !== 0 || used.length !== n || new Set(used).size !== n)
      throw new HttpError(400, "Invalid knockout bracket.");
    const rounds = Math.log2(size);
    // create from final backwards so feeds_into ids exist
    const byRound: string[][] = [];
    for (let r = rounds; r >= 1; r--) {
      byRound[r] = [];
      for (let i = 0; i < size / 2 ** r; i++) byRound[r]![i] = uid();
    }
    let order = 1;
    for (let r = 1; r <= rounds; r++) {
      for (let i = 0; i < size / 2 ** r; i++) {
        const feeds = r < rounds ? byRound[r + 1]![Math.floor(i / 2)]! : null;
        const slot = i % 2 === 0 ? "A" : "B";
        let a: string | null = null,
          b: string | null = null,
          bye = false;
        if (r === 1) {
          const [fa, fb] = input.fixtures[i]!;
          a = teamIds[fa]!;
          b = fb === null ? null : teamIds[fb]!;
          bye = fb === null;
        }
        await exec(
          `INSERT INTO matches (id,tournament_id,kind,round,round_name,slot_index,team_a_id,team_b_id,winner_team_id,status,play_order,feeds_into_match_id,feeds_slot,format)
           VALUES (?,?,'KNOCKOUT',?,?,?,?,?,?,?,?,?,?,?)`,
          [
            byRound[r]![i],
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
        );
        if (bye && feeds)
          await exec(`UPDATE matches SET ${slot === "A" ? "team_a_id" : "team_b_id"}=? WHERE id=?`, [a, feeds]);
      }
    }
  }
  return tid;
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
});

async function finishTournament(tid: string, champion: string, runnerUp: string) {
  await exec(`UPDATE tournaments SET status='COMPLETED', champion_team_id=?, runner_up_team_id=? WHERE id=?`, [
    champion,
    runnerUp,
    tid,
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function advance(m: any, winner: string, loser: string) {
  if (m.kind === "KNOCKOUT") {
    if (m.feeds_into_match_id)
      await exec(`UPDATE matches SET ${m.feeds_slot === "A" ? "team_a_id" : "team_b_id"}=? WHERE id=?`, [
        winner,
        m.feeds_into_match_id,
      ]);
    else await finishTournament(m.tournament_id, winner, loser);
  } else if (m.kind === "FINAL") {
    await finishTournament(m.tournament_id, winner, loser);
  } else {
    const [{ c }] = await q(
      `SELECT COUNT(*) c FROM matches WHERE tournament_id=? AND kind='LEAGUE' AND status<>'COMPLETED'`,
      [m.tournament_id],
    );
    const [{ f }] = await q(`SELECT COUNT(*) f FROM matches WHERE tournament_id=? AND kind='FINAL'`, [
      m.tournament_id,
    ]);
    if (Number(c) === 0 && Number(f) === 0) {
      const { standings: table } = await getTournament(m.tournament_id);
      if (table.length < 2) return;
      const [{ mx }] = await q(`SELECT MAX(play_order) mx FROM matches WHERE tournament_id=?`, [m.tournament_id]);
      await exec(
        `INSERT INTO matches (id,tournament_id,kind,round,round_name,team_a_id,team_b_id,status,play_order,format) VALUES (?,?,'FINAL',2,'League Final',?,?,'UPCOMING',?,1)`,
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
  const [t] = await q(`SELECT id,name,type,status FROM tournaments WHERE id=?`, [m.tournament_id]);
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
  if (m.status !== "UPCOMING" && m.status !== "SKIPPED") throw new HttpError(400, "This match cannot be started.");
  if (!m.team_a_id || !m.team_b_id) throw new HttpError(400, "Both teams must be known before starting.");
  const [{ c }] = await q(`SELECT COUNT(*) c FROM matches WHERE tournament_id=? AND status='LIVE'`, [
    m.tournament_id,
  ]);
  if (Number(c) > 0) throw new HttpError(409, "Another match is already live. Finish it first.");
  const expectServe = input.tossChoice === "SERVE" ? input.tossWinner : input.tossWinner === "A" ? "B" : "A";
  if (input.servingTeam !== expectServe)
    throw new HttpError(400, "The serving team does not match the coin toss decision.");
  const teams = await q(`SELECT id,player1_id,player2_id FROM teams WHERE id IN (?,?)`, [m.team_a_id, m.team_b_id]);
  const A = teams.find((t) => t.id === m.team_a_id)!,
    B = teams.find((t) => t.id === m.team_b_id)!;
  const initial = createMatch({
    teamA: [A.player1_id, A.player2_id],
    teamB: [B.player1_id, B.player2_id],
    format: m.kind === "FINAL" ? 1 : (Number(m.format) as 1 | 3),
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
    [JSON.stringify(input), JSON.stringify(initial), JSON.stringify([action]), JSON.stringify(state), id],
  );
  await exec(`INSERT INTO match_events (match_id,seq,action_json,state_json) VALUES (?,?,?,?)`, [
    id,
    1,
    JSON.stringify(action),
    JSON.stringify(state),
  ]);
  return getMatch(id);
}

export async function matchAction(id: string, action: MatchAction | { type: "UNDO" }, expectedSeq?: number) {
  const m = await loadRow(id);
  if (m.status !== "LIVE") throw new HttpError(400, "This match is not live.");
  const seq = Number(m.seq);
  if (expectedSeq !== undefined && expectedSeq !== seq)
    throw new HttpError(409, "The score changed on another device. Reloading.");
  const initial = JSON.parse(m.initial_json) as MatchState;
  let actions: MatchAction[] = JSON.parse(m.actions_json);
  let state: MatchState;
  if (action.type === "UNDO") {
    const r = undoLast(initial, actions);
    if (r.actions.length === actions.length) throw new HttpError(400, "Nothing to undo.");
    actions = r.actions;
    state = r.state;
  } else {
    state = applyAction(replay(initial, actions), action);
    actions = [...actions, action];
  }
  const ok = await exec(
    `UPDATE matches SET actions_json=?, state_json=?, seq=?, updated_at=NOW() WHERE id=? AND seq=?`,
    [JSON.stringify(actions), JSON.stringify(state), actions.length, id, seq],
  );
  if (!ok) throw new HttpError(409, "The score changed on another device. Reloading.");
  if (action.type === "UNDO") await exec(`DELETE FROM match_events WHERE match_id=? AND seq>?`, [id, actions.length]);
  else
    await exec(`INSERT INTO match_events (match_id,seq,action_json,state_json) VALUES (?,?,?,?)`, [
      id,
      actions.length,
      JSON.stringify(action),
      JSON.stringify(state),
    ]);
  return getMatch(id);
}

export async function confirmMatch(id: string, userId?: string) {
  const m = await loadRow(id);
  if (m.status !== "LIVE") throw new HttpError(400, "This match is not live.");
  const state = replay(JSON.parse(m.initial_json), JSON.parse(m.actions_json)) as MatchState;
  if (state.status !== "MATCH_OVER" || !state.winner) throw new HttpError(400, "The match is not finished yet.");
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
  if (!["UPCOMING", "SKIPPED"].includes(m.status)) throw new HttpError(400, "Only upcoming matches can be moved.");
  if (op === "skip") return exec(`UPDATE matches SET status='SKIPPED' WHERE id=?`, [id]);
  if (op === "unskip") return exec(`UPDATE matches SET status='UPCOMING' WHERE id=?`, [id]);
  if (op === "end") {
    const [{ mx }] = await q(`SELECT MAX(play_order) mx FROM matches WHERE tournament_id=?`, [m.tournament_id]);
    return exec(`UPDATE matches SET play_order=?, status='UPCOMING' WHERE id=?`, [Number(mx) + 1, id]);
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

export async function playerStats(filter: { since?: string; tournamentId?: string } = {}) {
  const players = await q(`SELECT id,name,nickname FROM players ORDER BY name`);
  const cond: string[] = ["m.status='COMPLETED'"];
  const params: unknown[] = [];
  if (filter.since) (cond.push("t.date >= ?"), params.push(filter.since));
  if (filter.tournamentId) (cond.push("t.id = ?"), params.push(filter.tournamentId));
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
      { id: p.id, name: p.name, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, pd: 0, winPct: 0, titles: 0, runnerUps: 0, tournaments: 0 },
    ]),
  );
  for (const r of rows) {
    const sides = [
      { ids: [r.a1, r.a2], team: r.team_a_id, pf: Number(r.score_a_total), pa: Number(r.score_b_total) },
      { ids: [r.b1, r.b2], team: r.team_b_id, pf: Number(r.score_b_total), pa: Number(r.score_a_total) },
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
    pd: s.pointsFor - s.pointsAgainst,
    winPct: s.played ? Math.round((s.wins / s.played) * 100) : 0,
  }));
  return { stats, matches: rows };
}
