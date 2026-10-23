import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q, exec, uid } from "@/lib/server/db";
import { playerStats } from "@/lib/server/domain";
const S = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  nickname: z.string().trim().max(100).optional(),
});
export const Route = createFileRoute("/api/players")({
  server: {
    handlers: {
      GET: handle(async () => json((await playerStats()).stats)),
      POST: handle(async ({ request }) => {
        await requireOrganizer(request);
        const b = await body(request, S);
        const [dup] = await q("SELECT id FROM players WHERE LOWER(name)=LOWER(?)", [b.name]);
        if (dup) throw new HttpError(400, "A player with this name already exists.");
        const id = uid();
        await exec("INSERT INTO players (id,name,nickname) VALUES (?,?,?)", [
          id,
          b.name,
          b.nickname || null,
        ]);
        return json({ id, name: b.name }, 201);
      }),
    },
  },
});
