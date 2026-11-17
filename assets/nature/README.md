# Embedded nature assets

Prepared September 7, 2026. All gameplay assets ship inside `game.bundle.js` as data URLs. Playing never fetches a texture or model from the network. The larger bundle is intentional: it includes photographed surface detail instead of replacing it with tiny generated noise.

| Source | Local maps | License |
| --- | --- | --- |
| [Poly Haven forest ground](https://polyhaven.com/a/forest_ground_04) | Diffuse, OpenGL normal, roughness at 1K | CC0 |
| [Poly Haven grass path](https://polyhaven.com/a/grass_path_2) | Diffuse, OpenGL normal, roughness at 1K | CC0 |
| [Poly Haven dry boulder](https://polyhaven.com/a/rock_boulder_dry) | Diffuse, OpenGL normal, roughness at 1K | CC0 |
| [Poly Haven sand](https://polyhaven.com/a/sand_01) | Diffuse, OpenGL normal, roughness at 1K | CC0 |
| [EZ-Tree 1.1.0](https://github.com/dgreenheck/ez-tree) | Oak and ash alpha leaf cutouts; oak bark color, normal and roughness | MIT package; bark source is Poly Haven CC0 |
| [Three.js r180](https://github.com/mrdoob/three.js/blob/r180/examples/textures/waternormals.jpg) | Water normal map | MIT |

The bark asset originates from [bark_brown_02](https://polyhaven.com/a/bark_brown_02). Complete license notices ship in `THIRD-PARTY-NOTICES.txt`. The Poly Haven API responses are retained beside these maps. All twelve downloaded surface maps were verified against the API MD5 digests. `manifest.json` records source URLs, byte counts, and SHA-256 hashes for all eighteen bundled maps.

After `npm ci`, run `npm run prepare:nature` to rebuild the embedded texture module and geometry-only EZ-Tree module. This step reads the downloaded source files and pinned package; it does not download assets. Then run `npm run build`. The generated modules are checked in with the source so ordinary rebuilding also works without preparing them again.

Color maps use sRGB; normal and roughness maps remain linear. Leaf color/alpha and shadow depth materials share the same image, cutoff and wind deformation. Geometry, tree spacing, terrain blending, fern/grass meshes, lighting, LOD and the water refraction renderer are integrated locally in Sunspark.
