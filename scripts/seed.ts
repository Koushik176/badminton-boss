import { readFileSync } from "node:fs";
import { q, exec, uid } from "../src/lib/server/db";
import { createTournament, startMatch, matchAction, confirmMatch, getMatch } from "../src/lib/server/domain";

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) await exec(stmt);

const [{ c }] = await q(`SELECT COUNT(*) c FROM players`);
if (Number(c) > 0) {
  console.log("already seeded");
  process.exit(0);
}
const names = ["Rahul", "Kiran", "Arun", "Vijay", "Suresh", "Manoj", "Deepak", "Anil", "Ravi", "Sanjay", "Prakash", "Naveen"];
const ids: string[] = [];
for (const n of names) {
  const id = uid();
  ids.push(id);
  await exec(`INSERT INTO players (id,name) VALUES (?,?)`, [id, n]);
}
const pair = (i: number): [string, string] => [ids[i * 2]!, ids[i * 2 + 1]!];

async function play(matchId: string, winsA: number[]) {
  const m = await getMatch(matchId);
  const A = m.teamA!.players, B = m.teamB!.players;
  await startMatch(matchId, { tossWinner: "A", tossChoice: "SERVE", teamASide: "bottom", servingTeam: "A", serverId: A[0]!.id, receiverId: B[0]!.id });
  for (let g = 0; g < winsA.length; g++) {
    const loserPts = winsA[g]!;
    const winner = g % 2 === 0 || winsA.length === 1 ? "A" : "B";
    const seq: ("A" | "B")[] = [];
    for (let i = 0; i < loserPts; i++) seq.push(winner === "A" ? "B" : "A", winner);
    while (seq.filter((x) => x === winner).length < 21) seq.push(winner);
    for (const t of seq) await matchAction(matchId, { type: "RALLY_WON", team: t });
    const st = (await getMatch(matchId)).state!;
    if (st.status === "GAME_OVER") {
      const w = st.games.at(-1)!.winner!;
      const wp = w === "A" ? A : B, lp = w === "A" ? B : A;
      await matchAction(matchId, { type: "GAME_STARTED", serverId: wp[0]!.id, receiverId: lp[0]!.id });
    }
  }
  await confirmMatch(matchId);
}

// League tournament (4 teams), all league matches played → final generated & played
const league = await createTournament({
  name: "Sunday Smash League", date: "2026-09-20", location: "City Sports Hall", type: "LEAGUE", format: 1,
  teams: [0, 1, 2, 3].map((i) => ({ name: `Team ${names[i * 2]}-${names[i * 2 + 1]}`, players: pair(i) })),
  fixtures: [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]],
});
const scores = [15, 18, 12, 19, 17, 10];
let i = 0;
for (;;) {
  const [m] = await q(`SELECT id FROM matches WHERE tournament_id=? AND status='UPCOMING' ORDER BY play_order LIMIT 1`, [league]);
  if (!m) break;
  await play(m.id, [scores[i++ % scores.length]!]);
}

// Knockout tournament (4 teams, one semi done, one live)
const ko = await createTournament({
  name: "October Open Knockout", date: "2026-10-06", location: "City Sports Hall", type: "KNOCKOUT", format: 1,
  teams: [2, 3, 4, 5].map((i) => ({ name: `Team ${names[i * 2]}-${names[i * 2 + 1]}`, players: pair(i) })),
  fixtures: [[0, 1], [2, 3]],
});
const semis = await q(`SELECT id FROM matches WHERE tournament_id=? AND round=1 ORDER BY slot_index`, [ko]);
await play(semis[0].id, [16]);
const m2 = await getMatch(semis[1].id);
await startMatch(semis[1].id, { tossWinner: "B", tossChoice: "COURT", teamASide: "top", servingTeam: "A", serverId: m2.teamA!.players[0]!.id, receiverId: m2.teamB!.players[1]!.id });
for (const t of ["A", "B", "B", "A", "A", "B", "A", "A"] as const) await matchAction(semis[1].id, { type: "RALLY_WON", team: t });
console.log("seeded");
