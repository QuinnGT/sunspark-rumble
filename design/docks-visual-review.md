# Docks visual acceptance

Reviewed 2026-09-08 against `concepts/sunhaven-docks-v1.png` and `concepts/sunhaven-village-v1.png`.

**Verdict: accept the scoped docks visual milestone.** The implemented scene now establishes the intended building, landform, oak and coastal palette vocabulary. This accepts a substantial, visible step toward the concepts; it does not claim their exact composition, detail density or final production finish. Technical release acceptance remains subject to the separate browser, traversal, resource and offline gates.

## Evidence and criteria

Actual rendered evidence is in `tests/artifacts/docks-milestone/`: final `after-high-reference.png`, `after-high-gameplay.png`, `after-high-entrance.png`, `after-high-cove.png` and `after-low-reference.png`. The archived `before-high-reference.png` was recaptured at 05:27:57 UTC, after the final after images. Both report files record the same reference camera: position `(105.5,7.8,23.4)`, target `(76,5.2,0)`, FOV 62, viewport 1672×940.

| Visual criterion | Observation | Result |
| --- | --- | --- |
| A complete coastal landmark replaces the small shed silhouette | Full navy pitched roof, deep cream eaves, upper windows, teal clapboard and substantial porch are legible in the comparison and ordinary gameplay views. Entrance close-up shows an open doorway and visible interior passage, with trim, lanterns and maritime props. | Pass |
| Connected rocky banks frame a wet, open cove | North/south shelves rise from the surrounding ground. The cove view shows an open water basin continuing toward the sea beneath the outer dock, with exposed pilings and braces. | Pass |
| Broad rounded oaks and composed planting establish hierarchy | The hero oak has overlapping crowns at visibly different heights, detailed leaf edges and exposed sweeping branches. Shrubs and flowers follow selected shelf edges and paths. The building remains readable beside the crown. | Pass |
| Warm/cool lighting and a clearer coastal sky support materials | Timber, teal siding and cream trim remain distinct in sun and shade. The sky is stronger blue; larger clouds have varied lobes and cooler undersides. Interior and trunk shade remain dark but readable. | Pass, with cloud-depth limitation below |
| Landmark composition is comparable and readable | The full lighthouse tower is visible beside the roof in the final matched reference. The ordinary gameplay view prioritizes the entrance and open cove; it does not show the lighthouse from every angle. | Pass |
| Lower detail retains the scene's identity | Low reference retains roof, lighthouse, banks and the oak's asymmetric outline. Reduced shadows and brighter, sharper leaf edges visibly change its finish, without removing major forms. | Pass for the reviewed still |

The matched before frame had a small front gable attached to a flat block, a dominant exposed roof-access ramp, relatively flat banks and tiny distant cloud wisps. The after frame gains a coherent building volume, terraced coastal relief, a deliberate oak focal point and substantial cloud shapes. These are observable scene changes, independent of test results.

## Remaining art gaps and limits

- Rock shelves have conspicuously angular terrace edges and broad, fairly uniform faces. More irregular geological breakup and softer grass/rock transitions would approach the concept's natural banks.
- Clouds still read as soft shaded sprites, with less internal volume and atmospheric variation than the concepts. Their improved silhouettes do not amount to volumetric clouds.
- The harbor and interior remain sparse compared with the references: boats, working clutter, mixed small props, localized wear and richer planting variation are future dressing opportunities. Wider village, lighthouse-detail and character-art work are outside this milestone.
- Fine foliage and siding edges are conspicuous in Low. Still images cannot establish their stability during motion, or prove absence of shadow shimmer, LOD popping, collision errors, performance regressions or offline loading failures. Those require the separate runtime evidence.

No major missing surface, floating hero tree, blocked-looking doorway or gross geometry clash is apparent in the reviewed final frames. This review is independent inspection of the integrated captures; the reviewer also authored this milestone's oak, planting and sky work.
