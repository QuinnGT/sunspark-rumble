import * as THREE from 'three';
import { coastalBoxGeometry } from '../../src/coastal-geometry.js';
import { coastalMaterial } from '../../src/coastal-materials.js';
import { registerSurfaceLayer } from '../../src/surface-layers.js';

// Measured seams in the generated 1254px atlas. Inset UVs avoid baking its
// painted inter-board seam on top of our actual geometric board joints.
export const ATLAS_ROWS = [0, .132, .264, .400, .529, .660, .787, .893, 1];
export function makeWall(atlas, candidate = true) {
  const group = new THREE.Group(); group.name = candidate ? 'Atlas wall sample' : 'Current coastal material sample';
  const paint = candidate ? new THREE.MeshStandardMaterial({map:atlas, roughness:.89, vertexColors:true}) : coastalMaterial('paintedWood',0x4caaa2);
  const trim = coastalMaterial('trim',0xf0e3c4), backing = coastalMaterial('timber',0x827461);
  function box(w,h,d,x,y,z,material,grain='x') {
    const m = new THREE.Mesh(coastalBoxGeometry(w,h,d,{bevel:.008,shade:.06,grain}),material); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true;group.add(m);return m;
  }
  const points=[];
  for(let row=0;row<13;row++) {
    const y=.24+(row+.5)*.28, spans=y>1.36&&y<3.04?[[-2.5,-.1],[1.5,2.5]]:[[-2.5,2.5]];
    for(const [left,right] of spans) {
      const width=right-left-.012,cx=(left+right)/2;
      // Front finish z=.16; backing front z=.11 gives 50mm clearance.
      box(width,.268,.18,cx,y,.02,backing);
      const board=box(width,.268,.05,cx,y,.135,paint);
      if(candidate) {
        board.geometry=board.geometry.clone();const uv=board.geometry.attributes.uv,p=board.geometry.attributes.position;
        const band=(row*3+1)%8, v0=1-ATLAS_ROWS[band+1]+.009,v1=1-ATLAS_ROWS[band]-.009;
        for(let i=0;i<uv.count;i++)uv.setXY(i,.015+(p.getX(i)+cx+2.5)/5*.97,v0+(p.getY(i)/.268+.5)*(v1-v0));
      }
      for(const u of [-.31,.073,.29])points.push([cx+width*u,y+.027,.16]);
    }
  }
  registerSurfaceLayer(group,'Wall siding front',points,[0,0,1]);
  // Open window: no opaque wall plane behind glass or frame.
  const pane=new THREE.MeshStandardMaterial({color:0x2b515f,roughness:.3,metalness:.12});
  box(1.55,1.59,.05,.7,2.2,-.02,pane);
  for(const x of [-.2,1.6])box(.16,1.98,.28,x,2.2,.23,trim,'y');
  for(const y of [1.22,3.18])box(2.02,.17,.3,.7,y,.25,trim);
  box(.062,1.78,.07,.7,2.2,.35,trim,'y');box(1.76,.062,.07,.7,2.2,.35,trim);
  box(2.16,.14,.57,.7,1.16,.33,trim);
  for(const x of [-2.55,2.55])box(.18,3.77,.26,x,2.06,.21,trim,'y');
  box(5.45,.2,.46,0,3.99,.2,trim);box(5.2,.19,.27,0,.23,.18,trim);
  return group;
}
