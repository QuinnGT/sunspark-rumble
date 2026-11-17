# Unreleased — Public release preparation

- Sunspark Rumble is open source under the MIT License (`LICENSE`). The README is rewritten for the public repository, and this file now holds the version history.
- New hosted web build: `npm run build:web` writes a static site to `dist/` with precompressed files. The portable edition still opens straight from disk.
- A Dockerfile and nginx configuration serve that site. `docs/deploy-dokploy.md` explains how to deploy it on Dokploy.
- A loading screen shows download progress while the game loads.
- Touch-only devices see a notice that the game needs a keyboard and mouse before the download starts, with a **Load anyway** button.
- Added a favicon and a share preview image, with Open Graph and Twitter tags.
- A **Credits & licenses** link in the page footer opens `THIRD-PARTY-NOTICES.txt`.
- The approved timber and rock color maps are embedded as WebP instead of PNG, which shrinks the embedded texture module from 6.9 MB to 3.5 MB.
- A GitHub Actions workflow runs the tests, the surface gate and both builds on every push and pull request to `main`.

---

# Sunspark Rumble 1.12.2 — Stable doorway beams

- Fixed flickering along the white doorway beams in the boathouse, workshop, village houses and orchard building.
- Cleaned up the post-to-header joints and recessed the wall ends behind the frames.
- Preserved door widths, collision, the restored natural trees and the new rocks.
- The surface gate now also checks narrow reveals and frame joints, in addition to floors, roofs and siding.
- Clarified the title badge to say “LOCAL PLAY” so it no longer looks like an internet connection status.

Reopen the game and look for **v1.12.2**.

---

# Sunspark Rumble 1.12.1 — Rock movement fix and natural trees

- Restored the earlier natural woodland trees around Driftwood Docks. Trunks now clear the new rock formations.
- Fixed falling or jumping into a sloped rock edge and becoming unable to move. The full body now resolves rock contact after falling; an already embedded character recovers without reloading.
- Fixed slow drifting while standing on a sloped rock. Players and bots share the correction.
- The approved painted timber and rock formations remain in place.

Reopen the game and look for **v1.12.1**.

---

# Sunspark Rumble 1.12.0 — Painted timber and coastal trees

- The boathouse uses the approved weathered teal timber artwork, mapped onto individual boards.
- Seven spreading oaks now populate the docks district, including its three landmark trees. Rounded crowns, smaller painted leaves and branching trunks replace the previous trees at those sites.
- Thirteen authored rock blocks form larger groups along the cove. The underlying cliff finish is quieter so the formations read together.
- Tree detail scales with distance. Rock and trunk collision follows the visible models, and the existing doors, ramps and boardwalk routes remain accessible.
- All artwork and models are included for offline play. Reopen the game and look for **v1.12.0**.

The wider village, vegetation outside the docks and player assets remain future art passes.

---

# Sunspark Rumble 1.11.0 — A new harbor silhouette

- Driftwood Docks gains a full pitched boathouse, tall open entrances, deeper porch and a workshop with an accessible roof terrace.
- Connected rock shelves frame the cove; clear water now reaches the inner boardwalk edges. Both mainland approaches remain usable.
- Three spreading oaks, composed planting beds and harbor props make the docks more distinctive.
- Warmer sunlight, cooler shade, a deeper blue sky and larger shaded clouds bring the scene together.
- New walls, roofs, ground and access routes have matching collision and expanded checks against overlapping surfaces, including the pitched roofs and clapboard walls.
- All assets, including the new embedded roof models, still load locally for offline play.

Reopen the game and look for **v1.11.0**. This milestone establishes the docks art standard; wider village and character refinements follow separately.

---

# Sunspark Rumble 1.10.1 — Clear, stable surfaces

- Fixed overlapping roof slabs and timber boards that produced streaks and flicker as the camera moved.
- Separated the visible backing under shed floors and dock boards while retaining their walking surfaces and roof access.
- Cleared protruding terrain beneath both open sheds and kept their entrances traversable.
- Fixed stale shadow patches when switching to Smooth graphics.
- Added construction rules and a release check for overlapping structural layers and terrain clearance.

Reopen the game and look for **v1.10.1**.

---

# Sunspark Rumble 1.10.0 — A crafted Sunhaven coast

