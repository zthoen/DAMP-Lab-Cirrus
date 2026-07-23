import test from "node:test";
import assert from "node:assert/strict";
import { scheduleProtocols } from "../src/protocolScheduler.js";
import { parseLabTable } from "../src/labTable.js";
import { BENCH_DIST_FT, walkMinutesForFt } from "../src/data.js";

const equipToStations = () => parseLabTable(`
Opentrons Flex Robot\tOpentrons
Dry Chemical Scale\tDry Chemical Weighing
NanoDrop 2000\tNanoDrop
`.trim()).equipToStations;

// A1, B1, C1 — see BENCH_DIST_FT for the real distances between them.
const travel = (a, b) => walkMinutesForFt(BENCH_DIST_FT[a][b]);

test("no equipment loaded returns a warning instead of a schedule", () => {
  const out = scheduleProtocols({}, ["1. A\t1.1\tSomething\t5"]);
  assert.deepEqual(out.schedule, []);
  assert.ok(out.warnings.some((w) => /equipment/i.test(w)));
});

test("no protocols pasted returns a warning instead of a schedule", () => {
  const out = scheduleProtocols(equipToStations(), ["", "   "]);
  assert.deepEqual(out.schedule, []);
  assert.ok(out.warnings.some((w) => /protocol/i.test(w)));
});

test("a single protocol starts at 0 and its duration is travel time plus each substep's own minutes", () => {
  const raw = `
1. Prep\t1.1\tOpentrons Flex Robot\t5
\t1.2\tDry Chemical Scale\t10
`.trim();
  const { schedule } = scheduleProtocols(equipToStations(), [raw]);
  assert.equal(schedule.length, 1);
  const p = schedule[0];
  assert.equal(p.startMin, 0);
  const expectedDuration = 5 + travel("A1", "B1") + 10;
  assert.ok(Math.abs(p.durationMin - expectedDuration) < 1e-9);
  assert.equal(p.endMin, p.durationMin);
  assert.deepEqual(p.path, ["A1", "B1"]);
  assert.equal(p.conflicts.length, 0);
});

test("two protocols on the same station with no time overlap both keep their own would-be start", () => {
  const a = `1. Read\t1.1\tNanoDrop 2000\t10`;
  const b = `1. Weigh\t1.1\tOpentrons Flex Robot\t10`;
  const { schedule } = scheduleProtocols(equipToStations(), [a, b]);
  assert.equal(schedule[0].startMin, 0);
  assert.equal(schedule[1].startMin, 0); // different station (C1 vs A1) — no conflict possible
});

test("a conflicting lower-priority protocol is delayed until the higher-priority one frees the station", () => {
  const a = `1. Read\t1.1\tNanoDrop 2000\t10`; // C1, [0,10]
  const b = `1. Read\t1.1\tNanoDrop 2000\t10`; // wants the same station, same window
  const { schedule } = scheduleProtocols(equipToStations(), [a, b]);
  assert.equal(schedule[0].startMin, 0); // priority 1 never moves
  assert.equal(schedule[1].startMin, 10); // pushed to right after A frees NanoDrop
  assert.equal(schedule[1].conflicts.length, 1);
  assert.equal(schedule[1].conflicts[0].withProtocolIndex, 0);
  assert.equal(schedule[1].conflicts[0].station, "C1");
  assert.equal(schedule[1].conflicts[0].pushedTo, 10);
});

test("three protocols all wanting the same station queue up back-to-back in priority order", () => {
  const one = `1. Read\t1.1\tNanoDrop 2000\t10`;
  const { schedule } = scheduleProtocols(equipToStations(), [one, one, one]);
  assert.deepEqual(schedule.map((p) => p.startMin), [0, 10, 20]);
  assert.deepEqual(schedule.map((p) => p.endMin), [10, 20, 30]);
});

test("a higher-priority protocol is never delayed by a lower-priority one, regardless of input order", () => {
  const busy = `1. Read\t1.1\tNanoDrop 2000\t30`;
  const quick = `1. Read\t1.1\tNanoDrop 2000\t5`;
  const out1 = scheduleProtocols(equipToStations(), [busy, quick]);
  assert.equal(out1.schedule[0].startMin, 0); // busy stays put
  assert.equal(out1.schedule[1].startMin, 30); // quick waits it out

  const out2 = scheduleProtocols(equipToStations(), [quick, busy]);
  assert.equal(out2.schedule[0].startMin, 0); // now quick has priority and stays put
  assert.equal(out2.schedule[1].startMin, 5); // busy waits for quick instead
});

