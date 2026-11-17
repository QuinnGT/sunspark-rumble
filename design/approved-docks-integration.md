# Approved docks assets — v1.12.0

The user approved the painted timber, stylized rock formation and rebuilt concept oak, then authorized their integration. This release brings those assets into Driftwood Docks. It does not declare the entire island a match for the concept art.

## In the game

- The boathouse exterior clapboards and gables use the approved teal artwork. Measured atlas strips map onto individual boards without changing their registered structural positions. The atlas is base color only; geometric bevels and constant roughness provide the finish. Short boards crop a five-metre reference strip; longer spans use the full strip without repeating its non-seamless ends.
- Seven concept oaks replace the three earlier landmarks and four ordinary trees in the docks district. Ordinary-tree instances and their collision records are removed together. The remainder of the island keeps its existing vegetation. Each oak uses the original spreading trunk and 15 crown lobes, with 2,820 / 1,410 / 705 spray cards across three distance levels. Shared meshes and materials keep instance costs bounded.
- Thirteen closed Quaternius rock blocks form overlapping groups along the cove. Their foundations bed into the existing heightfield; transformed triangle collision supplies footing, movement and shot cover. The original connected cliff triangles remain the single terrain surface, with quieter mineral shading to complement the painted blocks. This pass does not resculpt the complete underlying heightfield.

## Runtime contract

`prepare:approved-art` extracts the approved oak and three rock geometries and embeds the three approved textures. It reads the retained original files, writes checksums to `assets/approved-docks/manifest.json` and requires no remote asset at runtime. `prepare:docks` combines those five meshes with the two roof meshes into an 864,628-byte glTF payload. Seven unique models serve 29 visible mesh slots.

Later changes: since 1.12.1 the concept oak is no longer part of the payload (the playable docks use the original woodland trees), and `prepare:approved-art` now embeds two colour maps, the teal timber atlas and the rock diffuse, as WebP derived from the retained PNGs. See `assets/approved-docks/README.md`.

Physics starts from synchronous source geometry. Before play, the glTF loader validates every position, normal, UV, color and index against that source, then replaces the visible geometry. Shared replacements have explicit resource ownership. Foliage wind bounds are reapplied after import; color, depth and distance materials use the same deformation and 0.5 alpha cutoff. Preset changes and LOD selection do not move the colliders. A stale export or missing payload fails startup with an error.

The existing structural 20 mm clearance rule is unchanged. No polygon-offset, render-order or depth-disabling workaround is used. The rock/terrain intersections are deliberate solid formations, not parallel decorative skins. The surface test still checks all 50 registered architectural assemblies and 4,358 samples.

## Evidence

- `npm test`: 188 passing tests. New coverage verifies replacement of ordinary-tree colliders, wind bounds after glTF import, matching shadow cutoffs, shared-geometry disposal and actual rock-face collision. The full existing gameplay, terrain, material and structural suites pass.
- `node tests/browser-surface-clearance.mjs --approved`: 300 elevated/grazing views, all three presets, actual compiled shadow modes, five unchanged roofs, workshop terrace, both boathouse doors and dock connections in both directions, shed traversal and crate landing. No browser errors. All six contact sheets were visually reviewed; representative detailed views accompany them in `tests/artifacts/approved-docks/surfaces`.
- `node tests/browser-startup-readiness.mjs --approved`: queued startup/quality selection, all 29 model slots ready, double teardown with zero retained renderer geometries/image-cache sources, disposal during actual shader compilation, and Detailed rendering without HDR support. No errors.
- Matching v1.11/v1.12 docks views and whole-frame diagnostics are retained in `tests/artifacts/approved-docks`. Screenshots are actual game renders. The reference camera is fixed and paused after posing the avatar; the other cameras use ordinary gameplay rendering.
- The final portable release loaded from `file://` in 7,838 ms with networking disabled. Movement, slide/jump, building, fire/reload, saved quality, ten map/explore switches and both eight/ten-bot matches pass. There are no network requests, errors or QA mutation hooks. All eight source, portable-folder and root-ZIP files match by SHA-256; `release-hashes.json` records the checksums. The v1.11 ZIP is retained as `design/pre-approved-assets-1.11.0-portable.zip`.

Visual review checks that the selected assets appear in the real scene and that the wall, roof and floor finishes remain stable in the captured views. Screenshots and finite sampling do not prove the absence of every kind of flicker. The angular terrain transitions, vegetation elsewhere, wider village and character finish remain future art work.

## Cost of the new art

Matched gameplay cameras were measured sequentially on the local RTX 5090 at 1672 × 940, with 210 warm frames per view. These samples are display-capped and do not establish lower-end performance.

| Preset | v1.11 frame p95 | v1.12 frame p95 | v1.11 render CPU p95 | v1.12 render CPU p95 |
| --- | ---: | ---: | ---: | ---: |
| Smooth | 5.8 ms | 5.8 ms | 3.9 ms | 4.0 ms |
| Balanced | 11.5 ms | 11.5 ms | 9.2 ms | 9.2 ms |
| Detailed | 11.5 ms | 11.5 ms | 11.2 ms | 11.6 ms |

Detailed whole-frame draw calls at the recorded gameplay frame change from 2,302 to 2,283; submitted triangles from 6,252,751 to 5,820,485. Replacing older foliage and rock decorations offsets some new asset cost. Whole-scene image residency rises from about 160.0 to 197.3 MiB, below the unchanged 256 MiB budget. This estimate excludes render targets and other procedural textures, which have separate diagnostics. The new atlases increase the production bundle from about 17.9 to 28.8 MiB. The art pass preserves the existing frame-time range on this machine; it is not a broad performance improvement claim.

## Sources

The timber and leaf images were generated with the built-in OpenAI image tool; prompts and originals remain under `design/art-proof` and `assets/art-proof`. The concept oak is original geometry. Its bark maps are the existing Poly Haven CC0 source. The three Rock_Medium models and Rocks_Diffuse texture are from Quaternius's free CC0 Stylized Nature MegaKit Standard pack. See `THIRD-PARTY-NOTICES.txt` and both asset manifests for provenance. The scanned Poly Haven cliff and previous imported-tree candidate are study references only.
