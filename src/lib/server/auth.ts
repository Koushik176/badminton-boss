const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)), (c) =>
    c.charCodeAt(0),
  );

async function pbkdf2(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: 100000 },
    key,
    256,
  );
  return b64u(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${b64u(salt)}:${await pbkdf2(password, salt)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return (await pbkdf2(password, fromB64u(salt))) === hash;
}

async function hmacKey() {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

export async function signJwt(claims: Omit<JwtClaims, "exp">, ttlSec = 60 * 60 * 24 * 7) {
  const header = b64u(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64u(enc.encode(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSec })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64u(sig)}`;
}

export async function verifyJwt(token: string): Promise<JwtClaims | null> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64u(s) as BufferSource, enc.encode(`${h}.${p}`));
  if (!ok) return null;
  const claims = JSON.parse(new TextDecoder().decode(fromB64u(p))) as JwtClaims;
  if (claims.exp < Date.now() / 1000) return null;
  return claims;
}
