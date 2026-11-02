import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { deleteMaintenance, updateMaintenance } from "@/lib/server/domain";

const S = z.object({
  resourceId: z.string().min(1, "Choose a resource").max(36),
  kind: z.string().max(20),
  description: z.string().trim().min(1, "Describe the work").max(500),
  cost: z.number({ message: "Enter the cost as a number" }),
  incurredOn: z.string().max(10),
  paidBy: z.string().trim().max(100).nullish(),
});

export const Route = createFileRoute("/api/maintenance/$id")({
  server: {
    handlers: {
      PUT: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await updateMaintenance(params.id, await body(request, S), user.sub));
      }),
      DELETE: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await deleteMaintenance(params.id, user.sub));
      }),
    },
  },
});
