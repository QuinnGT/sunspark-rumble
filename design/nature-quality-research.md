# Nature quality research — 7 September 2026

Research in response to the user's screenshots of version 1.5.1. This is a proposed direction, not an implemented graphics release.

## Finding

The current nature pass added detail but did not establish the geometry, shading, lighting, and scene composition needed for the earlier AI concept images. Those concepts were not evidence of an achievable rendered result. Further visual targets should be actual captures from this game at its gameplay camera and resolution.

The user's screenshots show 145 FPS in practice and 175 FPS in a match on Detailed. These are useful indications of headroom on that machine, not a benchmark of future effects or a guarantee for other computers. Earlier embedded-browser measurements should not alone determine the maximum quality tier.

## Primary references worth using

### EZ-Tree — Dan Greenheck

- Demo: https://www.eztree.dev/
- Repository: https://github.com/dgreenheck/ez-tree
- Author's explanation: https://tympanus.net/codrops/2025/01/27/fractals-to-forests-creating-realistic-3d-trees-with-three-js/
- Inspected source: https://github.com/dgreenheck/ez-tree/blob/main/src/lib/tree.js

Recursive tapered branches, changes in branch direction, growth forces, varied leaf placement, and GLB export provide a much stronger starting point than Sunspark's straight cylinders and repeated leaf sprays. Current source includes MeshStandardMaterial leaves, optional rounded normals, wind, receiving/casting shadows, and multiple levels of detail built from one skeleton. An appropriate candidate is to export a small set of tuned trees and create controlled game-scale variations. Verify the chosen revision, textures, licenses, and material/shader export behavior before integration; a GLB export alone does not imply that custom wind shaders transfer.

### Bruno Simon's portfolio — whole-world art direction

- Demo: https://bruno-simon.com/
- Repository and Blender/compression workflow: https://github.com/brunosimon/folio-2025
- Foliage: https://github.com/brunosimon/folio-2025/blob/main/sources/Game/World/Foliage.js
- Lighting (filename is spelled this way): https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Ligthing.js
- Rendering: https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Rendering.js

This is a relevant stylized interactive-world reference. Its foliage uses instanced planes with deliberately adjusted normals and received shadows; the lighting shadow region follows the view. The renderer adds restrained bloom and optional depth of field, while authored Blender assets and compressed GLBs/textures supply the scene. Borrow shading and asset-pipeline ideas, not its branding or complete visual identity. Its foliage orientation assumes a preferred camera angle, so direct transplantation into our freely rotating third-person camera would require adaptation. Depth of field is not a priority for aiming clarity.

### Official Three.js ocean — surface, sky, reflection

- Demo: https://threejs.org/examples/webgl_shaders_ocean.html
- Source matching our installed r180: https://github.com/mrdoob/three.js/blob/r180/examples/webgl_shaders_ocean.html

Uses the Water and Sky add-ons, a water normal texture, sun parameters, and an environment map generated from the sky. This provides a reproducible reference for ocean lighting and reflected surface detail on our existing WebGL renderer. It does not by itself supply clear shallows, shore foam, an underwater scene, or a complete coastal environment.

### Official Three.js backdrop water — visible depth and refraction

- Demo: https://threejs.org/examples/webgpu_backdrop_water.html
- Inspected current source: https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_backdrop_water.html

Uses scene color/depth to distort the scene below the surface and vary water appearance with depth; also demonstrates an animated caustic effect on submerged geometry. This is a useful technique reference. It uses the newer WebGPU/TSL renderer path and is not a drop-in module for Sunspark r180 WebGL. We should first prototype the relevant color/depth technique in our existing renderer rather than assume an engine migration is necessary.

Material capabilities reference: https://threejs.org/docs/pages/MeshStandardMaterial.html

## Verified gaps in Sunspark

- `src/nature-foliage.js`: repeated flat leaf-spray cards, Lambert material, emissive contribution, and `receiveShadow=false`. The screenshot's bright-edged repeated leaves need an alpha/mipmap and normal/shading audit; the exact edge-artifact cause has not been isolated.
- `src/materials.js`: 128px procedural color maps and near-uniform roughness, without normal or AO maps. Larger images alone would not improve object silhouettes.
- `src/game.js`: a broad hemisphere fill and a single whole-island shadow region (160 world units across); no environment map or ambient-occlusion pass. Existing ACES tone mapping is already enabled, so enabling tone mapping again is not a solution.
- `src/nature-water.js`: shader-generated seabed color rather than visible submerged geometry/refraction; 384px coastal reflection rendered selectively. The user's attached angles mostly show the land, so water findings come from source inspection.
- Screenshot composition: repetitive tree forms, sparse isolated ground tufts, uniformly rounded rocks, and oversized diagonal storm stripes across the sky. These remain noticeable even if rendering resolution is increased.

## Recommended implementation order

1. Create one representative playable woodland-and-shore segment using the existing camera, character, collision rules, and controls. Keep a fixed camera/time for before-and-after comparisons.
2. Replace tree silhouettes and leaf distribution; add correctly scaled leaves, canopy shadowing and carefully tuned backlighting. Use several variations with consistent detail transitions.
3. Give ground, bark, and rocks material relief and varied roughness. Build clustered grass, small stones, and ground litter around plausible locations while preserving clear combat routes and reliable collision.
4. Tune sunlight/fill balance, concentrate nearby shadow resolution, and evaluate subtle contact shading. Improve sky/storm presentation so they support the scene.
5. Add an actual shallow seabed, underwater rocks, depth-aware refraction/color, and restrained shore foam. Establish the near shore before adding costly distant ocean effects.
6. Compare actual gameplay screenshots and frame times at the user's resolution. Target a stable 60 FPS minimum for the richer preset on the measured desktop, preserving cheaper presets. Test fights, building, and looking through foliage, not just an empty scenic camera.
7. Roll the proven treatment across the island once the small area is visibly convincing and performance is measured. Bundle assets locally so play remains offline without accounts or paid services.

## Verification limits

Reviewed published demos, author explanations, public implementation code, and current local rendering code. Browser-control transport was unavailable during this research, so no live-demo performance or fresh interactive captures were obtained. No game source, dependencies, build, or release package changed during this research.
