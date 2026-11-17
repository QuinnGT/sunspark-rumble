# Three.js preparation — 1.9.0

All eight renderer preparation items are implemented. This is the foundation for the next Sunhaven terrain and asset pass. The dock/village/island concept images remain the visual targets; the current scenery is still prototype art.

## Rules for the next art pass

| Area | Implemented foundation | Rule for new content |
| --- | --- | --- |
| 1. Materials and textures | `nature-assets.js` validates color/data roles, shares decoded texture sources, uploads before play, caps anisotropy, and reports mip memory. `terrain-layers.js` gives each layer matching color, normal and roughness scales. | Base color uses sRGB; normal/roughness remain non-color data. Roughness uses G and normals use OpenGL convention. Use the asset cache and material layer definitions. Current terrain maps are 1024px; the shared asset ceiling is 2048px. |
| 2. Static batching | `materials.js` preserves indices, normalized colors, tangents, additional UVs and custom attributes. Compatible repeated geometry uses instances; other compatible static meshes merge within spatial groups. | Preserve vertex AO/masks and UVs when authoring. Keep dynamic, transparent and custom object-space shader objects out of automatic batching. Source geometry ownership stays with its creator. |
| 3. Terrain authority | `terrain-heightfield.js` and `terrain-surface.js` share a one-metre triangle surface between rendering, walking/build support, water depth and exact shot queries. Both maps use indexed 32m chunks with identical seam positions/normals/masks/colors. | Change the authored map height source and rebuild the sampled field. Do not add independent visual displacement that changes the walkable silhouette without updating collision. Cliff/overhang meshes need their own collision; a heightfield cannot represent overhangs. |
| 4. Foliage culling and LOD | `nature-foliage.js` uses 32m canopy cells and 64m branch cells, shared instances, conservative wind bounds and distance hysteresis. Main, reflection and shadow views cull independently. Collision proxies remain stable. | Populate spatial cells, preserve bounds for maximum wind displacement, and use the matching wind/cutout depth and distance materials. Do not hide whole distant groves to achieve LOD. |
| 5. Color pipeline | Intermediate scene buffers use linear RGBA16F. The screen pass applies tone mapping and output conversion once. Sky, water and storm follow the same output path. | Keep lighting and offscreen calculations linear. Devices without `EXT_color_buffer_float` skip optional contact/reflection/refraction passes and render directly; an RGBA8 intermediate would clip bright values before tone mapping. |
| 6. Measured rendering budgets | `render-profiler.js` records the whole frame, exclusive pass counts, CPU distributions, memory counts and optional asynchronous GPU timers. Water uses actual wet-terrain bounds and projected coverage. | Measure complete frames during combat and at docks, village and quarry. Count main, shadow, water and contact work together. Never wait synchronously for a GPU query. Keep current-pose character shadows while budgeting optional water passes. |
| 7. Loading and resource ownership | Loading waits for embedded texture decoding/upload and shader warmup across all presets and two camera positions. Early starts queue until ready. `ResourceScope` and module teardown release shared resources only after their last owner. | Register assets before warmup; await `window.sunspark.ready` in development fixtures. A module owns its targets, geometry and instances. Materials borrow cached textures. New modules need idempotent teardown and explicit ownership. |
| 8. Shader maintenance | `shader-patches.js` guards named replacements, rejects absent/ambiguous chunks, and checks the pinned Three.js revision 180. Shader failures are surfaced at startup and in diagnostics. | Keep patches small and named. When upgrading Three.js, inspect its chunks and rerun the actual WebGL tests before updating the revision guard. Do not silently ignore a failed replacement. |

## Current bounds

- Drawing buffers: Smooth 1.6 million pixels / DPR 1; Balanced 2.6 million / DPR 1.25; Detailed 4 million / DPR 1.5. Device and WebGL limits can reduce these further.
- Detailed water: visible wet terrain must occupy at least 1% of the view and lie within 55m in Balanced or 70m in Detailed. Distance is measured to nearby water bounds, so looking inland across a harbor still works. Far ocean uses analytic water shading.
- Refraction: scale 0.5 with a 1200px longest side in Balanced, or 0.7 with a 1600px longest side in Detailed. Reflections: at most 768px and 20Hz. Current actor shadows update every gameplay frame.
- Terrain: 100 chunks / 204,800 triangles for the full Sunhaven grid; 49 chunks / 96,800 triangles for Breezy Bay, before culling. Border chunks may be smaller.
- Nature assets: 18 decoded sources, approximately 96 MiB of RGBA8 plus mips, within the 256 MiB nature-texture budget. This excludes procedural textures, geometry and render targets. Target diagnostics separately estimate configured color/depth/MSAA attachments; they are not driver memory measurements.
- The four-layer terrain shader uses matching triplanar color/normal/roughness projection with explicit texture gradients. Nearly horizontal areas take only the required projection; masked-out layers are skipped.

