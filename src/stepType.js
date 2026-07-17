// Equipment that produces a measurement or reading a technician has to record —
// everything else (centrifuges, shakers, incubators, ...) is treated as a Read
// step: you follow the instructions and run it, but there's nothing to write down.
const WRITE_KEYWORDS = [
  "nanodrop", "spectrophotometer", "spectrometer", "plate reader", "reader",
  "microscope", "balance", "scale", "ph meter", "sequencer", "imager", "imaging",
  "analyzer", "analyser", "scanner", "detector", "camera", "fluorometer",
  "qpcr", "gel doc", "densitometer", "flow cytometer", "cytometer",
];

export function classifyStepType(equipmentName) {
  const n = String(equipmentName || "").toLowerCase();
  return WRITE_KEYWORDS.some((k) => n.includes(k)) ? "Write" : "Read";
}
