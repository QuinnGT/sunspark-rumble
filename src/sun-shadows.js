import * as THREE from 'three';
const offset=new THREE.Vector3(-35,65,25),basis=new THREE.Matrix4().lookAt(offset,new THREE.Vector3(),new THREE.Vector3(0,1,0));
const right=new THREE.Vector3().setFromMatrixColumn(basis,0),up=new THREE.Vector3().setFromMatrixColumn(basis,1),back=new THREE.Vector3().setFromMatrixColumn(basis,2);
// Snap in the light's axes, not the world's X/Z axes: the sun looks diagonally
// down onto the island, so world-axis snapping still slides its texels.
export function focusSunShadow(sun,center,extent,size){
  const texel=extent*2/size,snap=v=>Math.round(center.dot(v)/texel)*texel;
  sun.target.position.copy(right).multiplyScalar(snap(right)).addScaledVector(up,snap(up)).addScaledVector(back,snap(back));
  sun.position.copy(sun.target.position).add(offset);
  Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});sun.shadow.camera.updateProjectionMatrix();
}
