import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { stripeOrphans } from "@workspace/db";
import { logger } from "./lib/logger";
import { getUncachableStripeClient } from "./stripeClient";
import { sendOrphanPermanentFailureAlert } from "./lib/alerts";

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CLAIM_BATCH_SIZE = 10;

/**
 * Processing rows older than this threshold are assumed to belong to a
 * crashed/restarted worker and are re-claimed on the next sweep.
 */
const STALE_PROCESSING_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

function extractStripeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const errAsObj = err as unknown as Record<string, unknown>;
    const raw = errAsObj.raw;
    if (
      raw !== null &&
      typeof raw === "object" &&
      "message" in raw &&
      typeof (raw as Record<string, unknown>).message === "string"
    ) {
      return (raw as Record<string, unknown>).message as string;
    }
    return err.message;
  }
  return String(err);
}

/**
 * Returns true if a Stripe error indicates the resource was already deleted
 * or never existed — both cases mean the object is gone and the orphan can
 * be considered resolved.
 */
function isStripeResourceMissing(err: unknown): boolean {
  if (err instanceof Error) {
    const errAsObj = err as unknown as Record<string, unknown>;
    const raw = errAsObj.raw;
    if (raw !== null && typeof raw === "object") {
      const rawObj = raw as Record<string, unknown>;
      const code = rawObj.code;
      const statusCode = rawObj.statusCode ?? (errAsObj).statusCode;
      if (code === "resource_missing" || statusCode === 404) return true;
    }
    const statusCode = errAsObj.statusCode;
    if (statusCode === 404) return true;
  }
  return false;
}

