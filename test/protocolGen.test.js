import test from "node:test";
import assert from "node:assert/strict";
import { generateProtocols } from "../src/protocolGen.js";
import { parseLabTable } from "../src/labTable.js";
import { BENCH_DIST_FT, PIPETTE_STATIONS } from "../src/data.js";

// A protocol's substeps, flattened across every Step group in order — the
// same sequence the old flat `p.steps` array used to be, before generation
// started grouping it into Step/Substep form (see protocolGen.js).
const flat = (p) => p.steps.flatMap((s) => s.substeps);

const table = () => parseLabTable(`
Opentrons Flex Robot\tOpentrons
Gel Doc\tGel Imaging
Thermal Cycler\tDNA Prep
Centrifuge\tPCR
Microscope\tResearch
Vortex Mixer\tImaging
`.trim());

test("the shared test fixture table parses with no errors", () => {
  const t = table();
  assert.equal(t.errors.length, 0);
});

test("same seed produces identical protocols (reproducible)", () => {
  const { equipToStations } = table();
  const a = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 42 });
  const b = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 42 });
  assert.deepEqual(a, b);
});

test("same seed reproduces the same protocols even when the equipment was pasted in a different row order", () => {
  // Two people typing/copying the same lab's equipment list will rarely paste
  // the rows in the exact same order — reproducibility across a shared seed
  // has to hold up to that, not just to an identical paste.
  const inOrder = table();
  const reordered = parseLabTable(`
Vortex Mixer\tImaging
Centrifuge\tPCR
Opentrons Flex Robot\tOpentrons
Microscope\tResearch
Thermal Cycler\tDNA Prep
Gel Doc\tGel Imaging
`.trim());
  assert.equal(reordered.errors.length, 0);
  const a = generateProtocols(inOrder.equipToStations, { count: 8, minSteps: 3, maxSteps: 6, seed: 42 });
  const b = generateProtocols(reordered.equipToStations, { count: 8, minSteps: 3, maxSteps: 6, seed: 42 });
  assert.deepEqual(a, b);
});

test("different seeds diverge", () => {
  const { equipToStations } = table();
  const a = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 1 });
  const b = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 2 });
  assert.notDeepEqual(a, b);
});

const repeatTable = () => parseLabTable(`
Vortex Mixer\tImaging
`.trim());

test("equipment (and its station) can repeat on consecutive steps outside the pool stations, across enough seeds", () => {
  const { equipToStations } = repeatTable();
  let sawRepeat = false;
  for (let seed = 0; seed < 30 && !sawRepeat; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 6, maxSteps: 6, seed });
    for (const p of protocols) {
      const path = p.fullPath;
      for (let i = 1; i < path.length; i++) {
        if (path[i] === path[i - 1]) sawRepeat = true;
      }
    }
  }
  assert.ok(sawRepeat, "never saw a consecutive station repeat across 300 protocols with only one non-pipette equipment option");
});

test("substep count respects the configured min/max range", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 30, minSteps: 4, maxSteps: 4, seed: 3 });
  for (const p of protocols) assert.equal(flat(p).length, 4);
});

test("no equipment produces an empty result with a warning instead of throwing", () => {
  const out = generateProtocols({}, { count: 3 });
  assert.equal(out.protocols.length, 0);
  assert.ok(out.warnings.length > 0);
});

test("fullTravelFt is the sum of the route distance (in feet) between consecutive substeps", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 3, maxSteps: 8, seed: 11 });
  for (const p of protocols) {
    let expected = 0;
    for (let i = 1; i < p.fullPath.length; i++) expected += BENCH_DIST_FT[p.fullPath[i - 1]][p.fullPath[i]];
    assert.equal(p.fullTravelFt, Math.round(expected));
  }
});

test("protocols are titled 'Protocol 1', 'Protocol 2', ...", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 4, minSteps: 3, maxSteps: 5, seed: 5 });
  protocols.forEach((p, i) => assert.equal(p.id, `Protocol ${i + 1}`));
});

