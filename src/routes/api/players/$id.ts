import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q, exec } from "@/lib/server/db";
import { playerStats } from "@/lib/server/domain";
const S = z.object({
  name: z.string().trim().min(1).max(100),
  nickname: z.string().trim().max(100).optional(),
});
export const Route = createFileRoute("/api/players/$id")({
  server: {
    handlers: {
      GET: handle(async ({ params }) => {
        const [p] = await q("SELECT * FROM players WHERE id=?", [params.id]);
        if (!p) throw new HttpError(404, "Player not found");
        const { stats, matches } = await playerStats();
        const mine = matches.filter((m) => [m.a1, m.a2, m.b1, m.b2].includes(params.id));
        const partners: Record<string, { id: string; played: number; wins: number }> = {};
        for (const m of mine) {
          const onA = [m.a1, m.a2].includes(params.id);
          const partner = onA
            ? m.a1 === params.id
              ? m.a2
              : m.a1
            : m.b1 === params.id
              ? m.b2
              : m.b1;
          const won = m.winner_team_id === (onA ? m.team_a_id : m.team_b_id);
          partners[partner] ??= { id: partner, played: 0, wins: 0 };
          partners[partner].played++;
          if (won) partners[partner].wins++;
        }
        const names = Object.fromEntries(stats.map((s) => [s.id, s.name]));
        return json({
          player: p,
          stats: stats.find((s) => s.id === params.id),
          partners: Object.values(partners)
            .map((x) => ({ ...x, name: names[x.id] }))
            .sort((a, b) => b.played - a.played),
          history: mine.map((m) => {
            const onA = [m.a1, m.a2].includes(params.id);
            return {
              id: m.id,
              tournament: m.tname,
              date: m.tdate,
              round: m.round_name,
              team: onA ? m.aname : m.bname,
              opponent: onA ? m.bname : m.aname,
              won: m.winner_team_id === (onA ? m.team_a_id : m.team_b_id),
              games: JSON.parse(m.games_json || "[]"),
              side: onA ? "A" : "B",
            };
          }),
        });
      }),
      PUT: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        const b = await body(request, S);
        await exec("UPDATE players SET name=?, nickname=? WHERE id=?", [
          b.name,
          b.nickname || null,
          params.id,
        ]);
        return json({ ok: true });
      }),
      DELETE: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        const [used] = await q("SELECT id FROM teams WHERE player1_id=? OR player2_id=? LIMIT 1", [
          params.id,
          params.id,
        ]);
        if (used)
          throw new HttpError(400, "This player has tournament history and cannot be deleted.");
        await exec("DELETE FROM players WHERE id=?", [params.id]);
        return json({ ok: true });
      }),
    },
  },
});
