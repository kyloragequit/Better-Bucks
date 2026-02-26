import { useLocation } from "wouter";
import logoImg from "@assets/Final_Logo_1771908016318.png";

export function AppLogo({ size = "md", linkTo }: { size?: "sm" | "md" | "lg"; linkTo?: string }) {
  const [, navigate] = useLocation();

  const sizeClasses = {
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
