import * as THREE from 'three';
import { patchShader } from '../../src/shader-patches.js';

// A proof-only adaptation of the licensed source, retained alongside the five
// untouched silhouettes. No source texture pixels or source files are changed.
export function broadleafAdaptation(source) {
  const root=source.clone(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry=mesh.geometry.clone();mesh.material=mesh.material.clone();
    const g=mesh.geometry,p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const y=p.getY(i),spread=1.08+.45*THREE.MathUtils.smoothstep(y,1.2,3.4);
      p.setXYZ(i,p.getX(i)*spread,y>3.4?3.4+(y-3.4)*.67:y,p.getZ(i)*spread);
    }
    g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    if(!mesh.material.name.includes('Leaves'))return;
    const points=[];for(let i=0;i<p.count;i+=8)points.push(new THREE.Vector3().fromBufferAttribute(p,i));
    // Smooth lighting across foliage clusters instead of lighting every card as
    // a flat sheet. Deterministic farthest-point seeds, followed by k-means.
    const centers=[points[0].clone()];
    while(centers.length<6){let far=points[0],distance=-1;for(const point of points){const d=Math.min(...centers.map(c=>c.distanceToSquared(point)));if(d>distance){distance=d;far=point;}}centers.push(far.clone());}
    for(let step=0;step<9;step++){
      const sums=centers.map(()=>new THREE.Vector3()),counts=centers.map(()=>0);
      for(const point of points){const ds=centers.map(c=>c.distanceToSquared(point)),i=ds.indexOf(Math.min(...ds));sums[i].add(point);counts[i]++;}
      centers.forEach((c,i)=>{if(counts[i])c.copy(sums[i]).divideScalar(counts[i]);});
    }
    const n=g.attributes.normal,point=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);const ds=centers.map(c=>c.distanceToSquared(point)),c=centers[ds.indexOf(Math.min(...ds))];normal.subVectors(point,c);normal.y+=.55;normal.normalize();n.setXYZ(i,normal.x,normal.y,normal.z);}
    mesh.material.color.setHex(0xe9f5ad);mesh.material.roughness=.88;
    mesh.material.onBeforeCompile=shader=>{
      const normals=patchShader(THREE.ShaderChunk.normal_fragment_begin,'normal *= faceDirection;','','proof foliage normals');
      shader.fragmentShader=patchShader(shader.fragmentShader,'#include <normal_fragment_begin>',normals,'proof foliage normal chunk');
      shader.fragmentShader=patchShader(shader.fragmentShader,'#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*.055;','proof foliage light transmission');
    };
    mesh.material.customProgramCacheKey=()=> 'proof-broadleaf-cluster-v1';
  });
  return root;
}
