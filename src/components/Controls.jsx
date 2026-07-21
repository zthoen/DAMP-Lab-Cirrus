import React from "react";
import { C, MONO, TH_STYLE } from "../constants.js";
import { STATION_NAME } from "../data.js";

export function NumField({ label, value, min, max, step = 1, onChange, width = 60, suffix }) {
  return (
    <label style={{ fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
      {label}
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => { let v = Number(e.target.value); if (isNaN(v)) v = min; v = Math.max(min, Math.min(max, v)); onChange(v); }}
        style={{ width, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 6px", fontFamily: MONO, fontSize: 13 }} />
      {suffix && <span style={{ fontFamily: MONO, fontSize: 11 }}>{suffix}</span>}
    </label>
  );
}

// The "N issue(s) found" red-bordered box under a paste textarea — shared by
// the Equipment Input and Protocol Visualizer tabs, which otherwise had two
// copies of the exact same markup for reporting per-row parse errors.
export function ErrorList({ errors }) {
  if (errors.length === 0) return null;
  return (
    <div style={{ marginTop: 10, background: "#3a2431", border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.red, marginBottom: 4 }}>{errors.length} issue(s) found</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.text }}>
        {errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  );
}

// The #/Station/Equipment/Type table used inside every per-step or per-protocol
// card (Protocol Generator's ProtocolCard, Protocol Visualizer's StepCard) —
// `rows` is `{ index, stationId, equipment, action }[]`; `stationId` may be
// null/undefined for a substep whose equipment couldn't be resolved to a
// station, which renders as an unresolved "?" in red instead of a station name.
export function StepTable({ rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr><th style={TH_STYLE}>#</th><th style={TH_STYLE}>Station</th><th style={TH_STYLE}>Equipment</th><th style={{ ...TH_STYLE, textAlign: "right" }}>Type</th></tr></thead>
      <tbody>
        {rows.map((row, i) => {
          const stationName = row.stationId ? STATION_NAME[row.stationId] : null;
          return (
            <tr key={i} style={{ borderTop: i ? `1px solid ${C.panel2}` : "none" }}>
              <td style={{ padding: "4px 6px", color: C.muted, fontFamily: MONO }}>{row.index}</td>
              <td style={{ padding: "4px 6px", color: stationName ? C.teal : C.red, fontWeight: 700, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={stationName || "unresolved"}>{stationName || "?"}</td>
              <td style={{ padding: "4px 6px", color: C.text, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.equipment}>{row.equipment}</td>
              <td style={{ padding: "4px 6px", textAlign: "right", color: row.action === "Write" ? C.amber : C.blue, fontFamily: MONO, fontSize: 11 }}>{row.action}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
