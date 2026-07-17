import test from "node:test";
import assert from "node:assert/strict";
import { classifyStepType } from "../src/stepType.js";

test("measurement/reading equipment is a Write step", () => {
  assert.equal(classifyStepType("Nanodrop One"), "Write");
  assert.equal(classifyStepType("Biorad Gel Doc XR+ Imaging System"), "Write");
  assert.equal(classifyStepType("Nikon Microscope"), "Write");
});

test("purely procedural equipment is a Read step", () => {
  assert.equal(classifyStepType("Centrifuge"), "Read");
  assert.equal(classifyStepType("ONiLAB Orbital Shaker"), "Read");
  assert.equal(classifyStepType("Applied Biosystems 2720 Thermal Cycler"), "Read");
});

test("classification is case-insensitive and handles missing input", () => {
  assert.equal(classifyStepType("NANODROP"), "Write");
  assert.equal(classifyStepType(""), "Read");
  assert.equal(classifyStepType(undefined), "Read");
});
