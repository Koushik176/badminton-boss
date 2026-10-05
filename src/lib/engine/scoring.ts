/**
 * Badminton doubles scoring engine.
 * Pure + deterministic: applyAction(state, action) -> new state. No UI, no I/O.
 */

export type TeamKey = "A" | "B";
export type CourtHalf = "left" | "right";
export type CourtSide = "top" | "bottom";
export type MatchFormat = 1 | 3;
export type EngineStatus = "SETUP" | "LIVE" | "PAUSED" | "GAME_OVER" | "MATCH_OVER";

export interface GameScore {
  A: number;
  B: number;
  winner: TeamKey | null;
}

export interface MatchState {
  format: MatchFormat;
  teams: Record<TeamKey, [string, string]>;
  status: EngineStatus;
  gameNumber: number;
  score: Record<TeamKey, number>;
  gamesWon: Record<TeamKey, number>;
  games: GameScore[];
  sides: Record<TeamKey, CourtSide>;
  /** Current service court (left/right) for every player id. */
  courts: Record<string, CourtHalf>;
  servingTeam: TeamKey | null;
  serverId: string | null;
  receiverId: string | null;
  serviceCourt: CourtHalf | null;
  /** Whether ends were already changed at 11 in the deciding game. */
  midGameSwitchDone: boolean;
  winner: TeamKey | null;
  rallyCount: number;
}

export type MatchAction =
  | { type: "SERVER_SELECTED"; servingTeam: TeamKey; serverId: string; receiverId: string }
  | { type: "RALLY_WON"; team: TeamKey }
  | { type: "GAME_STARTED"; serverId: string; receiverId: string }
  | { type: "MATCH_PAUSED" }
  | { type: "MATCH_RESUMED" };

export class EngineError extends Error {}

export const other = (t: TeamKey): TeamKey => (t === "A" ? "B" : "A");
const flip = (h: CourtHalf): CourtHalf => (h === "left" ? "right" : "left");
export const courtForScore = (score: number): CourtHalf => (score % 2 === 0 ? "right" : "left");

export function teamOf(state: MatchState, playerId: string): TeamKey | null {
  if (state.teams.A.includes(playerId)) return "A";
  if (state.teams.B.includes(playerId)) return "B";
  return null;
}

export function partnerOf(state: MatchState, playerId: string): string {
  const t = teamOf(state, playerId);
  if (!t) throw new EngineError("Unknown player");
  const [p1, p2] = state.teams[t];
  return p1 === playerId ? p2 : p1;
}

function playerInCourt(state: MatchState, team: TeamKey, half: CourtHalf, courts = state.courts) {
  const p = state.teams[team].find((id) => courts[id] === half);
  if (!p) throw new EngineError("Invalid court positions");
  return p;
}

export function createMatch(opts: {
  teamA: [string, string];
  teamB: [string, string];
  format?: MatchFormat;
  teamASide?: CourtSide;
}): MatchState {
  const sideA = opts.teamASide ?? "bottom";
  return {
    format: opts.format ?? 1,
    teams: { A: opts.teamA, B: opts.teamB },
    status: "SETUP",
    gameNumber: 1,
    score: { A: 0, B: 0 },
    gamesWon: { A: 0, B: 0 },
    games: [],
    sides: { A: sideA, B: sideA === "bottom" ? "top" : "bottom" },
    courts: {},
    servingTeam: null,
    serverId: null,
    receiverId: null,
    serviceCourt: null,
    midGameSwitchDone: false,
    winner: null,
    rallyCount: 0,
  };
}

export function isGameWon(own: number, opp: number): boolean {
  if (own >= 30) return true;
  return own >= 21 && own - opp >= 2;
}

function placePlayers(state: MatchState, servingTeam: TeamKey, serverId: string, receiverId: string) {
  if (teamOf(state, serverId) !== servingTeam)
    throw new EngineError("The server must belong to the serving team.");
  if (teamOf(state, receiverId) !== other(servingTeam))
    throw new EngineError("The receiver must belong to the receiving team.");
  const half = courtForScore(state.score[servingTeam]);
  const courts: Record<string, CourtHalf> = {
    [serverId]: half,
    [partnerOf(state, serverId)]: flip(half),
    [receiverId]: half, // diagonally opposite = same named court from own perspective
    [partnerOf(state, receiverId)]: flip(half),
  };
  return { courts, servingTeam, serverId, receiverId, serviceCourt: half };
}

