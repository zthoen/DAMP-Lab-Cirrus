/* Static lab floor geometry: the physical grid every station map is drawn onto,
   independent of whatever equipment/station table a user loads. Fixed at 8 columns
   (A-H) x 3 rows (1-3) = 24 benches, plus 5 fixed utility fixtures beyond the back
   wall (waste/sharps/recycling/sink/consumables — see FIXTURES below). Storage
   aisles from the original sim are otherwise out of scope for now. */

// Real-world reference measurements the protocol generator's "distance walked" is
// built from (see routeDistanceFt below) — approximate, as given by the lab:
// benches are ~7ft long, walkways are ~6ft wide, and the walkway past row 3 is
// ~5ft wide.
export const BENCH_LEN_FT = 7;
export const WALKWAY_WIDTH_FT = 6;
export const BACK_AISLE_FT = 5;

// Benches touch — there's no gap within a column (A1 touches A2 touches A3) or
// between the two columns of a touching pair (B touches C, D touches E, F touches
// G). The only open space on the floor is the 5 walkways: one between each of
// A|B, C|D, E|F, G|H, plus the back walkway past row 3. A bench can only be
// reached by walking to its front (the edge facing its walkway) and using that
// walkway — never by cutting through another bench.
const SLOT_W = 70, SLOT_H = 62;
const COL_X = { A: 40, B: 150, C: 220, D: 330, E: 400, F: 510, G: 580, H: 690 };
const ROW_Y = { 1: 30, 2: 30 + SLOT_H, 3: 30 + 2 * SLOT_H };
export const SLOTS = {};
for (const [c, x] of Object.entries(COL_X)) for (const r of [1, 2, 3]) SLOTS[c + r] = { x, y: ROW_Y[r], w: SLOT_W, h: SLOT_H };

// Each pair shares one walkway; the first column in a pair faces it on the right,
// the second faces it on the left (the pair's touching neighbor, if any, blocks
// the other side).
const WALKWAY_GROUPS = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"]];
const COL_ORDER = WALKWAY_GROUPS.flat();
const groupOf = (col) => WALKWAY_GROUPS.findIndex((g) => g.includes(col));
const frontSide = (col) => (WALKWAY_GROUPS[groupOf(col)][0] === col ? "right" : "left");
const walkwayCenterX = (g) => {
  const [l, r] = WALKWAY_GROUPS[g];
  return (COL_X[l] + SLOT_W + COL_X[r]) / 2;
};

// The back walkway runs behind row 3, connecting the bottom of all 4 vertical
// walkways — the only lateral path between walkway groups, and the only way to
// reach the fixtures beyond it (see FIXTURES below).
export const BACK_AISLE_Y = ROW_Y[3] + SLOT_H + 30;
export const BACK_AISLE_H = 34;

// Vertical walkway rectangles, for the map to render as open lanes (no text — the
// floor plan should read as walkways without needing them individually labeled).
export const WALKWAYS = WALKWAY_GROUPS.map(([l, r]) => ({
  x: COL_X[l] + SLOT_W,
  width: COL_X[r] - (COL_X[l] + SLOT_W),
  y: ROW_Y[1],
  height: ROW_Y[3] + SLOT_H - ROW_Y[1],
}));

/* Fixed utility fixtures beyond the back wall — baselines that never move, laid
   out (left to right) exactly as given: the sharps bin at the end of column B,
   a recycling bin between it and the biohazard box at the end of column C, then
   the sink and consumables storage continuing the same wall run. Real dimensions
   (feet) are kept as "length" (the top-to-bottom extent, facing the wall) x
   "width" (the left-to-right extent), scaled up for map legibility since a
   couple of feet would otherwise round to an unreadably small box. */
const FIXTURE_PX_PER_FT = 16;
// Clear floor space below the back walkway before the fixtures start, plus
// headroom above the boxes for an external ID label (these are small enough
// that text never fits inside them the way it does inside a bench) — enough of
// a gap that the fixtures read as clearly beyond the walkway, not crowding it.
const FIXTURE_TOP_Y = BACK_AISLE_Y + BACK_AISLE_H / 2 + 45;
const FIXTURE_GAP = 12;
const box = (lengthFt, widthFt) => ({ w: Math.round(widthFt * FIXTURE_PX_PER_FT), h: Math.round(lengthFt * FIXTURE_PX_PER_FT) });

