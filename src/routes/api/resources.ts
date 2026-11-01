import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { createResource } from "@/lib/server/domain";

const S = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.string().max(20),
  notes: z.string().trim().max(500).nullish(),
});

export const Route = createFileRoute("/api/resources")({
  server: {
    handlers: {
      POST: handle(async ({ request }) => {
        const user = await requireOrganizer(request);
        return json(await createResource(await body(request, S), user.sub), 201);
      }),
    },
  },
});
