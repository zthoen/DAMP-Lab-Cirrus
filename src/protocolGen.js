import { mulberry32, randInt } from "./rng.js";
import { BENCH_DIST_FT, STATION_IDS, isFixtureId, PIPETTE_STATIONS } from "./data.js";
import { classifyStepType } from "./stepType.js";

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const FIXTURE_IDS = STATION_IDS.filter(isFixtureId);

// Every protocol opens with steps at some combination of these "prep" stations
// and closes with steps at some combination of these "cleanup" stations — see
// pickPoolSubset. Neither pool is ever touched by the random walk in between
// (see `reserved` below) — they're bookend-only territory.
const OPEN_POOL = ["GLASSWARE", "CONSUM1", "CONSUM2"];
const CLOSE_POOL = ["SINK", "WASTE", "SHARPS"];

// One equipment can live at several stations that aren't off-limits (see
// `avoid` below); return the one farthest from `from` (by the actual walking
// route, not a straight line — see routeDistanceFt in data.js) so picking that
// equipment actually forces a walk, not just a coin-flip.
function farthestStation(stations, from, avoid) {
  const usable = avoid ? stations.filter((s) => !avoid.has(s)) : stations;
  const pool = usable.length ? usable : stations;
  if (!from) return pool[0];
  return pool.reduce((best, s) => (BENCH_DIST_FT[from][s] > BENCH_DIST_FT[from][best] ? s : best), pool[0]);
}

function travelFtOfPath(path) {
  let ft = 0;
  for (let i = 1; i < path.length; i++) ft += BENCH_DIST_FT[path[i - 1]][path[i]];
  return Math.round(ft);
}

// Chunks a flat run of substeps into the same Step/Substep shape
// protocolImport.js parses a real pasted protocol into — a "Prep" step for the
// open-pool retrieval substeps (if any), a "Cleanup" step for the close-pool
// disposal substeps (if any), and the walk in between split into "Procedure"
// step(s) of a random size (2-4 substeps, drawn from the same seeded stream as
// everything else) rather than one single undifferentiated block. A protocol
// with no bookends at all (the coverage protocol, or one whose table has no
// equipment mapped to any pool station) is just "Procedure" chunks start to
// finish.
function groupIntoSteps(rng, flatSubsteps, openLen, closeLen) {
  const groups = [];
  let i = 0;
  if (openLen > 0) { groups.push({ name: "Prep", entries: flatSubsteps.slice(0, openLen) }); i = openLen; }

  const middleEnd = flatSubsteps.length - closeLen;
  const procedureChunks = [];
  while (i < middleEnd) {
    const size = Math.min(middleEnd - i, randInt(rng, 2, 4));
    procedureChunks.push(flatSubsteps.slice(i, i + size));
    i += size;
  }
  procedureChunks.forEach((entries, idx) => {
    groups.push({ name: procedureChunks.length > 1 ? `Procedure ${idx + 1}` : "Procedure", entries });
  });

  if (closeLen > 0) groups.push({ name: "Cleanup", entries: flatSubsteps.slice(middleEnd) });

  return groups.map((g, idx) => {
    const number = idx + 1;
    const substeps = g.entries.map((e, j) => ({ label: `${number}.${j + 1}`, ...e }));
    const path = substeps.map((s) => s.station);
    return { number, name: g.name, substeps, path, stationsVisited: new Set(path).size, travelFt: travelFtOfPath(path) };
  });
}

// Groups a protocol's flat substep sequence into Steps (see groupIntoSteps),
// then derives the whole-protocol totals the same way protocolImport.js does:
// fullPath/fullStationsVisited/fullTravelFt over the single concatenated
// route (not summed from each step's own smaller total, so it also counts the
// walk from one step's last station to the next step's first), and stepLinks
// — one [lastStationOfStep, firstStationOfNextStep] pair per step boundary —
// for LabMap.jsx's dashed hand-off overlay.
function asProtocol(id, flatSubsteps, openLen, closeLen, rng) {
  const steps = groupIntoSteps(rng, flatSubsteps, openLen, closeLen);
  const fullPath = steps.flatMap((s) => s.path);
  const fullStationsVisited = new Set(fullPath).size;
  const fullTravelFt = travelFtOfPath(fullPath);
  const stepLinks = [];
  for (let i = 1; i < steps.length; i++) {
    const prevPath = steps[i - 1].path, nextPath = steps[i].path;
    if (prevPath.length && nextPath.length) stepLinks.push([prevPath[prevPath.length - 1], nextPath[0]]);
  }
  return { id, steps, fullPath, fullStationsVisited, fullTravelFt, stepLinks };
}

// A random-length (1..N), random-order, no-repeat subset of `pool`, restricted
// to whichever members actually have equipment mapped to them — this is how
// an open/close bookend gets "any combination or number" of its pool's
// stations rather than a fixed single station or fixed pair. Every count from
// 1 to the number of available stations is equally likely, and every subset
// of that size is equally likely too (a prefix of a full shuffle).
function pickPoolSubset(rng, stationEquip, pool) {
  const available = pool.filter((s) => stationEquip[s]?.length);
  if (available.length === 0) return [];
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, randInt(rng, 1, shuffled.length));
}

