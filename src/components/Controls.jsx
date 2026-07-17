import React from "react";
import { C, LC, MONO } from "../constants.js";

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

export function Dropdown({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 10px", fontSize: 13 }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function StatCard({ label, value, sub, color = C.text, light }) {
  const c = light ? LC : C;
  return (
    <div style={{ background: light ? LC.panel2 : C.panel2, border: `1px solid ${c.border}`, borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: light && color === C.text ? LC.text : color }}>{value}</div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: c.muted, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: c.muted, marginTop: 2, fontFamily: MONO }}>{sub}</div>}
    </div>
  );
}

// A small "i" info popover, extracted so setting rows can carry the same explain-on-
// click affordance the chart panels use. Pass `text` (string or node) for the body.
export function InfoDot({ text, light }) {
  const [open, setOpen] = React.useState(false);
  const c = light ? LC : C;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)} title="What is this?"
        style={{ width: 16, height: 16, borderRadius: "50%", border: `1px solid ${c.border}`, background: light ? LC.panel2 : C.panel2, color: c.muted, fontSize: 10, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: "14px", cursor: "pointer", padding: 0, textAlign: "center", verticalAlign: "middle" }}>
        i
      </button>
      {open && (
        <div style={{ position: "absolute", top: 20, left: 0, width: 250, background: light ? LC.panel2 : C.panel2, border: `1px solid ${c.border}`, borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.45, color: c.text, zIndex: 40, boxShadow: "0 4px 16px rgba(0,0,0,.45)" }}>
          {text}
        </div>
      )}
    </span>
  );
}

// Labeled range slider with a formatted value read-out, used throughout the
// simulation-settings panels so each slider stays compact and consistent.
export function Slider({ label, value, min, max, step = 1, onChange, fmt, width = 140, color = C.teal, valColor, active, hint, disabled }) {
  const shown = fmt ? fmt(value) : String(value);
  return (
    <label style={{ fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.45 : 1 }}>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: color, width }} />
      <span style={{ fontFamily: MONO, fontSize: 12.5, minWidth: 62, color: (active ?? true) ? (valColor || color) : C.muted }}>{shown}</span>
      {hint && <span style={{ fontSize: 10.5, color: C.muted, maxWidth: 240 }}>{hint}</span>}
    </label>
  );
}

// iOS-style on/off switch, used to enable each optional lab feature (financials,
// rework, consumables). Clicking anywhere on the label toggles it.
export function Toggle({ checked, onChange, label, hint, color = C.teal }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
      <span onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        style={{ width: 36, height: 20, borderRadius: 12, background: checked ? color : C.border, position: "relative", transition: ".15s", flexShrink: 0, display: "inline-block" }}>
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: ".15s" }} />
      </span>
      {label && <span style={{ color: checked ? C.text : C.muted, fontWeight: 600 }}>{label}</span>}
      {hint && <span style={{ fontSize: 10.5, color: C.muted }}>{hint}</span>}
    </label>
  );
}

// Collapsible settings group with a colored accent stripe. `right` renders in the header
// (e.g. a feature Toggle) and doesn't toggle the section when clicked. Keeps the crowded
// settings page navigable — related knobs live together and stay folded until needed.
export function Section({ title, subtitle, children, defaultOpen = false, right, accent = C.border, open: openProp, onToggle }) {
  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = openProp ?? openState;
  const toggle = () => (onToggle ? onToggle(!open) : setOpenState(o => !o));
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden", background: C.panel }}>
      <div onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: C.panel2, borderLeft: `3px solid ${accent}` }}>
        <span style={{ fontSize: 12, color: C.muted, width: 10 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: C.muted }}>{subtitle}</span>}
        {right && <div style={{ marginLeft: "auto" }} onClick={e => e.stopPropagation()}>{right}</div>}
      </div>
      {open && <div style={{ padding: "14px", borderTop: `1px solid ${C.border}` }}>{children}</div>}
    </div>
  );
}

// data-title carries the panel's plain-text title through to the "Save results"
// export, which uses it to name the saved chart image file. `noExport` keeps a panel
// on screen but out of that export (e.g. the interactive method-picker), by simply
// not tagging it with data-title.
export function Panel({ title, children, style, info, light, noExport }) {
  const [open, setOpen] = React.useState(false);
  const c = light ? LC : C;
  return (
    <div data-title={!noExport && typeof title === "string" ? title : undefined}
      style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, minWidth: 0, position: "relative", ...style }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${c.border}` }}>
        {/* invisible spacer mirrors the info button so the centered title stays truly centered */}
        {info && <div style={{ width: 17, flexShrink: 0 }} />}
        <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: c.text, fontWeight: 700, letterSpacing: .1, lineHeight: 1.35 }}>{title}</div>
        {info && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setOpen(o => !o)} title="What is this?"
              style={{ width: 17, height: 17, borderRadius: "50%", border: `1px solid ${c.border}`, background: light ? LC.panel2 : C.panel2, color: c.muted, fontSize: 10.5, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: "15px", cursor: "pointer", padding: 0, textAlign: "center" }}>
              i
            </button>
            {open && (
              <div style={{ position: "absolute", top: 21, right: 0, width: 230, background: light ? LC.panel2 : C.panel2, border: `1px solid ${c.border}`, borderRadius: 8, padding: 10, fontSize: 11, lineHeight: 1.4, color: c.text, zIndex: 30, boxShadow: "0 4px 16px rgba(0,0,0,.45)" }}>
                {info}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}