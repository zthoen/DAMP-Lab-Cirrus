import React, { useState } from "react";
import { C, MONO, TH_STYLE } from "../constants.js";
import { NumField } from "./Controls.jsx";
import { scheduleProtocols } from "../protocolScheduler.js";
import { STATION_NAME } from "../data.js";
import { usePersistedState } from "../usePersistedState.js";

const PLACEHOLDER = `Overnight Culture Prep
Step\tSubstep\tEquipment\tTime
1. Prepare Reagents\t1.1\tOpentrons Flex Robot\t15
\t1.2\tNanoDrop 2000\t5
2. Run Gel\t2.1\tBiorad Gel Doc XR+ Imaging System\t20`;

// Protocol text is remembered only for this browser session, same as the Lab
// Optimizer's paste boxes.
const SESSION_KEY = "damp-lab-scheduler-protocols";
const deserializeTexts = (raw) => {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : ["", ""];
};

// One color per protocol row, cycled — lets a Gantt bar and its table row be
// visually matched at a glance without needing a legend.
const ROW_COLORS = [C.teal, C.green, C.amber, C.blue, C.sage, C.red];
const colorFor = (i) => ROW_COLORS[i % ROW_COLORS.length];

const fmtMin = (m) => (Math.round(m * 10) / 10).toString();

export default function ProtocolSchedulerTab({ labData }) {
  const [texts, setTexts] = usePersistedState(sessionStorage, SESSION_KEY, ["", ""], {
    serialize: JSON.stringify, deserialize: deserializeTexts,
  });
  const [result, setResult] = useState(null);

  const count = texts.length;
  const setCount = (n) => setTexts((prev) => {
    const next = prev.slice(0, n);
    while (next.length < n) next.push("");
    return next;
  });
  const setTextAt = (i, value) => setTexts((prev) => prev.map((t, idx) => (idx === i ? value : t)));

  const equipCount = Object.keys(labData.equipToStations).length;
  const pastedCount = texts.filter((t) => t.trim()).length;
  const schedule = () => setResult(scheduleProtocols(labData.equipToStations, texts));

  const maxEnd = result?.schedule.length ? Math.max(...result.schedule.map((p) => p.endMin), 1) : 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <NumField label="protocols" value={count} min={1} max={20} onChange={setCount} width={54} />
        <button className="lbtn primary" disabled={equipCount === 0 || pastedCount === 0} onClick={schedule}>Schedule</button>
        {equipCount === 0 && <span style={{ fontSize: 11.5, color: C.amber }}>Load equipment on the Equipment Input tab first.</span>}
        {equipCount > 0 && pastedCount === 0 && <span style={{ fontSize: 11.5, color: C.amber }}>Paste at least one protocol below.</span>}
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, maxWidth: 900 }}>
        Paste each protocol in Step/Substep/Equipment format, plus a 4th <b>Time</b> column giving how many
        minutes that substep uses its equipment for. The order you paste protocols in is their priority order,
        1 through {count} &mdash; 1 highest, {count} lowest: the first always starts at time 0 and never moves;
        each later protocol starts as early as it can, only ever getting delayed itself whenever it would
        otherwise need a station a higher-priority protocol is still using (walking between stations is assumed
        to take 5ft per second, and never occupies any equipment). A <b>Pipette</b> step is the one exception —
        with more than one bench able to do the job, a conflict on its usual bench first tries routing to a
        different pipette-eligible one before ever delaying the protocol. Each protocol runs start-to-finish
        once it begins &mdash; only its start time (and, for a Pipette step, which bench it lands on) ever moves.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(2, count)}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {texts.map((t, i) => (
          <div key={i}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 4, fontFamily: MONO }}>
              Protocol {i + 1} <span style={{ color: C.teal }}>
                (Priority {i + 1}{i === 0 ? " — Highest" : i === count - 1 ? " — Lowest" : ""})
              </span>
            </div>
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

      {result && result.schedule.length > 0 && (
        <>
          <ScheduleTable schedule={result.schedule} />
          <Gantt schedule={result.schedule} maxEnd={maxEnd} />
        </>
      )}
    </div>
  );
}

