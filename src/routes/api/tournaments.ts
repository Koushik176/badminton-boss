import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q } from "@/lib/server/db";
import { createTournament } from "@/lib/server/domain";
const S = z.object({
  name: z.string().trim().min(1, "Tournament name is required").max(150),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  location: z.string().trim().max(150).optional(),
  type: z.enum(["KNOCKOUT", "LEAGUE"]),
  format: z.union([z.literal(1), z.literal(3)]),
  teams: z.array(z.object({ name: z.string().trim().min(1).max(100), players: z.tuple([z.string(), z.string()]) })).min(2).max(64),
  fixtures: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0).nullable()])).max(2100),
});
export const Route = createFileRoute("/api/tournaments")({
  server: { handlers: {
    GET: handle(async () => json(await q(
      "SELECT t.*, c.name champion_name, (SELECT COUNT(*) FROM teams x WHERE x.tournament_id=t.id) team_count, (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id AND m.status='COMPLETED') done, (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id AND m.status<>'BYE') total FROM tournaments t LEFT JOIN teams c ON c.id=t.champion_team_id ORDER BY t.date DESC, t.created_at DESC"))),
    POST: handle(async ({ request }) => {
      await requireOrganizer(request);
      const id = await createTournament(await body(request, S));
      return json({ id }, 201);
    }),
  } },
});
