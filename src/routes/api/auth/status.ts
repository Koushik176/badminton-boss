import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q } from "@/lib/server/db";
export const Route = createFileRoute("/api/auth/status")({
  server: { handlers: { GET: handle(async () => {
    const [{ c }] = await q("SELECT COUNT(*) c FROM users");
    return json({ hasOrganizer: Number(c) > 0 });
  }) } },
});
