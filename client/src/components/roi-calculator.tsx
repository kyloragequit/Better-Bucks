import { useState } from "react";

const FONT_BODY = "'Inter', sans-serif";
const FONT_DISPLAY = "'Outfit', sans-serif";

const NAVY = "#162A4A";
const GREEN = "#4E9F3D";
const GREEN_LIGHT = "#e8f5e4";
const MUTED = "#64748b";
const BORDER = "#dde3ea";
const BG_SECTION = "#F0F4F8";
const BG_CARD_INNER = "#f5f7fa";
const RED = "#dc2626";
const RED_DARK = "#b91c1c";
const BLUE = "#1a6fb5";
const PURPLE = "#5a42cc";

const BENCHMARKS = [
  { num: "26–28%", color: RED_DARK, desc: "avg annual turnover in manufacturing (Manufacturers Alliance 2024)" },
  { num: "49%",    color: RED_DARK, desc: "warehouse worker turnover rate (U.S. Bureau of Labor Statistics)" },
  { num: "$18,600",color: BLUE, desc: "avg cost to replace one warehouse worker (KPI Solutions / BLS)" },
  { num: "21%",    color: PURPLE, desc: "productivity gain from engaged employees (Gallup / Bucketlist research)" },
];

const BARS = [
  { label: "Turnover reduction", range: "15–20%", width: "20%", bg: GREEN_LIGHT, color: "#065c3d", source: "industry avg 20–28%" },
  { label: "Productivity lift",  range: "15–21%", width: "21%", bg: "#e0eaf5", color: NAVY, source: "Gallup / Bucketlist" },
  { label: "Absenteeism drop",  range: "10–15%", width: "16%", bg: "#ede9fb", color: PURPLE, source: "SHRM data" },
  { label: "Engagement score",  range: "+15–30 pts", width: "25%", bg: "#fef5e7", color: "#7c5e10", source: "Gapp Group ROI Model" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n);
}

function SliderRow({ label, min, max, step, value, onChange, display }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; display: string | number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 70px", alignItems: "center", gap: 14 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: GREEN, cursor: "pointer" }}
        data-testid={`slider-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, textAlign: "right", color: NAVY }}>{display}</span>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div style={{ background: BG_CARD_INNER, borderRadius: 10, padding: "14px 16px" }}>
      <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: NAVY }}>{value}</p>
      <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: MUTED, marginTop: 2 }}>{sub}</p>
    </div>
  );
}

export function ROICalculator() {
  const [emp,  setEmp]  = useState(150);
  const [wage, setWage] = useState(20);
  const [turn, setTurn] = useState(35);

  const annualWage    = wage * 2080;
  const leavers       = Math.round(emp * turn / 100);
  const replaceCost   = Math.round(annualWage * 0.40);
  const totalTurnover = leavers * replaceCost;
  const laborBudget   = emp * annualWage;
  const otCost        = Math.round(laborBudget * 0.05);
  const savTurn       = Math.round(totalTurnover * 0.15);
  const savOT         = Math.round(otCost * 0.10);
  const savProd       = Math.round(laborBudget * 0.03);
  const totalROI      = savTurn + savOT + savProd;

  const card: React.CSSProperties = {
    background: "#fff",
    border: `1px solid ${BORDER}`,
    borderRadius: 16,
    padding: "1.5rem",
    marginBottom: "1.25rem",
  };

  const sectionLabel: React.CSSProperties = {
    fontFamily: FONT_BODY,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: MUTED,
    marginBottom: "1.25rem",
  };

  return (
    <div style={{ fontFamily: FONT_BODY, background: BG_SECTION, padding: "2rem 1rem" }} data-testid="section-roi-calculator">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{ display: "inline-block", background: GREEN, color: "#fff", fontFamily: FONT_BODY, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 999, marginBottom: "1rem" }}>
            Better Bucks
          </span>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.6rem", color: NAVY }}>
            How much is turnover<br />costing your operation?
          </h2>
          <p style={{ fontFamily: FONT_BODY, fontSize: 15, color: MUTED, maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
            Plug in your numbers. See what structured employee incentives can realistically save you.
          </p>
        </div>

        <div style={card}>
          <p style={sectionLabel}>Your operation</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            <SliderRow label="Employees"          min={50}  max={500} step={10} value={emp}  onChange={setEmp}  display={emp} />
            <SliderRow label="Avg hourly wage"    min={15}  max={35}  step={1}  value={wage} onChange={setWage} display={"$" + wage} />
            <SliderRow label="Annual turnover %"  min={20}  max={60}  step={1}  value={turn} onChange={setTurn} display={turn + "%"} />
          </div>
        </div>

        <div style={card}>
          <p style={sectionLabel}>What turnover is costing you today</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            <MetricCard label="Workers leaving per year"   value={leavers}           sub="at current turnover rate" />
            <MetricCard label="Cost to replace one worker" value={fmt(replaceCost)}  sub="hard + soft costs combined" />
            <MetricCard label="Annual turnover cost"       value={fmt(totalTurnover)} sub="lost every year" />
            <MetricCard label="Overtime + absenteeism"    value={fmt(otCost)}        sub="additional hidden cost" />
          </div>
        </div>

        <div style={card}>
          <p style={sectionLabel}>What Better Bucks realistically delivers</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {BARS.map(b => (
              <div key={b.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: MUTED }}>{b.label}</span>
                <div style={{ height: 24, background: BG_CARD_INNER, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: b.width, height: "100%", background: b.bg, borderRadius: 6, display: "flex", alignItems: "center", padding: "0 10px" }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: 700, color: b.color, whiteSpace: "nowrap" }}>{b.range}</span>
                  </div>
                </div>
                <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: MUTED, textAlign: "right" }}>{b.source}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <p style={sectionLabel}>Estimated annual value to your business</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
            {[
              ["Turnover savings (conservative 15% reduction)", savTurn],
              ["Overtime + absenteeism savings (10%)",          savOT],
              ["Productivity value (3% of total labor budget)", savProd],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: FONT_BODY, fontSize: 13, color: MUTED }}>{label as string}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600, color: GREEN, whiteSpace: "nowrap" }}>+{fmt(val as number)}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, color: NAVY }}>Total estimated annual savings</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 700, color: GREEN }} data-testid="text-roi-total">{fmt(totalROI)}/yr</span>
          </div>
        </div>

        <div style={card}>
          <p style={sectionLabel}>Industry benchmarks — backed by BLS + Manufacturers Alliance</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {BENCHMARKS.map(b => (
              <div key={b.num} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: b.color, marginBottom: 4 }}>{b.num}</p>
                <p style={{ fontFamily: FONT_BODY, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: FONT_BODY, fontSize: 10, color: MUTED, textAlign: "center", marginTop: "1.5rem", lineHeight: 1.6 }}>
          Sources: U.S. Bureau of Labor Statistics JOLTS · Manufacturers Alliance 2024 Workforce Trends Report · KPI Solutions · Gallup State of the Global Workplace · Gapp Group Incentive ROI Model · SHRM Human Capital Benchmarking<br />
          Conservative estimates used throughout. Actual results may vary by operation size, industry segment, and program design.
        </p>

      </div>
    </div>
  );
}
