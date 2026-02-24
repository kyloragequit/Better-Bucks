import logoImg from "@assets/Final_Logo_1771908016318.png";

export function LogoBackground() {
  const logos = [
    { top: "5%", left: "3%", size: "80px", rotate: "-15deg", opacity: 0.06 },
    { top: "15%", right: "8%", size: "120px", rotate: "25deg", opacity: 0.04 },
    { top: "35%", left: "12%", size: "60px", rotate: "45deg", opacity: 0.07 },
    { bottom: "20%", left: "6%", size: "100px", rotate: "-30deg", opacity: 0.05 },
    { top: "55%", right: "5%", size: "70px", rotate: "60deg", opacity: 0.06 },
    { bottom: "8%", right: "20%", size: "90px", rotate: "-45deg", opacity: 0.04 },
    { top: "45%", left: "45%", size: "50px", rotate: "15deg", opacity: 0.03 },
    { bottom: "35%", right: "35%", size: "110px", rotate: "-60deg", opacity: 0.05 },
    { top: "8%", left: "55%", size: "65px", rotate: "35deg", opacity: 0.04 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {logos.map((pos, i) => (
        <img
          key={i}
          src={logoImg}
          alt=""
          aria-hidden="true"
          className="absolute grayscale"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            width: pos.size,
            height: pos.size,
            transform: `rotate(${pos.rotate})`,
            opacity: pos.opacity,
            objectFit: "contain",
          }}
        />
      ))}
    </div>
  );
}
