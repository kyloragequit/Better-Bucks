import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onFocus, ...props }, ref) => {
  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      onFocus?.(e);
      if (
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(max-width: 640px)").matches
      ) {
        const el = e.currentTarget;
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
    <textarea
      onFocus={handleFocus}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
