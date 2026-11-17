// Modular build placement. Floors and ramps occupy cells; walls occupy cell edges.
import * as THREE from 'three';
import { RULES } from './config.js';

export const BUILD = Object.freeze({ size:4, height:3, thickness:.18, reach:8, ceiling:24 });
export const PIECES = ['wall','ramp','floor'];
const near=(a,b)=>Math.abs(a-b)<.05;
const sameCell=(a,b)=>near(a.x,b.x)&&near(a.z,b.z);
const cardinal=(a,b)=>near(Math.abs(a.x-b.x)+Math.abs(a.z-b.z),BUILD.size)&&(near(a.x,b.x)||near(a.z,b.z));
const facing=yaw=>({x:Math.round(-Math.sin(yaw)),z:Math.round(-Math.cos(yaw))});
const sameDirection=(a,b)=>{const af=facing(a),bf=facing(b);return af.x===bf.x&&af.z===bf.z;};
const along=(p,f,n)=>({x:p.x+f.x*n,z:p.z+f.z*n});
const onEdge=(wall,cell)=>{
  const f=facing(wall.yaw);
  return f.x?near(Math.abs(wall.x-cell.x),2)&&near(wall.z,cell.z):near(wall.x,cell.x)&&near(Math.abs(wall.z-cell.z),2);
};

export function buildBounds(p,inset=0){
  const f=facing(p.yaw),wall=p.kind==='wall';
  const w=wall?(f.x?.32:4):4,d=wall?(f.z?.32:4):4;
  // Trim mating edges for validation only. Rendered pieces and physics stay full size.
  const ix=w>1?inset:0,iz=d>1?inset:0;
  return new THREE.Box3(new THREE.Vector3(p.x-w/2+ix,p.kind==='floor'?p.y-BUILD.thickness:p.y+.03,p.z-d/2+iz),
    new THREE.Vector3(p.x+w/2-ix,p.kind==='floor'?p.y:p.y+BUILD.height-.03,p.z+d/2-iz));
}

function attachmentLevels(p,b){
  const ys=[],f=facing(p.yaw),bf=facing(b.yaw);
  if(p.kind==='wall'){
    if(b.kind==='wall'){
      if(sameCell(p,b)&&Math.abs(f.x)===Math.abs(bf.x))ys.push(b.y,b.y+3);
      // Perpendicular corner or the next wall along the same edge.
      else if(Math.abs(f.x)!==Math.abs(bf.x)?near(Math.abs(p.x-b.x),2)&&near(Math.abs(p.z-b.z),2):f.x?near(p.x,b.x)&&near(Math.abs(p.z-b.z),4):near(p.z,b.z)&&near(Math.abs(p.x-b.x),4))ys.push(b.y);
    }else if(onEdge(p,b))ys.push(b.y,...(b.kind==='ramp'&&sameCell(p,along(b,bf,2))?[b.y+3]:[]));
  }else if(b.kind==='wall'){
    if(onEdge(b,p))ys.push(b.y,b.y+3);
  }else if(b.kind==='floor'){
    if(sameCell(p,b)||cardinal(p,b))ys.push(b.y);
  }else{
    if(sameCell(p,b))ys.push(b.y);
    if(sameCell(p,along(b,bf,4))&&(p.kind==='floor'||f.x===bf.x&&f.z===bf.z))ys.push(b.y+3);
    if(sameCell(p,along(b,bf,-4)))ys.push(b.y);
  }
  return ys;
}