/* Generates `count` fake protocols, each a variable-length sequence of substeps
   grouped into Steps — the same Step/Substep shape protocolImport.js parses a
   real pasted protocol into (see groupIntoSteps/asProtocol below), so the two
   tabs' protocols read the same way: a `steps` array (each with its own
   `substeps`, `path`, `stationsVisited`, `travelFt`), plus whole-protocol
   `fullPath`/`fullStationsVisited`/`fullTravelFt` and `stepLinks` for
   LabMap.jsx's dashed step-to-step overlay. `minSteps`/`maxSteps` still count
   substeps (the individual station visits), not the coarser Step groups —
   unchanged from before this grouping existed, just relabeled "substeps" in
   the UI for accuracy. Each substep's type (Read/Write) is determined by the
   equipment itself, not drawn at random — see stepType.js. Seeded so the same
   equipment-to-station mapping and the same seed always produce the same
   protocols, regardless of what row order the equipment happened to be pasted
   in — so two people who paste an equivalent
   table (same equipment, same stations, any row order) and use the same seed get
   back an identical, sharable list of protocols.

   Every protocol opens with steps at some combination of Glassware/Consumables 1/
   Consumables 2 (`OPEN_POOL`) and closes with steps at some combination of Sink/
   Biohazard Waste/Sharps Bin (`CLOSE_POOL`) — `pickPoolSubset` draws a random-size,
   random-order subset of whichever pool members actually have equipment mapped to
   them, so a table missing some (or all) of a pool's stations just uses fewer of
   them (or none, dropping that bookend entirely) rather than inventing a step with
   no real equipment behind it. Equipment never repeats back-to-back within a
   bookend (and `pickPoolSubset` never repeats a station within one), so a
   consumable/waste step never immediately follows an identical one. `minSteps`/
   `maxSteps` are honored inclusive of these bookend steps (and the guaranteed
   pipette step below), bumped up automatically when the configured range is too
   tight to fit them.

   The random walk that fills the middle steers clear of both entire pools
   (`reserved`) regardless of which specific stations ended up chosen for this
   protocol's bookends — they're single, fixed locations with no alternate bench to
   reroute to, so letting the middle walk land on one would risk either an
   incidental repeat right next to the real bookend step, or landing on a station
   that turns out to be needed for the close after all (see the pipette rule below).
   Unlike the bookends, the middle walk *does* allow the same equipment (and
   therefore, for single-station equipment, the literal same bench) to repeat
   consecutively — the "keep moving" rule only still applies to the six pool
   stations, which the middle walk can never reach at all. Multi-station equipment
   (Pipette included) is still resolved via `farthestStation`, so reusing it in
   practice still tends to route to a different bench, but that's now an emergent
   effect of the distance model rather than an enforced rule.

   A pipette isn't tied to one specific station — any bench with pipettes and bench
   space works — so a step whose equipment is "Pipette" is always a candidate in
   the middle walk, resolved against the fixed `PIPETTE_STATIONS` pool (data.js) the
   same farthest-station way as any other multi-station equipment. Every protocol
   is now guaranteed at least one pipette step: one middle-walk slot is pre-assigned
   to "Pipette" before the walk runs (the rest are drawn normally, and may land on
   "Pipette" again by chance). Because every protocol therefore uses a pipette, it's
   also required to close with a Sharps Bin step as its *last* step (used pipette
   tips are sharps waste) — after the middle walk runs, "SHARPS" is moved to the end
   of `closeStations` (added there if it wasn't already part of the chosen close
   subset, or relocated there if `pickPoolSubset` had placed it earlier), as long as
   equipment is mapped there, even if that pushes the protocol one step past
   `maxSteps`.

   The other 2 fixtures (recycling, the 4C refrigerator) aren't bookend steps and
   aren't reserved, so they can appear anywhere in the middle walk if equipment is
   mapped there — but a random walk over a large equipment pool can still miss one
   across a small batch, so after the normal draw, `generateProtocols` checks
   whether every fixture with equipment mapped to it (bookend pools included) was
   actually visited by some step; if any weren't, one extra "coverage" protocol is
   appended that walks to each missed fixture in turn. This coverage protocol isn't
   held to the bookend rule (it's a single-purpose fixture-visit, not a simulated
   protocol). */
