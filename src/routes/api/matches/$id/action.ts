import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { matchAction } from "@/lib/server/domain";
void HttpError;
const S = z.object({
  seq: z.number().int().optional(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("RALLY_WON"), team: z.enum(["A", "B"]) }),
    z.object({
      type: z.literal("GAME_STARTED"),
      serverId: z.string().max(36),
      receiverId: z.string().max(36),
    }),
    z.object({ type: z.literal("MATCH_PAUSED") }),
    z.object({ type: z.literal("MATCH_RESUMED") }),
    z.object({ type: z.literal("SWITCH_ENDS") }),
    z.object({ type: z.literal("UNDO") }),
  ]),
});
export const Route = createFileRoute("/api/matches/$id/action")({
  server: {
    handlers: {
      POST: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        const b = await body(request, S);
        return json(await matchAction(params.id, b.action, b.seq));
      }),
    },
  },
});
