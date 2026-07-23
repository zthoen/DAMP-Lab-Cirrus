import { BENCH_DIST_FT, PIPETTE_STATIONS, walkMinutesForFt } from "./data.js";
import { parseProtocol, PIPETTE_LABEL } from "./protocolImport.js";

// The first committed interval on `station` that overlaps [start, end), or
// null if the station is free the whole time.
function firstConflict(committed, station, start, end) {
  const intervals = committed.get(station);
  if (!intervals) return null;
  return intervals.find((iv) => start < iv.end && iv.start < end) || null;
}

// Nearest-first ordering, same tie-break as protocolImport.js's own
// `nearestStation`: with no previous station yet (the protocol's very first
// substep), the pool's own order is kept rather than sorted.
function orderByDistance(candidates, from, distTable) {
  if (!from) return candidates;
  return [...candidates].sort((a, b) => distTable[from][a] - distTable[from][b]);
}

/* Builds one protocol's timeline for a specific candidate whole-protocol
   start time (`startMin`), choosing each substep's station in order. A
   substep whose Equipment cell reads "Pipette" isn't tied to one bench —
   `parseProtocol` already resolves it to the *nearest* pipette-eligible
   station for the formatted view, but here it's re-resolved against the
   whole `pipetteStations` pool at scheduling time, since a different bench
   from that pool can substitute if the nearest one is busy. Every other
   substep keeps parseProtocol's own single resolved `station` — only a
   Pipette step has more than one bench that could do the job, so only a
   Pipette step ever gets rerouted around a conflict instead of forcing the
   whole protocol to wait for it.

   For each substep, the pool (just `[sub.station]` for anything that isn't
   "Pipette") is tried nearest-first; the first candidate that's actually
   free at the time it would be used is taken with no further consequence.
   If every candidate is busy, building stops right there and reports the
   candidate that would free up *soonest* (`conflict`, chosen by minimum
   delay across the whole pool, so a forced wait is always as short as
   possible) instead of continuing to build past it — the caller is going to
   retry with a larger `startMin` anyway, and everything from this substep
   onward would need to be recomputed against the new time regardless. */
function buildTimelineAt(steps, distTable, pipetteStations, committed, startMin) {
  const events = [];
  const swaps = [];
  let t = 0;
  let prevStation = null;

  for (const step of steps) {
    for (const sub of step.substeps) {
      const isPipette = PIPETTE_LABEL.test(sub.equipment);
      const candidates = isPipette ? pipetteStations : (sub.station ? [sub.station] : []);
      if (candidates.length === 0) continue;

      const ordered = orderByDistance(candidates, prevStation, distTable);
      const preferred = ordered[0];
      let chosen = null, chosenStart = 0, chosenEnd = 0;
      let bestConflict = null; // the candidate needing the smallest delay, among those tried

      for (const cand of ordered) {
        const travel = prevStation ? walkMinutesForFt(distTable[prevStation][cand]) : 0;
        const relStart = t + travel, relEnd = relStart + (sub.minutes || 0);
        const absStart = startMin + relStart, absEnd = startMin + relEnd;
        const blocking = firstConflict(committed, cand, absStart, absEnd);
        if (!blocking) { chosen = cand; chosenStart = relStart; chosenEnd = relEnd; break; }
        const delta = blocking.end - absStart;
        if (!bestConflict || delta < bestConflict.delta) {
          bestConflict = {
            station: cand, delta, withProtocolIndex: blocking.protocolIndex,
            pushedTo: blocking.end, atMinute: absStart, isPipette,
          };
        }
      }

      if (chosen == null) return { events, swaps, durationMin: t, conflict: bestConflict };

      // The preferred (nearest) candidate was busy but a Pipette step could
      // route around it to a different bench with no delay at all — still a
      // real conflict that "arose," just one resolved by rerouting instead
      // of waiting.
      if (chosen !== preferred) swaps.push({ station: preferred, resolvedStation: chosen, delta: 0, isPipette: true });

      events.push({ label: sub.label, equipment: sub.equipment, station: chosen, action: sub.action, start: chosenStart, end: chosenEnd, isPipette });
      t = chosenEnd;
      prevStation = chosen;
    }
  }
  return { events, swaps, durationMin: t, conflict: null };
}

/* Places one protocol's timeline against `committed` (every higher-priority
   protocol's own already-placed intervals), starting from candidate time 0
   and re-building the whole timeline from scratch each time a substep can't
   be resolved without a delay — directly implementing "detect a conflict,
   flag it, push forward, recheck" as a convergent loop: `buildTimelineAt`
   always advances `startMin` by a strictly positive amount that clears the
   specific collision it just found, and a full rebuild at the new,
   later `startMin` re-validates everything, including substeps that were
   already fine, rather than assuming they still are. */
function placeProtocol(steps, distTable, pipetteStations, committed) {
  let startMin = 0;
  const delays = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const built = buildTimelineAt(steps, distTable, pipetteStations, committed, startMin);
    if (!built.conflict) {
      return { events: built.events, durationMin: built.durationMin, startMin, conflicts: [...delays, ...built.swaps] };
    }
    delays.push({ ...built.conflict, resolvedStation: built.conflict.station });
    startMin += built.conflict.delta;
  }
}

/* Schedules a set of protocols (same Step/Substep/Equipment/Time format as
   the Protocol Visualizer, plus the 4th "Time (minutes)" column) onto a
   shared timeline of station usage. Protocols are scheduled in the order
   they're passed — that order *is* their priority, 1 (first) through N
   (last), highest to lowest (see ProtocolSchedulerTab.jsx's numbered paste
   boxes): the first protocol always starts at time 0 and never moves for
   anyone; each later protocol is placed as early as possible without
   colliding with any equipment a higher-priority protocol already claimed,
   only ever being delayed (or, for a Pipette step, rerouted to a different
   bench) itself — never delaying an already-scheduled, higher-priority
   protocol.

   Each protocol's own step/substep sequence and per-substep duration
   ("used the entirety of the time as labeled") are never reordered or split
   — the only things scheduling can change are *when* a protocol as a whole
   begins and, for a Pipette step specifically, *which* pipette-eligible
   bench it lands on (see buildTimelineAt/placeProtocol above).

   `distTable`/`pipetteStations` default to the real, current floor
   (BENCH_DIST_FT/PIPETTE_STATIONS), same as protocolImport.js's
   parseProtocol.

   Returns `{ schedule, warnings }`. `schedule` is one entry per non-blank
   protocol, in priority order: `{ index, name, startMin, endMin,
   durationMin, stationsVisited, path, events, conflicts, errors }` —
   `events`/`path` are already shifted onto the shared timeline (absolute
   minutes, not relative to the protocol's own start). `conflicts` is every
   collision that had to be resolved to place this protocol, in the order
   found — a whole-protocol delay (`delta > 0`) or a same-time Pipette
   reroute (`delta === 0`, `isPipette: true`) — empty if the protocol never
   ran into one; its length is what `ProtocolSchedulerTab.jsx` reports as
   "Conflicts Resolved." `errors` is parseProtocol's own per-row error list. */
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
    const { events, durationMin, startMin, conflicts } = placeProtocol(parsed.steps, distTable, pipetteStations, committed);

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
