import test from "node:test";
import assert from "node:assert/strict";
import {
  routeDistanceFt, routeWaypoints, BENCH_DIST_FT, STATION_IDS, STATION_NAME, NAME_TO_STATION_ID, center, front, FIXTURES,
  WALKWAY_WIDTH_FT, WALKWAY_LANE_FT, BACK_AISLE_FT, BENCH_LEN_FT, BENCH_WIDTH_FT, SLOTS,
  TOUCHING_PAIRS, DEFAULT_TRIO_ANCHOR, nearFixturesForAnchor, trioFixturesForAnchor, buildDistTable, DIST_TABLES_BY_ANCHOR,
} from "../src/data.js";

// Liang-Barsky segment/AABB clipping — true only for a real, nonzero-length
// crossing through `rect`'s interior, not a segment that merely touches a
// corner or edge. Used below to independently prove the diagonal routes never
// cut through a bench that isn't one of the route's own two endpoints.
function segmentCrossesRect(p0, p1, rect) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  let tmin = 0, tmax = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > tmax) return false; if (r > tmin) tmin = r; }
    else { if (r < tmin) return false; if (r < tmax) tmax = r; }
    return true;
  };
  if (!clip(-dx, p0.x - rect.x)) return false;
  if (!clip(dx, rect.x + rect.w - p0.x)) return false;
  if (!clip(-dy, p0.y - rect.y)) return false;
  if (!clip(dy, rect.y + rect.h - p0.y)) return false;
  return tmin < tmax;
}

test("same station is zero distance", () => {
  assert.equal(routeDistanceFt("A1", "A1"), 0);
});

test("same-column moves cross bench lengths within their shared walkway, no back-aisle detour", () => {
  assert.equal(routeDistanceFt("A1", "A2"), BENCH_LEN_FT);
  assert.equal(routeDistanceFt("A1", "A3"), 2 * BENCH_LEN_FT);
  assert.equal(routeDistanceFt("A3", "A1"), 2 * BENCH_LEN_FT); // symmetric
});

test("columns sharing one walkway (A-B) cross it directly, no back-aisle detour", () => {
  // Same row: just the walkway width (no vertical component to diagonalize).
  assert.equal(routeDistanceFt("A1", "B1"), WALKWAY_WIDTH_FT);
  // Adjacent row: the bench-length drop and the walkway-width crossing are
  // walked as one diagonal (the whole walkway between them is open floor),
  // which is shorter than doing the two legs separately.
  assert.equal(routeDistanceFt("A1", "B2"), Math.hypot(BENCH_LEN_FT, WALKWAY_WIDTH_FT));
  // Two rows apart (row 1 to row 3): B2 sits directly in the way of a direct
  // line regardless of which side of the walkway it's on, so this one case
  // keeps the old squared-off route instead of a diagonal.
  assert.equal(routeDistanceFt("A1", "B3"), 2 * BENCH_LEN_FT + WALKWAY_WIDTH_FT);
});

test("a touching pair (B-C) can't cut through each other — still routes via the back aisle", () => {
  // B and C touch directly but don't share a walkway (B's walkway is A-B, C's is C-D),
  // so B1 -> C1 has to detour: down to B3, diagonally across the back aisle (one
  // bench-width apart), up to C1. Down/up stay pure vertical (a third column's
  // benches would otherwise get cut through), but the aisle crossing itself is a
  // diagonal, same as the shared-walkway case above.
  const expected = 2 * BENCH_LEN_FT + Math.hypot(BACK_AISLE_FT, BENCH_WIDTH_FT) + 2 * BENCH_LEN_FT;
  assert.equal(routeDistanceFt("B1", "C1"), expected);
});

