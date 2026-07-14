import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { permissionsForUser } from "./auth/permission-repository.js";
import { auth, handleAuthRequest } from "./auth/runtime.js";
import { db } from "./db/client.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = createApp({
  getPermissions: (userId) => permissionsForUser(db, userId),
  getSession: (headers) => auth.api.getSession({ headers }),
  handleAuthRequest,
});

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.info(`AnShow API listening on http://localhost:${info.port}`);
  },
);

function shutdown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}; stopping AnShow API.`);
  server.close(() => {
    process.exitCode = 0;
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
