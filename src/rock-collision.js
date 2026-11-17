import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { RULES } from './config.js';
import { capsuleTriangleContact } from './capsule-contact.js';

// Static world-space triangles match the rendered rock, including rotation,
// nonuniform scale and irregular sides. The box is only a quick rejection test.
export class RockCollision {
  constructor(mesh){
    mesh.updateWorldMatrix(true,false);
    this.bounds=new THREE.Box3().setFromObject(mesh,true);
    this.tree=new Octree().fromGraphNode(mesh);
    this.ray=new THREE.Ray();this.capsule=new Capsule();this.triangles=[];this.contact={normal:new THREE.Vector3(),depth:0};
  }
  surfaceAt(x,z,underside=false){
    const b=this.bounds;if(x<b.min.x||x>b.max.x||z<b.min.z||z>b.max.z)return underside?Infinity:-Infinity;
    this.ray.origin.set(x,underside?b.min.y-1:b.max.y+1,z);this.ray.direction.set(0,underside?1:-1,0);
    const hit=this.tree.rayIntersect(this.ray);return hit?hit.position.y:underside?Infinity:-Infinity;
  }
  blocks(x,z,radius,feet,height=RULES.playerHeight,stepHeight=RULES.stepHeight){
    const b=this.bounds,bottom=feet+stepHeight,top=feet+height;
    if(top<=b.min.y||bottom>=b.max.y||x+radius<b.min.x||x-radius>b.max.x||z+radius<b.min.z||z-radius>b.max.z)return false;
    // A center inside the closed solid must remain blocked even if the capsule
    // is deep enough that no surface triangle intersects its shell.
    const upper=this.surfaceAt(x,z);
    if(upper>bottom+.001&&this.surfaceAt(x,z,true)<top)return true;
    const capsule=this.capsule;capsule.radius=Math.min(radius,(top-bottom)/2);
    capsule.start.set(x,bottom+capsule.radius,z);capsule.end.set(x,top-capsule.radius,z);
    this.triangles.length=0;this.tree.getCapsuleTriangles(capsule,this.triangles);
    for(const triangle of this.triangles)if(capsuleTriangleContact(capsule,triangle,this.contact))return true;
    return false;
  }
  // Vertical motion needs the whole body, including the lower step band that
  // horizontal movement may climb. Return the actual triangle contact normal.
  penetration(x,z,radius,feet,height=RULES.playerHeight){
    const capsule=this.capsule;capsule.radius=Math.min(radius,height/2);
    capsule.start.set(x,feet+capsule.radius,z);capsule.end.set(x,feet+height-capsule.radius,z);
    this.triangles.length=0;this.tree.getCapsuleTriangles(capsule,this.triangles);
    let deepest=null;
    for(const triangle of this.triangles){const hit=capsuleTriangleContact(capsule,triangle,this.contact);if(hit&&(!deepest||hit.depth>deepest.depth))deepest={normal:hit.normal.clone(),depth:hit.depth};}
    return deepest;
  }
}
