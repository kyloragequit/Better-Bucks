import { SiInstagram } from "react-icons/si";

export function InstagramFloat() {
  return (
    <a
      href="https://www.instagram.com/better_bucks"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="link-instagram-float"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white rounded-full shadow-lg px-4 py-2.5 text-sm font-medium hover:scale-105 active:scale-95 transition-transform"
    >
      <SiInstagram className="h-4 w-4 shrink-0" />
      <span>@better_bucks</span>
    </a>
  );
}
