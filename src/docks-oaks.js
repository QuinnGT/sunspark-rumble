// Authored spreading oak silhouettes for the docks reference scene. Crowns are
// overlapping sprays of alpha-cutout leaves, never opaque sphere stand-ins.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from './config.js';
import { natureTexture } from './nature-assets.js';
import { graphicsProfile } from './graphics.js';
import { canopyLevel } from './nature-foliage.js';
import { ResourceScope } from './resource-scope.js';
import { patchShader } from './shader-patches.js';

export const DOCKS_OAK_SITES = Object.freeze([
  Object.freeze({ id: 'north-bank-oak', x: 91, z: -2, scale: 1.04, yaw: .34, variant: 0 }),
  Object.freeze({ id: 'south-bank-oak', x: 88, z: 52, scale: 1.10, yaw: -1.14, variant: 1 }),
  Object.freeze({ id: 'boathouse-backdrop-oak', x: 68, z: -5, scale: .87, yaw: .94, variant: 2 }),
]);
export const DOCKS_OAK_WIND_PADDING = Object.freeze({ x: .103, y: 0, z: .052 });
// Preserve bright vertex tint values above 1 without keeping Float32 colors.
// The material restores this uniform gain after normalized Uint8 decoding.
export const DOCKS_OAK_COLOR_GAIN = 1.125;
export function docksOakReserved(x, z, padding = 0) { return DOCKS_OAK_SITES.some(site => Math.hypot(x - site.x, z - site.z) < 7 + padding); }
const CLUSTERS = Object.freeze([
  [-.15, 7.9, -.25, 1.95, 2.10, 1.85], [-3.4, 5.1, .65, 1.75, 1.8, 1.75], [3.3, 6.1, .35, 1.80, 2.0, 1.8],
  [-1.9, 6.85, -2.35, 2.05, 1.8, 1.8], [1.5, 7.0, -2.4, 1.9, 1.7, 1.7],
  [-1.6, 5.6, 2.15, 1.9, 1.55, 1.6], [1.7, 7.0, 2.2, 1.85, 1.8, 1.75],
]);
const windCode = `
  vec3 oakWorld=(modelMatrix*vec4(transformed,1.)).xyz;
  float crown=smoothstep(2.6,5.5,position.y);
  transformed.x+=sin(oakTime*.83+oakWorld.x*.18+oakWorld.z*.11)*.09*crown;
  transformed.z+=sin(oakTime*1.07+oakWorld.z*.24)*.05*crown;
  transformed.x+=sin(oakTime*3.1+oakWorld.x*3.4+oakWorld.z*2.1)*.012*crown;
`;
function oakWind(material, time, lit = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.oakTime = time;
    shader.vertexShader = 'uniform float oakTime;\n' + patchShader(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n' + windCode, 'docks oak wind');
    if (lit) {
      const normal = patchShader(THREE.ShaderChunk.normal_fragment_begin, 'normal *= faceDirection;', '', 'docks oak outward normals');
      shader.fragmentShader = patchShader(shader.fragmentShader, '#include <normal_fragment_begin>', normal, 'docks oak normal chunk');
      shader.fragmentShader = patchShader(shader.fragmentShader, '#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*.055;', 'docks oak transmitted light');
    }
  };
  material.customProgramCacheKey = () => `sunspark-docks-oak-v1-${lit}`;
  material.userData.staticBatching = false; return material;
}
function branchTube(points, radii, sides = 9) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), steps = Math.max(7, points.length * 4), frames = curve.computeFrenetFrames(steps, false);
  const p = [], n = [], uv = [], color = [], index = [], length = curve.getLength();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, center = curve.getPointAt(t), segment = Math.min(radii.length - 2, Math.floor(t * (radii.length - 1))), local = t * (radii.length - 1) - segment, radius = THREE.MathUtils.lerp(radii[segment], radii[segment + 1], local);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, radial = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      const v = center.clone().addScaledVector(radial, radius * (1 + Math.sin(a * 3 + t * 7) * .065));
      p.push(v.x, v.y, v.z); n.push(radial.x, radial.y, radial.z); uv.push(j / sides * Math.PI * radii[0] * 2, t * length);
      const shade = .77 + .23 * Math.min(1, t * 3); color.push(shade, shade, shade);
      if (i < steps && j < sides) { const k = i * (sides + 1) + j; index.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1); }
    }
  }
  for (const end of [0, steps]) {
    const center = curve.getPointAt(end / steps), start = p.length / 3, normal = frames.tangents[end].clone().multiplyScalar(end ? 1 : -1);
    p.push(center.x, center.y, center.z); n.push(normal.x, normal.y, normal.z); uv.push(0, 0); color.push(.8, .8, .8);
    for (let j = 0; j < sides; j++) { const k = end * (sides + 1) + j; if (end) index.push(start, k, k + 1); else index.push(start, k + 1, k); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3)); g.setIndex(index); return g;
}
function branchesFor(clusters, variant) {
  const parts = [branchTube([[0, -.10, 0], [.08, .7, .06], [-.13, 2.1, .06], [.05, 3.5, -.10], [-.22, 5.15, -.23], [0, 6.6, -.24]], [.68, .53, .42, .35, .19, .035], 12)];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + variant * .4, x = Math.cos(a), z = Math.sin(a);
    parts.push(branchTube([[0, .48, 0], [x * .47, .20, z * .47], [x * .91, -.08, z * .91]], [.21, .16, .025], 7));
  }
  clusters.forEach(([x, y, z], i) => {
    if (i === 0) return;
    const start = 2.5 + (i % 3) * .45;
    parts.push(branchTube([[0, start, 0], [x * .32, start + .65, z * .31], [x * .76, y - 1.2, z * .74], [x, y -.15, z]], [.29 - i * .018, .22 - i * .012, .125, .025], 9));
    for (const side of [-1, 1]) parts.push(branchTube([[x * .71, y - 1.4, z * .70], [x + side * .6, y - .15, z + .25], [x + side * .9, y + .8, z + .52]], [.075, .045, .009], 6));
  });
  const g = mergeGeometries(parts); parts.forEach(part => part.dispose()); g.computeBoundingBox(); g.computeBoundingSphere(); g.name = `Docks oak trunk and limbs ${variant}`; return g;
}
function leavesFor(cards, stride) {
  const p = [], n = [], uv = [], color = [], index = [], sizeScale = stride === 1 ? 1 : stride === 2 ? 1.23 : 1.50;
  for (let i = 0; i < cards.length; i += stride) {
    const card = cards[i], center = card.center, normal = card.normal, up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3().crossVectors(up, normal); if (tangent.lengthSq() < .01) tangent.set(1, 0, 0); else tangent.normalize();
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize(), rotation = new THREE.Quaternion().setFromAxisAngle(normal, card.roll);
    tangent.applyQuaternion(rotation).multiplyScalar(card.size * sizeScale * .5); bitangent.applyQuaternion(rotation).multiplyScalar(card.size * sizeScale * .61);
    for (let plane = 0; plane < 2; plane++) {
      const a = plane ? normal.clone().multiplyScalar(card.size * sizeScale * .45) : tangent, b = bitangent, start = p.length / 3;
      for (const [sx, sy, u, v] of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]) {
        const point = center.clone().addScaledVector(a, sx).addScaledVector(b, sy); p.push(point.x, point.y, point.z);
        n.push(normal.x, normal.y, normal.z); uv.push(u, v); color.push(...card.color);
      }
      index.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }
  const packed = new Uint8Array(color.length); let maxColorError = 0;
  for (let i = 0; i < color.length; i++) { packed[i] = Math.round(color[i] / DOCKS_OAK_COLOR_GAIN * 255); maxColorError = Math.max(maxColorError, Math.abs(packed[i] / 255 * DOCKS_OAK_COLOR_GAIN - color[i])); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(packed, 3, true)); g.setIndex(index);
  g.userData.vertexColorGain = DOCKS_OAK_COLOR_GAIN; g.userData.maxColorQuantizationError = maxColorError;
  g.computeBoundingBox(); const pad = new THREE.Vector3(...Object.values(DOCKS_OAK_WIND_PADDING)); g.boundingBox.min.sub(pad); g.boundingBox.max.add(pad); g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere()); return g;
}
/** Reusable export candidates: branches + three leaf LODs; UV/color retained. */
export function createDocksOakTemplate(variant = 0) {
  const rng = seeded(9731 + variant * 211), clusters = CLUSTERS.map((c, i) => c.map((n, j) => j < 3 ? n + (i ? (rng() - .5) * .35 : 0) : n)), cards = [];
  for (const [cx, cy, cz, rx, ry, rz] of clusters) for (let i = 0; i < 420; i++) {
    const a = i * 2.399963 + rng() * .3, vertical = 1 - 2 * (i + .5) / 420, radial = Math.sqrt(1 - vertical * vertical), shell = i % 5 ? .82 + rng() * .18 : .37 + rng() * .44;
    const direction = new THREE.Vector3(Math.cos(a) * radial, vertical, Math.sin(a) * radial), center = new THREE.Vector3(cx + direction.x * rx * shell, cy + direction.y * ry * shell, cz + direction.z * rz * shell);
    const normal = new THREE.Vector3(direction.x * .84, direction.y * 1.18 + .20, direction.z * .84).normalize();
    const brightness = .76 + shell * .17 + Math.max(0, direction.y) * .10 + rng() * .08;
    cards.push({ center, normal, size: .60 + rng() * .30, roll: rng() * Math.PI * 2, color: [brightness, brightness, brightness * .84] });
  }
  return { branches: branchesFor(clusters, variant), levels: [1, 2, 4].map(stride => leavesFor(cards, stride)), clusters, cardCount: cards.length * 2 };
}

