import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { confirmMatch } from "@/lib/server/domain";
void z; void body; void HttpError;
export const Route = createFileRoute("/api/matches/$id/confirm")({
  server: { handlers: { POST: handle(async ({ request, params }) => {
    const u = await requireOrganizer(request);
    return json(await confirmMatch(params.id, u.sub));
  }) } },
});
