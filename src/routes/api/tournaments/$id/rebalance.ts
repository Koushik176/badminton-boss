import { createFileRoute } from "@tanstack/react-router";
import { handle, json, requireOrganizer } from "@/lib/server/http";
import { rebalanceUpcoming } from "@/lib/server/domain";
export const Route = createFileRoute("/api/tournaments/$id/rebalance")({
  server: { handlers: { POST: handle(async ({ request, params }) => {
    await requireOrganizer(request);
    return json(await rebalanceUpcoming(params.id));
  }) } },
});
