import { logger } from "./logger";

/**
 * Sends a push notification via the Expo push API.
 * Throws if the API returns a non-OK status.
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
): Promise<void> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify({ to: expoPushToken, title, body, sound: "default" }),
  });
  if (!response.ok) {
    logger.error({ status: response.status }, "Expo push API returned non-OK status");
    throw new Error(`Expo push API returned ${response.status}`);
  }
}
