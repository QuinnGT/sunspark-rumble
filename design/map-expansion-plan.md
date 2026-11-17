# Sunspark Rumble — Sunhaven Island expansion

Status: implemented as version 1.8.0, September 7, 2026. This is the original design plan; the tables and gates below preserve proposed targets for comparison. Current scope and measured results are in ../local-notes/REPORT.md (kept out of the public repository), section "Sunhaven Island expansion: 1.8.0".

Delivered: both selectable maps, 240-unit Sunhaven, five districts, ten bots, interior/roof/dock/quarry routes, varied spawns and supplies, shifting storm, expanded building and nature coverage, offline launch and quality controls. Ninety automated tests pass; 80 simulation matches and six rendered browser matches reached results. Ten bots were selected without a formal 8/10/12 population study. Beginner four-to-five-minute pacing, lower-end hardware performance and absence of every build-time spike remain unproven; the report records actual measurements rather than treating these targets as passed. Map switching uses a fresh local page to release the prior world's resources. The existing build ceiling is 24 above local ground, not absolute world y=24.

## Intended experience

A sunny coastal island with five recognizable places, branching routes, and satisfying changes in elevation. A player can choose a quieter orchard start, fight across colorful village roofs, or use the quarry terraces to slide into a fight. Every district offers a practical way to use walls, ramps, and floors. The lighthouse remains the island's recognizable landmark.

Keep instant play, the four weapons, current movement, all difficulty levels, quality presets, and offline launch. Target four-to-five-minute surviving matches, within the original short-round intent; early elimination can end a round sooner. Expand the existing island's identity without stretching the scale of characters, buildings, or movement.

## Size and population

| Item | Current release | Expansion target |
| --- | --- | --- |
| Movement boundary | Radius 67; diameter 134 game units | Radius 120; diameter 240 units |
| Boundary-envelope area | About 14,103 square units | About 45,239 square units: 3.21 times current |
| Match opponents | Eight bots | Begin blockout with eight; target twelve after pacing and performance checks |
| Main places | Four repeated cabins and lighthouse | Five districts, each with distinct routes and cover |
| Storm | Radius 65; fixed center; closes from 0:45 to 4:15 | Starts at radius 118; phased circles; finishes closing around 4:45 |
| Map choice | Current match / playground flow | Compact Breezy Bay and expanded Sunhaven; preserve the compact playground |

The 3.21 figure compares circular movement envelopes. Coves, slopes, and building footprints reduce usable ground, so this is not a claim of 3.21 times navigable floor area. At unchanged sprint speed 10.6, a straight 240-unit crossing takes about 23 seconds before slopes, cover, or combat. This is large enough for variety without requiring vehicles.

Twelve bots are a population target, not a difficulty increase: retain Easy's reaction time, damage, grace period, and one-attacker limit. Give bots regional patrols and natural routes toward fights; do not grant knowledge of the player's hidden position. If eight bots already deliver the encounter targets, keep eight or ten rather than adding unnecessary load.

## District layout

Coordinates are proposed centers, in existing world axes: x east, negative z north. Keep a roughly circular outer envelope with modest coves, and join all five districts by dry ground. The map sketch shows centers and route intent, not finished terrain geometry.

| District | Approximate center x,z / footprint | Identity and play |
| --- | --- | --- |
| Lantern Heights | 0,-78 / 44×42 | Existing lighthouse identity on a terraced northern headland. Two winding approaches, a broad lookout and rock shoulders. Long views are interrupted by ridges; the tower itself is a landmark, not an inaccessible firing nest. |
| Orchard Grove | -72,-28 / 48×48 | Curving fruit-tree rows, a small open shed, stone walls, sunny clearings. Gentle slopes support beginner starts and close-to-mid-range fights. Trunks and low walls provide real cover; leaves do not become invisible bullet blockers. |
| Sunbeam Village | 0,0 / 60×52 | Four varied coastal buildings, a courtyard, awnings and two simple ground-floor interiors. Roof routes suit building; streets let players flank without building. Two doors per accessible interior; other doors read clearly as closed. |
| Driftwood Docks | 78,22 / 50×42 | A shallow inlet, broad boardwalks, boathouse, stacked cargo and grounded decorative boats. Distinct short-range lanes, exposed cross-water views and two permanent routes inland. Boat travel and swimming are outside this first expansion. |
| Pebble Quarry | -46,68 / 52×44 | Warm stone terraces, a work shed, ramps and separated boulders. Connected slopes support sliding; upper ledges favor the Prism. Long way around always remains available if the player lacks building resources. |

There are four outer districts plus the central village. Connect them with an outer loop and spokes into the center. Break the southeast's otherwise open space with a low dune ridge and a small roadside rest stop, not a sixth fully developed district.

## Traversal, combat and building rules