test("no two protocols ever end up with overlapping intervals on the same station", () => {
  const p = (mins) => `
1. Step\t1.1\tOpentrons Flex Robot\t${mins[0]}
\t1.2\tNanoDrop 2000\t${mins[1]}
\t1.3\tDry Chemical Scale\t${mins[2]}
`.trim();
  const texts = [p([4, 6, 3]), p([2, 9, 5]), p([7, 1, 2]), p([3, 4, 8])];
  const { schedule } = scheduleProtocols(equipToStations(), texts);

  const byStation = {};
  for (const proto of schedule) {
    for (const ev of proto.events) (byStation[ev.station] ??= []).push({ ...ev, protocol: proto.index });
  }
  for (const events of Object.values(byStation)) {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i], b = events[j];
        const overlap = a.start < b.end && b.start < a.end;
        assert.ok(!overlap, `protocols ${a.protocol} and ${b.protocol} overlap on ${a.station}`);
      }
    }
  }
});

test("a substep with no Time column defaults to 0 minutes (uses the station instantaneously)", () => {
  const raw = `1. Prep\t1.1\tOpentrons Flex Robot`;
  const { schedule } = scheduleProtocols(equipToStations(), [raw]);
  assert.equal(schedule[0].durationMin, 0);
  assert.equal(schedule[0].errors.length, 0);
});

test("an invalid Time cell is reported as a per-protocol error and treated as 0 minutes", () => {
  const raw = `1. Prep\t1.1\tOpentrons Flex Robot\tsoon`;
  const { schedule } = scheduleProtocols(equipToStations(), [raw]);
  assert.equal(schedule[0].durationMin, 0);
  assert.ok(schedule[0].errors.some((e) => /not a valid time/.test(e)));
});

test("equipment that isn't in the loaded list never occupies a station or causes a conflict", () => {
  const raw = `
1. Prep\t1.1\tMystery Machine\t20
\t1.2\tNanoDrop 2000\t5
`.trim();
  const { schedule } = scheduleProtocols(equipToStations(), [raw, raw]);
  assert.deepEqual(schedule[0].path, ["C1"]);
  assert.equal(schedule[0].startMin, 0);
  assert.equal(schedule[1].startMin, 5); // only ever waits on NanoDrop, not the unresolved Mystery Machine
});

test("protocol names fall back to 'Protocol N' when the paste has no title line", () => {
  const raw = `1. Prep\t1.1\tOpentrons Flex Robot\t5`; // starts straight on a data row, no title above it
  const { schedule } = scheduleProtocols(equipToStations(), [raw]);
  assert.equal(schedule[0].name, "Protocol 1");
});

test("a Pipette step reroutes to a different pipette-eligible bench instead of waiting, when its preferred one is busy", () => {
  const pool = ["A1", "B1"];
  const a = `1. Prep\t1.1\tOpentrons Flex Robot\t10`; // claims A1, [0,10]
  const b = `1. Aliquot\t1.1\tPipette\t8`; // A1 is the preferred (first, no prior station) pool member
  const { schedule } = scheduleProtocols(equipToStations(), [a, b], BENCH_DIST_FT, pool);
  assert.equal(schedule[0].startMin, 0);
  assert.equal(schedule[1].startMin, 0); // rerouted, not delayed
  assert.deepEqual(schedule[1].path, ["B1"]);
  assert.equal(schedule[1].conflicts.length, 1);
  assert.equal(schedule[1].conflicts[0].delta, 0);
  assert.equal(schedule[1].conflicts[0].isPipette, true);
  assert.equal(schedule[1].conflicts[0].station, "A1");
  assert.equal(schedule[1].conflicts[0].resolvedStation, "B1");
});

test("a Pipette step still waits when every pipette-eligible bench is busy, picking whichever frees up soonest", () => {
  const pool = ["A1", "B1"];
  const a = `1. Prep\t1.1\tOpentrons Flex Robot\t10`; // claims A1, [0,10]
  const b = `1. Weigh\t1.1\tDry Chemical Scale\t6`; // claims B1, [0,6]
  const c = `1. Aliquot\t1.1\tPipette\t5`;
  const { schedule } = scheduleProtocols(equipToStations(), [a, b, c], BENCH_DIST_FT, pool);
  assert.equal(schedule[2].startMin, 6); // B1 frees at 6, sooner than A1's 10
  assert.deepEqual(schedule[2].path, ["B1"]);
  assert.ok(schedule[2].conflicts.length >= 1);
  assert.ok(schedule[2].conflicts.some((c) => c.delta > 0)); // had to wait at all
});

test("with only one pipette-eligible bench in the pool, a Pipette step behaves exactly like ordinary single-station equipment", () => {
  const pool = ["C1"];
  const a = `1. Read\t1.1\tNanoDrop 2000\t10`; // also C1, [0,10]
  const b = `1. Aliquot\t1.1\tPipette\t5`;
  const { schedule } = scheduleProtocols(equipToStations(), [a, b], BENCH_DIST_FT, pool);
  assert.equal(schedule[1].startMin, 10);
  assert.deepEqual(schedule[1].path, ["C1"]);
});
