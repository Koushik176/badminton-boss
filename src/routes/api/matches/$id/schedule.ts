import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { scheduleOp } from "@/lib/server/domain";
void HttpError;
const S = z.object({ op: z.enum(["up", "down", "end", "skip", "unskip"]) });
export const Route = createFileRoute("/api/matches/$id/schedule")({
  server: {
    handlers: {
      POST: handle(async ({ request, params }) => {
        await requireOrganizer(request);
        await scheduleOp(params.id, (await body(request, S)).op);
        return json({ ok: true });
      }),
    },
  },
});