export function generateProtocols(equipToStations, opts = {}) {
  const { count = 10, minSteps = 4, maxSteps = 8, seed = 1234 } = opts;
  const realEquipment = Object.keys(equipToStations);
  if (realEquipment.length === 0) return { protocols: [], warnings: ["No equipment loaded — build the lab map first."] };

  const rng = mulberry32(seed);
  const warnings = [];

  // Pipette is injected as a normal candidate below — it never counts toward
  // "is any equipment loaded at all" above, since an empty lab shouldn't
  // generate pipette-only protocols just because the pool is always available.
  const equipToStationsFull = { ...equipToStations, Pipette: PIPETTE_STATIONS };
  // Sorted, not insertion order: `equipToStations`'s key order is whatever row
  // order the equipment happened to be pasted in, which has nothing to do with
  // the lab itself — two people pasting the same equipment list in a different
  // row order would otherwise build a differently-ordered `stationEquip` below
  // and get different protocols out of the same seed. Sorting makes generation
  // depend only on *what* was pasted, not the order it was typed/copied in, so
  // the same seed really does reproduce the same protocols for anyone with the
  // same equipment list.
  const equipment = Object.keys(equipToStationsFull).sort();

  const singleStationLab = equipment.every((e) => new Set(equipment.flatMap((x) => equipToStationsFull[x])).size <= 1);
  if (singleStationLab) warnings.push("Every piece of equipment maps to the same station — protocols can't force movement.");

  const stationEquip = {};
  for (const e of equipment) for (const s of equipToStationsFull[e]) (stationEquip[s] ??= []).push(e);
  if (!OPEN_POOL.some((s) => stationEquip[s]?.length)) {
    warnings.push("No equipment mapped to Glassware, Consumables 1, or Consumables 2 — protocols won't open with a prep step.");
  }
  if (!CLOSE_POOL.some((s) => stationEquip[s]?.length)) {
    warnings.push("No equipment mapped to the Sink, Biohazard Waste, or Sharps Bin — protocols won't close with a disposal step.");
  }
  if (!stationEquip.SHARPS?.length) {
    warnings.push("No equipment mapped to the Sharps Bin — every protocol uses a pipette and won't be able to add the required disposal step.");
  }

  const reserved = new Set([...OPEN_POOL, ...CLOSE_POOL]);

  const protocols = [];
  for (let p = 0; p < count; p++) {
    const openStations = pickPoolSubset(rng, stationEquip, OPEN_POOL);
    let closeStations = pickPoolSubset(rng, stationEquip, CLOSE_POOL);
    const bookendCount = openStations.length + closeStations.length;
    // +1 guarantees room for the mandatory pipette step below, on top of whatever
    // bookend steps this protocol ended up with.
    const nSteps = Math.max(randInt(rng, minSteps, maxSteps), bookendCount + 1);

    const steps = [];
    let prevStation = null;
    let prevEquip = null;

    for (const station of openStations) {
      let candidates = stationEquip[station].filter((e) => e !== prevEquip);
      if (candidates.length === 0) candidates = stationEquip[station];
      const equip = pick(rng, candidates);
      steps.push({ equipment: equip, station, action: classifyStepType(equip) });
      prevStation = station;
      prevEquip = equip;
    }

    // middleCount is always >= 1 (see the nSteps bump above), so there's always a
    // slot to pin to "Pipette" — every protocol gets at least one pipette step.
    const middleCount = nSteps - openStations.length - closeStations.length;
    const forcedPipetteIndex = randInt(rng, 0, middleCount - 1);
    for (let i = 0; i < middleCount; i++) {
      let equip;
      if (i === forcedPipetteIndex) {
        equip = "Pipette";
      } else {
        // No e !== prevEquip check here: the same equipment (and, for
        // single-station equipment, the literal same bench) is allowed to repeat
        // on consecutive steps — the only stations middle-walk equipment can
        // never reach at all are the six pool stations, via `reserved`.
        const candidates = equipment.filter((e) => equipToStationsFull[e].some((s) => !reserved.has(s)));
        equip = pick(rng, candidates);
      }
      const station = farthestStation(equipToStationsFull[equip], prevStation, reserved);
      steps.push({ equipment: equip, station, action: classifyStepType(equip) });
      prevStation = station;
      prevEquip = equip;
    }

    // Every protocol uses a pipette (above), so every protocol needs this close.
    if (stationEquip.SHARPS?.length) {
      closeStations = closeStations.filter((s) => s !== "SHARPS");
      closeStations.push("SHARPS");
    }

    for (const station of closeStations) {
      let candidates = stationEquip[station].filter((e) => e !== prevEquip);
      if (candidates.length === 0) candidates = stationEquip[station];
      const equip = pick(rng, candidates);
      steps.push({ equipment: equip, station, action: classifyStepType(equip) });
      prevStation = station;
      prevEquip = equip;
    }

    protocols.push(asProtocol(`Protocol ${p + 1}`, steps, openStations.length, closeStations.length, rng));
  }

  const visited = new Set(protocols.flatMap((p) => p.fullPath));
  const missedFixtures = FIXTURE_IDS.filter((f) => stationEquip[f]?.length && !visited.has(f));
  if (missedFixtures.length > 0) {
    const steps = missedFixtures.map((station) => {
      const equip = stationEquip[station][0];
      return { equipment: equip, station, action: classifyStepType(equip) };
    });
    protocols.push(asProtocol(`Protocol ${protocols.length + 1}`, steps, 0, 0, rng));
  }

  return { protocols, warnings };
}
