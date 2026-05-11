import cron from "node-cron";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { users } from "@workspace/db";
import { logger } from "./lib/logger";
import { sendExpoPushNotification } from "./routes/mobile";
import { storage } from "./storage";

/**
 * Minimum Bucks balance that triggers a reminder notification.
 * Employees with fewer Bucks than this threshold are not notified.
 */
const MIN_BALANCE_THRESHOLD = 100;

/**
 * Runs once per day at 10:00 AM server time.
 * Finds every approved employee who:
 *   - has a registered Expo push token (i.e. uses the mobile app)
 *   - has a Bucks balance at or above the threshold
 * …and sends them a push notification encouraging them to visit the store.
 */
async function sendBucksReminders(): Promise<void> {
  logger.info("[bucksReminder] Starting daily Bucks reminder sweep");

  let recipients: (typeof users.$inferSelect)[];
  try {
    recipients = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "employee"),
          eq(users.status, "approved"),
          isNotNull(users.expoPushToken),
          gt(users.balance, MIN_BALANCE_THRESHOLD - 1),
        ),
      );
  } catch (err) {
    logger.error({ err }, "[bucksReminder] Failed to query recipients — aborting sweep");
    return;
  }

  if (recipients.length === 0) {
    logger.info("[bucksReminder] No eligible recipients found — sweep complete");
    return;
  }

  logger.info({ count: recipients.length }, "[bucksReminder] Sending Bucks reminders");

  let succeeded = 0;
  let failed = 0;

  for (const user of recipients) {
    const token = user.expoPushToken!;
    const balance = user.balance;
    const body =
      balance >= 500
        ? `You have ${balance} Bucks saved up — treat yourself in the store today!`
        : `You have ${balance} Bucks waiting — head to the store and pick something out!`;

    const title = "You have Bucks to spend!";
    try {
      await sendExpoPushNotification(token, title, body);
      succeeded++;
      logger.info(
        { userId: user.id, balance },
        "[bucksReminder] Reminder sent",
      );
      storage.createNotificationLog({ userId: user.id, title, body }).catch((logErr: unknown) =>
        logger.warn({ err: logErr, userId: user.id }, "[bucksReminder] Failed to record notification log"),
      );
    } catch (err) {
      failed++;
      logger.warn(
        { err, userId: user.id },
        "[bucksReminder] Failed to send reminder to employee",
      );
    }
  }

  logger.info(
    { succeeded, failed, total: recipients.length },
    "[bucksReminder] Daily Bucks reminder sweep complete",
  );
}

/**
 * Registers the daily Bucks reminder cron job.
 * Runs every day at 10:00 AM server time.
 */
export function startBucksReminderJob(): void {
  cron.schedule("0 10 * * *", () => {
    sendBucksReminders().catch((err: unknown) => {
      logger.error({ err }, "[bucksReminder] Unexpected error in reminder job");
    });
  });

  logger.info(
    { schedule: "0 10 * * *", minBalanceThreshold: MIN_BALANCE_THRESHOLD },
    "[bucksReminder] Daily Bucks reminder job scheduled",
  );
}
