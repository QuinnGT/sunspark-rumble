# Docks architecture milestone handoff

The original 8 x 8 m boathouse, low flat roof and east-facing 9 m roof ramp are replaced by a 12 x 10 m harbor workshop with a full navy roof, tall cream-framed doors, upper windows and attached terrace. Its two pitched roof halves are thin closed shells with actual sloping undersides, so the collider does not fill the attic with an artificial box. Geometry carries metre UVs and linear vertex crevice/eave shading.

## Final placement and routes

All dimensions are metres. `DOCKS_ARCHITECTURE` in `src/docks-architecture.js` is the machine-readable fixture contract.

| Assembly | Footprint | Height |
| --- | --- | --- |
| Main interior | x70..82, z5..15 | Floor3.3; walls9.88 |
| Full roof | x69..83, z3.9..16.1 | Eaves9.6; ridge13.2; shell thickness0.24 vertically |
| Front porch | x69..83, z15..17.5 | Floor3.3; canopy8.5 at back /8.0 at front |
| Rear landing | x73.5..78.5, z3..5 | Floor3.3 |
| West workshop / terrace | x65..70, z5..15 | Interior floor3.3; terrace7.3 |
| Terrace upper landing | x61.8..65, z4.8..6 | Floor7.3 |
| Terrace ramp | x61.8..65, z6..17.5 | Low3.3 atz17.5; high7.3 atz6 |

Main front and rear doors are 4.8 m wide and4.5 m tall. Front passage goes (76,10) →(76,16.3) →(80,16.3) →(80,20). The porch meets the existing north dock only atz17.5, with no overlapping deck planes. Rear passage goes (76,10) →(76,4) →(76,2). Terrace approach goes (63.4,18.1) →(63.4,17.5) →(63.4,5.5) →(66,5.5) →(67.5,10), rising along the ramp. `World.canWalk` passes each segment in both directions. Terrain agent grades all floor footprints below3.275 and rear/west approach mouths to3.25.

The high main roof is physical sloping cover. The intended playable flat destination is the west terrace at7.3, not the old boathouse roof height. Its ramp has `accessId: 'boathouse-terrace'`. The interior landmark reports `roof:7.3` for that accessible destination, while coastal asset metadata reports the actual ridge `roof:13.2` plus `terrace:7.3`.

## Model and rendering integration

`createDocksRoofGeometry({width=14,depth=12.2,rise=3.6,thickness=.24,side=-1|1})` is a deterministic pure indexed geometry constructor. Coordinates are local to eave origin(0,0,0), with ridge(0,3.6,0). The two source roof meshes are translated to(76,9.6,10), use `Coastal roof` material, and mark `userData.authoredModel` as `boathouse-roof-left` or `boathouse-roof-right`. Root may export these to embedded GLB and preserve the corresponding visual slots when batching; original exact collision meshes remain authoritative. Material initialization and World construction are not required by the constructor itself.

The main structure contributes39 registered surface layers: the original six flat decks, two pitched roof slopes and inclined porch canopy, plus30 exterior/interior wall and gable finishes. A complete assembled scene currently audits50 layers/4358 samples with no clearance violations. The legacy12-layer fixture and one-surface-per-boathouse release count explicitly account for this metadata. Vertical layers are shot-tested along their declared normals; they are not walking surfaces. Do not omit slope layers from the audit or treat the ridge as a flat walking platform.

The architecture tests in `tests/docks-architecture.test.js` validate roof face orientation, UV tangent frames and hollow underside; both-direction door/dock/terrace traversal; exact roof shot/support surfaces; and real-world finish clearance. Three focused tests pass. Parent owns full suite registration, builds, matched-camera inspection and portable packaging.

## Dressing and visual review

The porch's loading group has two solid barrels and rope coils; an interior repair bench and hanging geometric net leave the center passage clear. Lanterns, a large sun badge, cream oculus, upper windows, corner posts, course trim, deep porch roof and rounded ridge cap form deliberate visual accents. Supports meet the terrain below the deck. Barrel hoops stand clear of the timber barrel surface rather than nearly coinciding with it.

The milestone still requires parent-led actual image review from the approved cove camera. The source-level checks establish geometry, clearances and traversability; they do not claim the reference likeness is complete without that rendered comparison.

## Facade review correction

The first actual draft exposed blank blue walls, an empty-looking blue interior, and a porch roof crossing the lower upper-story windows. The revised kit uses weathered teal horizontal clapboards with visible seams, warm timber interior walls and a repair bench/oars brought into the visible workshop bay. Front upper windows move to9.5m center height and the sun badge to9.65m with0.43m emblem radius, keeping them clear above the unchanged porch roof. Main roof dimensions and exported GLTF shell topology are unchanged.

Each clapboard wall and gable retains its exact original invisible collision core. The rendered backing is recessed25mm from each face, and the board finish lies exactly at the physical core face. Both exterior and interior board faces are registered. Expanded auditing found the original rear/front door header inside faces coplanar with the interior walls at(74.512,7.962537,5.16) and(74.512,7.962537,14.84). Making the door trim project30mm into the interior removed this overlap. A second run caught the workshop door foot only5mm from its post at(66.027,3.454843,14.86) and(68.947,3.454843,14.86); the foot now projects40mm past the post. These were corrected without reducing audit coverage. Corner posts clear the wall on both faces, and window/oculus crossbars are split into disjoint horizontal pieces rather than overlapping at their common face.

Every vertical finish also publishes `coverMeshUuid`, identifying its exact invisible wall or gable core in `world.solids`. Cover validation casts along the declared normal against that owner and requires the declared finish point exactly. A global shot may correctly hit a projecting door frame first: the rear header example at(74.512,7.962537,5.16) hits the trim atz5.19 before the wall atz5.16. The global first hit must be no farther than the owned wall; the visible clearance audit still inspects every face. This preserves exact collision checks without removing samples or treating all nearer cover as a placement error.
