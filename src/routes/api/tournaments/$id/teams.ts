import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { addTeam } from "@/lib/server/domain";
const S = z.object({
  name: z.string().trim().min(1, "Enter a team name").max(100),
  players: z.tuple([z.string().min(1).max(36), z.string().min(1).max(36)]),
});
export const Route = createFileRoute("/api/tournaments/$id/teams")({
  server: { handlers: { POST: handle(async ({ request, params }) => {
    await requireOrganizer(request);
    const b = await body(request, S);
    return json(await addTeam(params.id, b), 201);
  }) } },
});
