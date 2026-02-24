import logoImg from "@assets/Final_Logo_1771908016318.png";

export function LogoBackground() {
  const logos = [
    { top: "2%", left: "2%", size: "110px", rotate: "-15deg", opacity: 0.15 },
    { top: "8%", right: "6%", size: "160px", rotate: "25deg", opacity: 0.1 },
    { top: "5%", left: "40%", size: "70px", rotate: "50deg", opacity: 0.12 },
    { top: "18%", left: "18%", size: "50px", rotate: "-40deg", opacity: 0.18 },
    { top: "22%", right: "25%", size: "90px", rotate: "10deg", opacity: 0.13 },
    { top: "30%", left: "5%", size: "130px", rotate: "45deg", opacity: 0.11 },
    { top: "35%", right: "3%", size: "60px", rotate: "-55deg", opacity: 0.16 },
    { top: "40%", left: "35%", size: "40px", rotate: "70deg", opacity: 0.14 },
    { top: "48%", left: "60%", size: "100px", rotate: "-20deg", opacity: 0.1 },
    { top: "50%", left: "8%", size: "75px", rotate: "30deg", opacity: 0.17 },
    { top: "55%", right: "12%", size: "140px", rotate: "-35deg", opacity: 0.09 },
    { top: "62%", left: "25%", size: "55px", rotate: "65deg", opacity: 0.15 },
    { top: "68%", right: "40%", size: "85px", rotate: "-10deg", opacity: 0.12 },
    { bottom: "20%", left: "3%", size: "120px", rotate: "-50deg", opacity: 0.13 },
    { bottom: "15%", right: "5%", size: "45px", rotate: "40deg", opacity: 0.18 },
    { bottom: "10%", left: "45%", size: "95px", rotate: "-65deg", opacity: 0.11 },
    { bottom: "3%", left: "15%", size: "65px", rotate: "20deg", opacity: 0.14 },
    { bottom: "5%", right: "25%", size: "150px", rotate: "-25deg", opacity: 0.08 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {logos.map((pos, i) => (
        <img
          key={i}
          src={logoImg}
          alt=""
          aria-hidden="true"
          className="absolute"
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
            filter: "saturate(1.5) hue-rotate(-10deg) brightness(1.1)",
          }}
        />
      ))}
    </div>
  );
}
