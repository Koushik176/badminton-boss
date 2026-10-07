import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q, exec, uid } from "@/lib/server/db";
import { hashPassword, signJwt } from "@/lib/server/auth";
const S = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8, "Password must be at least 8 characters").max(100) });
export const Route = createFileRoute("/api/auth/setup")({
  server: { handlers: { POST: handle(async ({ request }) => {
    const b = await body(request, S);
    const [{ c }] = await q("SELECT COUNT(*) c FROM users");
    if (Number(c) > 0) throw new HttpError(403, "An organizer account already exists. Please sign in.");
    const id = uid();
    await exec("INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,'admin')", [id, b.email.toLowerCase(), await hashPassword(b.password)]);
    return json({ token: await signJwt({ sub: id, email: b.email.toLowerCase(), role: "admin" }), email: b.email.toLowerCase() });
  }) } },
});
