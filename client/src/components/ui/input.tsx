import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => {
    // h-11 (44px) on mobile for comfortable tap targets, h-9 on >=sm to match
    // icon buttons and keep dense desktop layouts. text-base on mobile prevents
    // iOS Safari from auto-zooming on focus; md:text-sm tightens it on desktop.
    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        onFocus?.(e);
        if (
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(max-width: 640px)").matches
        ) {
          const el = e.currentTarget;
          // Defer until the on-screen keyboard has had a chance to appear
          // so scrollIntoView lands the input above it instead of behind it.
          window.setTimeout(() => {
            try {
              el.scrollIntoView({ block: "center", behavior: "smooth" });
            } catch {
              /* no-op */
            }
          }, 280);
        }
      },
      [onFocus],
    );

    return (
      <input
        type={type}
        onFocus={handleFocus}
        className={cn(
          "flex h-11 sm:h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