- Driftwood Docks now has individual weathered planks, thick rope-wrapped pilings, bracing, metal fittings, lanterns and detailed cargo crates.
- The boathouse has a taller slate gable. Teal and coral coastal buildings gain clapboard walls, recessed windows, cream trim and canvas awnings; roof decks and access routes stay playable.
- Shaped open boat hulls sit in a deeper, connected shallow-water basin. Both boardwalk approaches remain dry and accessible.
- Sculpted headlands, rocky slopes, sandy landings, shrubs and flower beds bring the shared coastal style into every Sunhaven district.
- Surface maps use consistent physical scales and load locally before play. Small scenery parts share efficient batches, and their graphics resources have explicit cleanup. Shared materials and spatial batching keep the added detail within the renderer's loading and resource budgets.

Reopen the game and look for **v1.10.0**.

---

# Sunspark Rumble 1.9.0 — Ready for richer islands

- Terrain color, surface bumps and roughness now follow matching material layers and scales, including steep faces and wet shorelines.
- Terrain is divided into smaller visible sections. Walking, building, shots and water depth use the same sampled ground surface.
- Repeated scenery preserves its texture and shading data when batched. Trees use spatial branch and canopy groups with stable distance detail and wind bounds.
- Colors remain consistent across graphics presets. Devices without HDR render targets use a simpler rendering path with the same final color treatment.
- Water effects depend on visible nearby water. Rendering resolution, reflections and offscreen buffers have explicit limits for large displays.
- The island waits for texture loading and shader preparation before play starts. Starting early or changing quality during loading is handled safely.
- GPU resources have explicit cleanup, and development diagnostics report complete-frame rendering costs and shader compatibility failures.

Reopen the game and look for **v1.9.0**. This release prepares the rendering foundation for the next terrain and art update.

---

# Sunspark Rumble 1.8.1 — Solid ground and steady shadows

- Fixed character shadow flicker during movement: animated bodies and their shadows now use the same frame. Shadow focus stays aligned to the sun's pixel grid.
- Raised enterable-house floors onto shallow foundations so the terrain cannot flicker through the boards. Doorways remain easy to step through.
- Moved the northern dock approach away from the blue boathouse doorway. Both doors and both land-to-dock routes remain usable.
- Replaced the rectangular quarry blocks with a rounded, irregular terrain hill, blended rock surfaces and connected timber access ramps.
- Permanent Sunhaven ramps now have foundations that follow the ground, closing the visible gaps underneath them.

Reopen the game and look for **v1.8.1**.

---

# Sunspark Rumble 1.8.0 — Welcome to Sunhaven

- Choose the new Sunhaven Island or the compact Breezy Bay on the title screen. Sunhaven is 240 game units across, about 3.2 times the original boundary area, with ten bots.
- Five districts: Sunbeam Village, Lantern Heights, Orchard Grove, Driftwood Docks and Pebble Quarry. Open interiors, connected dock platforms, two-way ramps and terraces add new routes and cover.
- Explore the selected island without a storm or attacking bots. The original practice playground remains available.
- Starting locations and supplies vary by match. The storm reveals its next circle, pauses between phases, and can finish in five different areas. Follow the directional arrow when outside.
- Building works across the expanded land. Bots navigate the new districts, climb roofs and terraces, and react early to the shifting safe area.
- Trees, ground cover, water depth and the minimap now use the selected map. Spatial collision queries and cached navigation reduce the cost of the larger world.
- Accidental deep-cove falls return the player to dry ground; use the permanent boardwalks to cross.

Reopen the game and look for **v1.8.0**. Try **Explore this island** for a relaxed first tour.

---

# Sunspark Rumble 1.7.1 — Bend, don't squash

- Replaced upper-body scaling with a joint-driven crouch and slide. Hips move back and down, knees bend forward, ankles keep feet flat, and the torso leans naturally.
- The helmet, backpack, clothing and weapon retain their dimensions throughout the transition. A neck joint keeps the head upright; the blaster stays level, with an articulated firing arm following its grip.
- Crouch-walking now steps with bent legs. Controls, movement speeds, crouch/slide collision heights and building rules stay the same.
- 78 automated checks pass, including mesh proportion invariance through the whole stance transition, planted feet, grip reach and low-ceiling fit.

Reopen the game and look for **v1.7.1**.

---

# Sunspark Rumble 1.7.0 — Make your move

- Press C to crouch, and again to stand. You stay low if there is a ceiling overhead. The camera, body, collision and bot aim all follow your stance.
- Hold Shift while moving, then tap C for a fast slide. Steer gently, carry momentum downhill, press Space to jump out, or C to brake. A short cooldown prevents repeated speed boosts.
- Hold Space for a higher jump or release early for a short hop. A small grace period catches late ledge jumps and presses just before landing.
- Quicker acceleration and braking, useful air steering, smoother downhill footing, bent knees, planted crouch feet, a sliding pose, dust and movement sounds.
- Movement hints appear above your health. Existing weapons, building, rock gaps and rooftop crate fixes remain included.