- Each district has at least two independent exits and two approaches to important high ground. Routes remain usable when one obvious bridge or doorway is covered by an opponent.
- Main routes are approximately 4–6 units wide; narrow player-only shortcuts must still admit the character and camera. Bot routes need their navigation clearance checked, not just a visually open gap.
- Place useful cover approximately every 10–18 units along exposed routes. Aim for 12–25 seconds between neighboring districts by realistic walking routes, and no mandatory long empty-field crossing.
- Arrange most local fights at 8–45 units. Reserve a few interrupted 60–100-unit sightlines for the Prism. Do not extend weapon range just because the map grew; the current ranges already span 28–140 units.
- Reserve flat 8×8-unit building pockets near fights, with 4-unit edges and 3-unit rises matching the existing building grid. Create optional one- or two-floor shortcuts between platforms, always with a permanent alternate route.
- Keep major walkable rooftops and terraces below approximately world y=15 so the existing build ceiling of 24 leaves vertical room. Decorative tower height is separate from playable height. Validate elevated building limits explicitly.
- Design several broad downhill curves for sprint → slide → jump, without mandatory precision jumps. Crouch-height cover must hide the actual lowered target and keep the blaster from shooting through it.
- No required water crossing. Shallow beach shelves have predictable ground collision and easy exits; deep water and the playable boundary must be visually obvious. Docks are dry navigable surfaces over decorative water.
- Use exclusion zones around ramps, doors, cover gaps, spawns and pickup sites before scattering plants. Preserve the exact rock collision and rooftop-crate fixes.

## Spawns, pickups and replayability

Create 16 authored spawn candidates, then select a validated subset per match. Start the player on outer districts, not in a random central crossfire. Each selected player start must have nearby cover, no initial opponent line of sight, and at least about 35 units of route separation from the closest bot. Apply stronger separation or a different candidate where difficulty vision would otherwise expose the player. Preserve the initial weapon loadout and Easy grace period.

Begin with about 30 authored utility pickup sites and 12 weapon sites, spread across the districts and route junctions. Every player start should have reachable ammo plus either shield or wood within roughly 5–10 seconds. Vary pickup assignments using a reproducible match seed, while guaranteeing basic supplies. Do not make the best weapon accessible only by winning an immediate fight.

Measure first meaningful engagement: target 15–35 seconds when moving toward a nearby district. A player deliberately taking the quiet outer route can avoid fighting longer. Aim to avoid repeated gaps of more than 45 seconds during active midgame play; record this as a playtest target rather than forcing enemy spawns beside the player.

Preserve instant replay. Vary starting district, supply distribution and the final-circle destination while keeping the physical map learnable. Start with authored dry-ground finale candidates near the village, grove clearing, dock approach, quarry upper terrace and the southern approach to the heights. Final centers are validated points inside those areas, not necessarily the district centers above.

## Storm plan

Use one shared storm state containing center, radius, next center/radius, phase and remaining time. Player damage, bot decisions, visuals, minimap and warnings all consume that same state. Show the next safe circle and a directional cue; replace the current instruction to head toward the middle of the map.

| Time | Radius behavior | Purpose |
| --- | --- | --- |
| 0:00–0:40 | Hold 118 | Orient, collect supplies, choose route |
| 0:40–1:40 | 118 → 84 | Gather the outer districts |
| 1:40–2:00 | Hold 84 | Short fight/reload window |
| 2:00–3:00 | 84 → 50 | Bring neighboring groups together |
| 3:00–3:15 | Hold 50 | Show the final area clearly |
| 3:15–4:00 | 50 → 23 | Encourage a final relocation and use of cover |
| 4:00–4:10 | Hold 23 | Brief final setup |
| 4:10–4:45 | 23 → 0 | Resolve the match; final center stays fixed |

For successive circles, enforce distance between centers + next radius ≤ current radius. Candidate shifts should also leave a navigable escape route with time for the slowest bot and a beginner who follows the warning. Early bots should plan from time-to-boundary and route cost, rather than wait until they are already outside. Reject finales in water, inside solid structures, or on isolated roofs.

The table is a starting tune. Confirm match lengths and storm deaths in simulation and actual play before treating it as final. Do not increase early storm punishment simply to hide navigation problems.

## Engineering work discovered in the current source

