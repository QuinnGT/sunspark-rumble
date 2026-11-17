# Surface construction and flicker prevention

The 1.10.0 coastal update placed timber board tops at exactly the same height as the rendered roof slab. Coral paint and timber competed for the same depth pixels as the camera moved. Shed floors used the same pattern; dock backing had only 6mm clearance. Both shed floors also intersected the sloping terrain because they were positioned from their centre height alone. Earlier floor/terrain and rooftop-crate fixes were too local to catch the new roof assembly.

## Construction contract

1. Choose the gameplay surface once: `top` in metres. Walking, ramp exits and shot collision use that authority.
2. Give the visible finish that same top. Remove the backing face or recess it. Coastal layered decks use a backing top at `top - SURFACE_CLEARANCE` (currently 20mm); their structural underside stays fixed.
3. An exact collision proxy may share the finish plane only if it is invisible **and excluded from generated solid visual batches**. `coastalLayeredDeck` sets both `visible=false` and `userData.instancedVisual=true`, retains the original box bounds, and creates the separate recessed backing.
4. Create the complete assembly through `coastalLayeredDeck`, not independent calls that repeat roof-height arithmetic. Its finish builder is private. Other layered geometry must register audit points and their outward normal with `registerSurfaceLayer`.
5. Physical clearance is measured along the surface normal. The 20mm value is our current structural construction minimum, not a universal depth-precision guarantee. Test the actual scale, camera distances and grazing views; do not raise the player's floor as a rendering workaround.
6. Deliberate decals are separate from structural finishes. Do not mask overlapping roofs/floors using draw order, transparency, disabled depth, polygon offset or a different camera near/far range.
7. Sample the authoritative terrain across the complete floor footprint. The two existing sheds now cut only protruding terrain below the original floor, with a two-metre blend outside the footprint and a 5mm tolerance above the required ground clearance. The one-metre grid vertices surrounding each floor must also be lowered so interpolation cannot bring soil back through the boards. The terrain-art baseline explicitly includes this foundation correction; a separate regression restricts grading to the two shed surrounds, verifies unchanged centre/floor heights and checks traversal.

## Automated checks

- `npm run test:surfaces`: synthetic coincident/1mm-separated faces must fail, including rotated parents and merged/instanced meshes. Separated finishes and invisible proxies must pass. Missing finishes must fail.
- The same test constructs the real Sunhaven world, after both decoration and solid batching. It currently checks 50 assemblies and 4,358 samples: eleven retained roofs, shed floors and dock modules, plus all 39 new boathouse roof, deck, canopy, wall and gable finishes. It checks actual rendered triangles along each declared normal, not merely object bounds or heights. Shared triangle edges, back faces and perpendicular trim do not count as duplicate layers.
- Each registered finish must exist at its intended surface and maintain the minimum separation from other parallel rendered faces. Horizontal finishes must also clear the actual terrain heightfield, including sloped faces that a parallel-triangle check would miss. First samples verify walking and shot-support heights for horizontal/inclined floors and roofs. Vertical walls publish `coverMeshUuid`; the test requires their owning solid to coincide with the declared finish plane. Projecting solid trim may appear sooner on the ray, while the full rendered-clearance audit still checks every mesh.
- `npm run check:surfaces` exposes the real-scene gate directly. The release packager calls this gate before copying any files; unregistered assemblies, missing finishes and insufficient clearance stop packaging.
- `npm run test:surfaces:browser`: real Chrome moving-camera inspection of affected roofs, shed floors and docks in Smooth/Balanced/Detailed, plus keyboard roof climbing, shed traversal and crate landing. Save the screenshots and check the browser error report. Build QA first and run the local server. The script checks rendering/errors and saves images for inspection; it does not automatically classify flicker in pixels.

The audit targets registered opaque architectural layers and their clearance above terrain. Transparent/alpha-cutout vegetation, water, terrain shading and shadows retain their separate tests. The finite sample grid does not prove that every possible triangle overlap is absent. Add samples and focused regressions when introducing different geometry; do not claim that one clearance constant prevents every kind of flicker.

The browser review also caught a separate shadow-mode bug present in the saved 1.10.0 build: after switching to Smooth, the terrain's cached fragment program still defined `USE_SHADOWMAP` while renderer shadows were disabled. It sampled a disposed shadow target and showed large dark patches. `applyGraphics` now invalidates each shared material once when shadow mode changes. The browser regression inspects the actual compiled terrain program in every preset; `shadow-regression-before.txt` records its failure before the correction. This check supplements the geometry gate; it is not evidence of another positioning error.

Evidence for this fix: `tests/artifacts/surface-clearance/before-tests.txt` fails on the original rendered roof layers, while the corrected geometry passes. The saved 1.10.0 QA bundle supports repeatable before/after browser views. The previous portable release is retained at `design/pre-surface-fix-1.10.0-portable.zip`.


## Docks milestone extension (1.11.0)

The wider boathouse intentionally changes floor, roof and access dimensions. Every layered wall has two registered sides and a backing recessed 25 mm; original collision cores keep the outer finish plane. Pitched shells and the porch canopy publish their normals. New sampling caught header, doorway-foot and corner-trim overlaps during implementation; those geometry errors were fixed rather than removing samples. The standard 20 mm threshold remains unchanged.

The current browser regression saves300 views (50 finishes ×2 angles ×3 presets), checks actual compiled shadow modes, climbs five unchanged roofs and the new terrace, walks both boathouse doors and dock connections in both directions, traverses both sheds and lands on a rooftop crate. Use `node tests/browser-surface-clearance.mjs --docks` to keep this milestone's evidence separate. Screenshots require visual review; the script does not classify pixel flicker automatically.

## Doorway beams and reveals (1.12.2)

The earlier wall sample grids missed the narrow wall ends inside doorways and the ends of the frame posts. Those faces were coplanar with the jambs, and posts also extended through their headers. This is separate coverage from checking the broad siding faces. The added audit reproduces 66 failing face registrations in v1.12.1.

`registerJoineryFaces` registers exposed front/back faces and inward reveals before batching, with samples near both beam ends. Each of the nine open frames has two jambs and a header, adding 81 face registrations. Together with the existing 50 finishes, the gate now checks 131 registrations and 6,833 samples at the unchanged 20 mm minimum. The full body of the collision proxies is retained; shortened rendered posts butt below headers, and wall ends recess 30 mm behind the continuous lining. Opaque header backing must fill the space above the opening. A separate ray regression prevents that recess turning into an open slit through the wall.

`tests/joinery-clearance.test.js` demonstrates failure on coplanar reveals and crossing post/header faces, including transformed batched assemblies. The corrected assembly and collision/backing separation pass. `npm run test:surfaces` includes these checks and the actual island audit; packaging invokes the actual island gate. `npm run test:beams:browser` saves 81 eye-height walk-by views (nine frames, three angles, three presets) for visual review. Keep the 300 existing structural views and walking routes; use `--beam-fix` on the surface browser script to retain this patch's evidence separately.

These sampled opaque faces and reviewed frames do not classify every possible flicker. Register new frame assemblies and exposed faces when extending the kit; do not rely on broad wall samples to cover perpendicular joinery.