test("equipToStations with no fixtures mapped at all adds no extra protocol beyond count", () => {
  const equipToStations = { Pipette: ["A1"], Centrifuge: ["D2"], Microscope: ["G1"] };
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 5, seed: 9 });
  assert.equal(protocols.length, 5);
});

test("every fixture with mapped equipment is visited by at least one protocol", () => {
  const fixtureTable = parseLabTable(`
Used Pipette Tips\tSharps Bin
Paper Waste\tRecycling Bin
Autoclave Bags\tBiohazard Waste
Glassware\tSink
Pipette Tips Restock\tConsumables 2
`.trim());
  assert.equal(fixtureTable.errors.length, 0);
  const { protocols } = generateProtocols(fixtureTable.equipToStations, { count: 2, minSteps: 2, maxSteps: 2, seed: 1 });
  const visited = new Set(protocols.flatMap((p) => p.fullPath));
  for (const fixture of ["SHARPS", "RECYCLE", "WASTE", "SINK", "CONSUM2"]) {
    assert.ok(visited.has(fixture), `${fixture} was never visited`);
  }
  // The coverage protocol (if any) still follows the naming scheme.
  protocols.forEach((p, i) => assert.equal(p.id, `Protocol ${i + 1}`));
});

const fullTable = () => parseLabTable(`
Opentrons Flex Robot\tOpentrons
Gel Doc\tGel Imaging
Microscope\tResearch
Used Pipette Tips\tSharps Bin
Autoclave Bags\tBiohazard Waste
Pipette Tips Restock\tConsumables 2
`.trim());

test("the shared full-table test fixture parses with no errors", () => {
  const t = fullTable();
  assert.equal(t.errors.length, 0);
});

test("every protocol opens with a retrieval step at consumables", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 4, maxSteps: 8, seed: 21 });
  for (const p of protocols) assert.equal(p.fullPath[0], "CONSUM2", `${p.id} didn't open at CONSUM2`);
});

test("every protocol closes with the Sharps Bin as its literal last substep (every protocol uses a pipette)", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 4, maxSteps: 8, seed: 21 });
  for (const p of protocols) {
    const path = p.fullPath;
    assert.equal(path[path.length - 1], "SHARPS", `${p.id} closed at ${path[path.length - 1]}, not Sharps`);
  }
});

test("some protocols dispose at Biohazard Waste immediately before the (always-last) Sharps Bin step, across enough seeds", () => {
  const { equipToStations } = fullTable();
  let sawDouble = false;
  for (let seed = 0; seed < 30 && !sawDouble; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 6, maxSteps: 8, seed });
    for (const p of protocols) {
      const [secondLast, last] = p.fullPath.slice(-2);
      if (secondLast === "WASTE" && last === "SHARPS") sawDouble = true;
    }
  }
  assert.ok(sawDouble, "never saw a protocol dispose at Biohazard Waste right before Sharps across 300 protocols");
});

test("bookend steps are still forced even when minSteps/maxSteps is too tight to fit them", () => {
  const { equipToStations } = fullTable();
  const count = 5;
  const { protocols } = generateProtocols(equipToStations, { count, minSteps: 1, maxSteps: 1, seed: 4 });
  // Only the main batch (not any auto-appended coverage protocol, which is a
  // single-purpose fixture-visit and isn't held to the bookend rule) is checked.
  for (const p of protocols.slice(0, count)) {
    assert.ok(p.fullPath.length >= 2, `${p.id} should have at least a retrieve + disposal substep`);
    assert.equal(p.fullPath[0], "CONSUM2");
  }
});

test("equipToStations without consumables/waste mapped warns and skips the bookend steps", () => {
  const equipToStations = { Pipette: ["A1"], Centrifuge: ["D2"], Microscope: ["G1"] };
  const out = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 5, seed: 9 });
  assert.ok(out.warnings.some((w) => /Consumables 2/.test(w)));
  assert.ok(out.warnings.some((w) => /Sharps|Biohazard/.test(w)));
  for (const p of out.protocols) assert.notEqual(p.fullPath[0], "CONSUM2");
});