test("different walkway groups route down, diagonally across the back aisle (by bench width), and up", () => {
  // A (group AB) -> D (group CD): down 2 rows, diagonally across 3 bench-widths
  // (columns A,B,C,D are indices 0..3 apart) plus the aisle's own depth, up 2 rows.
  const expected = 2 * BENCH_LEN_FT + Math.hypot(BACK_AISLE_FT, 3 * BENCH_WIDTH_FT) + 2 * BENCH_LEN_FT;
  assert.equal(routeDistanceFt("A1", "D1"), expected);
});

test("row-3-to-row-3 cross-group move still pays the back-aisle crossing once", () => {
  assert.equal(routeDistanceFt("A3", "H3"), Math.hypot(BACK_AISLE_FT, 7 * BENCH_WIDTH_FT));
});

// --- Diagonal walking paths ---

test("a same-walkway diagonal is strictly shorter than the old squared-off route would have been", () => {
  const vertical = BENCH_LEN_FT;
  const squaredOff = vertical + WALKWAY_WIDTH_FT;
  assert.ok(routeDistanceFt("A1", "B2") < squaredOff, "diagonal should beat the old vertical-then-lateral sum");
});

test("a cross-walkway back-aisle crossing is strictly shorter than the old squared-off route would have been", () => {
  const down = 2 * BENCH_LEN_FT, up = 2 * BENCH_LEN_FT, lateral = 3 * BENCH_WIDTH_FT;
  const squaredOff = down + BACK_AISLE_FT + lateral + up;
  assert.ok(routeDistanceFt("A1", "D1") < squaredOff, "diagonal aisle crossing should beat the old sum");
});

test("a same-column move never gets a diagonal shortcut — a bench sits directly between non-adjacent rows", () => {
  // A2 physically blocks any straight line from A1 to A3, so this has to stay
  // the full vertical distance, not some shorter diagonal.
  assert.equal(routeDistanceFt("A1", "A3"), 2 * BENCH_LEN_FT);
});

test("a same-walkway pair two rows apart never gets a diagonal shortcut either — the middle row blocks it on both sides", () => {
  assert.equal(routeDistanceFt("A1", "B3"), 2 * BENCH_LEN_FT + WALKWAY_WIDTH_FT);
  assert.equal(routeDistanceFt("B3", "A1"), 2 * BENCH_LEN_FT + WALKWAY_WIDTH_FT); // symmetric
});

test("routeWaypoints starts and ends every same-walkway route at the two stations' fronts, never their centers", () => {
  for (const [aId, bId] of [["A1", "B2"], ["A1", "B3"], ["A1", "A3"], ["A1", "B1"]]) {
    const pts = routeWaypoints(aId, bId);
    assert.deepEqual(pts[0], front(aId), `${aId} -> ${bId} should start at ${aId}'s front`);
    assert.deepEqual(pts[pts.length - 1], front(bId), `${aId} -> ${bId} should end at ${bId}'s front`);
    assert.notDeepEqual(pts[pts.length - 1], center(bId), `${aId} -> ${bId} shouldn't overlap into ${bId}'s box`);
  }
});

test("routeWaypoints funnels a same-walkway route through the middle WALKWAY_LANE_FT of the walkway, not its full width", () => {
  const gapPx = SLOTS.B1.x - (SLOTS.A1.x + SLOTS.A1.w);
  const laneHalfPx = (gapPx * WALKWAY_LANE_FT) / WALKWAY_WIDTH_FT / 2;
  const laneCenterX = (SLOTS.A1.x + SLOTS.A1.w + SLOTS.B1.x) / 2;
  assert.ok(WALKWAY_LANE_FT < WALKWAY_WIDTH_FT, "the lane should be narrower than the walkway itself");

  const pts = routeWaypoints("A1", "B2");
  // A (left column, front faces right) enters at the lane's near/left edge;
  // B (right column, front faces left) is reached via the lane's near/right
  // edge — never the walkway's raw outer boundary on either side.
  assert.equal(pts[1].x, laneCenterX - laneHalfPx);
  assert.equal(pts[2].x, laneCenterX + laneHalfPx);
  assert.ok(pts[1].x > pts[0].x, "should step inward from A's own edge to reach the lane, not walk its raw edge");
  assert.ok(pts[2].x < pts[3].x, "should leave the lane before reaching B's own edge, not walk its raw edge");
});

