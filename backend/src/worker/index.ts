import { initializeRuntime } from "../runtime-bootstrap.js";

await initializeRuntime(process.env, () => {
  const keepAlive = setInterval(() => undefined, 60_000);

  function shutdown(signal: NodeJS.Signals): void {
    console.info(`Received ${signal}; stopping AnShow worker.`);
    clearInterval(keepAlive);
    process.exitCode = 0;
  }

  console.info("AnShow worker is ready; no jobs are configured yet.");

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
});
