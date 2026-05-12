/**
 * ONE-TIME backfill script — run once in production after deploying the
 * welcomeNotificationSent feature to suppress stale welcome notifications
 * for employees who already existed before the column was added.
 *
 * WARNING: Do not re-run after go-live. Re-running will also flip any
 * genuinely new employees who have not yet received their welcome notification,
 * silently suppressing it for them.
 *
 * If you need a re-runnable version, add a timestamp predicate such as:
 *   WHERE welcome_notification_sent = FALSE
 *     AND created_at < '<column_added_timestamp>'
 */
import { pool } from "@workspace/db";

async function main() {
  console.log("Backfilling welcomeNotificationSent for pre-existing users...");
  console.log(
    "NOTE: This is a one-time script. Do not re-run after go-live.",
  );

  const result = await pool.query<{ id: number }>(
    `UPDATE users
     SET welcome_notification_sent = TRUE
     WHERE welcome_notification_sent = FALSE
     RETURNING id`,
  );

  console.log(
    `Done. Marked ${result.rowCount ?? 0} user(s) as welcome_notification_sent = true.`,
  );
  console.log(
    "New employees will still receive the welcome notification on first push token registration.",
  );

  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
