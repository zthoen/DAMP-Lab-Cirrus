import React from "react";
import { C, MONO } from "../constants.js";

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
