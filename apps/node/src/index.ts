import { serve } from "@hono/node-server";
import { createApiApp } from "@repo/shared/api";

const app = createApiApp();

serve(
  {
    fetch: app.fetch,
    port: parseInt(process.env.PORT || "3000"),
  },
  (info) => {
    console.log(`Server running on port ${info.port}`);
  },
);
