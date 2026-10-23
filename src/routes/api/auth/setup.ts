import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handle, json, body, HttpError } from "@/lib/server/http";
import { q, transaction, uid } from "@/lib/server/db";
import { hashPassword, signJwt } from "@/lib/server/auth";
const S = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});
const DONE = "An organizer account already exists. Please sign in.";
export const Route = createFileRoute("/api/auth/setup")({
  server: {
    handlers: {
      POST: handle(async ({ request }) => {
        const b = await body(request, S);
        // Fast path; the real guard is the single-row app_setup table (PRIMARY KEY id=1) inside the transaction.
        if ((await q("SELECT 1 FROM app_setup WHERE id=1")).length) throw new HttpError(403, DONE);
        const id = uid();
        const email = b.email.toLowerCase();
        const hash = await hashPassword(b.password);
        try {
          await transaction([
            ["INSERT INTO app_setup (id, admin_user_id) VALUES (1, ?)", [id]],
            [
              "INSERT INTO users (id,email,password_hash,role) VALUES (?,?,?,'admin')",
              [id, email, hash],
            ],
          ]);
        } catch (e) {
          if (/duplicate|1062/i.test(String((e as Error)?.message))) throw new HttpError(403, DONE);
          throw e;
        }
        return json({ token: await signJwt({ sub: id, email, role: "admin" }), email });
      }),
    },
  },
});
