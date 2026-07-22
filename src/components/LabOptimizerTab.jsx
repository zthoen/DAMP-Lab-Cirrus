import React, { useState } from "react";
import { C, MONO, TH_STYLE } from "../constants.js";
import { NumField } from "./Controls.jsx";
import { optimizeLayout } from "../labOptimizer.js";
import { usePersistedState } from "../usePersistedState.js";
import LabMap from "./LabMap.jsx";

const PLACEHOLDER = `Overnight Culture Prep
Step\tSubstep\tEquipment
1. Prepare Reagents\t1.1\tOpentrons Flex Robot
\t1.2\tNanoDrop 2000
2. Run Gel\t2.1\tBiorad Gel Doc XR+ Imaging System`;

// Protocol text is remembered only for this browser session (same reasoning as
// the Protocol Visualizer's paste) — kept in sessionStorage, not localStorage.
const SESSION_KEY = "damp-lab-optimizer-protocols";
const deserializeTexts = (raw) => {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : ["", ""];
};

const ANCHOR_LABEL = { BC: "the B-C columns (today's spot)", DE: "the D-E columns", FG: "the F-G columns" };

export default function LabOptimizerTab({ labData }) {
  const [texts, setTexts] = usePersistedState(sessionStorage, SESSION_KEY, ["", ""], {
    serialize: JSON.stringify, deserialize: deserializeTexts,
  });
  const [result, setResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hoverBefore, setHoverBefore] = useState(null);
  const [hoverAfter, setHoverAfter] = useState(null);

  const count = texts.length;
  const setCount = (n) => setTexts((prev) => {
    const next = prev.slice(0, n);
    while (next.length < n) next.push("");
    return next;
  });
  const setTextAt = (i, value) => setTexts((prev) => prev.map((t, idx) => (idx === i ? value : t)));

  const equipCount = Object.keys(labData.equipToStations).length;
  const pastedCount = texts.filter((t) => t.trim()).length;
  // An exact search can take a second or two on a large relevant-station
  // count — deferring the actual work a tick lets the button repaint to
  // "Optimizing…" first, instead of just looking unresponsive until it's done.
  const optimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setResult(optimizeLayout(labData.equipToStations, texts));
      setIsOptimizing(false);
    }, 0);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <NumField label="protocols" value={count} min={1} max={20} onChange={setCount} width={54} />
        <button className="lbtn primary" disabled={equipCount === 0 || pastedCount === 0 || isOptimizing} onClick={optimize}>
          {isOptimizing ? "Optimizing…" : "Optimize"}
        </button>
        {equipCount === 0 && <span style={{ fontSize: 11.5, color: C.amber }}>Load equipment on the Equipment Input tab first.</span>}
        {equipCount > 0 && pastedCount === 0 && <span style={{ fontSize: 11.5, color: C.amber }}>Paste at least one protocol below.</span>}
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, maxWidth: 900 }}>
        Paste each protocol in the same Step/Substep/Equipment format as the Protocol Visualizer. The optimizer
        rearranges which named station sits at which bench to minimize total distance walked across all of them —
        it only ever proposes a rearrangement of the fixed A1-H3 grid: the Sink, Glassware, Consumables 1/2, and
        the 4C Refrigerator never move, and the sharps/recycling/biohazard group can only relocate together, as a
        block, to the base of another pair of touching columns. Only the stations these protocols actually use can
        change anything, so the search only ever considers those — when there are few enough of them, it checks
        every possible arrangement and finds the true, provably best layout; only when there are too many does it
        fall back to a best-effort search. Either way, it never recommends anything worse than the current layout.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(2, count)}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {texts.map((t, i) => (
          <div key={i}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4, fontFamily: MONO }}>Protocol {i + 1}</div>
            <textarea
              value={t}
              onChange={(e) => setTextAt(i, e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              style={{
                width: "100%", height: 140, background: C.bg, color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: 10, fontFamily: MONO, fontSize: 11.5, resize: "vertical", boxSizing: "border-box",
              }}
            />
          </div>
        ))}
      </div>

      {result && result.warnings.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 11.5, color: C.amber }}>{result.warnings.join(" ")}</div>
      )}

      {result && result.baseline && (
        <>
          <OptimalityBanner result={result} />
          <SummaryRow result={result} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.teal, marginBottom: 6 }}>Improved Layout</div>
              <LabMap
                stationEquip={result.best.stationEquip}
                stationNames={result.best.stationNames}
                fixtures={result.best.fixtures}
                heatCounts={result.best.visitCounts}
                hoverSlot={hoverAfter} setHoverSlot={setHoverAfter}
              />
              <div style={{ marginTop: 8, fontSize: 11.5, fontFamily: MONO, color: C.muted }}>{result.best.totalTravelFt}ft walked across {result.best.perProtocol.length} protocol(s)</div>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>Current layout</div>
              <LabMap
                stationEquip={result.baseline.stationEquip}
                stationNames={result.baseline.stationNames}
                fixtures={result.baseline.fixtures}
                heatCounts={result.baseline.visitCounts}
                hoverSlot={hoverBefore} setHoverSlot={setHoverBefore}
              />
              <div style={{ marginTop: 8, fontSize: 11.5, fontFamily: MONO, color: C.muted }}>{result.baseline.totalTravelFt}ft walked across {result.baseline.perProtocol.length} protocol(s)</div>
            </div>
          </div>
          <MovesList result={result} />
        </>
      )}
    </div>
  );
}

