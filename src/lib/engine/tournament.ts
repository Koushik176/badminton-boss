/** Pure tournament helpers: teams, fixtures, brackets, standings. */

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const pairingKey = (pairs: [string, string][]) =>
  pairs
    .map((p) => [...p].sort().join("+"))
    .sort()
    .join("|");

/** Random doubles pairs. Locked pairs stay; avoids repeating `previousKey` when possible. */
export function randomTeams(
  players: string[],
  opts: { locked?: [string, string][]; previousKey?: string | undefined; rng?: Rng | undefined } = {},
): [string, string][] {
  if (players.length < 2) throw new Error("At least 2 players are required.");
  if (players.length % 2 !== 0) throw new Error("Doubles teams require an even number of players.");
  const locked = opts.locked ?? [];
  const lockedIds = new Set(locked.flat());
  const free = players.filter((p) => !lockedIds.has(p));
  let result: [string, string][] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const s = shuffle(free, opts.rng);
    result = [...locked];
    for (let i = 0; i < s.length; i += 2) result.push([s[i]!, s[i + 1]!]);
    if (free.length <= 2 || pairingKey(result) !== opts.previousKey) break;
  }
  return result;
}

export interface TeamPair {
  players: [string, string];
  locked: boolean;
}

/**
 * Doubles teams where `locked` pairs are kept exactly as given and only the remaining
 * players are paired at random. Locked pairs are validated; nothing is silently dropped.
 */
export function buildTeams(
  players: string[],
  locked: [string, string][] = [],
  opts: { previousKey?: string | undefined; rng?: Rng } = {},
): TeamPair[] {
  const pool = new Set(players);
  const seen = new Set<string>();
  for (const [a, b] of locked) {
    if (a === b) throw new Error("A team needs two different players.");
    for (const p of [a, b]) {
      if (!pool.has(p)) throw new Error("A locked team contains a player who is not selected.");
      if (seen.has(p)) throw new Error("A player is assigned to more than one team.");
      seen.add(p);
    }
  }
  const pairs = randomTeams(players, { locked, previousKey: opts.previousKey, rng: opts.rng });
  return pairs.map((players, i) => ({ players, locked: i < locked.length }));
}

export function roundRobin<T>(teams: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) out.push([teams[i]!, teams[j]!]);
  return out;
}

/** Small deterministic PRNG so a schedule can be reproduced from a seed. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Fixture = [string, string];

/**
 * Cost of a match order: back-to-back appearances dominate, then uneven rest gaps per team,
 * then teams whose shortest rest is much shorter than others'. Lower is better.
 */
export function scheduleCost(seq: readonly Fixture[]): number {
  const last = new Map<string, number>();
  const gaps = new Map<string, number[]>();
  seq.forEach(([a, b], i) => {
    for (const t of [a, b]) {
      const prev = last.get(t);
      if (prev !== undefined) {
        const g = gaps.get(t) ?? [];
        g.push(i - prev);
        gaps.set(t, g);
      }
      last.set(t, i);
    }
  });
  let cost = 0;
  const mins: number[] = [];
  for (const g of gaps.values()) {
    const mean = g.reduce((s, x) => s + x, 0) / g.length;
    for (const x of g) {
      if (x === 1) cost += 10000;
      cost += 50 / (x * x) + 20 * (x - mean) ** 2 / g.length;
    }
    mins.push(Math.min(...g));
  }
  if (mins.length) {
    const m = mins.reduce((s, x) => s + x, 0) / mins.length;
    cost += 5 * mins.reduce((s, x) => s + (x - m) ** 2, 0);
  }
  return cost;
}

/**
 * Orders league fixtures to spread rest evenly. `fixed` is the full slot list where non-null
 * entries are already decided (completed / live / protected matches) and null entries are the
 * slots to fill with `free`. Without `fixed`, every slot is free. Deterministic for a given rng.
 * Equal rest for every team is not always possible (e.g. with an odd team count); this minimises
 * the imbalance, it does not guarantee zero.
 */
export function scheduleLeague(
  free: readonly Fixture[],
  opts: { rng?: Rng; fixed?: readonly (Fixture | null)[] } = {},
): Fixture[] {
  const rng = opts.rng ?? Math.random;
  const slots: (Fixture | null)[] = opts.fixed ? [...opts.fixed] : free.map(() => null);
  const freeIdx = slots.flatMap((s, i) => (s === null ? [i] : []));
  if (freeIdx.length !== free.length) throw new Error("Number of open slots must match the fixtures to place.");

  // Greedy: fill each open slot with the fixture whose teams have rested longest.
  const remaining = shuffle(free, rng);
  const restOf = (team: string, at: number) => {
    for (let j = at - 1; j >= 0; j--) {
      const s = slots[j];
      if (s && (s[0] === team || s[1] === team)) return at - j;
    }
    return 1000;
  };
  for (const at of freeIdx) {
    let best = 0, bestScore = -Infinity;
    remaining.forEach((f, k) => {
      const score = Math.min(restOf(f[0], at), restOf(f[1], at)) * 10 + Math.min(restOf(f[0], at) + restOf(f[1], at), 200) / 100;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    });
    slots[at] = remaining.splice(best, 1)[0]!;
  }

  // Local search: swap two open slots, keep if not worse.
  const seq = slots as Fixture[];
  let cost = scheduleCost(seq);
  const iterations = Math.max(50, Math.min(4000, Math.floor(400000 / Math.max(1, seq.length))));
  for (let it = 0; it < iterations && freeIdx.length > 1 && cost > 0; it++) {
    const i = freeIdx[Math.floor(rng() * freeIdx.length)]!;
    const j = freeIdx[Math.floor(rng() * freeIdx.length)]!;
    if (i === j) continue;
    [seq[i], seq[j]] = [seq[j]!, seq[i]!];
    const c = scheduleCost(seq);
    if (c <= cost) cost = c;
    else [seq[i], seq[j]] = [seq[j]!, seq[i]!];
  }
  return seq;
}

