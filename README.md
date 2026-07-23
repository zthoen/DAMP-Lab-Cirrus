# DAMP Lab - Cirrus

A browser-based tool for laying out a lab floor and reasoning about how much a
technician has to walk to run a protocol on it. No backend, no database — a
small Vite + React single-page app that runs entirely client-side.

## What it does

- **Equipment Input** — paste an equipment-to-station table from a spreadsheet
  and see it laid out on a fixed 24-bench lab floor grid (plus 8 utility
  fixtures: sharps bin, recycling, biohazard waste, sink, glassware, two
  consumables stations, and a refrigerator).
- **Protocol Generator** — generate fake protocols (randomized, seeded step
  sequences) engineered to force movement between benches instead of letting a
  technician camp at one station.
- **Protocol Visualizer** — paste a *real* protocol (step/substep/equipment)
  and see its actual walked route plotted on the map, step by step or start to
  finish.
- **Lab Optimizer** — paste one or more real protocols and search for a
  station layout that minimizes total distance walked across all of them,
  within a few fixed constraints on what's allowed to move.
- **Protocol Scheduler** — paste one or more *timed* real protocols, in
  priority order, and find the earliest start time for each one that never
  double-books a piece of equipment.

## Running it

```
npm install
npm run dev
```

This opens a local dev server (defaults to port 3000). Other scripts:

```
npm run build     # production build
npm run preview   # preview the production build
npm test          # run the test suite (Node's built-in test runner, no extra deps)
```

## Development

See `CLAUDE.md` for an architectural walkthrough of how the pieces fit
together — the lab floor's geometry/distance model, the table/protocol
parsers, the layout optimizer's search, and the scheduler's conflict
resolution.

## Handoff packages

`handoff/` holds standalone TypeScript ports of individual tools, prepped
for embedding into other, external React codebases — each subfolder is a
self-contained mini-package (its own `package.json`/`tsconfig.json`/
`README.md`) with no dependency on this app. See `handoff/protocol-visualizer/`
for the first one.