76 automated checks pass, alongside actual browser movement, combat, building and replay checks.

Reopen the game and look for **v1.7.0**. Try the Practice playground first.

---

# Sunspark Rumble 1.6.2 — Walk beside the rocks

- Replaced oversized rectangular rock collision with checks against the actual rock geometry. Clear corners and gaps are now passable, and you can approach visible rock faces closely.
- Player and bot movement use the same rock shapes. Standing and overhead checks follow rock surfaces instead of invisible flat box tops.
- Rocks retain their visible shape, placement and bullet cover. The earlier rooftop-crate fix remains included.
- 68 automated checks pass. Browser tests walked and sprinted through two real gaps in both directions in Smooth and Detailed modes, and separately verified a close approach to a large rock.

Reopen the game and look for **v1.6.2**.

---

# Sunspark Rumble 1.6.1 — Rooftop crate fix

- Fixed the flickering dark bands on all four rooftop crates. Their top faces overlapped the wooden lid exactly, causing z-fighting as the camera moved. The bands now wrap slightly above the lid.
- Walking collision, jumping onto the lid, cover and bot navigation retain their existing behavior.
- 63 automated checks pass, including a new regression that probes the actual rendered crate surfaces after batching.

Reopen the game and look for **v1.6.1**.

---

# Sunspark Rumble 1.6.0 — A richer Breezy Bay

September 7, 2026

- Rebuilt the trees with curved branching, varied oak/ash canopies, photographic leaf cutouts and bark, soft leaf lighting, and matched moving shadows.
- Added dense windblown meadow grass, fern fronds, textured paths and sand, and irregular weathered boulders. Terrain transitions and open routes keep combat readable.
- Added depth-aware water refraction: clear shallows reveal the sandy seabed and rocks, with animated underwater light, shoreline foam, moving normal-map ripples, sun glints and coastal reflections.
- Added atmospheric sky lighting, focused sun shadows and gentle contact shading on Detailed. The storm now fades into mist instead of filling the sky with diagonal stripes.
- Smooth, Balanced and Detailed use distinct grass, foliage, shadow and water budgets. The existing live FPS display and saved preferences remain available.
- All textures and code are bundled locally. The portable game still opens directly from disk without internet, Node, accounts or paid services.

62 geometry/gameplay/rendering checks pass. Dedicated Chrome keyboard/mouse testing also verified connected building and climbing, R reload, crate collision, cover destruction, all three presets, a natural match result, replay and staged victory presentation.

Reopen the game and look for **v1.6.0**. Try **Detailed** in Graphics & FPS to see the full pass, or keep Balanced as your starting point.

---

# Sunspark Rumble 1.5.1 — Find your sweet spot

September 7, 2026

- Added a live FPS badge below the map. It shows your picture quality and updates about once a second while playing.
- Added a dedicated **Graphics & FPS** panel, reached from the badge, pause menu, or Controls & settings.
- Choose **Smooth**, **Balanced**, or **Detailed**. Balanced offers a middle option with softer shadows and sky reflections; fresh settings start here.
- Changes apply immediately and preserve the current match. Quality and the optional FPS display save between visits; older graphics preferences still work.
- The panel shows the last gameplay measurement while paused. New presets start a fresh measurement after you resume.

**61 tests pass**, including real frame timing, preset changes during a paused match, saved preferences, and all earlier gameplay regressions. The offline bundle and portable ZIP are updated. Reopen the game and look for **v1.5.1**.

---

# Sunspark Rumble 1.5.0 — A living little island

September 7, 2026

- Replaced the flat sea texture with turquoise shallows, irregular moving ripples, small offshore waves, shoreline foam, and sun glints. Detailed coastal views also reflect the scene.
- Replaced polygon tree crowns with original textured leaf sprays, branching shapes, gentle wind, and leaf-shaped shadows. Green and warm peach trees keep the island colorful.
- Added a graded blue sky, soft clouds, and a smoother transition from grass to sand.
- Simplified distant leaves and opponents, combined permanent scenery drawing, and limited reflection work. **Smooth on slower PCs** keeps moving water and foliage with cheaper sky reflections and no shadows or small meadow plants.
- Preserved the existing cover, ramps, building, and rooftop-crate collision. Fixed a camera clipping issue when standing very close to a wall.
- Everything is included locally. No downloads, accounts, or online services are needed to play.

