import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q } from "@/lib/server/db";
import { playerStats } from "@/lib/server/domain";
void z; void body; void requireOrganizer; void HttpError;
export const Route = createFileRoute("/api/dashboard")({
  server: { handlers: { GET: handle(async () => {
    const [counts] = await q("SELECT (SELECT COUNT(*) FROM players) players, (SELECT COUNT(*) FROM tournaments) tournaments, (SELECT COUNT(*) FROM matches WHERE status='COMPLETED') matches, (SELECT COUNT(*) FROM tournaments WHERE status='COMPLETED') completed");
    const active = await q("SELECT id,name,date,location,type FROM tournaments WHERE status='LIVE' ORDER BY date DESC");
    const live = await q("SELECT m.id, m.tournament_id, m.round_name, m.state_json, ta.name aname, tb.name bname, t.name tname FROM matches m JOIN teams ta ON ta.id=m.team_a_id JOIN teams tb ON tb.id=m.team_b_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.status='LIVE'");
    const upcoming = await q("SELECT m.id, m.round_name, m.play_order, ta.name aname, tb.name bname, t.name tname FROM matches m LEFT JOIN teams ta ON ta.id=m.team_a_id LEFT JOIN teams tb ON tb.id=m.team_b_id JOIN tournaments t ON t.id=m.tournament_id WHERE m.status='UPCOMING' AND t.status='LIVE' ORDER BY t.date DESC, m.play_order LIMIT 5");
    const top = (await playerStats()).stats.filter((s) => s.played > 0).sort((a, b) => b.wins - a.wins || b.pd - a.pd).slice(0, 5);
    return json({ counts, active, live: live.map((l) => ({ ...l, state: l.state_json ? JSON.parse(l.state_json) : null, state_json: undefined })), upcoming, top });
  }) } },
});
