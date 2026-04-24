import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  testId?: string;
};

export function MobileBottomNav({ items }: { items: MobileNavItem[] }) {
  const [location] = useLocation();
  const isActive = (path: string) => location === path || location.startsWith(`${path}/`);

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-[998] bg-primary border-t border-white/10 pb-safe pl-safe pr-safe"
      aria-label="Primary"
      data-testid="mobile-bottom-nav"
    >
      <ul className="grid grid-cols-4">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
                data-testid={item.testId ? `bottomnav-${item.testId}` : `bottomnav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-secondary" : ""}`} aria-hidden="true" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