1. **Central map definition.** Add map bounds, terrain parameters, named districts, route splines, spawn/pickup candidates, build exclusions and storm presets to a map definition. Keep Breezy Bay as an explicit definition with its current placements so existing regression fixtures remain useful. Refactor direct imports of the single global `heightAt` toward world-owned sampling; prevent inactive-map data leaking into active matches.
2. **Terrain, coast and minimap.** `world.js` assumes several radii and a 220-unit terrain plane. `game.js` draws fixed 67/61 minimap circles. Generate terrain, coast/material masks, minimap and labels from the chosen definition. Keep comparable terrain vertex spacing as dimensions grow; use spatial terrain tiles where profiling supports them. The final coastline must match the playable boundary and real shallow ground.
3. **Water and vegetation coverage.** `nature-water.js` samples a fixed 160-unit depth field and uses radial thresholds around 65–95. `nature-ground.js` scatters grass only around ±60 and radius 61. Make extents configurable; derive shoreline depth and near-water rendering decisions from actual terrain/water distance so the docks work correctly. A 512-square depth field is a reasonable starting point for the larger extent, subject to memory/performance checks.
4. **Navigation and collision cost.** `navigation.js` has a 55×55 ground grid with a radius-64 cutoff. A 97×97 grid at the same 2.5-unit spacing covers the proposed boundary: over three times as many ground nodes. Avoid rebuilding the whole grid and all elevated links on every placed wall. Update affected cells/surface links, use spatial lookup for nearby colliders and endpoint connections, and profile the path queue before choosing further changes. All bridge, interior and roof connections must work in both directions where designed.
5. **Spatial render batches.** Existing permanent scenery is heavily merged and tree variants are instanced. Partition large permanent batches by district or approximately 24–32-unit cells so offscreen regions can be culled. Share geometry/materials and retain localized shadows and grass distances. Do not triple all visible detail or introduce runtime asset streaming just to increase land area.
6. **Match systems.** `game.js` has eight named bot starts and fixed pickup arrays. `bots.js` patrols and escapes around the origin. Move those decisions to map data and the shared storm state. Keep authored spawn validation, budget sensing/path work across frames, and preserve difficulty fairness as population rises.
7. **Map selection and reset.** Add a compact map choice in the existing start flow. Keep playground familiar. Repeatedly switching maps must remove old terrain, collision, builds, bot routes and pickups while correctly retaining or releasing shared textures. Test ten map/replay switches for memory growth and stale geometry.

## Delivery stages and completion gates

1. **Foundation and larger playable blockout.** Extract the current map definition, prove Breezy Bay still behaves the same, then add the 240-unit landmass with simple district blocks and eight bots. Gate: walk/sprint/slide all routes, test camera clearance, place connected builds, and ensure the boundary/ground/water/minimap agree. No detailed art pass yet.
2. **District gameplay.** Build village and quarry first: they exercise interiors, roofs, collision, slopes and building. Add the heights, orchard and docks after those interactions work. Gate: two usable exits per district, correct rock gaps, clear ramp entries, solid cover and practical low/upper routes. Both human and bot traversal must pass.
3. **Match loop.** Add spawn validation, supply distribution, phased off-center storm and regional bot goals. Evaluate eight, ten and twelve bots. Gate: active Easy opponents without gang-ups, no routine storm stranding, varied finales, readable warnings, and satisfactory encounter/round pacing.
4. **Art and performance.** Give each district a distinct silhouette and material palette; dress only validated routes. Reuse existing licensed offline textures and trees where possible. Gate: all quality presets, camera-facing foliage/cover readability, no placement overlaps or z-fighting, and measured frame times under combat/building/water load.
5. **Release verification.** Full regressions, actual browser keyboard/mouse rounds, map switching, instant replay and final offline portable launch. Gate: versioned source and portable ZIP match, no missing assets/network dependency, and documented measured limitations.

Do not implement vehicles, swimming, destructible terrain, a full building-interior simulation, new weapons, or additional biomes in this expansion. They can be separate projects after the new map proves enjoyable.

## Verification targets

- Retain all 78 current tests. Add boundary/minimap consistency, map-switch lifecycle, seeded spawn safety, circle containment, reachable finale validation and bot storm escape cases.
- Replay the current movement, ramp/floor/wall, reload, cover-shot, rock-gap, roof-crate and crouch tests on Breezy Bay; add equivalent physical fixtures in the new districts.
- Run at least 20 reproducible automated matches per difficulty for navigation/termination diagnostics. Log spawn positions, first shots, eliminations, storm deaths, time stuck and match duration. These runs check logic; they do not establish human difficulty or enjoyment.
- Play actual browser matches from each outer starting district, including at least three full Easy matches and one match at each other difficulty. Exercise interiors, water-edge routes, crouch cover, connected roof builds and several finale locations. Include an observed beginner playtest when available; do not claim that experience based solely on bots.
- Performance: use the same hardware, viewport and route for old/new comparisons. Provisional targets are 60 FPS on the chosen test computer's appropriate preset, no recurring frame spikes above 50 ms during building/path updates, and 95th-percentile frame time no more than about 25% worse than the compact map at the same preset. Record CPU/GPU and frame times; the current RTX 5090 results do not establish low-end hardware support. Test another lower-powered machine if available, or document the gap.
- Offline/release: test the extracted portable build with networking disabled, plus ten map/replay changes. Verify source/release/ZIP content hashes and record actual screenshots, not concept images.

## Recommended first milestone

A complete plain-geometry Sunhaven with five district footprints, navigable routes, reliable building/collision and a finishable eight-bot match. Use that to adjust size and pacing before investing in detailed scenery. The expanded island is ready only after the later match, art and release gates pass.
