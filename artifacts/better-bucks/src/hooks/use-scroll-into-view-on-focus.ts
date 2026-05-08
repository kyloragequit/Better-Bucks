import { useCallback } from "react";

/**
 * Returns an `onFocusCapture` handler that scrolls the focused field into the
 * centre of the viewport on small screens (<=640px). Use this on long modal
 * forms (store item editor, survey editor, tier editor, etc.) where the
 * on-screen keyboard would otherwise cover the field. Browsers' default
 * `scroll-padding-bottom` handles short forms; this is targeted to long ones.
 */
export function useScrollIntoViewOnFocus() {
  return useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 641px)").matches) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  }, []);
}
