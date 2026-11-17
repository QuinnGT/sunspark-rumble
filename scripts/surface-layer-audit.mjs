import * as THREE from 'three';

const EPSILON = 1e-5;

// Audit actual rendered triangles, after world transforms and batching. Invisible
// collision proxies are excluded; merged and instanced meshes are still inspected.
// AABB overlap alone is not a surface conflict: perpendicular trim, adjacent tiles,
// triangle seams and back faces must not produce a false positive.
export function auditSurfaceLayers(root, { skipRoots = new Set(), groundHeightAt } = {}) {
  root.updateWorldMatrix(true, true);
  const meshes = [], layers = [], matrix = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), barycentric = new THREE.Vector3();
  const ray = new THREE.Raycaster(), castNormal = new THREE.Vector3(), expected = new THREE.Vector3();
  const visit = object => {
    if (!object.visible || skipRoots.has(object)) return;
    for (const layer of object.userData.surfaceLayers ?? []) layers.push({ object, layer });
    if (object.isMesh && !object.isSkinnedMesh && object.geometry?.attributes.position) meshes.push(object);
    for (const child of object.children) visit(child);
  };
  visit(root);
  let samples = 0;
  const violations = [];
  for (const { object, layer } of layers) {
    castNormal.fromArray(layer.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(object.matrixWorld));
    let worst = null;
    for (const local of layer.points) {
      samples++;
      expected.fromArray(local).applyMatrix4(object.matrixWorld);
      ray.set(expected.clone().addScaledVector(castNormal, .06), castNormal.clone().negate());
      ray.near = 0; ray.far = .06 + Math.max(.12, layer.clearance * 2);
      const faces = [];
      for (const hit of ray.intersectObjects(meshes, false)) {
        const mesh = hit.object, geometry = mesh.geometry;
        const material = Array.isArray(mesh.material) ? mesh.material[hit.face.materialIndex] : mesh.material;
        if (!material?.visible || material.transparent || material.alphaTest > 0) continue;
        if (hit.instanceId !== undefined) { mesh.getMatrixAt(hit.instanceId, matrix); matrix.premultiply(mesh.matrixWorld); }
        else matrix.copy(mesh.matrixWorld);
        normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(matrix));
        if (normal.dot(castNormal) < .995) continue;
        a.fromBufferAttribute(geometry.attributes.position, hit.face.a);
        b.fromBufferAttribute(geometry.attributes.position, hit.face.b);
        c.fromBufferAttribute(geometry.attributes.position, hit.face.c);
        point.copy(hit.point).applyMatrix4(inverse.copy(matrix).invert());
        THREE.Triangle.getBarycoord(point, a, b, c, barycentric);
        if (Math.min(barycentric.x, barycentric.y, barycentric.z) <= EPSILON) continue;
        faces.push({ distance: hit.distance, mesh: mesh.name || mesh.type, material: material.name || material.type, face: hit.faceIndex, instance: hit.instanceId });
      }
      let problem;
      if (!faces.some(face => Math.abs(face.distance - .06) < EPSILON)) problem = { reason: 'finish missing at the declared surface', point: expected.toArray() };
      else for (let i = 1; i < faces.length; i++) {
        const gap = faces[i].distance - faces[i - 1].distance;
        if (gap < layer.clearance - EPSILON && (!problem || gap < problem.gap)) problem = { reason: 'overlapping surface layers', gap, required: layer.clearance, point: expected.toArray(), faces: [faces[i - 1], faces[i]] };
      }
      // Sloping terrain can pierce a floor without any parallel triangles.
      // Query the authoritative sampled terrain, shared by rendering/collision.
      if (groundHeightAt && castNormal.y > .999) {
        const gap=expected.y-groundHeightAt(expected.x,expected.z);
        if(gap<layer.clearance-EPSILON&&(!problem||gap<(problem.gap??-Infinity))) problem={reason:'terrain intersects finish clearance',gap,required:layer.clearance,point:expected.toArray()};
      }
      if (problem && (!worst || (problem.gap ?? -1) < (worst.gap ?? -1))) worst = problem;
    }
    if (worst) violations.push({ surface: layer.name, ...worst });
  }
  return { layers: layers.length, samples, violations };
}

export function auditWorldSurfaces(world) {
  return auditSurfaceLayers(world.scene, { groundHeightAt:(x,z)=>world.heightAt(x,z), skipRoots: new Set([world.ground, world.water, world.sky, world.foliage, world.groundCover, world.landscape, ...world.clouds, ...world.flags]) });
}