export function createDocksOaks(world, { sites = DOCKS_OAK_SITES } = {}) {
  if (world.map.id !== 'sunhaven') return null;
  if (world.docksOaks) return world.docksOaks;
  const root = new THREE.Group(); root.name = 'Spreading docks oaks'; root.userData.staticBatching = false; world.scene.add(root); world.docksOaks = root;
  const resources = new ResourceScope('docks oak trees'), time = { value: 0 }, trees = [], leafMap = resources.retain(natureTexture('oak_color', true));
  const bark = resources.retain(new THREE.MeshStandardMaterial({ color: 0xc1b6a3, map: natureTexture('oak_color_1k', true), normalMap: natureTexture('oak_normal_1k'), normalScale: new THREE.Vector2(.6, .6), roughnessMap: natureTexture('oak_roughness_1k'), roughness: 1, vertexColors: true })); bark.name = 'Docks oak weathered bark';
  for (const map of [bark.map, bark.normalMap, bark.roughnessMap]) resources.retain(map);
  const leaves = resources.retain(oakWind(new THREE.MeshStandardMaterial({ map: leafMap, color: 0xe9f5ad, vertexColors: true, alphaTest: .29, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .88 }), time, true)); leaves.name = 'Docks oak sunlit leaves';
  leaves.color.multiplyScalar(DOCKS_OAK_COLOR_GAIN);
  const depth = resources.retain(oakWind(new THREE.MeshDepthMaterial({ map: leafMap, alphaTest: .29, side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking }), time));
  const distance = resources.retain(oakWind(new THREE.MeshDistanceMaterial({ map: leafMap, alphaTest: .29, side: THREE.DoubleSide }), time));
  for (const site of sites) {
    const template = createDocksOakTemplate(site.variant), base = world.heightAt(site.x, site.z), tree = new THREE.Group(); tree.name = site.id; tree.position.set(site.x, base, site.z); tree.scale.setScalar(site.scale); tree.rotation.y = site.yaw; root.add(tree);
    for (const geometry of [template.branches, ...template.levels]) resources.retain(geometry);
    const trunk = new THREE.Mesh(template.branches, bark); trunk.name = `${site.id} exact trunk collision`; trunk.castShadow = trunk.receiveShadow = true; trunk.userData.instancedVisual = true; tree.add(trunk); world.rockCollider(trunk, 'docks-oak');
    const levels = template.levels.map((geometry, level) => { const mesh = new THREE.Mesh(geometry, leaves); mesh.name = `${site.id} canopy LOD${level}`; mesh.visible = level === 0; mesh.castShadow = mesh.receiveShadow = true; mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance; tree.add(mesh); return mesh; });
    trees.push({ ...site, y: base, level: 0, tree, trunk, levels, template });
  }
  let profile = graphicsProfile('balanced'), nextUpdate = 0, disposed = false;
  root.setQuality = value => { profile = graphicsProfile(value); nextUpdate = 0; };
  root.update = (t, camera) => { if (disposed) return; time.value = t; if (!camera || t < nextUpdate) return; nextUpdate = t + .25; const p = camera.getWorldPosition ? camera.getWorldPosition(new THREE.Vector3()) : camera.position;
    for (const tree of trees) { tree.level = canopyLevel(Math.hypot(p.x - tree.x, p.z - tree.z), tree.level, Math.max(36, profile.leafDistance)); tree.levels.forEach((mesh, i) => { mesh.visible = i === tree.level; }); }
  };
  root.diagnostics = () => ({ trees: trees.length, clustersPerTree: CLUSTERS.length, levels: trees.map(tree => tree.level), leafCards: trees.reduce((sum, tree) => sum + tree.template.cardCount / 2 ** tree.level, 0), triangles: trees.reduce((sum, tree) => sum + (tree.trunk.geometry.index.count + tree.levels[tree.level].geometry.index.count) / 3, 0), disposed });
  root.userData.placements = trees.map(({ id, x, y, z, scale }) => ({ id, x, y, z, scale })); root.trees = trees;
  root.dispose = () => { if (disposed) return; disposed = true; resources.dispose(); root.clear(); root.removeFromParent(); };
  return root;
}