export interface BracketSlot {
  round: number; // 1 = first round
  index: number;
  a: string | null; // team id, null = TBD
  b: string | null;
  bye: boolean;
}

export function roundName(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi Final";
  if (fromEnd === 2) return "Quarter Final";
  return `Round ${round}`;
}

/** Single-elimination bracket with random byes. */
export function knockoutBracket(teams: string[], rng: Rng = Math.random) {
  if (teams.length < 2) throw new Error("At least 2 teams are required to start a tournament.");
  let size = 1;
  while (size < teams.length) size *= 2;
  const rounds = Math.log2(size);
  const byes = size - teams.length;
  const s = shuffle(teams, rng);
  // Spread byes across first-round slots randomly.
  const byeSlots = new Set(shuffle([...Array(size / 2).keys()], rng).slice(0, byes));
  const slots: BracketSlot[] = [];
  let k = 0;
  for (let i = 0; i < size / 2; i++) {
    if (byeSlots.has(i)) slots.push({ round: 1, index: i, a: s[k++]!, b: null, bye: true });
    else slots.push({ round: 1, index: i, a: s[k++]!, b: s[k++]!, bye: false });
  }
  for (let r = 2; r <= rounds; r++)
    for (let i = 0; i < size / 2 ** r; i++)
      slots.push({ round: r, index: i, a: null, b: null, bye: false });
  return { rounds, slots };
}

export interface ResultRow {
  a: string;
  b: string;
  winner: string;
  pointsA: number;
  pointsB: number;
  /** Per-game scores (team `a` = A). Used for point difference; falls back to totals if absent. */
  games?: { A: number; B: number }[] | undefined;
}

/**
 * Point-difference contribution of one game to the winner (the loser gets the negative).
 * A game that reached deuce (loser on 20+) counts as a single point; otherwise the real margin.
 */
export const gamePointDiff = (winnerPts: number, loserPts: number) =>
  loserPts >= 20 ? 1 : winnerPts - loserPts;

/** Signed point difference for team A of one match (team B's is the negative). */
export function matchPointDiff(r: Pick<ResultRow, "pointsA" | "pointsB" | "games">): number {
  if (!r.games?.length) return r.pointsA - r.pointsB;
  return r.games.reduce((s, g) => (g.A === g.B ? s : s + Math.sign(g.A - g.B) * gamePointDiff(Math.max(g.A, g.B), Math.min(g.A, g.B))), 0);
}

export interface StandingRow {
  team: string;
  mp: number;
  w: number;
  l: number;
  points: number;
  scored: number;
  conceded: number;
  pd: number;
}

export function standings(teams: string[], results: ResultRow[]): StandingRow[] {
  const map = new Map<string, StandingRow>(
    teams.map((t) => [t, { team: t, mp: 0, w: 0, l: 0, points: 0, scored: 0, conceded: 0, pd: 0 }]),
  );
  for (const r of results) {
    const A = map.get(r.a)!,
      B = map.get(r.b)!;
    A.mp++;
    B.mp++;
    A.scored += r.pointsA;
    A.conceded += r.pointsB;
    B.scored += r.pointsB;
    B.conceded += r.pointsA;
    const [W, L] = r.winner === r.a ? [A, B] : [B, A];
    W.w++; W.points += 2; L.l++;
    const d = matchPointDiff(r);
    A.pd += d; B.pd -= d;
  }
  const rows = [...map.values()];
  const h2h = (x: string, y: string) => {
    const m = results.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));
    if (!m) return 0;
    return m.winner === x ? -1 : 1;
  };
  return rows.sort(
    (x, y) => y.points - x.points || y.pd - x.pd || y.scored - x.scored || h2h(x.team, y.team),
  );
}

/** Heading for a finished match, from the match kind and the tournament's recorded outcome. */
export function resultHeading(
  m: { kind: string; round_name?: string | null; winner_team_id: string | null },
  t: { status: string; champion_team_id?: string | null },
): string {
  if (m.kind === "LEAGUE") return "Match Winner";
  if (m.kind === "LEAGUE_FINAL")
    return t.status === "COMPLETED" && t.champion_team_id && t.champion_team_id === m.winner_team_id
      ? "Tournament Champion"
      : "League Final · Winner";
  return `${m.round_name ?? "Match"} · Winner`;
}
