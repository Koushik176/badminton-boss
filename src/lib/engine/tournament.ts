/** Pure tournament helpers: teams, fixtures, brackets, standings. */

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pairingKey = (pairs: [string, string][]) =>
  pairs.map((p) => [...p].sort().join("+")).sort().join("|");

/** Random doubles pairs. Locked pairs stay; avoids repeating `previousKey` when possible. */
export function randomTeams(
  players: string[],
  opts: { locked?: [string, string][]; previousKey?: string; rng?: Rng } = {},
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
    for (let i = 0; i < s.length; i += 2) result.push([s[i], s[i + 1]]);
    if (free.length <= 2 || pairingKey(result) !== opts.previousKey) break;
  }
  return result;
}

export function roundRobin<T>(teams: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) out.push([teams[i], teams[j]]);
  return out;
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
    if (byeSlots.has(i)) slots.push({ round: 1, index: i, a: s[k++], b: null, bye: true });
    else slots.push({ round: 1, index: i, a: s[k++], b: s[k++], bye: false });
  }
  for (let r = 2; r <= rounds; r++)
    for (let i = 0; i < size / 2 ** r; i++) slots.push({ round: r, index: i, a: null, b: null, bye: false });
  return { rounds, slots };
}

export interface ResultRow {
  a: string;
  b: string;
  winner: string;
  pointsA: number;
  pointsB: number;
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
    const A = map.get(r.a)!, B = map.get(r.b)!;
    A.mp++; B.mp++;
    A.scored += r.pointsA; A.conceded += r.pointsB;
    B.scored += r.pointsB; B.conceded += r.pointsA;
    const [W, L] = r.winner === r.a ? [A, B] : [B, A];
    W.w++; W.points += 2; L.l++;
  }
  const rows = [...map.values()].map((r) => ({ ...r, pd: r.scored - r.conceded }));
  const h2h = (x: string, y: string) => {
    const m = results.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));
    if (!m) return 0;
    return m.winner === x ? -1 : 1;
  };
  return rows.sort(
    (x, y) => y.points - x.points || y.pd - x.pd || y.scored - x.scored || h2h(x.team, y.team),
  );
}
