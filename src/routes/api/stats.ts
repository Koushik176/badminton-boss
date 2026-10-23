import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { playerStats } from "@/lib/server/domain";
void body;
void requireOrganizer;
void HttpError;
const S = z.object({
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tournamentId: z.string().max(36).optional(),
});
export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: handle(async ({ request }) => {
        const u = new URL(request.url);
        const f = S.parse({
          since: u.searchParams.get("since") || undefined,
          tournamentId: u.searchParams.get("tournamentId") || undefined,
        });
        return json((await playerStats(f)).stats);
      }),
    },
  },
});
