import React, { useState } from "react";
import { C, MONO } from "../constants.js";
import { NumField } from "./Controls.jsx";
import { generateProtocols } from "../protocolGen.js";
import LabMap from "./LabMap.jsx";

export default function ProtocolGeneratorTab({ labData }) {
  const [count, setCount] = useState(8);
  const [minSteps, setMinSteps] = useState(4);
  const [maxSteps, setMaxSteps] = useState(8);
  const [seed, setSeed] = useState(1234);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);

  const equipCount = Object.keys(labData.equipToStations).length;
  const generate = () => {
    const out = generateProtocols(labData.equipToStations, { count, minSteps: Math.min(minSteps, maxSteps), maxSteps, seed });
    setResult(out);
    setSelectedId(out.protocols[0]?.id ?? null);
  };

  const selected = result?.protocols.find((p) => p.id === selectedId) || null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <NumField label="protocols" value={count} min={1} max={50} onChange={setCount} width={54} />
        <NumField label="min steps" value={minSteps} min={2} max={20} onChange={setMinSteps} width={54} />
        <NumField label="max steps" value={maxSteps} min={2} max={20} onChange={setMaxSteps} width={54} />
        <NumField label="seed" value={seed} min={0} max={999999} onChange={setSeed} width={80} />
        <button className="lbtn primary" disabled={equipCount === 0} onClick={generate}>Generate</button>
        {equipCount === 0 && <span style={{ fontSize: 11.5, color: C.amber }}>Load equipment on the Lab Builder tab first.</span>}
      </div>

      {result && result.warnings.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 11.5, color: C.amber }}>{result.warnings.join(" ")}</div>
      )}

      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.protocols.map((p) => (
              <ProtocolCard key={p.id} p={p} selected={p.id === selectedId} onSelect={() => setSelectedId(p.id)} />
            ))}
          </div>
          <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
            <LabMap
              stationEquip={labData.stationEquip}
              hoverSlot={hoverSlot} setHoverSlot={setHoverSlot}
              highlightPath={selected ? selected.steps.map((s) => s.station) : []}
            />
            {selected && (
              <div style={{ marginTop: 8, fontSize: 11.5, fontFamily: MONO, color: C.muted }}>
                {selected.id} · {selected.steps.length} steps · {selected.stationsVisited} benches visited · {selected.travelFt}ft walked
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProtocolCard({ p, selected, onSelect }) {
  const th = { textAlign: "left", padding: "3px 8px", color: C.muted, fontFamily: MONO, fontWeight: 700, fontSize: 9.5, textTransform: "uppercase", letterSpacing: .4, borderBottom: `1px solid ${C.border}` };
  return (
    <div onClick={onSelect} style={{ cursor: "pointer", background: C.panel, border: `1px solid ${selected ? C.teal : C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", background: C.panel2, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: MONO }}>{p.id}</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: MONO }}>{p.steps.length} steps · {p.stationsVisited} benches · {p.travelFt}ft walked</span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr><th style={th}>#</th><th style={th}>Station</th><th style={th}>Equipment</th><th style={{ ...th, textAlign: "right" }}>Type</th></tr></thead>
          <tbody>
            {p.steps.map((s, i) => (
              <tr key={i} style={{ borderTop: i ? `1px solid ${C.panel2}` : "none" }}>
                <td style={{ padding: "4px 6px", color: C.muted, fontFamily: MONO }}>{i + 1}</td>
                <td style={{ padding: "4px 6px", color: C.teal, fontFamily: MONO, fontWeight: 700 }}>{s.station}</td>
                <td style={{ padding: "4px 6px", color: C.text, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.equipment}>{s.equipment}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: s.action === "Write" ? C.amber : C.blue, fontFamily: MONO, fontSize: 11 }}>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
