import { z } from "zod";
import { EngineError } from "../engine/scoring";
import { verifyJwt } from "./auth";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { request: Request; params: any };

export function handle(fn: (ctx: Ctx) => Promise<Response>) {
  return async (ctx: Ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof EngineError) return json({ error: e.message }, 400);
      if (e instanceof z.ZodError)
        return json({ error: e.issues[0]?.message ?? "Invalid input" }, 400);
      console.error(e);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function requireOrganizer(request: Request) {
  const h = request.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const claims = token ? await verifyJwt(token) : null;
  if (!claims || !["organizer", "admin"].includes(claims.role))
    throw new HttpError(401, "Please sign in as an organizer.");
  return claims;
}

export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
  return schema.parse(data);
}
