# Sunhaven asset study 01

**v1.12.1 update:** the user preferred the original natural woodland. Those trees are restored around the docks; the concept oak remains a study reference. Approved timber and rocks remain in the game. See [rock contact and restoration notes](../rock-contact-recovery.md). The sections below record the earlier review and integration history.

This isolated Three.js proof retains the approved painted timber, rock and concept oak samples. All three now appear in the playable v1.12 docks. The earlier wood/tree samples remain available for comparison; the terrain sample shows the underlying cove form with its current cliff finish.

Run `npm start`, then open <http://127.0.0.1:4173/design/art-proof/index.html?asset=oak>. The viewer supports orbit, zoom, camera reset, current/candidate switching and model variants. `npm run build:art-proof` rebuilds it. With the server running, `npm run test:art-proof` checks the comparisons, and `npm run test:concept-oak` checks the new tree and exports its textured GLB.

## Visual findings

| Sample | Finding | Decision |
| --- | --- | --- |
| Painted timber | Generated artwork provides identifiable knots, individual board variation, teal paint and warm wear. The material comparison uses identical geometry, camera and light. | Approved; integrated on the boathouse. |
| Stylized rocks | Authored facets and painted edges offer a more deliberate shape than the current grid-based cliff. This three-rock arrangement remains a small modular formation. | User approved the rock formation direction. Develop connected cliff compositions and grassy transitions when integrating. |
| Scanned cliff | Much richer natural crevices and strata. Its brown photorealistic finish and open scan boundary do not match the concepts as a ready-made replacement. | Retain as a shape/material benchmark; do not roll out across the island. |
| Previous imported-tree adaptation | Stretched source geometry retained oversized leaf shapes and an unsuitable crown. | Superseded. Kept as the explicitly labelled previous candidate. |
| Concept oak v2 | Original low fork, six spreading main limbs, irregular rounded crown with 15 foliage lobes, and small generated oak sprays. Warm bark and olive/yellow-green foliage follow the concept. | Approved; seven docks placements at varied sizes, including four ordinary-tree replacements. |

### Corrected current-tree comparison

The first study labelled the special docks oak as the general current tree. That was misleading. The game uses `IslandFoliage` for ordinary island trees; the broad `createDocksOaks` tree appears only at three Sunhaven landmark sites. Both builders are present in the current game bundle. The viewer now defaults to an actual ordinary island oak when selecting Current trees, with the island ash and **Docks oak (3 sites)** listed separately. The browser regression verifies that the default is a real IslandFoliage instance, with the landmark oak hidden.

This study does not claim that the whole concept-quality milestone is passed. The integration adds synchronous matching collision, an embedded glTF runtime payload, three canopy LODs, shared resources and the full three-preset gameplay review. See [integration notes](../approved-docks-integration.md).

## Sources and preparation

- **Teal plank atlas:** generated with the built-in OpenAI image tool. Exact request: [teal-plank-prompt.txt](teal-plank-prompt.txt). Output is **1254 × 1254**, despite the requested 2048. It is sRGB base color, not a seamless texture or a complete PBR set. Eight measured strip ranges are mapped onto individual boards. No normal map was inferred from dark paint. The wall uses geometric bevels and constant roughness for the new finish.
- **Stylized Nature MegaKit Standard:** [Quaternius’s official download](https://quaternius.itch.io/stylized-nature-megakit), free Standard version. Original models and textures are retained under `assets/art-proof/nature/`, with `License_Standard.txt` stating CC0 1.0. The three Rock_Medium models and previous CommonTree_1 adaptation are displayed. Source trees 2–5 remain archived. No paid files were acquired.
- **Rock Face 01:** [Poly Haven](https://polyhaven.com/a/rock_face_01), by Dario Barresi, CC0. The 1K glTF, binary, albedo, OpenGL normal and packed ARM map were downloaded from official manifest URLs. All five files match the API's MD5 checksums. This is a scanned face with an open boundary, not a complete standalone closed rock.
- **Concept oak v2:** original geometry in [concept-oak.js](concept-oak.js); it does not derive from the imported source tree. The built-in OpenAI image tool generated [oak-sprays-v2.png](../../assets/art-proof/oak-sprays-v2.png), a 1254 × 1254 RGBA atlas with four sprays. The requested size was 1536; the actual output is recorded honestly. [Exact generation prompt](oak-sprays-v2-prompt.txt). Four quadrant UVs use the original alpha channel, with no background painted into the geometry. Bark color and normal maps reuse the existing CC0 Poly Haven bark source documented in [nature assets](../../assets/nature/README.md).
- **Reusable model:** [sunhaven-concept-oak-v2.glb](../../assets/art-proof/sunhaven-concept-oak-v2.glb), 7,099,688 bytes, includes the two textured meshes, vertex colors/normals and alpha mask. A GLTFLoader round trip verifies both meshes and textures. The runtime wind and two-sided cluster-lighting shader patches live in `concept-oak.js`; these JavaScript behaviors are not stored in standard glTF and must be reapplied by the game importer. Compression and LODs are integration work.
- **Current samples:** ordinary oak/ash through IslandFoliage, plus the separately labelled landmark oak; current coastal paint material on identical sample geometry; actual north-cove terrain triangles and terraces cropped to the viewer. The terrain crop has a cut outer boundary because it is extracted from a larger island, not because the game has holes.

[Asset manifest](../../assets/art-proof/manifest.json) records source URLs, license references, sizes and SHA-256 hashes. Original downloaded archive is retained under `assets/art-proof/source/`. Temporary download-session cookies and signed URLs are removed after acquisition.

## Technical evidence

The proof uses Three.js 0.180.0, ACES tone mapping, sRGB output and the existing docks sunlight/exposure values. Current and candidate share each asset's fixed camera. The imported texture samplers are deduplicated within the proof. This is an inspection scene, not an in-game performance benchmark.

- `npm run test:surfaces`: all four existing surface regressions pass, including the full current world.
- The new wall audit checks **57 samples** with no overlap violations. Its finish is 50 mm in front of the backing; it uses no depth-test, polygon-offset or draw-order workaround.
- The browser proof saves **10 matched asset views**, the complete viewer, and close/elevated/grazing wall views. Loading, shader program checks and camera-reset interaction pass without console errors. See [report.json](../../tests/artifacts/art-proof/report.json).
- The tree test saves **six camera views**, the actual ordinary oak, a wind frame and the complete tree viewer. It verifies the default current-tree identity, real image alpha, visible/depth/distance cutoffs, depth writes and textured GLB export/import. [Tree report](../../tests/artifacts/art-proof/tree-v2/report.json). Initial validation caught a 0.45 vs 0.5 leaf/shadow cutoff mismatch: Three r180 forces 0.5 for alpha-to-coverage shadows. The new tree now uses 0.5 consistently. Its 2,820 spray cards and branch mesh total 14,736 triangles before wind deformation.
- Screenshots were visually inspected. These tests do not automatically score art quality or prove absence of every kind of pixel flicker. The gameplay surface browser suite was not rerun because the game geometry and release bundle are unchanged.

The approved-assets integration is recorded separately in [the v1.12 notes](../approved-docks-integration.md), including real gameplay evidence. Earlier proof-only test results above describe the study at the time of its original review.