function OptimalityBanner({ result }) {
  const n = result.relevantStationCount;
  return (
    <div style={{
      marginBottom: 12, fontSize: 12, padding: "8px 12px", borderRadius: 8,
      color: result.optimal ? C.green : C.amber,
      background: result.optimal ? "#1a2e1e" : "#2e2610",
      border: `1px solid ${result.optimal ? C.green : C.amber}`,
    }}>
      {result.optimal
        ? (n === 0
          ? "Exact Search: These protocols never touch a movable bench, so the current layout is already optimal — nothing to rearrange."
          : "Exact Search: Optimized layout found")
        : `Best Effort Result: These protocols reference ${n} stations -- too many for an exact search. This layout is improved but not optimized.`}
    </div>
  );
}

function SummaryRow({ result }) {
  const cardStyle = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", minWidth: 140 };
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>Current</div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.text }}>{result.baseline.totalTravelFt}ft</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>Optimized</div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: C.teal }}>{result.best.totalTravelFt}ft</div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>Saved</div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: result.improvementFt > 0 ? C.green : C.muted }}>
          {result.improvementFt}ft {result.baseline.totalTravelFt > 0 && `(${result.improvementPct}%)`}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase", letterSpacing: .5 }}>Total Moves</div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: result.totalMoves > 0 ? C.text : C.muted }}>{result.totalMoves}</div>
      </div>
    </div>
  );
}

function MovesList({ result }) {
  if (result.moves.length === 0 && !result.anchorChanged) {
    return <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>The current layout already looks best for these protocols — no moves recommended.</div>;
  }
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 6 }}>Recommended moves</div>
      {result.anchorChanged && (
        <div style={{ fontSize: 12, color: C.teal, marginBottom: 8 }}>
          Move the sharps bin / recycling bin / biohazard waste group to {ANCHOR_LABEL[result.best.anchorKey]} (they stay in the same order relative to each other).
        </div>
      )}
      {result.moves.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, maxWidth: 500 }}>
          <thead><tr><th style={TH_STYLE}>Station</th><th style={TH_STYLE}>From</th><th style={TH_STYLE}>To</th></tr></thead>
          <tbody>
            {result.moves.map((m) => (
              <tr key={m.name}>
                <td style={{ padding: "4px 8px", color: C.text }}>{m.name}</td>
                <td style={{ padding: "4px 8px", color: C.red, fontFamily: MONO, fontWeight: 700 }}>{m.from}</td>
                <td style={{ padding: "4px 8px", color: C.green, fontFamily: MONO, fontWeight: 700 }}>{m.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
