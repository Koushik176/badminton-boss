import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { deleteResource, updateResource } from "@/lib/server/domain";

const S = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.string().max(20),
  notes: z.string().trim().max(500).nullish(),
  active: z.boolean().optional(),
});

export const Route = createFileRoute("/api/resources/$id")({
  server: {
    handlers: {
      PUT: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await updateResource(params.id, await body(request, S), user.sub));
      }),
      DELETE: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await deleteResource(params.id, user.sub));
      }),
    },
  },
});
