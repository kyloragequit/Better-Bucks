/**
 * Better Bucks brand tokens — synced from the web artifact's
 * artifacts/better-bucks/src/index.css and tailwind.config.ts.
 *
 * Brand: navy primary, green secondary, gold accent.
 */

export const brand = {
  navy: "#162A4A",
  navyLight: "#1F3A5F",
  green: "#4E9F3D",
  greenLight: "#62B850",
  gold: "#F5C842",
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  danger: "#DC2626",
} as const;

const colors = {
  light: {
    text: brand.text,
    tint: brand.navy,

    background: brand.white,
    foreground: brand.text,

    card: brand.white,
    cardForeground: brand.text,

    primary: brand.navy,
    primaryForeground: brand.white,

    secondary: brand.green,
    secondaryForeground: brand.white,

    muted: "#F1F5F9",
    mutedForeground: brand.textMuted,

    accent: brand.gold,
    accentForeground: brand.navy,

    destructive: brand.danger,
    destructiveForeground: brand.white,

    border: brand.border,
    input: brand.border,
  },

  radius: 10,
};

export default colors;
