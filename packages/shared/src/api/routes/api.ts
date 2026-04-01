import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { DbAdapter, signupValidator } from "../../core";
import { cookieOptions, generateToken, clearCookieOptions } from "../auth/jwt";
import { env } from "hono/adapter";
import { AppContext, Env } from "../app";
import { createPgAdapter } from "../adapters/pg";
import { createPgPoolAdapter } from "../adapters/pg-pool";
import { createPostgrestAdapter } from "../adapters/postgrest";

export const apiRoutes = new Hono<AppContext>();

function getAdapter(e: Env, token?: string): DbAdapter {
  switch (e.DB_CLIENT) {
    case "pg":
      return createPgAdapter(e.DB_URL);
    case "pg-pool":
      return createPgPoolAdapter(e.DB_URL);
    case "pg-pool-worker":
      return createPgPoolAdapter(e.DB_URL, true);
    case "pgbouncer":
      return createPgAdapter(e.DB_URL_PGBOUNCER);
    case "postgrest":
      return createPostgrestAdapter(e.POSTGREST_URL, token);
    case "hyperdrive":
      return createPgAdapter(e.HYPERDRIVE.connectionString);
    default:
      throw new Error(`DB_CLIENT error: ${e.DB_CLIENT}`);
  }
}

apiRoutes.post("/signup", signupValidator, async (c) => {
  const e = env<Env>(c);
  const { JWT_SECRET, NODE_ENV } = e;
  const agencySlug = c.req.param("agency")!;
  const { email, password } = c.req.valid("json");

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await getAdapter(e).signup(agencySlug, email, passwordHash);

    if ("error" in result) {
      return c.json({ errors: [result.error] }, 400);
    }

    const token = await generateToken(
      result.id,
      agencySlug,
      result.agency_id,
      JWT_SECRET,
    );
    setCookie(c, "authToken", token, {
      ...cookieOptions,
      path: `/${agencySlug}`,
      secure: NODE_ENV === "production",
    });

    return c.json({
      message: "User signup success",
      user: { id: result.id, email: result.email },
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

apiRoutes.post("/signin", signupValidator, async (c) => {
  const e = env<Env>(c);
  const { JWT_SECRET, NODE_ENV } = e;
  const agencySlug = c.req.param("agency")!;
  const { email, password } = c.req.valid("json");

  try {
    const result = await getAdapter(e).signin(agencySlug, email);

    if ("error" in result) {
      return c.json({ errors: [result.error] }, 403);
    }

    const passwordsMatch = await bcrypt.compare(password, result.password_hash);
    if (!passwordsMatch) {
      return c.json({ errors: ["Invalid password"] }, 403);
    }

    const token = await generateToken(
      result.id,
      agencySlug,
      result.agency_id,
      JWT_SECRET,
    );
    setCookie(c, "authToken", token, {
      ...cookieOptions,
      path: `/${agencySlug}`,
      secure: NODE_ENV === "production",
    });

    return c.json({
      message: "User signin success",
      user: { id: result.id, email },
    });
  } catch (error: any) {
    console.error(`Signin error:`, error);
    return c.json(
      { error: "Internal server error", details: error.message },
      500,
    );
  }
});

apiRoutes.post("/signout", async (c) => {
  const { NODE_ENV } = env<Env>(c);
  const agencySlug = c.req.param("agency")!;

  setCookie(c, "authToken", "", {
    ...clearCookieOptions,
    path: `/${agencySlug}`,
    secure: NODE_ENV === "production",
    expires: new Date(0),
  });

  return c.json({ message: "User signout success" });
});

apiRoutes.get("/authenticated/agency", async (c) => {
  const e = env<Env>(c);
  const agencySlug = c.req.param("agency")!;
  const payload = c.get("jwtPayload");

  if (payload!.slug !== agencySlug) return c.body(null, 403);

  try {
    let users;
    if (e.DB_CLIENT === "postgrest") {
      const token = getCookie(c, "authToken");
      users = await getAdapter(e, token).getAgencyUsers(payload!.agency);
    } else {
      users = await getAdapter(e).getAgencyUsers(payload!.agency);
    }
    const usersHtml = users
      .map(
        (user) => `<div><p>ID: ${user.id}</p><p>Email: ${user.email}</p></div>`,
      )
      .join("");
    return c.html(usersHtml);
  } catch (error) {
    console.error(error);
    return c.html(`<p>Internal server error</p>`, 500);
  }
});

apiRoutes.get("/authenticated/events", async (c) => {
  const e = env<Env>(c);
  const agencySlug = c.req.param("agency")!;
  const payload = c.get("jwtPayload");

  if (payload!.slug !== agencySlug) return c.body(null, 403);

  try {
    let events;
    if (e.DB_CLIENT === "postgrest") {
      const token = getCookie(c, "authToken");
      events = await getAdapter(e, token).getAgencyEvents(payload!.agency);
    } else {
      events = await getAdapter(e).getAgencyEvents(payload!.agency);
    }
    const eventsHtml = events
      .map(
        (event) => `
        <div>
          <p>ID: ${event.id}</p>
          <p>Name: ${event.name}</p>
          <p>Artist: ${event.artist}</p>
          <p>Date: ${event.date}</p>
          <p>Description: ${event.description}</p>
        </div>`,
      )
      .join("");
    return c.html(eventsHtml);
  } catch (error) {
    console.error(error);
    return c.html(`<p>Internal server error</p>`, 500);
  }
});

apiRoutes.post("/authenticated/events", async (c) => {
  const e = env<Env>(c);
  const agencySlug = c.req.param("agency")!;
  const payload = c.get("jwtPayload");

  if (payload!.slug !== agencySlug) return c.body(null, 403);

  try {
    const { name, artist, date, description } = await c.req.json<{
      name: string;
      artist: string;
      date: string;
      description: string;
    }>();

    let result;
    if (e.DB_CLIENT === "postgrest") {
      const token = getCookie(c, "authToken");
      result = await getAdapter(e, token).createEvent(
        payload!.agency,
        name,
        artist,
        date,
        description,
      );
    } else {
      result = await getAdapter(e).createEvent(
        payload!.agency,
        name,
        artist,
        date,
        description,
      );
    }

    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ event: result });
  } catch (error) {
    console.error(error);
    return c.json({ error: error }, 500);
  }
});
