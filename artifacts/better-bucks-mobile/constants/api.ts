/**
 * Mobile app runtime configuration.
 *
 * Required env vars (set via Expo `extra` or `EXPO_PUBLIC_*`):
 *   - EXPO_PUBLIC_API_URL — base URL for the Better Bucks API server
 *                          (e.g. https://betterbucks.net). Falls back to
 *                          the workspace dev domain when running in Replit.
 *   - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — Stripe publishable key (pk_live_…
 *                          or pk_test_…). REQUIRED for the signup flow.
 */

const devDomain = process.env.EXPO_PUBLIC_DOMAIN;

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (devDomain ? `https://${devDomain}` : "https://betterbucks.net");

export const STRIPE_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