const sharpsBox = box(2, 1), recycleBox = box(1.5, 3), wasteBox = box(2, 2), sinkBox = box(2, 4), consumBox = box(2, 4);
// Chained left to right so boxes never overlap regardless of their relative
// widths, with the sharps/recycling/biohazard trio centered under the B-C
// walkway boundary (the "end of column B" / "end of column C" it sits between).
const trioWidth = sharpsBox.w + FIXTURE_GAP + recycleBox.w + FIXTURE_GAP + wasteBox.w;
const sharpsX = (COL_X.B + SLOT_W / 2 + COL_X.C + SLOT_W / 2) / 2 - trioWidth / 2;
const recycleX = sharpsX + sharpsBox.w + FIXTURE_GAP;
const wasteX = recycleX + recycleBox.w + FIXTURE_GAP;
const sinkX = wasteX + wasteBox.w + FIXTURE_GAP;       // continues the wall run past the biohazard box
const consumX = sinkX + sinkBox.w + FIXTURE_GAP;

export const FIXTURES = {
  SHARPS: { name: "Sharps Bin", x: sharpsX, y: FIXTURE_TOP_Y, w: sharpsBox.w, h: sharpsBox.h, feetX: 2 },
  RECYCLE: { name: "Recycling Bin", x: recycleX, y: FIXTURE_TOP_Y, w: recycleBox.w, h: recycleBox.h, feetX: 5 },
  WASTE: { name: "Biohazard Waste", x: wasteX, y: FIXTURE_TOP_Y, w: wasteBox.w, h: wasteBox.h, feetX: 8 },
  SINK: { name: "Sink", x: sinkX, y: FIXTURE_TOP_Y, w: sinkBox.w, h: sinkBox.h, feetX: 11 },
  CONSUM: { name: "Consumables Storage", x: consumX, y: FIXTURE_TOP_Y, w: consumBox.w, h: consumBox.h, feetX: 14 },
};
const FIXTURE_IDS = Object.keys(FIXTURES);
export const isFixtureId = (id) => Object.prototype.hasOwnProperty.call(FIXTURES, id);

// centers are static (SLOTS/FIXTURES never change at runtime) — precompute once.
const CENTER_CACHE = {};
for (const id in SLOTS) CENTER_CACHE[id] = { x: SLOTS[id].x + SLOTS[id].w / 2, y: SLOTS[id].y + SLOTS[id].h / 2 };
for (const id in FIXTURES) CENTER_CACHE[id] = { x: FIXTURES[id].x + FIXTURES[id].w / 2, y: FIXTURES[id].y + FIXTURES[id].h / 2 };
export const center = (id) => CENTER_CACHE[id];

// The point on a station's edge that actually opens onto its walkway — every
// route starts and ends here, never at a raw straight line between two centers.
// A bench's front is whichever side faces its walkway; a fixture's front is its
// top edge, since the back walkway is the only way to reach it.
export const front = (id) => {
  if (isFixtureId(id)) { const f = FIXTURES[id]; return { x: f.x + f.w / 2, y: f.y }; }
  const r = SLOTS[id], c = center(id);
  return frontSide(id[0]) === "right" ? { x: r.x + r.w, y: c.y } : { x: r.x, y: c.y };
};

export const STATION_IDS = [...Object.keys(SLOTS), ...FIXTURE_IDS];
const rowOf = (id) => Number(id[1]);

// A station's position along the "wall" axis used for lateral distance — bench
// columns are spaced one bench-length apart (matching the pixel layout's touching/
// gapped pattern isn't needed here, just a consistent unit), fixtures use their
// own real feet position along that same run.
const wallFeetX = (id) => (isFixtureId(id) ? FIXTURES[id].feetX : COL_ORDER.indexOf(id[0]) * BENCH_LEN_FT);

/* A bench can only be reached through its walkway, so every bench-to-bench route
   is: front of the start bench -> down/up its walkway -> (if the destination is on
   a different walkway) across the back walkway -> down/up the destination's
   walkway -> front of the destination bench. Two benches sharing one walkway (same
   column, or the two columns of a touching pair) skip the back-walkway detour
   entirely. The 5 fixtures sit just beyond the back walkway, so reaching one from
   a bench always costs one back-walkway crossing plus the lateral walk to line up
   with it; two fixtures are both already past that walkway, so moving between them
   is pure lateral distance. */
