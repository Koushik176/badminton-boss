import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { startMatch } from "@/lib/server/domain";
void HttpError;
const T = z.enum(["A", "B"]);
const S = z.object({
  tossWinner: T,
  tossChoice: z.enum(["SERVE", "COURT"]),
  teamASide: z.enum(["top", "bottom"]),
  servingTeam: T,
  serverId: z.string().max(36),
  receiverId: z.string().max(36),
});
export const Route = createFileRoute("/api/matches/$id/start")({
  server: {
    handlers: {
      POST: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        return json(await startMatch(params.id, await body(request, S)));
      }),
    },
  },
});
