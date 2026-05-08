import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  testId?: string;
  badge?: number;
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
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
                data-testid={item.testId ? `bottomnav-${item.testId}` : `bottomnav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="relative inline-flex">
                  <Icon className={`h-5 w-5 ${active ? "text-secondary" : ""}`} aria-hidden="true" />
                  {(item.badge ?? 0) > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                      data-testid={`badge-pending-orders-mobile`}
                    >
                      {item.badge! > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
