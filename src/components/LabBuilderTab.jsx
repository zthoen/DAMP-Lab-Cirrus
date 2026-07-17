import React, { useState } from "react";
import { C, MONO } from "../constants.js";
import { STATION_IDS } from "../data.js";
import LabMap from "./LabMap.jsx";

const PLACEHOLDER = `Equipment\tStation Name\tStation Location
Opentrons Flex Robot\tAutomation Prep\tA1
Biorad Gel Doc XR+ Imaging System\tGel Imaging\tC3
New Brunswick Innova Incubator Shaker\tMED Prep\tF1, F2, F3
Applied Biosystems 2720 Thermal Cycler\tDNA Prep\tD2`;

export default function LabBuilderTab({ rawTable, setRawTable, labData }) {
  const [hoverSlot, setHoverSlot] = useState(null);
  const equipCount = Object.keys(labData.equipToStations).length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
      <div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>
          Paste a table from your spreadsheet: <b>Equipment</b>, <b>Station Name</b>, and{" "}
          <b>Station Location</b> (a bench code A1&ndash;H3, or one of the fixed fixtures &mdash; SHARPS, RECYCLE,
          WASTE, SINK, CONSUM). If one piece of equipment lives at several stations, list them on one row
          separated by commas (<code>F1, F2, F3</code>) or give it its own row per station.
        </div>
        <textarea
          value={rawTable}
          onChange={(e) => setRawTable(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          style={{
            width: "100%", height: 300, background: C.bg, color: C.text, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 10, fontFamily: MONO, fontSize: 12, resize: "vertical", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, fontFamily: MONO, color: C.muted }}>
          <span>{equipCount} equipment</span>
          <span>{Object.keys(labData.stationEquip).length}/{STATION_IDS.length} stations mapped</span>
        </div>
        {labData.errors.length > 0 && (
          <div style={{ marginTop: 10, background: "#3a2431", border: `1px solid ${C.red}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.red, marginBottom: 4 }}>{labData.errors.length} issue(s) found</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: C.text }}>
              {labData.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>
      <LabMap stationEquip={labData.stationEquip} stationNames={labData.stationNames} hoverSlot={hoverSlot} setHoverSlot={setHoverSlot} />
    </div>
  );
}
