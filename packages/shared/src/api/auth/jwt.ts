import { sign } from "hono/jwt";
import { CookieOptions } from "hono/utils/cookie";

export const generateToken = async (
  userId: string,
  agencySlug: string,
  agencyId: string,
  secret: string,
) => {
  const algorithm = "HS256";
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    iat: now,
    exp: now + 1 * 60 * 60 * 24,
    slug: agencySlug,
    agency: agencyId,
    role: "agency_postgrest",
  };
  const token = await sign(payload, secret!, algorithm);
  return token;
};

export const cookieOptions = {
  httpOnly: true,
  maxAge: 3600,
  sameSite: "Lax",
} as CookieOptions;

export const clearCookieOptions = {
  httpOnly: true,
  maxAge: 0,
  sameSite: "Lax",
} as CookieOptions;