test("routeWaypoints goes to the closest point of the lane, then as directly as possible to the next station", () => {
  // "Closest": entering from the front, the very next point is already inside
  // the lane — no detour past it and back. "As directly as possible": from
  // there to the point of the lane nearest the destination is a single
  // segment (no extra bends), then straight out to the destination's front.
  const pts = routeWaypoints("A1", "B2");
  assert.equal(pts.length, 4, "front -> lane entry -> lane exit -> front, nothing more");
});

test("routeWaypoints keeps a same-column move inside the lane too — both ends use the same near edge", () => {
  const pts = routeWaypoints("A1", "A3");
  assert.deepEqual(pts[pts.length - 1], front("A3"));
  // Same column means the same "near" side of the lane on both ends, so the
  // middle of the path is a single straight vertical run inside the lane.
  assert.equal(pts[1].x, pts[2].x);
  assert.notEqual(pts[1].x, pts[0].x, "should still step off A1's own edge into the lane");
});

test("every same-walkway route (any two columns, any two rows) avoids every other bench's box", () => {
  // Front-to-front, funneled through the lane, is safe for every combination
  // — including two rows apart, which a raw center-to-center diagonal is not
  // (see the routing model's own comments) — because the whole line from one
  // front to the other never re-enters either column's width.
  const WALKWAY_GROUPS = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"]];
  const groupOf = (col) => WALKWAY_GROUPS.findIndex((g) => g.includes(col));

  for (const aId of Object.keys(SLOTS)) {
    for (const bId of Object.keys(SLOTS)) {
      if (aId === bId || groupOf(aId[0]) !== groupOf(bId[0])) continue; // different walkways route via the back aisle instead
      const pts = routeWaypoints(aId, bId);
      for (let i = 1; i < pts.length; i++) {
        const segment = [pts[i - 1], pts[i]];
        for (const [otherId, rect] of Object.entries(SLOTS)) {
          if (otherId === aId || otherId === bId) continue;
          assert.ok(
            !segmentCrossesRect(segment[0], segment[1], rect),
            `${aId} -> ${bId} leg ${i} cuts through ${otherId}`,
          );
        }
      }
    }
  }
});

test("BENCH_DIST_FT lookup matches routeDistanceFt for every pair", () => {
  const ids = Object.keys(BENCH_DIST_FT);
  for (const a of ids) for (const b of ids) assert.equal(BENCH_DIST_FT[a][b], routeDistanceFt(a, b));
});

test("the 8 fixtures are valid stations alongside the 24 benches", () => {
  assert.equal(STATION_IDS.length, 32);
  for (const id of ["SHARPS", "RECYCLE", "WASTE", "SINK", "GLASSWARE", "CONSUM1", "CONSUM2", "REFRIGERATOR"]) {
    assert.ok(STATION_IDS.includes(id));
  }
});

test("every station has a fixed name, and every name resolves back to its station", () => {
  assert.equal(Object.keys(STATION_NAME).length, STATION_IDS.length);
  for (const id of STATION_IDS) {
    assert.ok(STATION_NAME[id], `${id} has no name`);
    assert.equal(NAME_TO_STATION_ID[STATION_NAME[id].toLowerCase()], id);
  }
});

test("station names match the hardcoded row/column layout", () => {
  assert.equal(STATION_NAME.A1, "Opentrons");
  assert.equal(STATION_NAME.H1, "Small Equipment");
  assert.equal(STATION_NAME.A3, "Hamilton");
  assert.equal(STATION_NAME.D3, "PCR");
  assert.equal(STATION_NAME.H3, "Prototyping");
});

