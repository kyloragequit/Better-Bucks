import { useLocation } from "wouter";
import logoImg from "@assets/logo-optimized.png";

export function AppLogo({ size = "md", linkTo }: { size?: "xs" | "sm" | "md" | "lg"; linkTo?: string }) {
  const [, navigate] = useLocation();

  const sizeClasses = {
    xs: "h-[28px] w-[28px]",
    sm: "h-[60px] w-[60px]",
    md: "h-[84px] w-[84px]",
    lg: "h-[120px] w-[120px]",
  };

  const handleClick = () => {
    if (linkTo) {
      navigate(linkTo);
    }
  };

  return (
    <img
      src={logoImg}
      alt="Better Bucks"
      className={`${sizeClasses[size]} rounded-md object-contain shrink-0 ${linkTo ? "cursor-pointer hover:opacity-80 transition-opacity" : ""} select-none`}
      onClick={handleClick}
      data-testid="app-logo"
    />
  );
}
