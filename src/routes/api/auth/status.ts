import { createFileRoute } from "@tanstack/react-router";
import { handle, json } from "@/lib/server/http";
import { q } from "@/lib/server/db";
export const Route = createFileRoute("/api/auth/status")({
  server: {
    handlers: {
      GET: handle(async () => {
        const rows = await q("SELECT 1 FROM app_setup WHERE id=1");
        return json({ hasOrganizer: rows.length > 0 });
      }),
    },
  },
});
