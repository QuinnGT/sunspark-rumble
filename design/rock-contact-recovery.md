# Rock contact recovery — v1.12.1

The v1.12 rock meshes had correct raycasts and triangle collision, but the movement controller applied gravity after its horizontal obstruction check. A floor ray beneath the character's centre could miss the rock while the body's radius intersected its sloped side. Falling then embedded the body, leaving every horizontal candidate blocked. There was no recovery path. Correct geometry alone did not cover this locomotion failure.

`World.resolveRockContacts` now checks the full body after player and bot vertical motion, including the lower 0.55 m step band that horizontal walking may climb. Triangle/capsule contacts provide the separation normal. Bounded projection rechecks adjacent rocks and the terrain after each correction. A verified last safe position or nearby valid location handles an actor that starts deeply embedded, where a surface intersection may no longer exist. Recovery preserves solid collision and requires no reload.

Browser settling tests exposed two further cases: the previous one-sided capsule/triangle helper could disagree between the walking and full-body capsules at oblique faces, and falling beside a rock could enter an adjacent crate's collision band. `capsule-contact.js` now computes segment/triangle distance using face intersections, endpoint/face distances and all three edges. An analytical and seeded containment regression prevents the longer capsule losing a contact found by the shorter one. Adjacent solid props participate in recovery while retaining their established step allowance.

A stationary sloped contact retains its verified support height. Otherwise each new gravity step would snap back to the lower centre-ray floor and slowly push the actor sideways. This support is discarded for a different position, upward jump or movement reset. Normal walking still uses the existing step, ramp and navigation rules.

The thirteen approved rock meshes, materials, scales and positions are unchanged. The earlier natural woodland templates return to the docks: four ordinary placements are restored, and three bank/backdrop trees use the same original oak/ash family. One ordinary trunk and the two bank sites move clear of rock bodies. The concept oak remains an art-study asset and is removed from the runtime payload.

## Regression contract

- `tests/rock-trapping-cases.json` retains thirteen drop/trap pairs captured in v1.12, one for each authored rock.
- `tests/rock-trapping.test.js` checks every case at 20, 60 and 144 Hz; direct recovery from the embedded positions; repeated moving jumps through the groups; stable support; and unchanged unobstructed positions.
- `tests/sunhaven-engine.test.mjs` exercises all thirteen embedded positions through the normal bot update.
- `tests/browser-rock-trapping.mjs --before` uses the saved v1.12 QA bundle and must reproduce embedding and failed keyboard escape. The same script without the flag checks falls, local recovery, Space jumping and keyboard escape in every preset.
- Tree placement checks require original foliage instances/colliders and trunks clear of the retained rock bodies. Existing model parity, structural clearance, old rock gaps, movement, doors, ramps and rooftop regressions remain active.

The broad diagnostic drop scan is limited to rock intersections; deep-water recovery and non-rock props have separate gameplay tests. This fix is not a claim that every possible collision configuration is covered. Source and browser evidence are retained under `tests/artifacts/rock-trapping`.

## Final verification

All 195 automated tests pass. The saved v1.12 browser build embeds in all 39 falls (thirteen rocks across three presets) and cannot jump or escape with ordinary keys. The final build keeps all 39 falls clear, recovers all 39 explicitly embedded starts, and passes real keyboard jumping and escape in every preset with no errors. The browser and engine cases include waiting on the recovered footing before jumping, so an immediate correction alone is insufficient.

The 50-assembly / 4,358-sample surface gate passes. All 300 browser surface views were inspected through six elevated/grazing contact sheets; existing walking routes and nine final docks views pass. Startup cancellation, double teardown and no-HDR fallback also pass. `before-browser-report.json` and `after-browser-report.json` are the final reproduction/comparison; intermediate `*-failure` files record earlier iterations and are superseded by the final reports.

The packaged v1.12.1 release passes direct offline file loading in 6,886 ms, with no network requests, errors or QA mutation hooks; movement/build/fire/reload, ten map switches and both bot populations pass. All eight source/release/ZIP file hashes match. See `offline-report.json` and `package-verification.json` in the same evidence directory.
