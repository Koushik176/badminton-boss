import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer } from "@/lib/server/http";
import { createDues, listDues } from "@/lib/server/domain";

const S = z.object({
  creditorId: z.string().min(1, "Choose who is owed").max(36),
  entries: z
    .array(
      z.object({
        debtorId: z.string().min(1).max(36),
        amount: z.number({ message: "Enter the amount as a number" }),
      }),
    )
    .min(1, "Pick at least one player")
    .max(50),
  reason: z.string().trim().max(200).nullish(),
  date: z.string().max(10).optional(),
});

export const Route = createFileRoute("/api/dues")({
  server: {
    handlers: {
      GET: handle(async () => json(await listDues())),
      POST: handle(async ({ request }) => {
        const user = await requireOrganizer(request);
        return json(await createDues(await body(request, S), user.sub), 201);
      }),
    },
  },
});
