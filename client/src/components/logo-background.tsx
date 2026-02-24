import logoImg from "@assets/Final_Logo_1771908016318.png";

export function LogoBackground() {
  const logos = [
    { top: "5%", left: "3%", size: "100px", rotate: "-15deg", opacity: 0.15 },
    { top: "12%", right: "8%", size: "140px", rotate: "25deg", opacity: 0.12 },
    { top: "35%", left: "8%", size: "80px", rotate: "45deg", opacity: 0.18 },
    { bottom: "18%", left: "5%", size: "120px", rotate: "-30deg", opacity: 0.14 },
    { top: "55%", right: "4%", size: "90px", rotate: "60deg", opacity: 0.16 },
    { bottom: "6%", right: "18%", size: "110px", rotate: "-45deg", opacity: 0.12 },
    { top: "42%", left: "42%", size: "70px", rotate: "15deg", opacity: 0.1 },
    { bottom: "32%", right: "32%", size: "130px", rotate: "-60deg", opacity: 0.13 },
    { top: "6%", left: "50%", size: "85px", rotate: "35deg", opacity: 0.14 },
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
