/**
 * Mobile app runtime configuration.
 *
 * Required env vars (set via Expo `extra` or `EXPO_PUBLIC_*`):
 *   - EXPO_PUBLIC_API_URL — base URL for the Better Bucks API server.
 *                          REQUIRED. No production fallback is hardcoded.
 *   - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — Stripe publishable key
 *                          (pk_live_… or pk_test_…). REQUIRED for signup.
 */

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!RAW_API_URL || RAW_API_URL.trim().length === 0) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. Configure it in app.json `extra` or " +
      "as an environment variable before starting the app.",
  );
}

export const API_URL: string = RAW_API_URL;

export const STRIPE_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
