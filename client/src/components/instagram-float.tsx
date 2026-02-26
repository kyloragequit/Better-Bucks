import { SiInstagram } from "react-icons/si";

export function InstagramFloat() {
  return (
    <a
      href="https://www.instagram.com/better_bucks"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-instagram-float"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 active:scale-95 transition-all"
    >
      <SiInstagram className="h-4 w-4 shrink-0" />
      <span>@better_bucks</span>
    </a>
  );
}
