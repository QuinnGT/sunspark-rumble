import * as THREE from 'three';
import {World} from '../src/world.js';
import {Movement} from '../src/movement.js';
import {RULES} from '../src/config.js';
import {writeFile} from 'node:fs/promises';
const w=new World(new THREE.Scene(),'sunhaven'),cases=[];
for(const {mesh,obstacle}of w.approvedRocks.rocks){
  const b=obstacle.box;
  for(let x=b.min.x-.3;x<=b.max.x+.3;x+=.65)for(let z=b.min.z-.3;z<=b.max.z+.3;z+=.65){
    const a={pos:new THREE.Vector3(x,b.max.y+3,z),radius:RULES.playerRadius,vy:0,grounded:false},m=new Movement(a,w);
    if(!w.canStand(x,a.pos.y,z))continue;
    for(let t=0;t<180;t++)m.update(1/120,{x:0,z:0,jumpHeld:false});
    if(a.pos.y>=-.5&&w.nearObstacles(a.pos.x,a.pos.z,a.radius).some(o=>o.shape&&(o.shape.blocks(a.pos.x,a.pos.z,a.radius,a.pos.y,a.height,0)||o.shape.blocks(a.pos.x,a.pos.z,a.radius,a.pos.y,a.height)))){
      const trapped=a.pos.clone();let escaped=false;
      for(let i=0;i<8;i++){a.pos.copy(trapped);a.vy=0;a.grounded=true;m.reset();m.jump();for(let t=0;t<90;t++)m.update(1/60,{x:Math.cos(i*Math.PI/4),z:Math.sin(i*Math.PI/4),jumpHeld:true});if(a.pos.distanceTo(trapped)>1&&w.canStand(a.pos.x,a.pos.y,a.pos.z)){escaped=true;break;}}
      cases.push({rock:mesh.name,drop:[x,b.max.y+3,z],trapped:trapped.toArray(),escaped});
    }
  }
}
await writeFile('tests/artifacts/rock-trapping/drop-probe.json',JSON.stringify(cases,null,2));console.log(JSON.stringify({collisions:cases.length,stuck:cases.filter(c=>!c.escaped).length,examples:cases.filter(c=>!c.escaped).slice(0,5)}));
