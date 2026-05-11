import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { apnsPushRetries } from "@workspace/db";
import { logger } from "./lib/logger";
import { pushPassUpdate } from "./apns";
import { storage } from "./storage";

const MAX_RETRIES = 5;
/** How often the sweep job checks for due rows. Rows become due via next_attempt_at. */
const SWEEP_INTERVAL_MS = 60 * 1000; // 1 minute
const CLAIM_BATCH_SIZE = 20;

/** Base delay for the first retry (attempt 1). Each subsequent attempt doubles it. */
const BASE_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
/** Upper cap on any single retry delay. */
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Compute next_attempt_at for a row that has just failed on attempt `retryCount`.
 * Exponential back-off: 5m, 10m, 20m, 40m, capped at 60m.
 */
function nextAttemptAt(retryCount: number): Date {
  const delayMs = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCount - 1), MAX_RETRY_DELAY_MS);
  return new Date(Date.now() + delayMs);
}

/**
 * Processing rows older than this threshold are assumed to belong to a
 * crashed/restarted worker and are re-claimed on the next sweep.
 */
const STALE_PROCESSING_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Upsert a pending retry record for an employee whose APNs push failed. If a
 * pending record already exists for this employee it is left unchanged so the
 * next sweep picks it up without resetting the retry count or schedule.
 * The first attempt is scheduled immediately (next_attempt_at = NOW()).
 */
