import { AppLogo } from "@/components/app-logo";

export function SiteFooter({ dark = false, absolute = false }: { dark?: boolean; absolute?: boolean }) {
  return (
    <footer
      className={`${
        absolute ? "absolute bottom-0 left-0 right-0" : "w-full"
      } py-3 flex items-center justify-center gap-2 select-none ${
        dark ? "text-white/30" : "text-muted-foreground/60"
      }`}
    >
      <AppLogo size="sm" />
      <span className="text-xs">Better Bucks LLC</span>
    </footer>
  );
}
