# Coastal material sources

The coastal architecture uses physically matched color, OpenGL tangent-space normal, and roughness maps. All files are embedded into `src/generated/coastal-textures.js` and then the portable game bundle. Playing and rebuilding the embedded module need no network. The shared `nature-assets.js` cache waits for decoding/upload and accounts for their mip memory before shader warmup.

## Authored material library

The timber, painted timber, slate, end grain, metal, rope and canvas maps are original deterministic project assets authored in `scripts/prepare-coastal.mjs`. They follow the project's source terms. They are not a download, photograph, AI-generated image, or re-licensed third-party work. Run `node scripts/prepare-coastal.mjs` to recreate them from their recipes and embed the unchanged CC0 plank set. This script uses Node built-ins only; it does not require an image application or additional package.

The three channels in each authored set use the same underlying surface field. Normals are computed from physical height gradients, with an explicit OpenGL green-channel convention accounting for image-row orientation. Roughness is replicated into RGB so Three.js's G-channel sampling is correct. Albedo is deliberately neutral for the coastal teal, coral, cream, navy and warm timber tints; it includes surface variation without painted directional highlights. Painted timber has much less contrast and relief than bare wood. Geometry supplies plank joints, bevels and recesses rather than printing a second layer of seams on individual boards.

| Kind | Resolution | Physical tile | Construction |
| --- | ---: | ---: | --- |
| `timber` | 1024 | 1m | Grain along U, knots, pores and silvered fibres; no board seams |
| `paintedWood` / `painted` / `trim` | 1024 | 1m | Restrained timber relief under paint; trim uses the same maps with smoother shading |
| `roof` | 1024 | 1m | Four staggered 25cm slate courses with lapped edges |
| `endGrain` | 512 | 24cm | Growth rings and radial checks |
| `metal` | 512 | 50cm | Small fixture patina and fine surface marks |
| `rope` | 512 | 20cm | Twisted sisal fibre relief; U follows rope length |
| `fabric` | 512 | 25cm | Cotton canvas warp and weft |

## CC0 photographed boards

`source/wood_planks_{Diffuse,nor_gl,Rough}.jpg` are the unchanged 1K maps from [Wood Planks by Amal Kumar / Poly Haven](https://polyhaven.com/a/wood_planks), used for the `planks` material on broad floors/decks where board seams are needed. The author specifies a 1.5m-wide surface. The grain runs along U. All three files were verified against the MD5 checksums in the retained `source/wood_planks.json` API response. This source remains public-domain [CC0](https://polyhaven.com/license); attribution is retained here for provenance. These assets are free from Poly Haven and must not be presented as original Sunspark-authored photographs. The public API was used once for download metadata; no live API integration ships in the game.

`manifest.json` records dimensions, physical scale, map roles, provenance, download URLs and SHA-256 digests of all 24 maps. The full library adds approximately **80 MiB** of RGBA8 texture data with mipmaps if every set is requested; repeat variants share decoded sources. The actual scene's combined nature/coastal residency estimate is reported by the existing diagnostics and remains subject to the 256MiB ceiling.

## Geometry and ownership contract

`coastalMaterial(kind, tint?, {repeat:[u,v], normalScale, roughness, metalness, vertexColors}?)` returns a cached ordinary `MeshStandardMaterial`. UV one means one metre by default; the material applies each set's physical tile size equally to all three maps. U follows wood grain and rope length. New geometry should have linear vertex colors for restrained crevice shading; `vertexColors:false` supports old geometry without that attribute. `stone` borrows the existing CC0 dry-boulder maps at a 1.5m scale instead of loading another rock set.

Scene resource ownership releases materials; the embedded asset cache owns their texture sources and transformed variants. Disposing a material removes its cache entry and does not dispose borrowed maps. Loading, cleanup and offline behavior use the same pipeline as terrain assets.
