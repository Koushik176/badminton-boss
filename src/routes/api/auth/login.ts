import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, requireOrganizer, HttpError } from "@/lib/server/http";
import { q } from "@/lib/server/db";
import { verifyPassword, signJwt } from "@/lib/server/auth";
const S = z.object({ email: z.string().trim().email().max(255), password: z.string().min(1).max(100) });
export const Route = createFileRoute("/api/auth/login")({
  server: { handlers: { POST: handle(async ({ request }) => {
    const b = await body(request, S);
    const [u] = await q("SELECT * FROM users WHERE email=?", [b.email.toLowerCase()]);
    if (!u || !(await verifyPassword(b.password, u.password_hash))) throw new HttpError(401, "Wrong email or password.");
    return json({ token: await signJwt({ sub: u.id, email: u.email, role: u.role }), email: u.email });
  }) } },
});
