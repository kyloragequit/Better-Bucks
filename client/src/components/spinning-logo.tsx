import logoImg from "@assets/Final_Logo_1771908016318.png";

interface SpinningLogoProps {
  className?: string;
}

export function SpinningLogo({ className = "h-5 w-5" }: SpinningLogoProps) {
  return (
    <img
      src={logoImg}
      alt=""
      aria-hidden="true"
      className={`animate-spin object-contain ${className}`}
    />
  );
}