export function applyAction(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "SERVER_SELECTED": {
      if (state.status !== "SETUP") throw new EngineError("Server already selected.");
      return {
        ...state,
        ...placePlayers(state, action.servingTeam, action.serverId, action.receiverId),
        status: "LIVE",
      };
    }
    case "GAME_STARTED": {
      if (state.status !== "GAME_OVER") throw new EngineError("No game to start.");
      const prev = state.games[state.games.length - 1];
      const servingTeam = prev.winner!; // winner of previous game serves first
      const next: MatchState = {
        ...state,
        gameNumber: state.gameNumber + 1,
        score: { A: 0, B: 0 },
        sides: { A: state.sides.B, B: state.sides.A }, // change ends
        midGameSwitchDone: false,
        status: "LIVE",
      };
      return { ...next, ...placePlayers(next, servingTeam, action.serverId, action.receiverId) };
    }
    case "MATCH_PAUSED":
      if (state.status !== "LIVE") throw new EngineError("Match is not live.");
      return { ...state, status: "PAUSED" };
    case "MATCH_RESUMED":
      if (state.status !== "PAUSED") throw new EngineError("Match is not paused.");
      return { ...state, status: "LIVE" };
    case "RALLY_WON":
      return rallyWon(state, action.team);
  }
}

function rallyWon(state: MatchState, team: TeamKey): MatchState {
  if (state.status !== "LIVE") throw new EngineError("Points can only be added during a live game.");
  const serving = state.servingTeam!;
  const score = { ...state.score, [team]: state.score[team] + 1 };
  if (score[team] > 30) throw new EngineError("Score cannot exceed 30.");
  let courts = { ...state.courts };
  let serverId = state.serverId!;

  if (team === serving) {
    // Same server; serving pair swaps service courts.
    const partner = partnerOf(state, serverId);
    courts[serverId] = flip(courts[serverId]);
    courts[partner] = flip(courts[partner]);
  } else {
    // Service over: nobody moves; new server is whoever stands in the court matching the score.
    serverId = playerInCourt(state, team, courtForScore(score[team]), courts);
  }
  const serviceCourt = courts[serverId];
  const receiverId = playerInCourt(state, other(team === serving ? serving : team), serviceCourt, courts);

  let next: MatchState = {
    ...state,
    score,
    courts,
    servingTeam: team,
    serverId,
    receiverId,
    serviceCourt,
    rallyCount: state.rallyCount + 1,
  };

  // Deciding game: change ends when leading side reaches 11.
  const deciding = state.format === 3 && state.gameNumber === 3;
  if (deciding && !next.midGameSwitchDone && Math.max(score.A, score.B) === 11) {
    next = { ...next, sides: { A: next.sides.B, B: next.sides.A }, midGameSwitchDone: true };
  }

  if (isGameWon(score[team], score[other(team)])) {
    const games = [...state.games, { A: score.A, B: score.B, winner: team }];
    const gamesWon = { ...state.gamesWon, [team]: state.gamesWon[team] + 1 };
    const needed = state.format === 3 ? 2 : 1;
    const matchOver = gamesWon[team] >= needed;
    next = {
      ...next,
      games,
      gamesWon,
      status: matchOver ? "MATCH_OVER" : "GAME_OVER",
      winner: matchOver ? team : null,
    };
  }
  return next;
}

/** Event-sourced reconstruction. Undo = drop the last event and replay. */
export function replay(initial: MatchState, actions: MatchAction[]): MatchState {
  return actions.reduce(applyAction, initial);
}

export function undoLast(initial: MatchState, actions: MatchAction[]) {
  const idx = [...actions].reverse().findIndex((a) => a.type === "RALLY_WON");
  if (idx === -1) return { state: replay(initial, actions), actions };
  const cut = actions.length - 1 - idx;
  const kept = actions.slice(0, cut);
  return { state: replay(initial, kept), actions: kept };
}

/** Role of a player in the current state, for court rendering. */
export function roleOf(state: MatchState, playerId: string) {
  if (playerId === state.serverId) return "SERVER";
  if (playerId === state.receiverId) return "RECEIVER";
  const t = teamOf(state, playerId);
  return t === state.servingTeam ? "SERVER PARTNER" : "RECEIVER PARTNER";
}
