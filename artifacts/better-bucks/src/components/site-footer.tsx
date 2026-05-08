import { AppLogo } from "@/components/app-logo";
import { Link } from "wouter";
import { Mail } from "lucide-react";

export function SiteFooter({ dark = false, absolute = false }: { dark?: boolean; absolute?: boolean }) {
  return (
    <footer
      className={`${
        absolute ? "absolute bottom-0 left-0 right-0" : "w-full"
      } py-4 flex flex-col items-center gap-1 select-none ${
        dark ? "text-white/30" : "text-muted-foreground/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <AppLogo size="xs" />
        <span className="text-xs">Better Bucks LLC</span>
      </div>
      <p className="text-[11px]">
        By using this website, you agree to our{" "}
        <Link
          href="/terms"
          className={`underline underline-offset-2 transition-opacity hover:opacity-80 ${
            dark ? "text-white/50" : "text-muted-foreground"
          }`}
        >
          Terms of Service
        </Link>
      </p>
      <p className="text-[11px] flex items-center gap-1">
        <Mail className="h-3 w-3 shrink-0" />
        Contact us:{" "}
        <a
          href="mailto:miles.chase@betterbucks.net"
          className={`underline underline-offset-2 transition-opacity hover:opacity-80 ${
            dark ? "text-white/50" : "text-muted-foreground"
          }`}
        >
          miles.chase@betterbucks.net
        </a>
      </p>
    </footer>
  );
}
