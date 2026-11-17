# Docks oak and lighting handoff

This pass establishes three broad, irregular oak crowns and composed planting against the new boathouse/cliff scene. The original dock/village concepts remain the visual targets. Code tests verify construction, collision and rendering contracts; acceptance still requires the combined actual scene capture.

## Integration

- `createDocksOaks(world)` from `src/docks-oaks.js` creates `world.docksOaks` once, after structural generation and before `decorateSunhavenLandscape`. It returns an owned group with `setQuality(value)`, `update(time,camera)`, `diagnostics()` and idempotent `dispose()`. Add it to automatic batching and final scene-collector skip roots, then invoke its teardown.
- `docksOakReserved(x,z,padding=0)` reserves seven metres around the selected trunk sites for generic seeded trees. Do not delete the authored oak placements using this predicate. The three sites are north bank `(91,-2)`, south bank `(88,52)` and boathouse backdrop `(68,-5)`; bases sample the current authoritative terrain.
- Each visible trunk/branch mesh owns the exact triangle collision used by `world.rockCollider`; its `instancedVisual` flag prevents a second static visual. Higher branches remain genuine visible cover. Foliage cards are decoration and do not invent solid crown collision.
- `createIslandSky({coastal:true})` selects the clearer Sunhaven atmosphere while preserving the original map's default. `createCloud({coastal:true,variant:i%3})` creates one of three embedded procedural cumulus variants. `configureDocksClouds(world.clouds)` from `docks-lighting.js` positions/scales the existing cloud groups into substantial sky banks.
- `DOCKS_LIGHTING` supplies exposure, directional-light color/intensity, hemisphere sky/ground colors/intensity, and environment intensity. These values use the existing lights and PMREM pipeline. Water's sun direction and shader/passes are unchanged.

## Mesh, material and budget contracts

Each oak has seven deliberately overlapping elliptical leaf-spray clusters and a sweeping, tapered branch skeleton. Crown-center heights differ by 2.8m: a low west bough, high rounded center and offset southeast crown expose sections of the rising branches and break the flat umbrella silhouette. The full crown is approximately 11.5m wide and 10.3m high before site scaling. Leaf edges come from the existing embedded oak cutout; there are no opaque canopy sphere fillers. Full detail uses 5,880 crossed cards per tree. Mid and distant detail retain one-half/one-quarter of the same deterministic sprays with moderately enlarged cards, preserving the overall silhouette. The three full trees together submit roughly 51k triangles before render-pass multiplication.

Leaf normals face out from each local crown cluster. Upper/outside sprays are lighter; material tint shifts them toward warm sunlit green while low-contrast transmitted light keeps the interior readable. Wind displaces only leaves, with identical depth/distance shader patches and 103mm/52mm conservative X/Z padding. Main, shadow and reflection cameras perform their own frustum culling. Hysteretic detail changes do not mutate trunk collision.

Leaf vertex colors use normalized Uint8 RGB with a 1.125 gain restored in the runtime material, preserving sunlit tint values above one instead of clipping them. This saves 1,111,320 bytes across all three trees and LODs, or 635,040 bytes across their visible full-detail canopies. Measured maximum reconstruction error is 0.002206 in linear tint. Mesh topology, leaf counts, positions, UVs, normals, wind and collision do not change. An exported crown must retain `vertexColorGain` metadata and bind the runtime leaf material after loading; plain exported PBR tint alone is insufficient.

`createDocksOakTemplate(variant)` returns reusable `branches`, three `levels`, cluster metadata and card count. Candidate asset names for an embedded model library are `docks-oak-trunk-{variant}` and `docks-oak-crown-{variant}-lod{0,1,2}`. Retain index, position, normal, UV and linear vertex-color attributes. Semantic runtime materials are **Docks oak weathered bark** and **Docks oak sunlit leaves**. The latter needs the runtime wind/cutout shadow materials after import; a plain exported PBR material alone does not reproduce animated foliage.

All leaf and bark images already ship in the shared cache, so the oaks add no decoded image sources. Three cloud variants use 512px local RGBA procedural textures, roughly 4MiB with mips in total, owned by their scene materials. Per-puff analytic shading gives cool undersides and soft warm-white upper puffs; taller cloud banks preserve distinct rising cumulus forms. Coastal cloud sprites omit ground-distance fog because it flattened these atmospheric objects into pale strips at 200m. Cloud textures are independent from the terrain/coastal cache and belong to the existing scene resource collector.

The landscape module now uses actual small leaf surfaces instead of smooth opaque shrub cores, with eleven authored dock beds emphasizing north/south rock lips, upper grassy crowns, path flowers and the backdrop tree. Ground sampling and obstacle/route guards remain authoritative. Under oak crowns, vegetation rejects the lower trunk footprint rather than treating the full high branch bounds as a ground-level solid.

## Focused checks

`node --test tests/docks-oaks.test.js` checks crown dimensions/LOD bounds, actual trunk raycasts, stable collision across quality/distance changes, borrowed texture ownership, identical wind/cutout shadow displacement, and opt-in sky/cloud configuration. Parent integration must also run the existing surface and shader-mode gates and review combined elevated/grazing/player-height dock captures in every preset.
