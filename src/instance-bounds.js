import * as THREE from 'three';

// Shader displacement happens in geometry space, before the instance transform.
// Expand there so rotated/nonuniformly scaled instances remain conservative in
// every render pass. Camera visibility must never be cached from the main view.
export function setInstanceBounds(mesh,padding=new THREE.Vector3()){
  const geometry=mesh.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const local=geometry.boundingBox.clone();local.min.sub(padding);local.max.add(padding);
  const box=new THREE.Box3(),matrix=new THREE.Matrix4(),instanceBox=new THREE.Box3();
  for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);box.union(instanceBox.copy(local).applyMatrix4(matrix));
  }
  mesh.boundingBox=box;mesh.boundingSphere=new THREE.Sphere();
  if(box.isEmpty())mesh.boundingSphere.set(new THREE.Vector3(),0);
  else box.getBoundingSphere(mesh.boundingSphere);
  return box;
}