function ScheduleTable({ schedule }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, maxWidth: 900, marginBottom: 18 }}>
      <thead>
        <tr>
          <th style={TH_STYLE}>Priority</th>
          <th style={TH_STYLE}>Protocol</th>
          <th style={TH_STYLE}>Wait Time (min)</th>
          <th style={TH_STYLE}>Time to Complete (min)</th>
          <th style={TH_STYLE}>Conflicts Resolved</th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((p) => (
          <tr key={p.index} style={{ borderTop: `1px solid ${C.panel2}` }}>
            <td style={{ padding: "6px 8px", fontFamily: MONO, color: C.muted }}>{p.index + 1}</td>
            <td style={{ padding: "6px 8px" }}>
              <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: colorFor(p.index), marginRight: 7 }} />
              <span style={{ color: C.text, fontWeight: 600 }}>{p.name}</span>
            </td>
            <td style={{ padding: "6px 8px", fontFamily: MONO, color: C.teal, fontWeight: 700 }}>{fmtMin(p.startMin)}</td>
            <td style={{ padding: "6px 8px", fontFamily: MONO, color: C.text }}>{fmtMin(p.endMin)}</td>
            <td style={{ padding: "6px 8px", fontFamily: MONO, color: p.conflicts.length > 0 ? C.amber : C.text }}>{p.conflicts.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Rounds a raw time span up to a "nice" gridline step (1/2/5/10/15/20/30/60/
// 120/240/480 minutes) so the axis never shows an awkward number of ticks
// regardless of how long the scheduled protocols run.
const NICE_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 240, 480];
function niceStep(maxEnd, targetTicks = 8) {
  const raw = maxEnd / targetTicks;
  return NICE_STEPS.find((s) => s >= raw) || NICE_STEPS[NICE_STEPS.length - 1];
}

// Fixed width of the row-label column (protocol name) that sits to the left
// of every Gantt row, axis included (an empty cell there keeps the axis's
// ticks aligned with the timeline track below it, not the labels).
const LABEL_COL = 130;

function Gantt({ schedule, maxEnd }) {
  const step = niceStep(maxEnd);
  const axisMax = Math.ceil(maxEnd / step) * step || step;
  const ticks = [];
  for (let m = 0; m <= axisMax; m += step) ticks.push(m);
  const pct = (m) => `${(m / axisMax) * 100}%`;

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>Station-usage timeline</div>
      <div style={{ maxWidth: 900, overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `${LABEL_COL}px 1fr`, gap: 8, marginBottom: 4, minWidth: 480 + LABEL_COL }}>
          <div />
          <div style={{ position: "relative", height: 18 }}>
            {ticks.map((m) => (
              <div key={m} style={{ position: "absolute", left: pct(m), fontSize: 10, color: C.muted, fontFamily: MONO, transform: m === axisMax ? "translateX(-100%)" : "none" }}>
                {m}m
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 480 + LABEL_COL }}>
          {schedule.map((p) => (
            <div key={p.index} style={{ display: "grid", gridTemplateColumns: `${LABEL_COL}px 1fr`, gap: 8, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                <span style={{ flex: "0 0 auto", display: "inline-block", width: 9, height: 9, borderRadius: 2, background: colorFor(p.index) }} />
                <span style={{ fontSize: 11.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>
                  {p.name}
                </span>
              </div>
              <div style={{ position: "relative", height: 30, background: C.panel2, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                {ticks.map((m) => (
                  <div key={m} style={{ position: "absolute", left: pct(m), top: 0, bottom: 0, width: 1, background: C.border, opacity: 0.6 }} />
                ))}
                {p.events.map((ev, i) => (
                  <div
                    key={i}
                    title={`${ev.label} — ${fmtMin(ev.end - ev.start)} min`}
                    style={{
                      position: "absolute", top: 4, bottom: 4,
                      left: pct(ev.start), width: `calc(${pct(ev.end)} - ${pct(ev.start)})`,
                      minWidth: 8, background: colorFor(p.index), borderRadius: 8, opacity: 0.85,
                      display: "flex", alignItems: "center", overflow: "hidden",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#0a0a0a", fontFamily: MONO, fontWeight: 700, padding: "0 3px", whiteSpace: "nowrap" }}>
                      {STATION_NAME[ev.station] || ev.station}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