test("a table parsed with no fixtures mentioned never opens/closes with a fixture — nothing is auto-installed there", () => {
  const { equipToStations } = table(); // none of these rows mention SHARPS/RECYCLE/WASTE/SINK/CONSUM1/CONSUM2
  const { protocols, warnings } = generateProtocols(equipToStations, { count: 8, minSteps: 4, maxSteps: 7, seed: 14 });
  assert.ok(warnings.some((w) => /Consumables 2/.test(w)));
  assert.ok(warnings.some((w) => /Sharps|Biohazard/.test(w)));
  const fixtureIds = new Set(["SHARPS", "RECYCLE", "WASTE", "SINK", "GLASSWARE", "CONSUM1", "CONSUM2", "REFRIGERATOR"]);
  for (const p of protocols) {
    for (const station of p.fullPath) assert.ok(!fixtureIds.has(station), `${p.id} visited fixture ${station}, which has no mapped equipment`);
  }
});

// Maps equipment to every OPEN_POOL/CLOSE_POOL station (Glassware, Consumables 1,
// Consumables 2, Sink, Biohazard Waste, Sharps Bin) plus a handful of ordinary
// benches for the middle random walk, so the open/close pool subset logic and the
// Pipette injection both have real equipment to exercise.
const poolTable = () => parseLabTable(`
Glassware Cart\tGlassware
Consumables Restock 1\tConsumables 1
Consumables Restock 2\tConsumables 2
Wash Station\tSink
Autoclave Bags\tBiohazard Waste
Used Pipette Tips\tSharps Bin
Opentrons Flex Robot\tOpentrons
Gel Doc\tGel Imaging
Thermal Cycler\tDNA Prep
Centrifuge\tPCR
Microscope\tResearch
Vortex Mixer\tImaging
`.trim());

const OPEN_POOL_IDS = new Set(["GLASSWARE", "CONSUM1", "CONSUM2"]);
const CLOSE_POOL_IDS = new Set(["SINK", "WASTE", "SHARPS"]);

test("the shared pool test fixture parses with no errors", () => {
  const t = poolTable();
  assert.equal(t.errors.length, 0);
});

test("open-pool stations only ever appear as a prefix, and close-pool stations only ever appear as a suffix", () => {
  const { equipToStations } = poolTable();
  for (let seed = 0; seed < 20; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 9, seed });
    for (const p of protocols) {
      const path = p.fullPath;
      let sawNonOpen = false;
      for (const station of path) {
        if (OPEN_POOL_IDS.has(station)) {
          assert.ok(!sawNonOpen, `${p.id} (seed ${seed}) has an open-pool station after a non-open-pool step`);
        } else {
          sawNonOpen = true;
        }
      }
      let sawClose = false;
      for (const station of path) {
        if (CLOSE_POOL_IDS.has(station)) {
          sawClose = true;
        } else {
          assert.ok(!sawClose, `${p.id} (seed ${seed}) has a non-close-pool station after a close-pool step`);
        }
      }
    }
  }
});

test("protocols can open with Glassware and Consumables 1, not just Consumables 2, across enough seeds", () => {
  const { equipToStations } = poolTable();
  const opened = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 8, seed });
    for (const p of protocols) opened.add(p.fullPath[0]);
  }
  assert.ok(opened.has("GLASSWARE"), "never saw a protocol open at Glassware");
  assert.ok(opened.has("CONSUM1"), "never saw a protocol open at Consumables 1");
  assert.ok(opened.has("CONSUM2"), "never saw a protocol open at Consumables 2");
});

