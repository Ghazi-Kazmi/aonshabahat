import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Admin login is a single username/password from env, kept in an HMAC-signed, httpOnly cookie.
export const ADMIN_COOKIE = "admin_session";
const MAX_AGE = 7 * 24 * 3600; // seconds

const secret = () => {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
};
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkCredentials(user: unknown, pass: unknown) {
  const u = process.env.ADMIN_USER ?? "", p = process.env.ADMIN_PASSWORD ?? "";
  if (!u || !p || typeof user !== "string" || typeof pass !== "string") return false;
  // Evaluate both so the response time doesn't reveal which one was wrong.
  const okUser = same(user.trim().toLowerCase(), u.toLowerCase());
  const okPass = same(pass, p);
  return okUser && okPass;
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${exp}.${sign(String(exp))}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export const clearCookie = () => `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAdmin(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const value = raw.split(/;\s*/).find((c) => c.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return same(sig, sign(exp));
}
