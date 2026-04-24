import { useQuery } from "@tanstack/react-query";
import { SiInstagram } from "react-icons/si";

export function InstagramFloat() {
  const { data: content } = useQuery<Record<string, string>>({ queryKey: ["/api/page-content"] });
  const handle = content?.instagram_handle ?? "better_bucks";

  return (
    <a
      href={`https://www.instagram.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-instagram-float"
      style={{ bottom: "calc(var(--bb-bottom-nav-h) + env(safe-area-inset-bottom) + 1rem)" }}
      className="fixed right-4 sm:right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
    >
      <SiInstagram className="h-4 w-4 shrink-0" />
      <span>@{handle}</span>
    </a>
  );
}
