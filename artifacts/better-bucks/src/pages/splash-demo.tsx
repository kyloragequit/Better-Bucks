const NAVY = "#162E4B";
const GREEN = "#2E7D32";
const CX = 195;
const CY = 422;
const R = 550;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function slicePath(i: number): string {
  const s = i * 45 - 90;
  const e = s + 45;
  const x1 = CX + R * Math.cos(toRad(s));
  const y1 = CY + R * Math.sin(toRad(s));
  const x2 = CX + R * Math.cos(toRad(e));
  const y2 = CY + R * Math.sin(toRad(e));
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

const SLICES = Array.from({ length: 8 }, (_, i) => ({
  d: slicePath(i),
  fill: i % 2 === 0 ? NAVY : GREEN,
  delay: i * 0.06,
}));

const CSS = `
  @keyframes spinIn {
    from { opacity: 0; transform: rotate(-180deg) scale(0.2); }
    to   { opacity: 1; transform: rotate(0deg)   scale(1);   }
  }
  @-webkit-keyframes spinIn {
    from { opacity: 0; -webkit-transform: rotate(-180deg) scale(0.2); }
    to   { opacity: 1; -webkit-transform: rotate(0deg)   scale(1);   }
  }

  @keyframes logoPopIn {
    from { opacity: 0; transform: scale(0); }
    to   { opacity: 1; transform: scale(1); }
  }
  @-webkit-keyframes logoPopIn {
    from { opacity: 0; -webkit-transform: scale(0); }
    to   { opacity: 1; -webkit-transform: scale(1); }
  }

  @keyframes swirlFadeOut {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0; transform: scale(1.08); pointer-events: none; }
  }
  @-webkit-keyframes swirlFadeOut {
    from { opacity: 1; -webkit-transform: scale(1); }
    to   { opacity: 0; -webkit-transform: scale(1.08); pointer-events: none; }
  }

  @keyframes homeReveal {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @-webkit-keyframes homeReveal {
    from { opacity: 0; -webkit-transform: scale(0.96); }
    to   { opacity: 1; -webkit-transform: scale(1); }
  }

  .swirl-overlay {
    position: absolute;
    inset: 0;
    z-index: 50;
    pointer-events: none;
    background: ${NAVY};
    animation: swirlFadeOut 0.35s ease-in 1.4s both;
    -webkit-animation: swirlFadeOut 0.35s ease-in 1.4s both;
  }

  .swirl-slice {
    animation: spinIn 0.65s cubic-bezier(0.22,1,0.36,1) both;
    -webkit-animation: spinIn 0.65s cubic-bezier(0.22,1,0.36,1) both;
    transform-origin: ${CX}px ${CY}px;
    -webkit-transform-origin: ${CX}px ${CY}px;
  }

  .swirl-logo {
    animation: logoPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
    -webkit-animation: logoPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
    animation-delay: 0.55s;
    -webkit-animation-delay: 0.55s;
    transform-origin: ${CX}px ${CY}px;
    -webkit-transform-origin: ${CX}px ${CY}px;
    opacity: 0;
  }

  .home-screen {
    opacity: 0;
    animation: homeReveal 0.4s ease-out 1.75s both;
    -webkit-animation: homeReveal 0.4s ease-out 1.75s both;
  }
`;

function SwirlIntro() {
  return (
    <div className="swirl-overlay">
      <svg
        viewBox="0 0 390 844"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        {SLICES.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.fill}
            className="swirl-slice"
            style={{ animationDelay: `${s.delay}s`, WebkitAnimationDelay: `${s.delay}s` } as React.CSSProperties}
          />
        ))}
        <g className="swirl-logo">
          <circle cx={CX} cy={CY} r={62} fill="white" stroke={NAVY} strokeWidth={3.5} />
          <circle cx={CX - 20} cy={CY - 14} r={5} fill={NAVY} />
          <circle cx={CX + 20} cy={CY - 14} r={5} fill={NAVY} />
          <path
            d={`M ${CX - 22} ${CY + 10} Q ${CX} ${CY + 32} ${CX + 22} ${CY + 10}`}
            stroke={NAVY}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
          <line x1={CX} y1={CY - 32} x2={CX} y2={CY - 42} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
          <line x1={CX} y1={CY + 32} x2={CX} y2={CY + 42} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
          <line x1={CX - 7} y1={CY - 38} x2={CX + 7} y2={CY - 38} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={CX - 7} y1={CY + 38} x2={CX + 7} y2={CY + 38} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

function HomeScreen() {
  return (
    <div
      className="home-screen"
      style={{
        width: "100%",
        height: "100%",
        background: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: "0 32px",
        boxSizing: "border-box",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={90}
        height={90}
        style={{ marginBottom: 24 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx={50} cy={50} r={44} fill={`${NAVY}15`} stroke={NAVY} strokeWidth={3.5} />
        <circle cx={33} cy={42} r={5} fill={NAVY} />
        <circle cx={67} cy={42} r={5} fill={NAVY} />
        <path
          d="M 26 60 Q 50 78 74 60"
          stroke={NAVY}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
        <line x1={50} y1={6} x2={50} y2={16} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
        <line x1={50} y1={84} x2={50} y2={94} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
        <line x1={42} y1={9} x2={58} y2={9} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={42} y1={91} x2={58} y2={91} stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" />
      </svg>

      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 800,
          fontSize: 26,
          color: NAVY,
          textAlign: "center",
          margin: 0,
          marginBottom: 6,
          letterSpacing: "-0.5px",
        }}
      >
        Better Bucks
      </h1>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          margin: 0,
          marginBottom: 40,
        }}
      >
        Rewards that actually work.
      </p>

      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          style={{
            width: "100%",
            padding: "16px 0",
            background: NAVY,
            color: "white",
            border: "none",
            borderRadius: 14,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            letterSpacing: "0.2px",
          }}
          onClick={() => (window.location.href = "/signup")}
        >
          Create a New Organization
        </button>

        <button
          style={{
            width: "100%",
            padding: "16px 0",
            background: GREEN,
            color: "white",
            border: "none",
            borderRadius: 14,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
          onClick={() => (window.location.href = "/login")}
        >
          Log In
        </button>

        <button
          style={{
            width: "100%",
            padding: "16px 0",
            background: "transparent",
            color: NAVY,
            border: `2px solid ${NAVY}`,
            borderRadius: 14,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
          onClick={() => (window.location.href = "/get-started")}
        >
          New Employee?
        </button>
      </div>
    </div>
  );
}

export default function SplashDemoPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F3F4F6",
        }}
      >
        <div
          style={{
            width: 390,
            height: 844,
            position: "relative",
            overflow: "hidden",
            borderRadius: 44,
            boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
            background: NAVY,
          }}
        >
          <SwirlIntro />
          <HomeScreen />
        </div>
      </div>
    </>
  );
}
