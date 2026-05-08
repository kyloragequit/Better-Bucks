/**
 * Mobile app runtime configuration.
 *
 * URL resolution order:
 *   1. EXPO_PUBLIC_API_URL — explicit override (pk_live / pk_test base)
 *   2. EXPO_PUBLIC_DOMAIN  — auto-set by the Replit workflow; derives the
 *      API base as https://<domain>  (Replit reverse-proxy routes /api/*)
 *   3. Empty string — app will fail gracefully on the first API call with a
 *      clear network error rather than crashing the process at startup.
 *
 * EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is optional; signup screens show a
 * clear error if it is missing.
 *
 * EXPO_PUBLIC_HCAPTCHA_SITE_KEY — hCaptcha site key for human verification
 *   during signup. When unset, the captcha step is skipped (dev/test only);
 *   production must always set this.
 */

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const rawDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();

export const API_URL: string = rawApiUrl
  ? rawApiUrl
  : rawDomain
    ? `https://${rawDomain}`
    : "";

export const STRIPE_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

export const HCAPTCHA_SITE_KEY: string =
  process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY ?? "";

export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
