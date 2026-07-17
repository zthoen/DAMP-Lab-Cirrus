import test from "node:test";
import assert from "node:assert/strict";
import { routeDistanceFt, routeWaypoints, BENCH_DIST_FT, STATION_IDS, FIXTURES, center, WALKWAY_WIDTH_FT, BACK_AISLE_FT, BENCH_LEN_FT } from "../src/data.js";

test("same station is zero distance", () => {
  assert.equal(routeDistanceFt("A1", "A1"), 0);
});

test("same-column moves cross bench lengths within their shared walkway, no back-aisle detour", () => {
  assert.equal(routeDistanceFt("A1", "A2"), BENCH_LEN_FT);
  assert.equal(routeDistanceFt("A1", "A3"), 2 * BENCH_LEN_FT);
  assert.equal(routeDistanceFt("A3", "A1"), 2 * BENCH_LEN_FT); // symmetric
});

test("a touching pair (B-C) can't cut through each other — still routes via the back aisle", () => {
  // B and C touch directly but don't share a walkway (B's walkway is A-B, C's is C-D),
  // so B1 -> C1 has to detour: down to B3, across the back aisle, up to C1.
  const expected = 2 * BENCH_LEN_FT + BACK_AISLE_FT + BENCH_LEN_FT + 2 * BENCH_LEN_FT;
  assert.equal(routeDistanceFt("B1", "C1"), expected);
});

test("columns sharing one walkway (A-B) cross it directly, no back-aisle detour", () => {
  // Same row: just the walkway width.
  assert.equal(routeDistanceFt("A1", "B1"), WALKWAY_WIDTH_FT);
  // Different row: bench-length hops plus one walkway-width crossing.
  assert.equal(routeDistanceFt("A1", "B3"), 2 * BENCH_LEN_FT + WALKWAY_WIDTH_FT);
});

test("different walkway groups route down, across the back aisle, and up", () => {
  // A (group AB) -> D (group CD): down 2 rows in AB's walkway, across 2 bench-widths
  // (A and B/C are 2 and 3 positions apart... use the actual column order A,B,C,D).
  const expected = 2 * BENCH_LEN_FT + BACK_AISLE_FT + 3 * BENCH_LEN_FT + 2 * BENCH_LEN_FT;
  assert.equal(routeDistanceFt("A1", "D1"), expected);
});

test("row-3-to-row-3 cross-group move still pays the back-aisle crossing once", () => {
  assert.equal(routeDistanceFt("A3", "H3"), BACK_AISLE_FT + 7 * BENCH_LEN_FT);
});

test("BENCH_DIST_FT lookup matches routeDistanceFt for every pair", () => {
  const ids = Object.keys(BENCH_DIST_FT);
  for (const a of ids) for (const b of ids) assert.equal(BENCH_DIST_FT[a][b], routeDistanceFt(a, b));
});

test("the 5 baseline fixtures are valid stations alongside the 24 benches", () => {
  assert.equal(STATION_IDS.length, 29);
  for (const id of ["SHARPS", "RECYCLE", "WASTE", "SINK", "CONSUM"]) assert.ok(STATION_IDS.includes(id));
});

test("two fixtures are both already past the back walkway — distance is pure lateral", () => {
  assert.equal(routeDistanceFt("SHARPS", "WASTE"), Math.abs(FIXTURES.SHARPS.feetX - FIXTURES.WASTE.feetX));
  assert.equal(routeDistanceFt("SINK", "CONSUM"), Math.abs(FIXTURES.SINK.feetX - FIXTURES.CONSUM.feetX));
  assert.equal(routeDistanceFt("SHARPS", "SHARPS"), 0);
});

test("reaching a fixture from a bench always crosses the back aisle once, regardless of walkway group", () => {
  // A1 (row 1, column A) -> SHARPS: descend 2 rows to the back aisle, cross it, walk
  // the lateral gap to the fixture.
  const expected = 2 * BENCH_LEN_FT + BACK_AISLE_FT + Math.abs(0 - FIXTURES.SHARPS.feetX);
  assert.equal(routeDistanceFt("A1", "SHARPS"), expected);
  assert.equal(routeDistanceFt("SHARPS", "A1"), expected); // symmetric
  // A bench already on row 3 skips the descent.
  assert.equal(routeDistanceFt("C3", "WASTE"), BACK_AISLE_FT + Math.abs(2 * BENCH_LEN_FT - FIXTURES.WASTE.feetX));
});

test("routeWaypoints for a fixture ends at its own center and starts at a real point", () => {
  const pts = routeWaypoints("A1", "SHARPS");
  assert.deepEqual(pts[pts.length - 1], center("SHARPS"));
  assert.equal(typeof pts[0].x, "number");
  assert.equal(typeof pts[0].y, "number");
});
