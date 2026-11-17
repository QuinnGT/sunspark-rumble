# Docks authored models

`docks-landmarks.glb` is an original local asset exported by `npm run prepare:docks` from the authored roof geometry in `src/docks-architecture.js`. The manifest records provenance, mesh names, bounds and SHA-256. No external model license or download is needed.

The exporter produces both the GLB and `src/generated/docks-models.js`, which embeds that exact binary in the portable bundle. At startup, Three.js GLTFLoader parses it before play. The loader validates vertices, normals, UVs and topology against the synchronous collision source, then replaces the visible roof geometry and preserves the coastal material. A stale export fails readiness instead of silently separating rendering from collision. Scene disposal owns imported visible geometry; temporary import resources are released immediately.

Re-export after changing either roof shell. Run the authored-model and surface tests, rebuild QA and review the docks camera. Do not add external decoder URLs or runtime network dependencies. This first reusable asset covers the two pitched roof shells; it does not imply the boathouse, cliffs or trees were externally modeled.

This milestone uses baked vertex-color crevice/underside shading with the existing coastal material, rather than adding an AO texture set. If a future authored asset adds aoMap, use non-color red-channel data and valid secondary UVs. The GLB receives the same coastal material after loading.