export async function recordStripeOrphan(opts: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastError?: string;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO stripe_orphans
        (stripe_customer_id, stripe_subscription_id, status, retry_count, last_error, created_at, updated_at)
      VALUES
        (${opts.stripeCustomerId}, ${opts.stripeSubscriptionId}, 'pending', 0, ${opts.lastError ?? null}, NOW(), NOW())
      ON CONFLICT ((COALESCE(stripe_customer_id, '')), (COALESCE(stripe_subscription_id, '')))
        WHERE status = 'pending'
      DO UPDATE SET
        last_error = EXCLUDED.last_error,
        updated_at = EXCLUDED.updated_at
    `);
    logger.info(
      {
        stripeCustomerId: opts.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId,
      },
      "[stripeOrphanRetry] Orphaned Stripe objects persisted for retry",
    );
  } catch (err) {
    logger.error(
      { err, stripeCustomerId: opts.stripeCustomerId, stripeSubscriptionId: opts.stripeSubscriptionId },
      "[stripeOrphanRetry] Failed to persist stripe orphan record",
    );
  }
}

/**
 * Atomically claims up to CLAIM_BATCH_SIZE rows that are either:
 *   - in 'pending' status, OR
 *   - in 'processing' status but with updated_at older than
 *     STALE_PROCESSING_THRESHOLD_MS (i.e. left behind by a crashed worker).
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent workers never double-process.
 */
async function claimOrphans(): Promise<(typeof stripeOrphans.$inferSelect)[]> {
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  const result = await db.execute<typeof stripeOrphans.$inferSelect>(
    sql`
      UPDATE stripe_orphans
      SET    status     = 'processing',
             updated_at = NOW()
      WHERE  id IN (
               SELECT id
               FROM   stripe_orphans
               WHERE  status = 'pending'
                  OR (status = 'processing' AND updated_at < ${staleThreshold})
               LIMIT  ${CLAIM_BATCH_SIZE}
               FOR UPDATE SKIP LOCKED
             )
      RETURNING *
    `,
  );
  return result.rows as (typeof stripeOrphans.$inferSelect)[];
}

async function processRow(
  row: typeof stripeOrphans.$inferSelect,
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
): Promise<void> {
  let subError: string | null = null;
  let custError: string | null = null;

  if (row.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } catch (err: unknown) {
      if (isStripeResourceMissing(err)) {
        logger.info(
          { id: row.id, stripeSubscriptionId: row.stripeSubscriptionId },
          "[stripeOrphanRetry] Subscription already gone — treating as resolved",
        );
      } else {
        subError = extractStripeErrorMessage(err);
      }
    }
  }

  if (row.stripeCustomerId) {
    try {
      await stripe.customers.del(row.stripeCustomerId);
    } catch (err: unknown) {
      if (isStripeResourceMissing(err)) {
        logger.info(
          { id: row.id, stripeCustomerId: row.stripeCustomerId },
          "[stripeOrphanRetry] Customer already gone — treating as resolved",
        );
      } else {
        custError = extractStripeErrorMessage(err);
      }
    }
  }

  const failed = subError !== null || custError !== null;
  const newRetryCount = row.retryCount + 1;
  const lastError = [subError, custError].filter(Boolean).join("; ") || null;

  if (!failed) {
    await db
      .update(stripeOrphans)
      .set({ status: "resolved", retryCount: newRetryCount, lastError: null, updatedAt: new Date() })
      .where(eq(stripeOrphans.id, row.id));
    logger.info(
      { id: row.id, stripeCustomerId: row.stripeCustomerId, stripeSubscriptionId: row.stripeSubscriptionId },
      "[stripeOrphanRetry] Orphan resolved",
    );
  } else if (newRetryCount >= MAX_RETRIES) {
    await db
      .update(stripeOrphans)
      .set({ status: "failed_permanently", retryCount: newRetryCount, lastError, updatedAt: new Date() })
      .where(eq(stripeOrphans.id, row.id));
    logger.error(
      { id: row.id, stripeCustomerId: row.stripeCustomerId, stripeSubscriptionId: row.stripeSubscriptionId, lastError },
      "[stripeOrphanRetry] Orphan marked failed_permanently after max retries — manual cleanup required",
    );
    // Notify the team via email / Slack so the permanent failure is actioned
    // promptly. sendOrphanPermanentFailureAlert catches its own errors so it
    // never blocks or throws back into the retry job.
    await sendOrphanPermanentFailureAlert({
      orphanId: row.id,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      lastError,
      retryCount: newRetryCount,
    });
  } else {
    await db
      .update(stripeOrphans)
      .set({ status: "pending", retryCount: newRetryCount, lastError, updatedAt: new Date() })
      .where(eq(stripeOrphans.id, row.id));
    logger.warn(
      { id: row.id, retryCount: newRetryCount, lastError },
      "[stripeOrphanRetry] Retry attempt failed, will try again",
    );
  }
}

async function retryPendingOrphans(): Promise<void> {
  let stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    logger.warn(
      "[stripeOrphanRetry] Stripe client unavailable during retry sweep — will try again next interval",
    );
    return;
  }

  let rows: (typeof stripeOrphans.$inferSelect)[];
  try {
    rows = await claimOrphans();
  } catch (err) {
    logger.error({ err }, "[stripeOrphanRetry] Failed to claim orphan rows");
    return;
  }

  if (rows.length === 0) return;

  logger.info(
    { count: rows.length },
    "[stripeOrphanRetry] Processing claimed stripe orphans",
  );

  for (const row of rows) {
    try {
      await processRow(row, stripe);
    } catch (err) {
      // An unexpected DB or network error during status update: log and
      // leave the row in 'processing' — it will be reclaimed as stale on
      // the next sweep after STALE_PROCESSING_THRESHOLD_MS.
      logger.error(
        { err, id: row.id },
        "[stripeOrphanRetry] Unexpected error processing orphan row — will be reclaimed as stale",
      );
    }
  }
}

/**
 * Immediately retries a single orphan row by ID, regardless of its current
 * status. Resets retry_count to 0 so permanently-failed records get a fresh
 * attempt. Intended for use by the developer dashboard "Retry Now" action.
 */
export async function retryOrphanNow(id: number): Promise<{ status: string }> {
  let stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    throw new Error("Stripe client unavailable — check STRIPE_SECRET_KEY configuration");
  }

  const claimResult = await db.execute<typeof stripeOrphans.$inferSelect>(
    sql`
      UPDATE stripe_orphans
      SET    status      = 'processing',
             retry_count = 0,
             updated_at  = NOW()
      WHERE  id = ${id}
        AND  status != 'resolved'
      RETURNING *
    `,
  );

  const rows = claimResult.rows as (typeof stripeOrphans.$inferSelect)[];
  if (!rows.length) {
    throw new Error("Record not found or already resolved");
  }

  const row = rows[0];
  logger.info({ id }, "[stripeOrphanRetry] Developer-triggered immediate retry");
  await processRow(row, stripe);

  const [updated] = await db.select().from(stripeOrphans).where(eq(stripeOrphans.id, id));
  return { status: updated?.status ?? "unknown" };
}

export function startStripeOrphanRetryJob(): void {
  const interval = setInterval(() => {
    retryPendingOrphans().catch((err: unknown) => {
      logger.error({ err }, "[stripeOrphanRetry] Unexpected error in retry job");
    });
  }, RETRY_INTERVAL_MS);
  interval.unref();

  logger.info(
    { intervalMs: RETRY_INTERVAL_MS, maxRetries: MAX_RETRIES },
    "[stripeOrphanRetry] Retry job started",
  );
}