test("the sharps/recycling/biohazard trio is aliased to its anchor column's row-3 bench", () => {
  // Touching row 3 directly means reaching one from its own anchor column's row 3
  // bench is free, and from elsewhere in that column is the normal same-column hop.
  assert.equal(routeDistanceFt("B3", "SHARPS"), 0);
  assert.equal(routeDistanceFt("B1", "SHARPS"), 2 * BENCH_LEN_FT);
  assert.equal(routeDistanceFt("C3", "WASTE"), 0);
  // From a different walkway group it's exactly like reaching the anchor's row 3.
  assert.equal(routeDistanceFt("A1", "SHARPS"), routeDistanceFt("A1", "B3"));
  assert.equal(routeDistanceFt("D1", "SHARPS"), routeDistanceFt("D1", "B3"));
  // Recycling straddles both B and C — reachable via whichever is closer.
  assert.equal(routeDistanceFt("B1", "RECYCLE"), Math.min(routeDistanceFt("B1", "B3"), routeDistanceFt("B1", "C3")));
});

test("two trio members resolve through their two anchor columns", () => {
  // SHARPS (anchor B) <-> WASTE (anchor C) is exactly a B3<->C3 trip.
  assert.equal(routeDistanceFt("SHARPS", "WASTE"), routeDistanceFt("B3", "C3"));
});

test("the sink/consumables pair sits beyond the back walkway — pure lateral between them", () => {
  const d = routeDistanceFt("SINK", "CONSUM2");
  assert.ok(d > 0);
  assert.equal(routeDistanceFt("SINK", "SINK"), 0);
});

test("reaching the far pair from a bench always crosses the back aisle once", () => {
  const fromRow1 = routeDistanceFt("A1", "SINK");
  const fromRow3 = routeDistanceFt("C3", "SINK");
  assert.ok(fromRow1 > fromRow3, "row 1 should be farther from the back aisle than row 3");
});

test("the trio and the far pair are on opposite sides of the same walkway", () => {
  // Going from a trio member to a far fixture still has to cross the back aisle,
  // same as bench-to-far, but skips the "down to row 3" portion since the trio is
  // already sitting right at that boundary.
  assert.equal(routeDistanceFt("SHARPS", "SINK"), routeDistanceFt("B3", "SINK"));
});

test("the far row orders sink, glassware, Consumables 1, Consumables 2 left to right", () => {
  assert.ok(routeDistanceFt("SINK", "GLASSWARE") < routeDistanceFt("SINK", "CONSUM1"));
  assert.ok(routeDistanceFt("SINK", "CONSUM1") < routeDistanceFt("SINK", "CONSUM2"));
});

test("the refrigerator is a far fixture, reachable like any other far fixture", () => {
  assert.ok(routeDistanceFt("A1", "REFRIGERATOR") > 0);
  assert.equal(routeDistanceFt("REFRIGERATOR", "REFRIGERATOR"), 0);
  // Far from column H, since it sits just past it.
  assert.ok(routeDistanceFt("H3", "REFRIGERATOR") < routeDistanceFt("A3", "REFRIGERATOR"));
});

test("routeWaypoints for a fixture ends at its own front, not its center, and starts at a real point", () => {
  for (const id of ["SHARPS", "RECYCLE", "WASTE", "SINK", "GLASSWARE", "CONSUM1", "CONSUM2", "REFRIGERATOR"]) {
    const pts = routeWaypoints("A1", id);
    assert.deepEqual(pts[pts.length - 1], front(id), `${id} path should end at its front`);
    assert.notDeepEqual(pts[pts.length - 1], center(id), `${id} path shouldn't overlap into its own box`);
    assert.equal(typeof pts[0].x, "number");
    assert.equal(typeof pts[0].y, "number");
  }
});

