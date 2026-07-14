import { serve } from "@hono/node-server";

import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const app = createApp();

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
