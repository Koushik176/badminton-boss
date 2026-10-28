import { createFileRoute } from "@tanstack/react-router";
import { handle, json } from "@/lib/server/http";
import { pairingInsights } from "@/lib/server/domain";
export const Route = createFileRoute("/api/pairings")({
  server: {
    handlers: {
      GET: handle(async () => json(await pairingInsights())),
    },
  },
});
