# Doorway beam flicker — v1.12.2

The reported moving stripe patterns came from two geometric conflicts. Wall end faces coincided with the inward faces of the white jambs, and the upright posts overlapped the headers with coplanar front/back faces. The old wall grids sampled the broad siding planes, so neither conflict was covered despite the previous surface gate passing.

The added registrations reproduce 66 failing faces in v1.12.1. Nine open frames are affected: both sides of the two village houses and orchard building, the boathouse's front and rear entrances, and the workshop entrance. This patch retains the original natural trees, new rocks, painted timber, door widths and collision shapes.

## Construction

Wall ends now recess 30 mm behind continuous jamb linings. Boathouse backing also recesses 25 mm at its ends so cladding and backing do not share an end plane. Rendered posts terminate below the header instead of extending through it. Village frame linings cover the entire wall thickness, and navy strips stop above the plinths instead of overlapping them. The wall above each header remains opaque: its backing and siding meet the adjacent wall with butt joints rather than carrying the doorway recess up as a slit.

Original collision meshes stay in the solids list with their original dimensions. Collision-only meshes are invisible and excluded from generated solid visual batches. No depth-test, render-order, polygon-offset, shadow-bias or camera-clipping workaround is used.

`registerJoineryFaces` captures exposed beam faces in parent coordinates before batching, including the narrow inward reveals and samples near both ends. It adds 81 face registrations (three faces per post/header across nine frames). The actual island gate now checks 131 registrations / 6,833 samples at the existing 20 mm minimum.

## Regression coverage

`tests/joinery-clearance.test.js` rejects coincident reveal faces and crossing post/header faces after transformed batching, accepts separated backing and proper joints, and verifies that recessed visuals preserve exact collision. The real-island surface test covers every doorway registration and casts through both sides of each wall above the header to detect an open slit. `AGENTS.md`, `npm run test:surfaces` and the packaging gate include this coverage.

`tests/browser-beam-clearance.mjs` compares the saved v1.12.1 bundle with the current QA bundle at nine doors, three eye-height walk-by angles and all three graphics presets: 81 views per build. The usual surface browser regression retains its 300 elevated/grazing views and keyboard roof, terrace, doorway, dock, shed and crate routes. Screenshots require human/visual inspection; neither script claims to classify temporal flicker automatically.

Final automated source suite: 197/197 pass, including the prior rock contact and movement tests. All 81 final doorway views and 300 structural views were reviewed through contact sheets; representative before/after frames were inspected at full size. All keyboard traversal routes and browser checks pass with no errors. The final portable v1.12.2 passes direct offline file loading in 7,874 ms, with no requests/errors/QA mutation hooks, movement/build/fire/reload, ten map switches and both bot populations. All eight source/release/ZIP hashes match.

Evidence is in `tests/artifacts/beam-clearance`: `before-audit.json`, `full-tests.txt`, before/after browser reports and images, the `surfaces` directory, `package-log.txt`, `offline-report.json` and `package-verification.json`. `iteration-recess-audit.json` is an intermediate geometry check; the package log records the final source gate. These finite sampled faces and camera positions do not prove every possible flicker or overlap is absent.
