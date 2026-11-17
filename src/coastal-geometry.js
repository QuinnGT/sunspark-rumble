// Reusable, metre-scaled coastal meshes. Geometry is cached and explicitly owned;
// materials and instances borrow it until the final scene and cache owners release.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ResourceScope } from './resource-scope.js';

const cache=new Map();let owner=new ResourceScope('coastal geometry cache');
function cached(key,create){
  if(!cache.has(key)){
    const geometry=create();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    geometry.userData.coastalGeometry=true;owner.retain(geometry);cache.set(key,geometry);
  }
  return cache.get(key);
}
const rounded=n=>Math.round(n*10000)/10000;
function vertexTint(g,shade){
  const p=g.attributes.position,n=g.attributes.normal,b=new THREE.Box3().setFromBufferAttribute(p),a=[];
  const half=new THREE.Vector3().subVectors(b.max,b.min).multiplyScalar(.5),center=new THREE.Vector3().addVectors(b.min,b.max).multiplyScalar(.5);
  for(let i=0;i<p.count;i++){
    const edge=[Math.abs((p.getX(i)-center.x)/(half.x||1)),Math.abs((p.getY(i)-center.y)/(half.y||1)),Math.abs((p.getZ(i)-center.z)/(half.z||1))].sort((a,b)=>b-a)[1];
    const face=.93+.07*Math.max(0,n.getY(i)),value=Math.max(.55,face-shade*Math.pow(edge,8));a.push(value,value,value);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(a,3));return g;
}

// Grain follows U on each broad face. Local dimensions are already metres; scaling
// meshes afterwards would change texel density, so callers author actual dimensions.
export function coastalBoxGeometry(width,height,depth,{grain='x',bevel=.025,shade=.1,uvOffset=[0,0]}={}){
  if(![width,height,depth].every(n=>Number.isFinite(n)&&n>0))throw new RangeError('Coastal box dimensions must be positive metres.');
  if(!['x','y','z'].includes(grain))throw new RangeError('Coastal grain axis must be x, y or z.');
  if(uvOffset.length!==2||!uvOffset.every(Number.isFinite))throw new RangeError('Coastal UV offset requires two finite metre values.');
  const r=Math.min(bevel,width*.2,height*.2,depth*.2),key=`box:${[width,height,depth,r,shade,...uvOffset].map(rounded)}:${grain}`;
  return cached(key,()=>{
    let g=r>0?new RoundedBoxGeometry(width,height,depth,1,r):new THREE.BoxGeometry(width,height,depth);
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      const coord={x:p.getX(i),y:p.getY(i),z:p.getZ(i)},normal={x:Math.abs(n.getX(i)),y:Math.abs(n.getY(i)),z:Math.abs(n.getZ(i))};
      const face=Object.keys(normal).sort((a,b)=>normal[b]-normal[a])[0],axes=['x','y','z'].filter(a=>a!==face);
      const u=axes.includes(grain)?grain:axes[0],v=axes.find(a=>a!==u);uv.setXY(i,coord[u]+uvOffset[0],coord[v]+uvOffset[1]);
    }
    vertexTint(g,shade);g.clearGroups();if(!g.index){const indexed=mergeVertices(g);g.dispose();g=indexed;}
    g.userData.grain=grain;g.userData.uvUnits='metres';return g;
  });
}

export function coastalCylinderGeometry(top,bottom,height,segments=10){
  return cached(`cylinder:${[top,bottom,height,segments].map(rounded)}`,()=>{
    const g=new THREE.CylinderGeometry(top,bottom,height,segments),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      if(Math.abs(n.getY(i))>.8)uv.setXY(i,p.getX(i),p.getZ(i));
      else uv.setXY(i,p.getY(i),uv.getX(i)*Math.PI*(top+bottom));
    }
    g.clearGroups();return vertexTint(g,.045);
  });
}

