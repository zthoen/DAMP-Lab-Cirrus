import { mulberry32 } from "./rng.js";
import { BENCH_DIST_FT } from "./data.js";
import { classifyStepType } from "./stepType.js";

const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// One equipment can live at several stations (EQUIP_LOCS-style); of its stations,
// return the one farthest from `from` (by the actual walking route, not a straight
// line — see routeDistanceFt in data.js) so picking that equipment actually forces a
// walk, not just a coin-flip.
function farthestStation(stations, from) {
  if (!from) return stations[0];
  return stations.reduce((best, s) => (BENCH_DIST_FT[from][s] > BENCH_DIST_FT[from][best] ? s : best), stations[0]);
}

/* Generates `count` fake protocols, each a variable-length sequence of steps whose
   equipment is deliberately drawn from a *different* station than the previous step
   (and the farthest of that equipment's stations from the current one, when it has
   more than one) — so executing the protocol forces the technician to keep moving
   around the floor instead of camping at one bench. Each step's type (Read/Write) is
   determined by the equipment itself, not drawn at random — see stepType.js. Seeded
   so the same inputs always produce the same protocols. */
export function generateProtocols(equipToStations, opts = {}) {
  const { count = 10, minSteps = 4, maxSteps = 8, seed = 1234 } = opts;
  const equipment = Object.keys(equipToStations);
  if (equipment.length === 0) return { protocols: [], warnings: ["No equipment loaded — build the lab map first."] };

  const rng = mulberry32(seed);
  const warnings = [];
  const singleStationLab = equipment.every((e) => new Set(equipment.flatMap((x) => equipToStations[x])).size <= 1);
  if (singleStationLab) warnings.push("Every piece of equipment maps to the same station — protocols can't force movement.");

  const protocols = [];
  for (let p = 0; p < count; p++) {
    const nSteps = randInt(rng, minSteps, maxSteps);
    const steps = [];
    let prevStation = null;
    let prevEquip = null;
    for (let i = 0; i < nSteps; i++) {
      let candidates = equipment.filter((e) => e !== prevEquip && equipToStations[e].some((s) => s !== prevStation));
      if (candidates.length === 0) candidates = equipment.filter((e) => e !== prevEquip);
      if (candidates.length === 0) candidates = equipment;

      const equip = pick(rng, candidates);
      const station = farthestStation(equipToStations[equip], prevStation);
      steps.push({ equipment: equip, station, action: classifyStepType(equip) });
      prevStation = station;
      prevEquip = equip;
    }

    let travelFt = 0;
    for (let i = 1; i < steps.length; i++) travelFt += BENCH_DIST_FT[steps[i - 1].station][steps[i].station];
    protocols.push({
      id: `G${p + 1}`,
      steps,
      stationsVisited: new Set(steps.map((s) => s.station)).size,
      travelFt: Math.round(travelFt),
    });
  }

  return { protocols, warnings };
}
