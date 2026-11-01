import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { addMaintenance, maintenanceOverview } from "@/lib/server/domain";

const MaintenanceBody = z.object({
  resourceId: z.string().min(1, "Choose a resource").max(36),
  kind: z.string().max(20),
  description: z.string().trim().min(1, "Describe the work").max(500),
  cost: z.number({ message: "Enter the cost as a number" }),
  incurredOn: z.string().max(10),
  paidBy: z.string().trim().max(100).nullish(),
});

const Filter = z.object({
  resourceId: z.string().max(36).optional(),
  kind: z.string().max(20).optional(),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
});

export const Route = createFileRoute("/api/maintenance")({
  server: {
    handlers: {
      GET: handle(async ({ request }) => {
        const u = new URL(request.url).searchParams;
        const f = Filter.parse({
          resourceId: u.get("resourceId") || undefined,
          kind: u.get("kind") || undefined,
          from: u.get("from") || undefined,
          to: u.get("to") || undefined,
        });
        return json(await maintenanceOverview(f));
      }),
      POST: handle(async ({ request }) => {
        const user = await requireOrganizer(request);
        return json(await addMaintenance(await body(request, MaintenanceBody), user.sub), 201);
      }),
    },
  },
});
