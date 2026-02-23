import logoImg from "@assets/ChatGPT_Image_Feb_23,_2026,_01_27_33_PM_1771876849184.png";

export function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-[60px] w-[60px]",
    md: "h-[84px] w-[84px]",
    lg: "h-[120px] w-[120px]",
  };

  return (
    <img
      src={logoImg}
      alt="Better Bucks"
      className={`${sizeClasses[size]} rounded-md object-contain shrink-0`}
      data-testid="app-logo"
    />
  );
}
