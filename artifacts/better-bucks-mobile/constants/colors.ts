/**
 * Better Bucks brand tokens — aligned with the spec design system.
 *
 * Light theme: white backgrounds, navy text, kelly-green accents.
 * The wallet balance card is the one exception — it keeps a dark navy background.
 */

export const brand = {
  // Core palette
  navy: "#162E4B",        // headers, navigation bars, text headings, badges — matches website hsl(213 54% 19%)
  navyCard: "#162A4A",    // wallet balance card background (dark navy)
  navyCardLight: "#1F3A5F", // slightly lighter card surface
  green: "#2E7D32",       // primary accent — buttons, active states, icons, progress bars
  greenLight: "#4CAF50",  // lighter green for hover/pressed states

  // Backgrounds
  white: "#FFFFFF",
  offWhite: "#F5F7FA",    // subtle off-white for list separators / input bg tint

  // Text
  text: "#1A237E",        // primary text — navy
  textSecondary: "#4A4A4A", // secondary text — dark gray
  textMuted: "#9E9E9E",   // muted / placeholder text

  // Borders & dividers
  border: "#E0E0E0",      // card and input borders

  // Status colours
  danger: "#C62828",      // error red
  warning: "#F9A825",     // amber warning
} as const;

const colors = {
  light: {
    text: brand.text,
    tint: brand.navy,

    background: brand.white,
    foreground: brand.text,

    card: brand.white,
    cardForeground: brand.text,

    primary: brand.green,
    primaryForeground: brand.white,

    secondary: brand.navy,
    secondaryForeground: brand.white,

    muted: brand.offWhite,
    mutedForeground: brand.textMuted,

    destructive: brand.danger,
    destructiveForeground: brand.white,

    border: brand.border,
    input: brand.border,
  },

  radius: 10,
};

export default colors;
