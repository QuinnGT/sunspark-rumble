// Original tree authored for the Sunhaven concept: low fork, spreading scaffold,
// irregular foliage lobes, small oak sprays. No opaque canopy proxy is rendered.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded } from '../../src/config.js';
import { natureTexture } from '../../src/nature-assets.js';
import { patchShader } from '../../src/shader-patches.js';

export const OAK_LOBES = Object.freeze([
  [-.35,7.6,-.3,2.05,1.55,1.8],[-2.1,7.0,-1.6,1.7,1.3,1.7],[1.8,7.15,-1.4,1.85,1.4,1.7],
  [-3.6,5.7,.1,1.55,1.3,1.5],[3.3,6.0,.35,1.8,1.3,1.5],
  [-1.95,5.5,2.15,1.8,1.15,1.4],[1.6,6.15,2.35,1.65,1.15,1.5],
  [-.1,6.45,1.1,1.8,1.35,1.75],[-3.5,6.65,-1.7,1.25,1.1,1.25],[3.2,7.0,-1.65,1.35,1.0,1.3],
  [-.8,8.35,-.4,1.2,.8,1.1],[.7,7.95,1.3,1.25,.9,1.1],
  [-4.2,5.9,1.35,.85,.75,.95],[3.75,5.7,1.8,.85,.8,.8],[-2.8,6.1,2.85,.95,.8,.9],
]);
const SCAFFOLD=[
  {end:[-3.65,5.75,.1],points:[[0,1.85,0],[-.7,2.8,.1],[-2.05,3.55,.15],[-3.05,4.5,.05],[-3.65,5.75,.1]],r:[.45,.37,.25,.13,.024]},
  {end:[3.3,6,.35],points:[[.08,2.3,0],[.7,3.1,.08],[1.9,3.65,.2],[2.95,4.8,.4],[3.3,6,.35]],r:[.44,.36,.26,.15,.024]},
  {end:[-2.1,7,-1.6],points:[[-.12,2.7,0],[-.35,3.65,-.45],[-1.3,4.7,-1.05],[-1.9,5.8,-1.3],[-2.1,7,-1.6]],r:[.38,.3,.23,.13,.018]},
  {end:[1.8,7.15,-1.4],points:[[.1,3.0,0],[.35,3.8,-.45],[1.25,4.8,-1],[1.7,6,-1.2],[1.8,7.15,-1.4]],r:[.34,.28,.19,.105,.018]},
  {end:[-1.95,5.5,2.15],points:[[-.03,2.75,.15],[-.6,3.5,.55],[-1.3,3.9,1.4],[-1.75,4.55,1.85],[-1.95,5.5,2.15]],r:[.3,.26,.18,.10,.018]},
  {end:[1.6,6.15,2.35],points:[[.05,3,.2],[.3,3.7,.8],[1.1,4.15,1.7],[1.45,5.1,2],[1.6,6.15,2.35]],r:[.3,.23,.16,.09,.018]},
];
function tube(points,radii,sides=10){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),steps=Math.max(9,points.length*5),frames=curve.computeFrenetFrames(steps,false),length=curve.getLength();
  const pos=[],uv=[],colors=[],index=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,c=curve.getPointAt(t),segment=Math.min(radii.length-2,Math.floor(t*(radii.length-1))),local=t*(radii.length-1)-segment,radius=THREE.MathUtils.lerp(radii[segment],radii[segment+1],local);
    for(let j=0;j<=sides;j++){
      const a=j/sides*Math.PI*2,radial=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));
      const ridge=1+.055*Math.cos(a*3+t*2)+.025*Math.sin(a*7-t*3),p=c.clone().addScaledVector(radial,radius*ridge);
      pos.push(p.x,p.y,p.z);uv.push(j/sides*Math.max(.45,radii[0]*5),t*length*.44);
      const shade=.87+.09*Math.min(1,t*4)+.025*Math.cos(a*3);colors.push(shade,shade,shade);
      if(i<steps&&j<sides){const k=i*(sides+1)+j;index.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
  }
  for(const end of [0,steps]){const c=curve.getPointAt(end/steps),start=pos.length/3;pos.push(...c.toArray());uv.push(0,0);colors.push(.8,.8,.8);for(let j=0;j<sides;j++){const k=end*(sides+1)+j;index.push(start,...(end?[k,k+1]:[k+1,k]));}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();return g;
}
function branchGeometry(){
  const parts=[tube([[0,-.12,0],[.07,.6,.02],[-.12,1.5,.06],[.05,2.45,0],[-.16,3.35,-.05],[-.35,4.6,-.2],[-.4,6.9,-.3]],[.78,.61,.49,.44,.37,.21,.025],14)];
  for(let i=0;i<5;i++){const a=i*Math.PI*.4+.15,x=Math.cos(a),z=Math.sin(a);parts.push(tube([[x*.15,.72,z*.15],[x*.52,.3,z*.48],[x*1.1,-.03,z*.95]],[.32,.27,.025],9));}
  SCAFFOLD.forEach((limb,i)=>{
    parts.push(tube(limb.points,limb.r));const [x,y,z]=limb.end;
    for(const [side,rise] of [[-1,.8],[1,1.15]])parts.push(tube([limb.points[2],[x*.83+side*.33,y-1.1,z*.85],[x+side*.7,y-.05,z+side*.5],[x+side*.95,y+rise,z+side*.6]],[.12,.095,.06,.008],7));
  });
  const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());g.computeBoundingBox();g.computeBoundingSphere();g.name='Sunhaven oak spreading trunk and roots';return g;
}
function leafGeometry(){
  const rng=seeded(58291),pos=[],normal=[],uv=[],colors=[],index=[];
  const up=new THREE.Vector3(0,1,0),palette=[0xf8edbb,0xe5efab,0xe9f1c0,0xf0edac].map(c=>new THREE.Color(c));let sprays=0;
  OAK_LOBES.forEach(([cx,cy,cz,rx,ry,rz],lobe)=>{
    const count=Math.round(110*rx*ry),center=new THREE.Vector3(cx,cy,cz);
    for(let i=0;i<count;i++){
      const a=i*2.399963+rng()*.55,h=1-2*(i+.5)/count,r=Math.sqrt(1-h*h),direction=new THREE.Vector3(Math.cos(a)*r,h,Math.sin(a)*r);
      // Multiple shells and a perturbed outline make overlapping organic lobes,
      // while the gaps between sprays keep the branches and sky readable.
      const shell=i%4===0?.35+rng()*.35:.76+rng()*.3,ruffle=1+.10*Math.sin(a*3+lobe)+.08*Math.cos(h*13+a*5);
      const p=center.clone().add(new THREE.Vector3(direction.x*rx,direction.y*ry,direction.z*rz).multiplyScalar(shell*ruffle));
      const n=new THREE.Vector3(direction.x*.76,direction.y*1.05+.22,direction.z*.76).normalize();
      // Card orientations vary independently of the smooth lobe normals. Never
      // rotate cards toward the camera: all views see the same 3D foliage.
      const planeNormal=direction.clone().add(new THREE.Vector3((rng()-.5)*1.1,(rng()-.5)*1.1,(rng()-.5)*1.1)).normalize();
      let tangent=new THREE.Vector3().crossVectors(up,planeNormal).normalize();if(tangent.lengthSq()<.1)tangent.set(1,0,0);
      const bitangent=new THREE.Vector3().crossVectors(planeNormal,tangent).normalize(),rotation=new THREE.Quaternion().setFromAxisAngle(planeNormal,rng()*6.28),size=.65+rng()*.28;
      tangent.applyQuaternion(rotation).multiplyScalar(size*.5);bitangent.applyQuaternion(rotation).multiplyScalar(size*.5);
      const band=(i+lobe)%4,u0=(band%2)*.5+.006,v0=band<2?.506:.006,shade=.78+.16*shell+.07*Math.max(0,direction.y),tint=palette[lobe%4],start=pos.length/3;
      for(const [sx,sy,u,v]of [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){const point=p.clone().addScaledVector(tangent,sx).addScaledVector(bitangent,sy);pos.push(...point.toArray());normal.push(...n.toArray());uv.push(u0+u*.488,v0+v*.488);colors.push(tint.r*shade,tint.g*shade,tint.b*shade);}
      index.push(start,start+1,start+2,start,start+2,start+3);sprays++;
    }
  });
  const g=new THREE.BufferGeometry();for(const [name,data,size]of [['position',pos,3],['normal',normal,3],['uv',uv,2],['color',colors,3]])g.setAttribute(name,new THREE.Float32BufferAttribute(data,size));g.setIndex(index);g.computeBoundingBox();g.boundingBox.expandByVector(new THREE.Vector3(.09,0,.06));g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());g.name='Sunhaven oak small leaf sprays';g.userData.sprays=sprays;return g;
}
const WIND=`float crown=smoothstep(3.,6.,position.y); transformed.x+=sin(oakTime*.8+position.y*.6+position.z*.5)*.07*crown; transformed.z+=sin(oakTime*1.1+position.x*.65)*.045*crown;`;
function canopyShader(material,time,lit=false){
  material.onBeforeCompile=s=>{
    s.uniforms.oakTime=time;s.vertexShader='uniform float oakTime;\n'+patchShader(s.vertexShader,'#include <begin_vertex>','#include <begin_vertex>\n'+WIND,'concept oak wind');
    if(lit){const normals=patchShader(THREE.ShaderChunk.normal_fragment_begin,'normal *= faceDirection;','','concept oak cluster normals');s.fragmentShader=patchShader(s.fragmentShader,'#include <normal_fragment_begin>',normals,'concept oak normal chunk');s.fragmentShader=patchShader(s.fragmentShader,'#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*.09;','concept oak leaf transmission');}
  };material.customProgramCacheKey=()=>`concept-oak-v2-${lit}`;return material;
}
export function createConceptOak(leafMap){
  const root=new THREE.Group(),time={value:0};root.name='Sunhaven concept oak v2';
  const bark=new THREE.MeshStandardMaterial({map:natureTexture('oak_color_1k',true),normalMap:natureTexture('oak_normal_1k'),normalScale:new THREE.Vector2(.38,.38),color:0xe8d7b5,roughness:.93,vertexColors:true});bark.name='Warm weathered oak bark';
  const branches=new THREE.Mesh(branchGeometry(),bark);branches.name='Low fork and spreading limbs';branches.castShadow=branches.receiveShadow=true;root.add(branches);
  // Three r180 uses 0.5 for alpha-to-coverage shadow passes. Use that cutoff in
  // the visible, depth and distance passes so moving leaves retain their shape.
  const material=canopyShader(new THREE.MeshStandardMaterial({name:'Painted oak leaf sprays v2',map:leafMap,color:0xffffff,roughness:.92,vertexColors:true,side:THREE.DoubleSide,alphaTest:.5,alphaToCoverage:true}),time,true);
  const leaves=new THREE.Mesh(leafGeometry(),material);leaves.name='Irregular clustered oak foliage';leaves.castShadow=leaves.receiveShadow=true;
  leaves.customDepthMaterial=canopyShader(new THREE.MeshDepthMaterial({map:leafMap,alphaTest:material.alphaTest,side:material.side,depthPacking:THREE.RGBADepthPacking}),time);
  leaves.customDistanceMaterial=canopyShader(new THREE.MeshDistanceMaterial({map:leafMap,alphaTest:material.alphaTest,side:material.side}),time);root.add(leaves);
  root.userData.artProof={revision:2,lobes:OAK_LOBES.length,sprays:leaves.geometry.userData.sprays,source:'Original Sunhaven tree geometry; generated RGBA oak-spray atlas'};
  root.update=t=>{time.value=t;};root.userData.windTime=time;return root;
}
