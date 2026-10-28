import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { editMatchStart } from "@/lib/server/domain";
const T = z.enum(["A", "B"]);
const S = z.object({
  seq: z.number().int().optional(),
  tossWinner: T,
  tossChoice: z.enum(["SERVE", "COURT"]),
  teamASide: z.enum(["top", "bottom"]),
  servingTeam: T,
  serverId: z.string().max(36),
  receiverId: z.string().max(36),
});
export const Route = createFileRoute("/api/matches/$id/edit-start")({
  server: {
    handlers: {
      POST: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        const { seq, ...setup } = await body(request, S);
        return json(await editMatchStart(params.id, setup, seq));
      }),
    },
  },
});
