import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import logoImg from "@assets/Final_Logo_1771908016318.png";
import funLogoImg from "@assets/image_1771968786741.png";
import { useFunMode, setFunMode } from "@/hooks/use-fun-mode";

export function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [spinning, setSpinning] = useState(false);
  const funMode = useFunMode();
  const [location] = useLocation();

  useEffect(() => {
    setFunMode(false);
  }, [location]);

  const handleClick = () => {
    setFunMode(!funMode);
    setSpinning(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setSpinning(true)));
  };

  const sizeClasses = {
    sm: "h-[60px] w-[60px]",
    md: "h-[84px] w-[84px]",
    lg: "h-[120px] w-[120px]",
  };

  return (
    <img
      src={funMode ? funLogoImg : logoImg}
      alt="Better Bucks"
      className={`${sizeClasses[size]} rounded-md object-contain shrink-0 cursor-pointer select-none ${spinning ? "logo-whirl" : ""}`}
      onClick={handleClick}
      onAnimationEnd={() => setSpinning(false)}
      data-testid="app-logo"
    />
  );
}
