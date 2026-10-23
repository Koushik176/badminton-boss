import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { getTournament } from "@/lib/server/domain";
void z;
void body;
void requireOrganizer;
void HttpError;
export const Route = createFileRoute("/api/tournaments/$id")({
  server: { handlers: { GET: handle(async ({ params }) => json(await getTournament(params.id))) } },
});
