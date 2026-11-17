# Docks landforms integration

Implemented source: `src/maps.js`, `src/docks-landforms.js`. Call `addDocksLandforms(world)` after Sunhaven generation and before landscape/batching. Repeated calls return the same result.

## Shape and ground authority

- North cove: connected lower shelf and raised crown centred at (94,-2), elliptical radii 15 x 13 metres, final centre height 9.320545.
- South cove: connected shelves centred at (94,53), radii 17 x 12 metres, final centre height 7.091373.
- Lighthouse: connected flanking terraces centred at (-14,-80) and (14,-81), capped at 9.55 metres. Existing summit stays at 10 metres.
- Angular modulation makes the escarpments irregular; the sampled heightfield supplies every visible top and slope. These are connected landforms, not large ornamental boulders.
- Boathouse body, porch, annex, rear landing and folded ramp footprints clear terrain by at least 25mm beneath the 3.3m finished floor. Rear approach (76,2) and terrace ramp mouth (63,19) are graded to 3.25m, blending into the mainland. Centre floor height is independent of the terrain below the pilings.
- The boardwalk basin now cuts through the old route-protection mask only inside a bounded open-harbor footprint. All interior water samples x82..100/z22.5..36.5 are below -1.35m, with sandy shallows at the pile bases and curved granite bank transitions. This removes the tall grassy mound visible in the first combined camera draft. Global water level and deck height remain unchanged.
- The original two dock ramp mouths remain unchanged: H(72,20)=1.9203596 and H(72,39)=3.1670265. The basin along z=28 remains connected below sea level.

The permitted source-change bounds are exported as `DOCKS_LANDFORM_BOUNDS`: architecture x58..86/z-3..23, north cove x77..112/z-17..13, south cove x74..114/z39..67, lighthouse x-28..28/z-102..-58, and the open harbor x78..109/z17.25..42.1. Fractional samples may need a one-cell border when comparing old terrain because interpolation uses neighbouring vertices. `sunhavenArtHeightSource` retains the complete 1.10.1 baseline; `docksMilestoneHeight` adds the approved changes; `inDocksLandformBounds` makes the scope testable.

## Rendering and collision

`addDocksLandforms` partitions steep triangles from existing terrain chunks into weathered granite meshes under `world.ground`. It removes the corresponding original indices before adding those triangles. There is exactly one rendered face at each interior sample, with unchanged total terrain triangle count. All movement, projectile-heightfield rays and Three.js ground raycasts agree. Nothing is added as a separate obstacle or elevated collision box.

The partition uses approximately 1,800 existing triangles in 12 additional material groups, with one cloned coastal stone material, metre UVs, facet normals and mild vertex-color variation. Stone meshes retain terrainMask attributes and bounded chunk geometry. The original terrain shader/material remains intact. `world.docksLandforms.diagnostics()` reports actual face/group counts; terrain chunk diagnostics should exclude children with `userData.docksCliff`.

New geometry is owned by the existing ground disposer. Its wrapper disposes the sole cloned stone material once; borrowed texture maps remain owned by the shared nature cache. All new faces stay under the ground resource-scope exclusion and do not pass through permanent-solid cloning.

## Verification and remaining visual gate

`node --test --test-isolation=none tests/terrain-art.test.js tests/terrain-pipeline.test.js tests/docks-landforms.test.js` passes all 17 tests after the focused cove refinement. Adding `tests/sunhaven-polish.test.js` passes all 23 tests. Terrain-pipeline tests required no changes: original analytic approximation tolerances still pass. Terrain-art comparisons retain strict original heights for all spawns/finales and existing ramps, and for pad/route points outside the approved bounds. Revised points are checked against actual rendered ground; the dedicated docks regression fixes new support grades, landform heights, source-change locality and every extracted face's exact single-hit raycast.

The map/navigation suite also passed all eight existing tests against the in-progress architecture. Parent still owns final whole-scene visual review at the comparison camera, the full surface gate, runtime resource/performance checks, complete browser traversal and release packaging. No bundles or package metadata were changed by this subtask.


## Updated browser fixtures

`tests/browser-surface-clearance.mjs` retains the eleven unchanged assemblies and obtains every new boathouse target from actual registered surface points and normals. It frames covered interior floors separately, views both roof slopes from their eaves, and frames vertical finishes along their outward normals. The five unchanged roof climbs, folded terrace access, front/rear doors, porch-to-dock connections, shed traversal, rooftop crate landing and all three compiled shadow-mode checks remain active.

`tests/browser-sunhaven-polish.mjs` waits for model/shader readiness, stages the new boathouse on its actual 3.3m floor, and follows published keyboard waypoints through both doors and onto the dock and terrace. The node polish fixture retains its old 14cm ground gap for all unchanged interiors; only the approved boathouse uses the shared 20mm structural minimum against its deliberately raised approach pad.

After the parent produces the current QA bundle and starts the local server, run `node tests/browser-surface-clearance.mjs` and `node tests/browser-sunhaven-polish.mjs --art`. Browser runs were not started by this subtask while the parent was still integrating art refinements.