export function routeDistanceFt(aId, bId) {
  if (aId === bId) return 0;
  const aFix = isFixtureId(aId), bFix = isFixtureId(bId);
  if (aFix && bFix) return Math.abs(wallFeetX(aId) - wallFeetX(bId));
  if (!aFix && !bFix) {
    const colA = aId[0], colB = bId[0], rowA = rowOf(aId), rowB = rowOf(bId);
    const gA = groupOf(colA), gB = groupOf(colB);
    if (gA === gB) {
      const vertical = Math.abs(rowA - rowB) * BENCH_LEN_FT;
      const lateral = colA === colB ? 0 : WALKWAY_WIDTH_FT;
      return vertical + lateral;
    }
    const down = (3 - rowA) * BENCH_LEN_FT;
    const up = (3 - rowB) * BENCH_LEN_FT;
    const lateral = Math.abs(COL_ORDER.indexOf(colA) - COL_ORDER.indexOf(colB)) * BENCH_LEN_FT;
    return down + BACK_AISLE_FT + lateral + up;
  }
  const benchId = aFix ? bId : aId;
  const down = (3 - rowOf(benchId)) * BENCH_LEN_FT;
  const lateral = Math.abs(wallFeetX(aId) - wallFeetX(bId));
  return down + BACK_AISLE_FT + lateral;
}

// Precomputed so the protocol generator can pick a "force movement" step without
// recomputing the route per draw.
export const BENCH_DIST_FT = {};
for (const a of STATION_IDS) {
  BENCH_DIST_FT[a] = {};
  for (const b of STATION_IDS) BENCH_DIST_FT[a][b] = routeDistanceFt(a, b);
}

// The point on the back-walkway travel line aligned with a station's x — for a
// bench that's its own walkway's centerline; for a fixture it's directly above
// its front (the back walkway is the only thing above it).
const railPoint = (id) => (isFixtureId(id) ? { x: front(id).x, y: BACK_AISLE_Y } : { x: walkwayCenterX(groupOf(id[0])), y: BACK_AISLE_Y });

// [front(id), ...intermediate points..., railPoint(id)] — the walk from a station
// out to the back-walkway rail.
const toRailPoints = (id) => {
  const f = front(id);
  if (isFixtureId(id)) return [f, railPoint(id)];
  return [f, { x: railPoint(id).x, y: f.y }, railPoint(id)];
};
// [railPoint(id), ...intermediate points..., front(id), center(id)] — the mirror
// image of toRailPoints, walking from the rail in to a station.
const fromRailPoints = (id) => {
  const f = front(id), c = center(id);
  if (isFixtureId(id)) return [railPoint(id), f, c];
  return [railPoint(id), { x: railPoint(id).x, y: f.y }, f, c];
};

/* Pixel waypoints mirroring routeDistanceFt's route exactly, for drawing the same
   path on the SVG map: front of the start station, through the middle of whatever
   walkway(s) it uses, to the front and then the center of the destination. Returns
   the points *after* the start (the caller already has the previous station's
   center), so consecutive legs of a multi-step path concatenate directly into one
   continuous line. */
export function routeWaypoints(aId, bId) {
  const aFix = isFixtureId(aId), bFix = isFixtureId(bId);

  if (!aFix && !bFix) {
    const fA = front(aId), fB = front(bId), cB = center(bId);
    const gA = groupOf(aId[0]), gB = groupOf(bId[0]);
    if (gA === gB) {
      const wx = walkwayCenterX(gA);
      return [fA, { x: wx, y: fA.y }, { x: wx, y: fB.y }, fB, cB];
    }
    const wxA = walkwayCenterX(gA), wxB = walkwayCenterX(gB);
    return [
      fA, { x: wxA, y: fA.y }, { x: wxA, y: BACK_AISLE_Y },
      { x: wxB, y: BACK_AISLE_Y }, { x: wxB, y: fB.y }, fB, cB,
    ];
  }

  // At least one endpoint is a fixture: always route via the back-walkway rail —
  // toRailPoints(aId) ends exactly where fromRailPoints(bId) begins (both at
  // railPoint), so concatenating them traces the lateral rail segment for free.
  return [...toRailPoints(aId), ...fromRailPoints(bId)];
}
