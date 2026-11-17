import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { auditWorldSurfaces } from './surface-layer-audit.mjs';

export function checkSurfaceClearance() {
  const world = new World(new THREE.Scene(), 'sunhaven'), report = auditWorldSurfaces(world);
  const kinds = new Set(['coastal-cabin','coastal-house','boathouse','boardwalk','coastal-shed']);
  const expected = world.coastalAssets.filter(asset => kinds.has(asset.kind)).reduce((count,asset)=>count+(asset.surfaceLayers?.length??1),0);
  assert.ok(expected >= 12, 'surface audit lost existing roof/floor/dock coverage');
  assert.equal(world.scene.userData.joinerySurfaces.length,81,'all nine open door frames must register both jambs and their header');
  assert.equal(report.layers, expected+world.scene.userData.joinerySurfaces.length, 'every layered asset and exposed joinery face must register its finish for auditing');
  assert.ok(report.samples > 1500, 'surface audit must inspect each board interior');
  assert.deepEqual(report.violations, [], 'Surface clearance gate failed; repair the overlapping geometry before packaging');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(checkSurfaceClearance()));
