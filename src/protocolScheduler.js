import { BENCH_DIST_FT, PIPETTE_STATIONS, walkMinutesForFt } from "./data.js";
import { parseProtocol } from "./protocolImport.js";

// A protocol's own fixed, schedule-independent timeline: the ordered list of
// station-occupancy intervals it would produce if run start-to-finish with no
// waiting, starting at relative time 0 — travel time (walkMinutesForFt over
// BENCH_DIST_FT) between consecutive resolved stations, plus each substep's
// own `minutes` occupying its station. A substep whose equipment never
// resolved to a station (same as protocolImport.js's `path`) contributes
// neither travel nor an occupancy interval and is skipped entirely, exactly
// like `path`'s `.filter(Boolean)`.
function buildTimeline(steps, distTable) {
  const events = [];
  let t = 0;
  let prevStation = null;
  for (const step of steps) {
    for (const sub of step.substeps) {
      if (!sub.station) continue;
      if (prevStation) t += walkMinutesForFt(distTable[prevStation][sub.station]);
      const start = t;
      const end = t + (sub.minutes || 0);
      events.push({ label: sub.label, equipment: sub.equipment, station: sub.station, action: sub.action, start, end });
      t = end;
      prevStation = sub.station;
    }
  }
  return { events, durationMin: t };
}

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

/* Finds the earliest start time >= 0 for a protocol's own relative `events`
   such that, once shifted by that start, none of its station-occupancy
   intervals overlaps any interval a higher-priority protocol already
   committed to that same station — directly implementing the "detect a
   conflict, flag where it happens, push forward, recheck" cycle: each pass
   scans events in order for the first one that still collides against the
   current candidate start (`conflict`), records it, and advances the
   candidate just far enough to clear that specific collision (to the end of
   the interval it collided with). Because every advance strictly clears the
   interval that caused it and the candidate only ever moves later, this
   always terminates — the same station's committed intervals can't be
   revisited in a way that grows the count of remaining conflicts, so the
   loop can run at most once per (event, committed interval) pair that could
   ever collide. Returns `{ start, conflicts }` — `conflicts` is the resolved
   log of every collision that had to be pushed past, in the order found, so
   the caller can show *why* a protocol started later than its own
   would-be-uninterrupted time. */
function earliestStart(events, committed) {
  let candidate = 0;
  const conflicts = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let hit = null;
    for (const ev of events) {
      const intervals = committed.get(ev.station);
      if (!intervals) continue;
      const start = candidate + ev.start, end = candidate + ev.end;
      const iv = intervals.find((c) => overlaps(start, end, c.start, c.end));
      if (iv) { hit = { ev, start, iv }; break; }
    }
    if (!hit) return { start: candidate, conflicts };
    conflicts.push({ station: hit.ev.station, atMinute: hit.start, withProtocolIndex: hit.iv.protocolIndex, pushedTo: hit.iv.end });
    candidate += hit.iv.end - hit.start;
  }
}

/* Schedules a set of protocols (same Step/Substep/Equipment/Time format as
   the Protocol Visualizer, plus the 4th "Time (minutes)" column) onto a
   shared timeline of station usage. Protocols are scheduled in the order
   they're passed — that order *is* the priority order (see App.jsx's
   Protocol Scheduler tab): the first protocol always starts at time 0 and
   never moves for anyone; each later protocol is placed as early as possible
   without colliding with any equipment a higher-priority protocol already
   claimed, only ever being delayed itself — never delaying an
   already-scheduled, higher-priority protocol. That's a direct, deterministic
   realization of "detect conflicts, push forward, repeat until none exist,"
   scoped one protocol at a time against a timeline of intervals that's only
   ever added to (see earliestStart above) — it always converges, and a
   protocol's own priority is respected exactly because it's fixed before any
   lower-priority protocol is ever considered.

   Each protocol's own step/substep sequence and per-substep duration
   ("used the entirety of the time as labeled") are never reordered or split
   — the only thing scheduling ever changes is *when* a protocol as a whole
   begins.

   `distTable`/`pipetteStations` default to the real, current floor
   (BENCH_DIST_FT/PIPETTE_STATIONS), same as protocolImport.js's
   parseProtocol.

   Returns `{ schedule, warnings }`. `schedule` is one entry per non-blank
   protocol, in priority order: `{ index, name, startMin, endMin,
   durationMin, stationsVisited, path, events, conflicts, errors }` —
   `events`/`path` are already shifted onto the shared timeline (absolute
   minutes, not relative to the protocol's own start), `conflicts` is the log
   from earliestStart (empty if the protocol never had to wait), and `errors`
   is parseProtocol's own per-row error list. */
export function scheduleProtocols(equipToStations, protocolTexts, distTable = BENCH_DIST_FT, pipetteStations = PIPETTE_STATIONS) {
  const cleanTexts = (protocolTexts || []).map((t) => t || "").filter((t) => t.trim());

  const warnings = [];
  if (Object.keys(equipToStations || {}).length === 0) warnings.push("No equipment loaded — build the lab map first.");
  if (cleanTexts.length === 0) warnings.push("No protocols pasted — nothing to schedule.");
  if (warnings.length > 0) return { schedule: [], warnings };

  // station id -> committed intervals ({ start, end, protocolIndex }), built
  // up one protocol at a time, in priority order.
  const committed = new Map();

  const schedule = cleanTexts.map((raw, index) => {
    const parsed = parseProtocol(raw, equipToStations, distTable, pipetteStations);
    const { events, durationMin } = buildTimeline(parsed.steps, distTable);
    const { start: startMin, conflicts } = earliestStart(events, committed);

    const shiftedEvents = events.map((ev) => ({ ...ev, start: startMin + ev.start, end: startMin + ev.end }));
    for (const ev of shiftedEvents) {
      const list = committed.get(ev.station) || [];
      list.push({ start: ev.start, end: ev.end, protocolIndex: index });
      committed.set(ev.station, list);
    }

    return {
      index,
      name: parsed.name || `Protocol ${index + 1}`,
      startMin, endMin: startMin + durationMin, durationMin,
      stationsVisited: new Set(shiftedEvents.map((e) => e.station)).size,
      path: shiftedEvents.map((e) => e.station),
      events: shiftedEvents,
      conflicts,
      errors: parsed.errors,
    };
  });

  return { schedule, warnings };
}
