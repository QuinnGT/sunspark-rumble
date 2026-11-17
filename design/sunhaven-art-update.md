# Sunhaven texture and terrain update

Status: complete and verified as 1.10.0. The source, portable folder and root ZIP contain the finished update.

The accepted docks, village and island concepts establish the direction: warm weathered timber, teal/coral coastal buildings with cream trim and navy hardware, substantial construction details, pale rock shoulders, sandy routes, clear turquoise shallows, and layered green planting with small cream/yellow/lavender flowers. Details must read from the ordinary third-person camera. Broad shape, material scale and composition take priority over tiny surface noise.

## Goal and team

The active goal delivers a playable Driftwood Docks reference area and carries the same material and landscape language across Sunhaven. The work preserves door openings, connected boardwalks, accessible roof decks, construction pockets, collision/cover, bot routes, map choices and the offline release.

| Responsibility | Owner | Deliverable |
| --- | --- | --- |
| Visual direction and integration | Main agent | Consistent reference interpretation, shared source integration, screenshots and gameplay review |
| Material production | materials_artist | Coordinated timber/paint/trim/roof/metal materials, embedded assets, provenance and cache integration |
| Coastal architecture and props | coastal_environment_artist | Boardwalk kit, boathouse/facade detail, crates, shaped boats and maritime fixtures |
| Terrain and landscape composition | terrain_environment_artist | Authored shoulders/seabed/transitions, rock and plant clusters, district identity, protected routes |
| Rendering performance | render_performance_qa | Frozen A/B batching experiments, attribute/ownership regressions, draw and memory tradeoffs |
| Verification and release | Main agent | Regression checks, all-preset profiling, visual review, offline launch and package hashes |

## Production boundaries

- Use the existing 1m sampled terrain as the single height authority. Preserve authored building pads, ramps, spawn/finale pockets and main travel corridors.
- Use fitted geology and coherent groups of low plants around landforms. Keep busy detail away from route centers and combat sightlines. Large rocks or other new blockers need matching collision and shot cover.
- Model the thickness and silhouette of boards, pilings, frames, hulls and fixtures. Use material maps for grain, wear and fine relief. Boards get metre-based UVs and plausible grain direction; avoid a large repeated wavy slab texture.
- Retain playable flat roofs. The reference's gables may inform facade pediments, sheds and other suitable parts without obstructing established roof routes.
- Share material sets and geometry through the 1.9.0 caches, spatial batching and ownership system. Maintain correct color/data channels, shader guards, wind bounds and optional rendering budgets.
- Keep asset maps generally at 1K, all under 2K, with diagnostics accounting for residency. All assets and required decoding code must ship locally. Record sources and licenses for any added external art.
- Preserve the current sunny toy-game identity and HUD readability. This pass changes environment art; it does not redesign controls, weapons, difficulty or match rules.

## Acceptance

1. Fixed-camera before/after gameplay views show a clear improvement in dock material scale, architectural depth, boat/boardwalk silhouettes, shoreline layering and plant composition.
2. The shared language visibly carries into village facades and district terrain, with readable paths and no floating rocks/plants, surface flicker or large texture stretches.
3. Keyboard/mouse traversal, interior doors, both dock routes, roof/ramp climbing, connected building, shooting/reloading, bots and map changes still pass.
4. Real WebGL checks pass in all presets, including no-HDR fallback and shader warmup. Complete-frame CPU/GPU costs and target/texture budgets are recorded against 1.9.0. Display-capped FPS is not treated as a lower-end guarantee.
5. A production build opens over file:// with networking disabled; all assets load, QA mutation hooks are absent, and the portable folder/ZIP match the source release files.

Baseline: `design/pre-art-1.9.0-portable.zip`, `tests/before-sunhaven-art.bundle.js`, `tests/before-sunhaven-art.qa.bundle.js`. Visual and performance evidence is saved under `tests/artifacts/sunhaven-art`.

## Implemented art