test("routeWaypoints for a cross-walkway bench pair also ends at the destination's front, not its center", () => {
  const pts = routeWaypoints("A1", "D1");
  assert.deepEqual(pts[pts.length - 1], front("D1"));
  assert.notDeepEqual(pts[pts.length - 1], center("D1"));
});

// --- Lab Optimizer support: alternate trio anchors ---

test("the 3 touching pairs are exactly B-C, D-E, F-G, and the default anchor is B-C", () => {
  assert.deepEqual(TOUCHING_PAIRS, { BC: ["B", "C"], DE: ["D", "E"], FG: ["F", "G"] });
  assert.equal(DEFAULT_TRIO_ANCHOR, "BC");
});

test("nearFixturesForAnchor keeps sharps-left/waste-right/recycle-both for every anchor", () => {
  assert.deepEqual(nearFixturesForAnchor("BC"), { SHARPS: ["B"], WASTE: ["C"], RECYCLE: ["B", "C"] });
  assert.deepEqual(nearFixturesForAnchor("DE"), { SHARPS: ["D"], WASTE: ["E"], RECYCLE: ["D", "E"] });
  assert.deepEqual(nearFixturesForAnchor("FG"), { SHARPS: ["F"], WASTE: ["G"], RECYCLE: ["F", "G"] });
});

test("routeDistanceFt aliases a custom anchor's trio to that anchor's own row-3 benches", () => {
  const de = nearFixturesForAnchor("DE");
  assert.equal(routeDistanceFt("D3", "SHARPS", de), 0);
  assert.equal(routeDistanceFt("E3", "WASTE", de), 0);
  // Same-anchor cross-member trip is exactly a D3<->E3 trip, mirroring the
  // default anchor's SHARPS<->WASTE = B3<->C3 relationship.
  assert.equal(routeDistanceFt("SHARPS", "WASTE", de), routeDistanceFt("D3", "E3"));
  // The real (BC) anchor is unaffected by passing a different one elsewhere.
  assert.equal(routeDistanceFt("B3", "SHARPS"), 0);
});

test("trioFixturesForAnchor keeps the trio's left-to-right order (sharps, recycling, biohazard) at every anchor", () => {
  for (const key of Object.keys(TOUCHING_PAIRS)) {
    const boxes = trioFixturesForAnchor(key);
    assert.ok(boxes.SHARPS.x < boxes.RECYCLE.x, `${key}: sharps should be left of recycling`);
    assert.ok(boxes.RECYCLE.x < boxes.WASTE.x, `${key}: recycling should be left of biohazard`);
  }
  // The default anchor's box matches the real, hardcoded FIXTURES positions.
  assert.deepEqual(trioFixturesForAnchor(DEFAULT_TRIO_ANCHOR).SHARPS, FIXTURES.SHARPS);
  assert.deepEqual(trioFixturesForAnchor(DEFAULT_TRIO_ANCHOR).WASTE, FIXTURES.WASTE);
});

test("buildDistTable for the default anchor matches BENCH_DIST_FT exactly", () => {
  const table = buildDistTable(nearFixturesForAnchor(DEFAULT_TRIO_ANCHOR));
  assert.deepEqual(table, BENCH_DIST_FT);
});

test("DIST_TABLES_BY_ANCHOR has one table per anchor, BC identical to BENCH_DIST_FT", () => {
  assert.deepEqual(Object.keys(DIST_TABLES_BY_ANCHOR).sort(), ["BC", "DE", "FG"]);
  assert.equal(DIST_TABLES_BY_ANCHOR.BC, BENCH_DIST_FT);
  // A DE-anchored table disagrees with the real one specifically on trio distances.
  assert.notEqual(DIST_TABLES_BY_ANCHOR.DE.SHARPS.A1, BENCH_DIST_FT.SHARPS.A1);
  // ...but agrees everywhere that has nothing to do with the trio.
  assert.equal(DIST_TABLES_BY_ANCHOR.DE.A1.H3, BENCH_DIST_FT.A1.H3);
});