test("protocols can close with the Sink, not just Sharps/Biohazard, across enough seeds", () => {
  const { equipToStations } = poolTable();
  let sawSink = false;
  for (let seed = 0; seed < 30 && !sawSink; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 8, seed });
    for (const p of protocols) {
      if (p.fullPath.includes("SINK")) sawSink = true;
    }
  }
  assert.ok(sawSink, "never saw a protocol close with the Sink across 300 protocols");
});

test("every protocol includes at least one Pipette substep", () => {
  const { equipToStations } = poolTable();
  for (let seed = 0; seed < 15; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 8, seed });
    for (const p of protocols) {
      assert.ok(flat(p).some((s) => s.equipment === "Pipette"), `${p.id} (seed ${seed}) has no Pipette substep`);
    }
  }
});

test("a Pipette substep is still guaranteed with minSteps/maxSteps of 1 and no bookend stations mapped at all", () => {
  const equipToStations = { Centrifuge: ["D2"], Microscope: ["G1"] };
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 1, maxSteps: 1, seed: 2 });
  for (const p of protocols) {
    assert.ok(flat(p).some((s) => s.equipment === "Pipette"), `${p.id} has no Pipette substep`);
  }
});

test("pool (consumables/waste) stations never repeat consecutively, even though other equipment can", () => {
  const { equipToStations } = poolTable();
  const poolIds = new Set([...OPEN_POOL_IDS, ...CLOSE_POOL_IDS]);
  for (let seed = 0; seed < 20; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 9, seed });
    for (const p of protocols) {
      const path = p.fullPath;
      for (let i = 1; i < path.length; i++) {
        if (poolIds.has(path[i])) {
          assert.notEqual(path[i], path[i - 1], `${p.id} (seed ${seed}) repeated a pool station consecutively`);
        }
      }
    }
  }
});

test("a Pipette substep's station is always a member of PIPETTE_STATIONS", () => {
  const { equipToStations } = poolTable();
  for (let seed = 0; seed < 15; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 8, seed });
    for (const p of protocols) {
      for (const s of flat(p)) {
        if (s.equipment === "Pipette") assert.ok(PIPETTE_STATIONS.includes(s.station), `${p.id} placed Pipette at ${s.station}, outside PIPETTE_STATIONS`);
      }
    }
  }
});

test("every protocol closes with the Sharps Bin as its literal last substep, since every protocol uses a pipette", () => {
  const { equipToStations } = poolTable();
  for (let seed = 0; seed < 15; seed++) {
    const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 4, maxSteps: 8, seed });
    for (const p of protocols) {
      const path = p.fullPath;
      assert.equal(path[path.length - 1], "SHARPS", `${p.id} (seed ${seed}) didn't close with Sharps`);
    }
  }
});

// --- Step/Substep grouping (new: protocols read like a real pasted one) ---

test("a generated protocol's steps carry substeps, path, stationsVisited, and travelFt, mirroring protocolImport.js", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 6, maxSteps: 10, seed: 30 });
  for (const p of protocols) {
    assert.ok(p.steps.length > 0, `${p.id} has no steps`);
    for (const step of p.steps) {
      assert.equal(typeof step.number, "number");
      assert.ok(step.name, `${p.id} step ${step.number} has no name`);
      assert.ok(step.substeps.length > 0, `${p.id} step ${step.number} has no substeps`);
      assert.deepEqual(step.path, step.substeps.map((s) => s.station));
      assert.equal(step.stationsVisited, new Set(step.path).size);
    }
  }
});

test("substep labels read N.M, numbered within their own step", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 6, maxSteps: 10, seed: 31 });
  for (const p of protocols) {
    for (const step of p.steps) {
      step.substeps.forEach((sub, i) => assert.equal(sub.label, `${step.number}.${i + 1}`));
    }
  }
});

test("fullPath is every step's path concatenated, in step order", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 6, maxSteps: 10, seed: 32 });
  for (const p of protocols) {
    assert.deepEqual(p.fullPath, p.steps.flatMap((s) => s.path));
    assert.equal(p.fullStationsVisited, new Set(p.fullPath).size);
  }
});