export function computeBuildPlacement(world,{kind,position,yaw,pitch=0,rotation=0,wood,actors=[]}){
  const angle=Math.round(yaw/(Math.PI/2))*(Math.PI/2),p={kind,yaw:-angle+rotation*Math.PI/2};
  const tx=position.x+Math.sin(yaw)*4,tz=position.z-Math.cos(yaw)*4,f=facing(p.yaw);
  p.x=Math.round(tx/4)*4;p.z=Math.round(tz/4)*4;
  if(kind==='wall'){
    if(f.x)p.x=Math.round((tx-2)/4)*4+2;
    else p.z=Math.round((tz-2)/4)*4+2;
  }
  const desired=position.y+Math.max(0,Math.tan(pitch))*5;
  const levelsAt=cell=>world.structures.flatMap(b=>attachmentLevels(cell,b.piece)).sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
  let levels=levelsAt(p);
  // At an elevated edge, keep a wall on the nearby platform instead of projecting
  // past it into empty air. The same reach rule also helps join a corner.
  if((!levels.length||Math.abs(levels[0]-desired)>3.2)&&position.y>world.heightAt(p.x,p.z)+1.6){
    let closest=null,best=Infinity;
    for(const dx of [-4,0,4])for(const dz of [-4,0,4]){
      const candidate={...p,x:p.x+dx,z:p.z+dz},ys=levelsAt(candidate);
      const forwardDistance=(candidate.x-position.x)*Math.sin(yaw)-(candidate.z-position.z)*Math.cos(yaw);
      if(!ys.length||Math.abs(ys[0]-desired)>3.2||forwardDistance<.65)continue;
      const score=(candidate.x-tx)**2+(candidate.z-tz)**2+(ys[0]-desired)**2;
      if(score<best&&score<20){best=score;closest={candidate,ys};}
    }
    if(closest){p.x=closest.candidate.x;p.z=closest.candidate.z;levels=closest.ys;}
  }
  const low=kind==='ramp'?along(p,f,-2):p;
  const sample=(x,z)=>world.floorAt(x,z,position.y);
  const base=kind==='ramp'?Math.min(sample(low.x,low.z),sample(low.x+f.z*1.8,low.z-f.x*1.8),sample(low.x-f.z*1.8,low.z+f.x*1.8)):sample(p.x,p.z);
  p.snapped=levels.length>0&&Math.abs(levels[0]-desired)<3.2;
  p.y=p.snapped?levels[0]:base+(kind==='floor'?.06:0);
  p.bounds=buildBounds(p);
  const bounds=buildBounds(p,.2);bounds.min.y+=.025;bounds.max.y-=.025;
  let reason='';
  if(Math.hypot(p.x,p.z)>world.map.buildRadius)reason='Move farther onto the island.';
  else if(p.y-world.heightAt(p.x,p.z)>BUILD.ceiling)reason='Height limit reached — extend sideways.';
  else if(Math.hypot(p.x-position.x,p.z-position.z,p.y-position.y)>BUILD.reach)reason='Move closer to this spot.';
  else if(!p.snapped&&p.y<position.y-1.6)reason='No support — aim beside an existing build.';
  else if(p.y>position.y+RULES.stepHeight&&!p.snapped)reason='Aim at a lower, reachable spot.';
  else if(world.structures.some(({piece:b})=>b.kind===kind&&sameCell(p,b)&&near(p.y,b.y)&&(kind==='floor'||(kind==='wall'?Math.abs(f.x)===Math.abs(facing(b.yaw).x):sameDirection(p.yaw,b.yaw)))))reason='Already built here — move or aim at the next space.';
  else if(world.obstacles.some(o=>bounds.intersectsBox(o.piece?buildBounds(o.piece,.2):o.box)))reason='Something is in the way. Try another space.';
  else if(world.ramps.some(r=>{
    const rb=r.piece?buildBounds(r.piece,.2):new THREE.Box3().setFromObject(r.mesh);
    return bounds.intersectsBox(rb);
  }))reason='A ramp already fills this space.';
  else if(kind!=='wall'&&[-1.75,0,1.75].some(dx=>[-1.75,0,1.75].some(dz=>{
    const localZ=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),surface=p.y+(kind==='ramp'?(.5-localZ/4)*3:0);
    return world.heightAt(p.x+dx,p.z+dz)>surface+.45;
  })))reason='This hill is too steep here. Try a flatter spot.';
  else if(actors.some(a=>{
    if(!a.alive)return false;
    const r=RULES.playerRadius;
    if(a.pos.x+r<=bounds.min.x||a.pos.x-r>=bounds.max.x||a.pos.z+r<=bounds.min.z||a.pos.z-r>=bounds.max.z)return false;
    if(kind==='floor'&&p.y<=a.pos.y+RULES.stepHeight)return false;
    if(kind==='ramp'){
      const q=world.rampLocal(p,a.pos.x,a.pos.z),surface=p.y+Math.max(0,Math.min(1,.5-q.z/4))*3;
      if(surface<=a.pos.y+RULES.stepHeight)return false;
    }
    return a.pos.y+(a.height??RULES.playerHeight)>bounds.min.y&&a.pos.y<bounds.max.y;
  }))reason='Leave a little room around players.';
  else if(wood<RULES.buildCost)reason='Need 10 wood — find a wood pickup.';
  return {...p,valid:!reason,reason};
}