**57 regression tests pass.** Browser checks covered both graphics modes, real combat and reloads, building, cover destruction, crate landings, match results, replay, and the victory fixture.

Reopen the game and look for **v1.5.0**. Existing launchers work; extract the updated portable ZIP if using a separate copy.

---

# Sunspark Rumble 1.4.1 — Scenery and crate collision

September 7, 2026

- Fixed rocks intersecting tree trunks. Scenery placement now checks visual footprints and reserves room around fixed crates and existing solid props.
- Rock movement bounds now include their scaled and rotated visible shape.
- Fixed all four rooftop crates being decorative only. Their sides block movement and shots, their lids support landing, and bots route around them.
- Added three regression tests covering prop separation, all crate faces, jump landings, and bot routes. **52 tests pass.** Browser play confirmed that walking stops at a crate and a jump lands on its lid.

Reopen the game and look for **v1.4.1**. Existing launchers and the portable ZIP are updated. Advanced water and foliage are proposed separately in `VISUAL-UPGRADE-PLAN.md`.

---
# Sunspark Rumble 1.4.0 — Breezy Bay gets a makeover

September 7, 2026

- Added wood grain, painted siding, bark, stone, cloth, and softly patterned grass. The sea has slowly drifting ripple textures.
- Fuller trees now have branching trunks, layered crowns, small leaves, and fruit. Meadows include grass clumps, five-petal flowers, ferns, and scattered stones.
- Cabins have clapboard siding, shutters, window reflections, trim, sun emblems, and rooftop decking. The lighthouse has framed lantern windows and extra architectural details.
- Explorer characters have rounded helmets and visors, jacket straps, kneepads, boots, and backpacks with a sun badge and water bottle. Blasters have rounded edges and extra trim.
- Walls, floors, ramps, and crates have timber textures, braces, bolts, and fittings. Existing collision and connected building rules are preserved.
- Combined decorative meshes and capped shadow refreshes at 30 Hz to reduce rendering work. **Smooth on slower PCs** removes small meadow plants and shadows while keeping the new models and textures.
- Everything still runs offline. Textures are generated inside the game; there are no extra downloads or accounts.

**49 gameplay tests pass.** Browser checks covered shooting, reload, jumping, build placement, bot combat, both graphics settings, walking onto a cabin roof, and a textured wall absorbing eight bot shots with zero player damage.

Reopen the game and look for **v1.4** on the title screen. The existing launchers and updated portable ZIP work as before.

---
# Sunspark Rumble 1.3.1

September 5, 2026

- Fixed newly placed walls, ramps, and floors not blocking bot shots until the next rendered frame. Their shot collision is now ready immediately.
- Fixed enlarged hit areas sticking through closely hugged walls and around corners. A valid assisted hit now also needs a clear path from the shot to the target's body. This applies to bot fire, player blasters, and Gumballs.
- Added build health bars when aiming at a piece, brief feedback when your cover is hit, impact sounds, and a clear **BROKE!** message when your build is destroyed.
- The shot that breaks a structure is absorbed. Later shots can pass through the opening. Enemies can still hit you from exposed sides or above cover.
- Added a repeatable browser cover-check fixture: `npm run build:qa`, then `npm start`. See the Browser checks section of README.md for the test URL and steps. Test controls are excluded from the playable release.

**49 automated tests pass.** New regressions cover immediate placement, hugging walls in all compass directions, grazing corners, wall seams, ramp faces, both sides of floors on every difficulty, bursts at 20/30/60 Hz, and destruction timing. Browser checks fired eight bot shots into a wall, ramp, and both faces of a floor: every piece dropped from 150 to 38 health with no player damage. Three more shots broke the wall without hurting the player; the following shot reduced shields from 100 to 86.

Refresh or reopen the game. Existing launchers work, and the portable ZIP is updated.

---
# Sunspark Rumble 1.3.0

September 5, 2026

- Choose **Easy, Medium, Hard, or Insane**. Each changes awareness, reaction time, aim, burst length, movement, reload timing, tactics, and building budget. Old Normal preferences become Medium.
- Bots actively patrol and engage. They see within a field of view, hear nearby gunfire, remember last sightings briefly, and lose track of hidden opponents.
- Bots have real magazines and reload breaks. Watch for cyan rings and the **RELOADING** label when aiming at an opponent. Yellow rings warn of incoming fire.
- Added flanking, close-range retreat, cover seeking while hurt or reloading, and attempts to gain higher ground.
- Bots can walk up cabin ramps, traverse roofs and connected player builds, and descend to escape the storm. Medium and above can jump when blocked.
- Bots build defensive walls, ramps toward elevated opponents, and floor landings from elevated edges. They follow the same placement rules and spend their own limited wood; their pieces are destructible.
- Easy stays approachable with forgiving aim, two-shot bursts, a longer opening grace, and limited simultaneous attackers. Hard and Insane apply much greater pressure.
- Fixed other bots' crossfire prematurely ending the player's opening grace. Repeated hits also cannot endlessly restart an already-engaged bot's reaction timer.
- Cached unchanged navigation edges so building does not recalculate every route across the island.

