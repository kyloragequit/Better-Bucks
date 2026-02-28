export function SiteFooter({ dark = false, absolute = false }: { dark?: boolean; absolute?: boolean }) {
  return (
    <footer
      className={`${
        absolute ? "absolute bottom-0 left-0 right-0" : "w-full"
      } py-3 text-center text-xs select-none ${
        dark ? "text-white/30" : "text-muted-foreground/60"
      }`}
    >
      Better Bucks LLC
    </footer>
  );
}