export function coastalTubeGeometry(points,radius=.035,segments=24,closed=false){
  const key=`tube:${radius}:${segments}:${closed}:${points.flat().map(rounded)}`;
  return cached(key,()=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    const g=new THREE.TubeGeometry(curve,segments,radius,6,closed),uv=g.attributes.uv,length=curve.getLength();
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*length,uv.getY(i)*Math.PI*radius*2);
    return vertexTint(g,.03);
  });
}

export function coastalRingGeometry(radius,tube=.035,segments=20){
  return cached(`ring:${radius}:${tube}:${segments}`,()=>{
    const g=new THREE.TorusGeometry(radius,tube,5,segments),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*radius*Math.PI*2,uv.getY(i)*tube*Math.PI*2);
    return vertexTint(g,.025);
  });
}

export function boatOutline(width=2.05,length=4.8){
  const outline=[];
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2,t=Math.cos(a),s=Math.sin(a),breadth=Math.sign(s)*Math.pow(Math.abs(s),.72);
    outline.push([breadth*width*.5*(1-.12*t),.64+.13*Math.pow(Math.abs(t),4),t*length*.5]);
  }
  return outline;
}

export function boatHullGeometry(width=2.05,length=4.8,part='outer'){
  return cached(`hull:${width}:${length}:${part}`,()=>{
    const outline=boatOutline(width,length),position=[],uv=[],color=[],indices=[];
    const ring=(sx,sz,y)=>outline.map(([x,top,z])=>[x*sx,y===null?top:y,z*sz]);
    const rings=part==='outer'?[ring(.26,.72,0),ring(.77,.91,.16),ring(1,1,null)]:[ring(.26,.72,.13),ring(.66,.87,.23),ring(.87,.97,null)];
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<outline.length;i++){
      const j=(i+1)%outline.length,verts=[rings[r][i],rings[r][j],rings[r+1][j],rings[r+1][i]],base=position.length/3;
      for(let k=0;k<4;k++){const [x,y,z]=verts[k];position.push(x,y,z);uv.push(z,y);const shade=r===0&&k<2?.65:.96;color.push(shade,shade,shade);}
      if(part==='outer')indices.push(base,base+1,base+2,base,base+2,base+3);else indices.push(base,base+2,base+1,base,base+3,base+2);
    }
    const base=position.length/3;for(const [x,y,z]of rings[0]){position.push(x,y,z);uv.push(z,x);color.push(.72,.72,.72);}
    for(let i=1;i<outline.length-1;i++)if(part==='outer')indices.push(base,base+i+1,base+i);else indices.push(base,base+i,base+i+1);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setIndex(indices);g.computeVertexNormals();return g;
  });
}

// Closed triangular facade canopy. Its exact triangles can also serve as the
// collision surface, avoiding a box that invents a flat walkable pitched roof.
export function coastalPedimentGeometry(width,depth,rise){
  return cached(`pediment:${width}:${depth}:${rise}`,()=>{
    const w=width/2,d=depth/2,points=[[-w,0,-d],[w,0,-d],[0,rise,-d],[-w,0,d],[w,0,d],[0,rise,d]];
    const faces=[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]],p=[],uv=[],indices=[];
    for(let f=0;f<faces.length;f++){
      const face=faces[f],start=p.length/3;
      for(const i of face){
        const [x,y,z]=points[i];p.push(x,y,z);
        if(f<2)uv.push(x,y);else if(f===2)uv.push(x,z);
        else uv.push(z,Math.hypot(x-(f===3?w:-w),y));
      }
      for(let i=1;i<face.length-1;i++)indices.push(start,start+i,start+i+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return vertexTint(g,.04);
  });
}

export function coastalGeometryDiagnostics(){let vertices=0,triangles=0;for(const g of cache.values()){vertices+=g.attributes.position.count;triangles+=(g.index?.count??g.attributes.position.count)/3;}return {geometries:cache.size,vertices,triangles};}
export function disposeCoastalGeometry(){owner.dispose();cache.clear();owner=new ResourceScope('coastal geometry cache');}
