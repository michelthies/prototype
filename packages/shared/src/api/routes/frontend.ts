import { Hono } from "hono";
import { signinPage, signupPage, agencyPage, eventsPage } from "../../frontend";
import { AppContext } from "../app";

export const frontendRoutes = new Hono<AppContext>();

frontendRoutes.get("/:agency", (c) => {
  const agencySlug = c.req.param("agency");
  return c.html(signinPage(agencySlug));
});

frontendRoutes.get("/:agency/signup", (c) => {
  const agencySlug = c.req.param("agency");
  return c.html(signupPage(agencySlug));
});

frontendRoutes.get("/:agency/agency", (c) => {
  const agencySlug = c.req.param("agency");
  return c.html(agencyPage(agencySlug));
});

frontendRoutes.get("/:agency/events", (c) => {
  const agencySlug = c.req.param("agency");
  return c.html(eventsPage(agencySlug));
});
