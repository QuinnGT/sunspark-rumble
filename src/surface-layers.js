// Metres. Structural finishes need real depth separation from their backing.
// This is a construction minimum for our scale/cameras, not a GPU precision guarantee.
import * as THREE from 'three';

export const SURFACE_CLEARANCE = .02;

export function registerSurfaceLayer(parent, name, points, normal = [0, 1, 0]) {
  const layer = { name, points, normal, clearance: SURFACE_CLEARANCE };
  (parent.userData.surfaceLayers ??= []).push(layer);
  return layer;
}

// Register the exposed flat faces of a beam before batching removes its mesh.
// Include the narrow reveals and samples near both ends, where posts meet headers.
// Buried end-grain joints are intentionally not declared as exposed finishes.
export function registerJoineryFaces(parent, mesh, name, faces) {
  mesh.updateWorldMatrix(true, false);parent.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox,matrix=new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(mesh.matrixWorld);
  const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),point=new THREE.Vector3();
  for(const face of faces){
    const axis=face[1],sign=face[0]==='+'?1:-1,tangents=['x','y','z'].filter(a=>a!==axis),points=[];
    const values=tangents.map(a=>{
      const lo=bounds.min[a],hi=bounds.max[a],margin=Math.min(.04,(hi-lo)*.22),steps=Math.max(2,Math.ceil((hi-lo)/.4));
      return Array.from({length:steps+1},(_,i)=>lo+margin+(hi-lo-margin*2)*i/steps);
    });
    for(const u of values[0])for(const v of values[1]){
      point.set(0,0,0);point[axis]=sign>0?bounds.max[axis]:bounds.min[axis];point[tangents[0]]=u;point[tangents[1]]=v;
      // Avoid aligned triangulation diagonals without moving onto a bevel.
      point[tangents[1]]+=.00037;
      points.push(point.clone().applyMatrix4(matrix).toArray());
    }
    const normal=new THREE.Vector3();normal[axis]=sign;normal.applyNormalMatrix(normalMatrix);
    const layer=registerSurfaceLayer(parent,`${name} ${face}`,points,normal.toArray());
    layer.kind='joinery';(parent.userData.joinerySurfaces??=[]).push(layer.name);
  }
}
