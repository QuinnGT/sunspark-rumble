# Docks reference milestone

Status: complete in v1.11.0. Baseline: 1.10.1, backed up at `pre-docks-milestone-1.10.1-portable.zip`.

The user approved substantial changes to building proportions, selected footprints and access routes. Establish one comparable gameplay view toward the boathouse across the cove before extending this standard across Sunhaven. Reference: `concepts/sunhaven-docks-v1.png`, with building vocabulary from `concepts/sunhaven-village-v1.png`.

## Visual and spatial direction

- Teal boathouse remains the primary landmark near (76,10), with a complete navy pitched roof, deep cream eaves, tall entrance, substantial porch and integrated accessible terrace. An upper volume or attached annex introduces the two-story vocabulary without rebuilding the whole village in this milestone.
- Preserve connected dry dock routes around the basin near (89,29.5). Building/access geometry may change; ground, collision, navigation and test expectations must change together. Keep two usable mainland approaches and clear doorways.
- Frame the cove with connected rock shelves and grassy crowns around its north/south banks; create a stronger lighthouse terrace/background silhouette. Terrain changes must use the shared heightfield. Do not place large disconnected rock ornaments over travel lanes.
- Broad rounded oak crowns and composed shrub/flower groups frame the path and roofs. Preserve trunk collision, culling, shadow/wind agreement and resource cleanup.
- Warm sunlight, cool readable shade, a clear blue sky and substantial soft clouds. Localized wear/dampness and small groups of maritime props support recognizable activity. Materials remain restrained, without multiplying full-size texture sets.
- Comparison camera starts on the outer boardwalk looking northwest: camera (105.5,7.8,23.4), target (76,5.2,0), FOV 62, with an ordinary third-person counterpart. This angle lets the taller roof and lighthouse share the skyline. Both archived 1.10.1 and the milestone use the same camera.

## Integration ownership

- Building agent: new architecture/dressing module and dock section of `sunhaven.js`; own new architecture tests. Publish footprint, floors, roof/terrace bounds and access waypoints. Coordinate ground clearance with terrain agent.
- Terrain agent: `maps.js`, new cliff/retaining module and terrain tests. Publish integration hook; root wires it into World. No changes to boathouse construction or plant module.
- Vegetation/lighting agent: new broad-oak module, `sunhaven-landscape.js`, sky/cloud functions in `nature-water.js`; lighting configuration module if useful. Publish World/game integration hooks instead of editing shared World/game files.
- Parent: model import pipeline, shared World/game integration, QA cameras/navigation/surface audit integration, foreground finish as needed, performance/resource and portable verification. Do not regenerate shared bundles while another agent depends on a stable baseline; parent owns builds and packaging.

## Acceptance

1. The comparison view clearly gains a full pitched-roof building, substantial porch/upper volume, connected rocky landforms, broad oak silhouettes and coherent warm/cool lighting. Save actual rendered images and assess each reference feature; a passing code suite alone does not complete the visual goal.
2. Reusable authored models are embedded locally with explicit loading/readiness/ownership where used; Three.js stays pinned. Any AO map uses non-color data and valid secondary UVs. Authoring scripts and provenance are retained.
3. All registered finishes and terrain clearances pass. Add coverage for new inclined/flat surfaces, not exemptions. Run the existing shader-mode, terrain, roof, crate and shadow regressions; update obsolete geometry expectations explicitly when the approved layout changes.
4. Ordinary player and bot traversal remains valid through both dock approaches, new entrances, terrace access and adjacent routes. Major visible solids provide matching collision/shot cover. Clear navigation uses spatial silhouettes as well as color.
5. All graphics presets work. Record whole-frame performance, draw calls and texture/geometry residency at matched cameras, verify loading/fallback/teardown, and investigate material regressions rather than hiding them.
6. Full automated suite, real-browser visual/traversal checks and final offline portable verification pass. Version, source, release folder and root ZIP agree; retain before/after evidence.

The seven proposed priorities form the wider art roadmap. This milestone establishes their environmental standard at the docks; an island-wide village/character expansion follows this scene rather than being implied complete by it. No new narrative, combat system or economy is introduced.


## Completed acceptance

Visual review accepted the final matched scene in `docks-visual-review.md`. All 185 automated tests, the 50-assembly/4,358-sample surface gate, 300 initial browser views plus corrected close-ups, ordinary player/bot routes, all-preset/both-map rendering, startup cancellation, teardown, no-HDR fallback and final offline release checks pass. Eight release files match source and ZIP by SHA-256. Evidence is under `tests/artifacts/docks-milestone`; `local-notes/REPORT.md` (kept out of the public repository) records scope, measured cost and limits. The established 16 MiB static geometry and 256 MiB image-cache limits were not relaxed. Reproduction: `npm test`, `npm run build:qa`, `npm start`, then the browser scripts with `--docks`, `npm run build`, `npm run package:release`, and `node tests/browser-offline.mjs`.
