import { and, lt, eq } from "drizzle-orm";
import { db } from "./db";
import { stripeOrphans } from "@workspace/db";
import { logger } from "./lib/logger";
import { sendOrphanSummaryAlert } from "./lib/alerts";

const SUMMARY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24 hours

async function runOrphanSummary(): Promise<void> {
  const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MS);

  let stuckRows: (typeof stripeOrphans.$inferSelect)[];
  try {
    stuckRows = await db
      .select()
      .from(stripeOrphans)
      .where(
        and(
          eq(stripeOrphans.status, "failed_permanently"),
          lt(stripeOrphans.updatedAt, thresholdDate),
        ),
      );
  } catch (err) {
    logger.error({ err }, "[stripeOrphanSummary] Failed to query stuck orphan rows");
    return;
  }

  if (stuckRows.length === 0) {
    logger.info("[stripeOrphanSummary] No permanently-failed orphans stuck > 24 h — nothing to report");
    return;
  }

  const now = Date.now();
  const oldestMs = Math.max(
    ...stuckRows.map((r) => now - r.updatedAt.getTime()),
  );
  const oldestAgeHours = Math.round(oldestMs / (1000 * 60 * 60));
  const orphanIds = stuckRows.map((r) => r.id);

  logger.warn(
    { count: stuckRows.length, oldestAgeHours, orphanIds },
    "[stripeOrphanSummary] Permanently-failed orphans stuck > 24 h — sending summary alert",
  );

  try {
    await sendOrphanSummaryAlert({ count: stuckRows.length, oldestAgeHours, orphanIds });
  } catch (err) {
    logger.error({ err }, "[stripeOrphanSummary] Unexpected error sending summary alert");
  }
}

export function startStripeOrphanSummaryJob(): void {
  // Run once immediately on startup to catch any records already stuck
  runOrphanSummary().catch((err: unknown) => {
    logger.error({ err }, "[stripeOrphanSummary] Unexpected error in startup sweep");
  });

  const interval = setInterval(() => {
    runOrphanSummary().catch((err: unknown) => {
      logger.error({ err }, "[stripeOrphanSummary] Unexpected error in summary job");
    });
  }, SUMMARY_INTERVAL_MS);
  interval.unref();

  logger.info(
    { intervalMs: SUMMARY_INTERVAL_MS, stuckThresholdHours: STUCK_THRESHOLD_MS / (1000 * 60 * 60) },
    "[stripeOrphanSummary] Daily summary job started",
  );
}