## Evidence and measured tradeoffs

`npm test`: **135/135 pass**, including exact terrain rays versus actual rendered triangles, chunk seams, material channels, batching attributes and mirrored winding, wind bounds, shared ownership, water visibility/state restoration, GPU query handling, shader failures, and existing movement/build/combat/navigation tests.

Real Chrome checks:

- `tests/browser-render-readiness.mjs`: all quality modes compile; direct versus Detailed color swatches differ by **0/255** with contact shading disabled for the comparison, including values above 1. The forced no-HDR path also differs by **0/255**. Steep material layers and shore views compile and render. No shader/runtime errors or remote assets.
- `tests/browser-startup-readiness.mjs`: delayed warmup, multiple early start requests and a quality change preserve the latest requested session and selected quality. Simulation remains frozen until ready. Double teardown leaves zero scene geometries and zero cached nature textures. The renderer counter retains one internal texture; it is not a test claiming every driver allocation becomes zero. Full-game Detailed mode also starts successfully with HDR support disabled.
- `tests/browser-threejs-readiness.mjs`: both maps and all presets, inward-facing inlet, quarry, village, combat with 10/8 bots and repeated replays. Exclusive pass counts sum to the entire frame. Replay texture counts remain at 37; geometry counts vary with visible actor/detail/build content and do not grow monotonically. No shader/runtime errors.
- Existing `browser-sunhaven-polish.mjs`: both village interiors, both boathouse directions, quarry climb and dock access pass. Balanced and Detailed each record zero stale moving-character shadow frames.

Performance evidence is in `tests/artifacts/threejs-readiness/{before,after}-report.json`. Measurements use a 1600×1000 Chrome viewport, RTX 5090 / ANGLE D3D11 and 180 warmed-up frame intervals per view. All final view p95 frame intervals are 7.0–7.1ms, at the local display limit. They do **not** establish lower-end performance or an uncapped FPS improvement. CPU p95 is 1.6–7.9ms across those views. The Detailed inlet has an isolated 14ms frame; the short combat run records a 36.5ms maximum CPU frame. Loading, build-time spikes and lower-end hardware still need budget testing as new art is added.

| Fixed view | Before draws / triangles | After draws / triangles |
| --- | ---: | ---: |
| Sunhaven Smooth inlet | 453 / 1,728,994 | 635 / 1,407,062 |
| Sunhaven Smooth village | 374 / 1,733,086 | 511 / 1,133,662 |
| Sunhaven Detailed quarry | 614 / 3,525,503 | 816 / 2,191,531 |
| Breezy Bay Smooth shore | 75 / 663,952 | 69 / 155,096 |

These are sampled whole-frame draw counts, not averages; optional reflection frames vary. Spatial culling adds draw groups while reducing submitted triangles in these views. The Detailed inlet costs more than before because its previously skipped inward-facing refraction now renders, and HDR/contact passes preserve highlights. Do not treat its before/after cost as equivalent visual work. Branch-cell experiments selected 64m over 32m after reducing both CPU and GPU cost in the local views; 96m increased GPU cost in two views and was rejected. The comparison is saved in `branch-cell-comparison.json`.

## Reproduce

Run `npm test`, then `npm run build:qa` and `npm start`. In another terminal:

```sh
npm run test:render-readiness
npm run test:startup-readiness
npm run test:graphics-readiness
node tests/browser-sunhaven-polish.mjs
node tests/browser-sunhaven.mjs
```

Run performance checks separately from other workloads. Chrome must be installed at the test driver's configured path. The no-HDR test masks the extension on this GPU; it validates fallback behavior, not the speed or compatibility of every lower-end device.

For the portable build: `npm run build`, `npm run package:release`, then `node tests/browser-offline.mjs`. The last command opens the release over `file://` with networking disabled and verifies gameplay, map switches, quality persistence, local assets and the absence of QA mutation hooks.
