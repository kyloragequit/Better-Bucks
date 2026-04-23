import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    return (v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "M";
  }
  if (abs >= 10_000) {
    const v = n / 1000;
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")) + "k";
  }
  return n.toLocaleString();
}
