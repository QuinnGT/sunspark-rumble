# Nature graphics implementation — version 1.6.0

Completed implementation, September 7, 2026. This supersedes the 1.5 procedural approximation. Research and primary links are in design/nature-quality-research.md.

- Six shared EZ-Tree templates supply irregular branching; photographic oak/ash leaf cutouts use radial canopy normals, interior shading and gentle wind. Matching shadow deformation prevents detached leaf shadows. Three leaf detail levels preserve the rooted collision and navigation bodies.
- Poly Haven color, normal and roughness maps supply grass, path, sand and weathered rock detail. Blended world-space terrain, bent instanced grass blades, fern fronds and irregular boulders provide close-range complexity.
- Refraction renders an opaque scene and depth target when the camera sees the coast; depth guards avoid foreground color bleeding. Absorption reveals the actual beach and submerged rocks. Detailed adds a 768-square reflection target at up to 20 Hz. Smooth uses clear water and analytic sky reflection without extra scene passes.
- A Three.js atmosphere feeds sky/environment lighting. A focused shadow region follows the player. Detailed contact shading uses the correctly alpha-tested scene depth, avoiding solid leaf rectangles. The visible storm wall fades toward the sky.
- Profile budgets control pixel ratio, grass density/distance, canopy detail, shadow resolution/rate, contact shading, and coastal water passes. No preset alters collision or gameplay.
- Eighteen licensed maps are embedded into the offline IIFE. The source pipeline and asset manifest record the exact origins and licenses. No runtime downloads or account requirements.

The circular island, solid cabin exteriors, playful characters, combat and existing building system remain the game's identity. This is a substantial nature upgrade; the concept images remain art direction rather than actual screenshots. Real captures and measured browser evidence are kept locally in tests/artifacts.
