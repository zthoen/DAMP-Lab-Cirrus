import test from "node:test";
import assert from "node:assert/strict";
import { generateProtocols } from "../src/protocolGen.js";
import { parseLabTable } from "../src/labTable.js";
import { BENCH_DIST_FT } from "../src/data.js";

const table = () => parseLabTable(`
Opentrons Flex Robot\tAutomation Prep\tA1
Gel Doc\tGel Imaging\tC3
Thermal Cycler\tDNA Prep\tD2
Centrifuge\tDNA Prep\tD3
Microscope\tSpectroscopy\tG1
Vortex Mixer\tSpectroscopy\tG2
`.trim());

test("same seed produces identical protocols (reproducible)", () => {
  const { equipToStations } = table();
  const a = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 42 });
  const b = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 42 });
  assert.deepEqual(a, b);
});

test("different seeds diverge", () => {
  const { equipToStations } = table();
  const a = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 1 });
  const b = generateProtocols(equipToStations, { count: 5, minSteps: 3, maxSteps: 6, seed: 2 });
  assert.notDeepEqual(a, b);
});

test("consecutive steps never sit at the same station when alternatives exist", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 20, minSteps: 6, maxSteps: 10, seed: 7 });
  for (const p of protocols) {
    for (let i = 1; i < p.steps.length; i++) {
      assert.notEqual(p.steps[i].station, p.steps[i - 1].station, `${p.id} step ${i} repeats a station`);
    }
  }
});

test("step count respects the configured min/max range", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 30, minSteps: 4, maxSteps: 4, seed: 3 });
  for (const p of protocols) assert.equal(p.steps.length, 4);
});

test("no equipment produces an empty result with a warning instead of throwing", () => {
  const out = generateProtocols({}, { count: 3 });
  assert.equal(out.protocols.length, 0);
  assert.ok(out.warnings.length > 0);
});

test("travelFt is the sum of the route distance (in feet) between consecutive steps", () => {
  const { equipToStations } = table();
  const { protocols } = generateProtocols(equipToStations, { count: 10, minSteps: 3, maxSteps: 8, seed: 11 });
  for (const p of protocols) {
    let expected = 0;
    for (let i = 1; i < p.steps.length; i++) expected += BENCH_DIST_FT[p.steps[i - 1].station][p.steps[i].station];
    assert.equal(p.travelFt, Math.round(expected));
  }
});
