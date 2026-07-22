import React, { useState } from "react";
import { C, MONO } from "../constants.js";
import { NumField, StepTable } from "./Controls.jsx";
import { generateProtocols } from "../protocolGen.js";
import LabMap from "./LabMap.jsx";

const FULL_KEY = "__FULL__";

export default function ProtocolGeneratorTab({ labData }) {
  const [count, setCount] = useState(8);
  const [minSteps, setMinSteps] = useState(10);
  const [maxSteps, setMaxSteps] = useState(30);
  const [seed, setSeed] = useState(1234);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStepKey, setSelectedStepKey] = useState(FULL_KEY);
  const [hoverSlot, setHoverSlot] = useState(null);

  const equipCount = Object.keys(labData.equipToStations).length;
  const generate = () => {
    const out = generateProtocols(labData.equipToStations, { count, minSteps: Math.min(minSteps, maxSteps), maxSteps, seed });
    setResult(out);
    setSelectedId(out.protocols[0]?.id ?? null);
    setSelectedStepKey(FULL_KEY);
  };

  // Picking a different protocol always starts back at that protocol's own
  // Full Protocol view — a step number selected under the *previous* protocol
  // has no meaning here.
  const selectProtocol = (id) => { setSelectedId(id); setSelectedStepKey(FULL_KEY); };

  const selected = result?.protocols.find((p) => p.id === selectedId) || null;
  const selectedStepIndex = selected && selectedStepKey !== FULL_KEY ? selected.steps.findIndex((s) => s.number === selectedStepKey) : -1;
  const selectedStep = selectedStepIndex === -1 ? null : selected.steps[selectedStepIndex];
  const highlightPath = !selected ? [] : (selectedStepKey === FULL_KEY ? selected.fullPath : (selectedStep ? selectedStep.path : []));

  // Same rule as the Protocol Visualizer: only while a single step is
  // selected (never "Full Protocol"), and only that step's own link out.
  const stepLinks = selected && selectedStepIndex >= 0 && selectedStepIndex < selected.stepLinks.length ? [selected.stepLinks[selectedStepIndex]] : [];

  const handleStepComplete = () => {
    if (!selected) return;
    const next = selected.steps[selectedStepIndex + 1];
    if (next) setSelectedStepKey(next.number);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <NumField label="protocols" value={count} min={1} max={50} onChange={setCount} width={54} />
        <NumField label="min substeps" value={minSteps} min={2} max={30} onChange={setMinSteps} width={54} />
        <NumField label="max substeps" value={maxSteps} min={2} max={30} onChange={setMaxSteps} width={54} />
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
              <ProtocolCard
                key={p.id} p={p}
                selected={p.id === selectedId} onSelect={() => selectProtocol(p.id)}
                stepKey={p.id === selectedId ? selectedStepKey : null}
                onSelectStep={setSelectedStepKey}
              />
            ))}
          </div>
          <div style={{ position: "sticky", top: 12, alignSelf: "start" }}>
            <LabMap
              stationEquip={labData.stationEquip}
              hoverSlot={hoverSlot} setHoverSlot={setHoverSlot}
              highlightPath={highlightPath}
              stepLinks={stepLinks}
              onStepComplete={handleStepComplete}
            />
            {selected && (
              <div style={{ marginTop: 8, fontSize: 11.5, fontFamily: MONO, color: C.muted }}>
                {selectedStepKey === FULL_KEY
                  ? `${selected.id} · ${selected.steps.length} steps · ${selected.fullStationsVisited} benches visited · ${selected.fullTravelFt}ft walked`
                  : `${selected.id}, Step ${selectedStep.number}: ${selectedStep.name} · ${selectedStep.substeps.length} substeps · ${selectedStep.stationsVisited} benches visited · ${selectedStep.travelFt}ft walked`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProtocolCard({ p, selected, onSelect, stepKey, onSelectStep }) {
  const substepCount = p.steps.reduce((n, s) => n + s.substeps.length, 0);
  return (
    <div style={{ background: C.panel, border: `1px solid ${selected ? C.teal : C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div
        onClick={onSelect}
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", background: C.panel2, borderBottom: selected ? `1px solid ${C.border}` : "none" }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: MONO }}>{p.id}</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: MONO }}>{p.steps.length} steps · {substepCount} substeps · {p.fullStationsVisited} benches · {p.fullTravelFt}ft walked</span>
      </div>
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10 }}>
          <div
            onClick={() => onSelectStep(FULL_KEY)}
            style={{ cursor: "pointer", background: C.bg, border: `1px solid ${stepKey === FULL_KEY ? C.teal : C.border}`, borderRadius: 8, padding: "8px 10px" }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, fontFamily: MONO }}>Full Protocol</div>
            <div style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, marginTop: 2 }}>
              {p.steps.length} steps · {substepCount} substeps · {p.fullStationsVisited} benches · {p.fullTravelFt}ft walked
            </div>
          </div>
          {p.steps.map((s) => (
            <div key={s.number} onClick={() => onSelectStep(s.number)} style={{ cursor: "pointer", background: C.bg, border: `1px solid ${stepKey === s.number ? C.teal : C.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: C.text, fontFamily: MONO }}>Step {s.number}</span>
                <span style={{ fontSize: 11.5, color: C.text }}>{s.name}</span>
                <span style={{ fontSize: 10.5, color: C.muted, fontFamily: MONO, marginLeft: "auto" }}>{s.stationsVisited} benches · {s.travelFt}ft</span>
              </div>
              <div style={{ padding: "0 10px 8px" }}>
                <StepTable rows={s.substeps.map((sub) => ({ index: sub.label, stationId: sub.station, equipment: sub.equipment, action: sub.action }))} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
