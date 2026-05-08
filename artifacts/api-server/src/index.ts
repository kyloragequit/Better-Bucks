import { httpServer, initApp } from "./app";
import { logger } from "./lib/logger";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
});

process.on("uncaughtException", (err: Error) => {
  logger.error({ err }, "Uncaught exception");
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM — draining DB pool...");
  try {
    const { pool } = await import("./db");
    await pool.end();
  } catch {}
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Received SIGINT — draining DB pool...");
  try {
    const { pool } = await import("./db");
    await pool.end();
  } catch {}
  process.exit(0);
});

const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  await initApp();

  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    logger.info({ port }, "Server listening");
  });
})();