export async function recordApnsPushRetry(employeeId: number, lastError?: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO apns_push_retries
        (employee_id, status, retry_count, last_error, next_attempt_at, created_at, updated_at)
      VALUES
        (${employeeId}, 'pending', 0, ${lastError ?? null}, NOW(), NOW(), NOW())
      ON CONFLICT (employee_id)
        WHERE status = 'pending'
      DO UPDATE SET
        last_error = EXCLUDED.last_error,
        updated_at = EXCLUDED.updated_at
    `);
    logger.info({ employeeId }, "[apnsPushRetry] Queued failed APNs push for retry");
  } catch (err) {
    logger.error({ err, employeeId }, "[apnsPushRetry] Failed to persist APNs push retry record");
  }
}

/**
 * Atomically claims up to CLAIM_BATCH_SIZE rows that are either:
 *   - in 'pending' status AND next_attempt_at <= NOW() (or null), OR
 *   - in 'processing' status but with updated_at older than
 *     STALE_PROCESSING_THRESHOLD_MS (left behind by a crashed worker).
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers never double-process.
 */
async function claimRetries(): Promise<(typeof apnsPushRetries.$inferSelect)[]> {
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  const result = await db.execute<typeof apnsPushRetries.$inferSelect>(
    sql`
      UPDATE apns_push_retries
      SET    status     = 'processing',
             updated_at = NOW()
      WHERE  id IN (
               SELECT id
               FROM   apns_push_retries
               WHERE  (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
                  OR  (status = 'processing' AND updated_at < ${staleThreshold})
               LIMIT  ${CLAIM_BATCH_SIZE}
               FOR UPDATE SKIP LOCKED
             )
      RETURNING *
    `,
  );
  return result.rows as (typeof apnsPushRetries.$inferSelect)[];
}

async function processRow(row: typeof apnsPushRetries.$inferSelect): Promise<void> {
  const newRetryCount = row.retryCount + 1;

  const pass = await storage.getActiveWalletPassForEmployee(row.employeeId);
  if (!pass) {
    await db
      .update(apnsPushRetries)
      .set({ status: "resolved", retryCount: newRetryCount, lastError: "No active pass — nothing to push", nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(apnsPushRetries.id, row.id));
    logger.info({ id: row.id, employeeId: row.employeeId }, "[apnsPushRetry] No active pass for employee — marking resolved");
    return;
  }

  const devices = await storage.listWalletDevicesForSerial(pass.serialNumber);
  if (!devices.length) {
    await db
      .update(apnsPushRetries)
      .set({ status: "resolved", retryCount: newRetryCount, lastError: "No registered devices", nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(apnsPushRetries.id, row.id));
    logger.info({ id: row.id, employeeId: row.employeeId }, "[apnsPushRetry] No registered devices — marking resolved");
    return;
  }

  const tokens = Array.from(new Set(devices.map((d) => d.pushToken)));
  let lastError: string | null = null;

  try {
    const result = await pushPassUpdate(tokens);

    if (!result.configured) {
      // APNs credentials are not configured (or temporarily unavailable).
      // Treat as a retryable failure so the row stays queued and is not
      // silently resolved when credentials are missing.
      lastError = "APNs credentials not configured — will retry when credentials become available";
    } else {
      if (result.invalidTokens.length) {
        logger.warn(
          { id: row.id, employeeId: row.employeeId, count: result.invalidTokens.length },
          "[apnsPushRetry] Removing invalid device token(s) discovered during retry",
        );
        await storage.deleteWalletDevicesByPushToken(result.invalidTokens);
      }

      if (result.errors > 0) {
        lastError = `${result.errors} of ${tokens.length} token(s) failed all APNs send attempts`;
      }
    }
  } catch (err: any) {
    lastError = err?.message ?? String(err);
  }

  if (!lastError) {
    await db
      .update(apnsPushRetries)
      .set({ status: "resolved", retryCount: newRetryCount, lastError: null, nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(apnsPushRetries.id, row.id));
    logger.info({ id: row.id, employeeId: row.employeeId, attempt: newRetryCount }, "[apnsPushRetry] APNs push retry succeeded");
  } else if (newRetryCount >= MAX_RETRIES) {
    await db
      .update(apnsPushRetries)
      .set({ status: "failed_permanently", retryCount: newRetryCount, lastError, nextAttemptAt: null, updatedAt: new Date() })
      .where(eq(apnsPushRetries.id, row.id));
    logger.error(
      { id: row.id, employeeId: row.employeeId, lastError, retryCount: newRetryCount },
      "[apnsPushRetry] APNs push marked failed_permanently after max retries — employee Wallet card may be stale",
    );
  } else {
    const due = nextAttemptAt(newRetryCount);
    await db
      .update(apnsPushRetries)
      .set({ status: "pending", retryCount: newRetryCount, lastError, nextAttemptAt: due, updatedAt: new Date() })
      .where(eq(apnsPushRetries.id, row.id));
    logger.warn(
      { id: row.id, employeeId: row.employeeId, retryCount: newRetryCount, maxRetries: MAX_RETRIES, lastError, nextAttemptAt: due.toISOString() },
      "[apnsPushRetry] APNs push retry attempt failed — will try again with exponential back-off",
    );
  }
}

async function retryPendingPushes(): Promise<void> {
  let rows: (typeof apnsPushRetries.$inferSelect)[];
  try {
    rows = await claimRetries();
  } catch (err) {
    logger.error({ err }, "[apnsPushRetry] Failed to claim retry rows");
    return;
  }

  if (rows.length === 0) return;

  logger.info({ count: rows.length }, "[apnsPushRetry] Processing claimed APNs push retries");

  for (const row of rows) {
    try {
      await processRow(row);
    } catch (err) {
      logger.error(
        { err, id: row.id, employeeId: row.employeeId },
        "[apnsPushRetry] Unexpected error processing APNs retry row — will be reclaimed as stale",
      );
    }
  }
}

export function startApnsPushRetryJob(): void {
  const interval = setInterval(() => {
    retryPendingPushes().catch((err: unknown) => {
      logger.error({ err }, "[apnsPushRetry] Unexpected error in APNs push retry job");
    });
  }, SWEEP_INTERVAL_MS);
  interval.unref();

  logger.info(
    { sweepIntervalMs: SWEEP_INTERVAL_MS, maxRetries: MAX_RETRIES, baseRetryDelayMs: BASE_RETRY_DELAY_MS, maxRetryDelayMs: MAX_RETRY_DELAY_MS },
    "[apnsPushRetry] APNs push retry job started (exponential back-off: 5m → 10m → 20m → 40m → 60m cap)",
  );
}
