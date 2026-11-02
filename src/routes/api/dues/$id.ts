import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { deleteDue, updateDue } from "@/lib/server/domain";

const S = z.object({
  debtorId: z.string().min(1).max(36),
  creditorId: z.string().min(1).max(36),
  amount: z.number({ message: "Enter the amount as a number" }),
  reason: z.string().trim().max(200).nullish(),
  date: z.string().max(10).optional(),
  paid: z.boolean(),
});

export const Route = createFileRoute("/api/dues/$id")({
  server: {
    handlers: {
      PUT: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await updateDue(params.id, await body(request, S), user.sub));
      }),
      DELETE: handle(async ({ request, params }) => {
        const user = await requireOrganizer(request);
        return json(await deleteDue(params.id, user.sub));
      }),
    },
  },
});
