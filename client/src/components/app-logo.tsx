export function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-7 w-7 text-sm",
    md: "h-9 w-9 text-lg",
    lg: "h-12 w-12 text-2xl",
  };

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold select-none shrink-0`}
      data-testid="app-logo"
    >
      B
    </div>
  );
}