**41 automated tests pass**, including controlled combat comparisons, sight and hearing, reload windows, cabin ascent/descent, autonomous tactical building, navigation after destruction, storm retreat, and all earlier weapon/building fixes.

Refresh or reopen your game to load the update. Existing launchers still work. Extract the updated portable ZIP if playing from a separate copy.

---
# Sunspark Rumble 1.2.0

September 5, 2026

- Added **Prism Popper**: a glowing crystal blaster with a visible 0.8-second charge, a rainbow shot, and closer aiming zoom. Click to charge and fire automatically; hold for repeat shots.
- Added **Gumball Blaster**: a candy-filled hopper and colorful traveling balls that bounce once off solid surfaces. Try bank shots around cover!
- Improved **Spark** with crisp golden fire and **Confetti** with multicolor bursts and gentle close-range knockback. All four weapons have their own models, firing sounds, and reload motion.
- Added weapon pickups around the island and all four weapons beside the practice spawn. Carry two guns, select **1 / 2**, and press **E** near a pickup to swap the selected slot. The preview says exactly which gun will be replaced.
- Ammo boxes replenish both carried weapon reserves. Swapping away and back preserves ammo; empty magazines still reload automatically.
- Build mode keeps its B / 1 / 2 / 3 controls. E cycles pieces while building. Switching to building cancels Prism charging and B restores your selected gun.
- Fixed custom sphere materials so the Gumball hopper is translucent and the Prism crystal glows.

**32 tests pass.** Browser play verified all four weapons firing and reloading, both slot swaps, the charge meter, building a wall and bouncing a Gumball off it, charge cancellation, and starting a fresh match. No browser warnings or errors were recorded. The offline bundle and portable ZIP are updated; refresh/reopen your game, or extract the new ZIP if using a separate copy.

---

# Sunspark Rumble 1.1.0

September 5, 2026

- Press **B** to enter build mode. **1** selects wall, **2** ramp, **3** floor. **Q / E** cycle pieces and **R** rotates them.
- Click to place, then keep building. Press **B** again to equip the blaster you were using.
- Walls, ramps, and floors snap to a shared grid. Extend ramps into staircases, add floor bridges and corner landings, and look up to stack walls.
- Added a build toolbar, connection preview, and clear placement feedback. Invalid or duplicate builds cost no wood; every successful piece costs 10.
- Floors support walking, block shots and upward jumps, and can be destroyed. Bots can travel beneath elevated floors with enough headroom.
- Preserved the permanent-ramp and repeated-reload fixes from 1.0.1.

Refresh or close and reopen the game. Existing launchers still work. Extract the updated portable ZIP if playing from a separate copy.

Verification: **23 tests pass**, including connected staircases and platforms at 20, 30, and 60 simulation updates per second, all four compass directions, turning a floor bridge, wall stacking, resource limits, pause/replay, floor collisions, and gun/reload restoration. Browser play of the production bundle built two ramps, climbed them, crossed two floor panels, stacked two walls, then returned to the same blaster and fired/reloaded successfully. No browser warnings or errors were recorded.

---

# Sunspark Rumble 1.0.1

September 5, 2026

- Fixed all four built-in cabin ramps. Their entrances now meet the ground, and their exits join the roofs without catching the character.
- Made ramp sides solid and updated bot paths to avoid their solid sections.
- Fixed a completed reload leaving a negative timer, which could prevent subsequent manual and automatic reloads.
- Added clear feedback when the magazine is already full or no reserve ammo is available.

Close and reopen the game, or refresh the browser, to load the update. The Windows launchers still work as before. The portable ZIP has been updated too.

Verification: 19 tests pass. All four permanent ramps were climbed in the browser from ground to roof using normal movement input from a test starting position. The production bundle was used to fire and press R three times with each weapon; all six reloads refilled the magazine, consumed the correct reserve ammo, and returned the timer to zero. Automated tests also cover repeat automatic reloads, solid ramp sides, and walking/sprinting onto every cabin roof at 20, 30, and 60 simulation updates per second.