test("the open-pool retrieval substeps are grouped into a 'Prep' step when any are present", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 4, maxSteps: 8, seed: 21 });
  for (const p of protocols) {
    assert.equal(p.steps[0].name, "Prep", `${p.id}'s first step should be Prep`);
    assert.ok(p.steps[0].path.includes("CONSUM2"));
  }
});

test("the close-pool disposal substeps are grouped into a 'Cleanup' step, last", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 4, maxSteps: 8, seed: 21 });
  for (const p of protocols) {
    const lastStep = p.steps[p.steps.length - 1];
    assert.equal(lastStep.name, "Cleanup", `${p.id}'s last step should be Cleanup`);
    assert.equal(lastStep.path[lastStep.path.length - 1], "SHARPS");
  }
});

test("middle steps are named 'Procedure' (or 'Procedure N' when there's more than one)", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 4, maxSteps: 10, seed: 33 });
  for (const p of protocols) {
    const middleSteps = p.steps.filter((s) => s.name !== "Prep" && s.name !== "Cleanup");
    for (const s of middleSteps) assert.ok(/^Procedure( \d+)?$/.test(s.name), `unexpected middle step name "${s.name}"`);
    if (middleSteps.length === 1) assert.equal(middleSteps[0].name, "Procedure");
    if (middleSteps.length > 1) middleSteps.forEach((s, i) => assert.equal(s.name, `Procedure ${i + 1}`));
  }
});

test("each middle 'Procedure' step has between 2 and 4 substeps, except possibly the last one (remainder)", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 15, minSteps: 6, maxSteps: 14, seed: 34 });
  for (const p of protocols) {
    const middleSteps = p.steps.filter((s) => s.name !== "Prep" && s.name !== "Cleanup");
    middleSteps.forEach((s, i) => {
      const isLast = i === middleSteps.length - 1;
      if (isLast) assert.ok(s.substeps.length >= 1 && s.substeps.length <= 4, `${p.id}'s last Procedure step has ${s.substeps.length} substeps`);
      else assert.ok(s.substeps.length >= 2 && s.substeps.length <= 4, `${p.id}'s Procedure step has ${s.substeps.length} substeps`);
    });
  }
});

test("stepLinks has one [lastOfStep, firstOfNextStep] pair per step boundary, matching protocolImport.js's shape", () => {
  const { equipToStations } = fullTable();
  const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 6, maxSteps: 10, seed: 35 });
  for (const p of protocols) {
    assert.equal(p.stepLinks.length, p.steps.length - 1);
    p.stepLinks.forEach((link, i) => {
      assert.deepEqual(link, [p.steps[i].path[p.steps[i].path.length - 1], p.steps[i + 1].path[0]]);
    });
  }
});

test("a protocol with only one step (e.g. minSteps/maxSteps of 1, no bookends mapped) has no stepLinks", () => {
  const equipToStations = { Centrifuge: ["D2"], Microscope: ["G1"] };
  const { protocols } = generateProtocols(equipToStations, { count: 5, minSteps: 1, maxSteps: 1, seed: 2 });
  for (const p of protocols) {
    if (p.steps.length === 1) assert.deepEqual(p.stepLinks, []);
  }
});

test("the coverage protocol (no bookends of its own) is still grouped into Procedure-only steps", () => {
  const fixtureTable = parseLabTable(`
Used Pipette Tips\tSharps Bin
Paper Waste\tRecycling Bin
Autoclave Bags\tBiohazard Waste
Glassware\tSink
Pipette Tips Restock\tConsumables 2
`.trim());
  const { protocols } = generateProtocols(fixtureTable.equipToStations, { count: 2, minSteps: 2, maxSteps: 2, seed: 1 });
  const coverage = protocols[protocols.length - 1];
  for (const step of coverage.steps) assert.ok(/^Procedure( \d+)?$/.test(step.name));
});
