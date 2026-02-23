import logoImg from "@assets/ChatGPT_Image_Feb_23,_2026,_01_29_46_PM_1771875029346.png";

export function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
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
