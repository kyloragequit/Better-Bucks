import logoImg from "@assets/Final_Logo_1773850720439.png";

export function LogoBackground() {
  const logos = [
    { top: "-80px", left: "-40px", size: "280px", rotate: "-20deg", opacity: 0.12 },
    { bottom: "-90px", right: "-50px", size: "300px", rotate: "25deg", opacity: 0.11 },

    { top: "5%", right: "8%", size: "140px", rotate: "30deg", opacity: 0.1 },
    { top: "15%", left: "15%", size: "100px", rotate: "-40deg", opacity: 0.14 },
    { top: "25%", right: "22%", size: "80px", rotate: "55deg", opacity: 0.13 },
    { top: "8%", left: "50%", size: "60px", rotate: "-15deg", opacity: 0.15 },

    { top: "38%", left: "4%", size: "110px", rotate: "45deg", opacity: 0.11 },
    { top: "45%", right: "5%", size: "55px", rotate: "-50deg", opacity: 0.16 },
    { top: "42%", left: "40%", size: "40px", rotate: "70deg", opacity: 0.14 },
    { top: "55%", left: "20%", size: "70px", rotate: "-30deg", opacity: 0.13 },
    { top: "60%", right: "15%", size: "90px", rotate: "15deg", opacity: 0.1 },

    { top: "70%", left: "8%", size: "50px", rotate: "60deg", opacity: 0.15 },
    { top: "72%", right: "35%", size: "75px", rotate: "-25deg", opacity: 0.12 },
    { top: "80%", left: "30%", size: "45px", rotate: "35deg", opacity: 0.16 },
    { top: "78%", right: "8%", size: "65px", rotate: "-45deg", opacity: 0.13 },
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
