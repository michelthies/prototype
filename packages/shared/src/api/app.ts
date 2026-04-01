import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { jwt } from "hono/jwt";
import { env } from "hono/adapter";
import { apiRoutes } from "./routes/api";
import { frontendRoutes } from "./routes/frontend";

export type Env = {
  DB_URL: string;
  DB_URL_PGBOUNCER: string;
  JWT_SECRET: string;
  NODE_ENV?: string;
  DB_CLIENT: string;
  POSTGREST_URL: string;
  HYPERDRIVE: { connectionString: string };
};

export type AppContext = {
  Variables: {
    jwtPayload?: { sub: string; slug: string; agency: string };
  };
};

let isolateId: string | null = null;

export function getIsolateId(): string {
  if (!isolateId) {
    isolateId = crypto.randomUUID();
  }
  return isolateId;
}

export function createApiApp() {
  const app = new Hono<AppContext>();

  app.use("*", async (c, next) => {
    try {
      await next();
    } finally {
      const cf = (c.req.raw as any)?.cf;
      c.header("X-CF-Colo", cf?.colo || "NODE");
      c.header("X-Isolate-ID", getIsolateId());
    }
  });

  app.use("/:agency/api/*", csrf());

  app.use("/:agency/api/authenticated/*", async (c, next) => {
    const { JWT_SECRET } = env<Env>(c);
    const agencySlug = c.req.param("agency");
    const jwtMiddleware = jwt({
      secret: JWT_SECRET,
      cookie: "authToken",
      alg: "HS256",
    });
    try {
      const result = await jwtMiddleware(c, next);
      return result;
    } catch (error) {
      console.log(`Auth error: ${error}`);
      c.header("HX-Redirect", `/${agencySlug}`);
      return c.body(null, 401);
    }
  });

  app.route("/:agency/api", apiRoutes);
  app.route("/", frontendRoutes);

  return app;
}
