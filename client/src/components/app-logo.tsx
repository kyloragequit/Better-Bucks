import logoImg from "@assets/ChatGPT_Image_Feb_23,_2026,_01_29_46_PM_1771875029346.png";

export function AppLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-20 w-20",
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