- **Coastal kit:** four connected boardwalk modules, 32 shared pilings, 30 cargo crates, two open boat hulls, one boathouse, three open coastal houses, two decorated cabins and two sheds. Planks, pilings, bracing, layered trim and hardware carry silhouette detail; metre UVs align grain and slate courses. The 1.6m entrance gable sits beyond the main boathouse roof platform and uses matching triangle collision.
- **Materials:** seven original deterministic sets for timber, paint, slate, end grain, hardware, rope and canvas; a verified CC0 photographed plank set remains available for broad floors. Geometry supplies real board joints and bevels. All color/normal/roughness channels agree in scale and orientation. Actual Sunhaven residency is about 160 MiB for 39 shared image sources, under the existing 256 MiB ceiling; this excludes render targets and other non-cache textures.
- **Landscape:** eight authored shoulder regions, scalloped shore edges and a connected dock basin, using the same sampled heightfield as collision, shots and water depth. 24 planted beds contain 84 shrubs, 187 flower clumps and 195 tufts, with 19 exact-collision boulders and four hero oaks. Plant/rock visuals use 114 compact spatial batches and 175,560 triangles before culling.
- **Gameplay preservation:** authored pads, routes, spawn/finale pockets and permanent ramp surfaces retain their previous sampled heights. The new basin opens into the sea without moving either dock landing. Roof platforms, doorway headroom, solid cargo cover and buildable space remain available.
- **Batching:** mixed small geometry is merged within the existing cells unless shared instancing saves at least 64 KiB. Single-geometry buckets remain instanced. Frozen A/B testing preserved all 713,500 static authored triangles and 426 collision solids, reducing unculled static submissions from 921 to 610 for an additional 5.43 MiB of geometry/instance arrays. The complete analysis is in `tests/artifacts/sunhaven-art/art-batching-review.md`.

## Reproduce verification

Run `npm test`, `npm run build:qa` and `npm start`. Run Chrome drivers serially so performance measurements do not compete for the GPU:

- `node tests/browser-sunhaven-art.mjs` — fixed-camera art, all presets and complete-frame costs.
- `node tests/browser-startup-readiness.mjs --art` — queued starts, quality changes during warmup, double cleanup including coastal/landscape owners, no-HDR fallback.
- `node tests/browser-sunhaven-polish.mjs --art` — doors, docks, quarry and current-pose shadows.
- `node tests/browser-sunhaven.mjs --art` — keyboard/mouse movement, connected builds, shooting/reloading, routes and map selection.
- `node tests/browser-threejs-readiness.mjs --art` — both maps/all presets, combat and replay resource bounds.
- `npm run build`, `npm run package:release`, `node tests/browser-offline.mjs` — final portable gameplay with networking disabled.

`npm run prepare:coastal` deterministically regenerates and embeds the maps without network access. Asset sources, licenses, dimensions, physical scales and hashes are retained in `assets/coastal/README.md` and `manifest.json`. The photographed plank credit also ships in `THIRD-PARTY-NOTICES.txt`.

## Final gameplay review and performance

Thirteen final gameplay views cover all five districts, including material detail, the inlet, both dock approaches, open boat interiors and a clear lighthouse approach. The original fixed headland camera is retained for comparison even though an existing tree crosses its sightline. The added headland-path view shows the district clearly.

A final foam correction removes a regular diamond pattern made by crossed sine waves. It reuses the existing ripple samples with derivative filtering, retaining the same depth band, textures, targets and passes. Twelve frozen before/after water views across all presets confirm the correction; see `water-foam-review.md`.

The added art increases rendering work relative to 1.9.0. In the final 1600x1000 RTX 5090 Chrome capture:

| View | Main calls: 1.9 → 1.10 | Whole CPU p95 | Frame interval p95 |
| --- | ---: | ---: | ---: |
| Smooth docks | 635 → 901 | 2.7 → 3.9ms | 7.1 → 7.1ms |
| Balanced docks | 647 → 913 | 7.7 → 10.8ms | 7.1 → 14.1ms |
| Detailed docks | 657 → 923 | 7.1 → 11.8ms | 7.1 → 14.1ms |

Other final district views have CPU p95 of 2.8–7.0ms and frame p95 near the local 7.1ms display cap. Whole-frame counts include optional shadow, refraction, reflection and output passes; an intermittent reflection frame may have a higher count than a typical sample. The isolated batching experiment above measures the optimization independently from the added art. Lower-end hardware and long-session performance remain unmeasured.

Automated validation: 156/156 tests. Browser evidence includes zero runtime/shader errors, all-preset views, keyboard/mouse traversal and building, 10/8-bot combat, bounded replay resource counts, queued loading, complete coastal/landscape teardown and no-HDR fallback.


Portable `file://` verification passed with networking disabled in 5802ms, with zero remote requests/errors, no QA mutation hooks, ten map/explore switches and both bot populations. All eight source/release/ZIP files match by SHA-256 (`package-verification.json`). The final production bundle is 17.79 MiB and the root ZIP is 13.31 MiB. No required implementation, verification or packaging work remains for this goal.
