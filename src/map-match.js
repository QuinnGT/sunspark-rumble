import { seeded } from './config.js';

export function spawnLayout(world,seed,blockedSight){
  const rng=seeded(seed*931+41),valid=world.map.spawns.map(([x,z])=>({x,z,y:world.floorAt(x,z,world.heightAt(x,z)+.6)})).filter(p=>world.canStand(p.x,p.y,p.z,.75));
  const outer=valid.slice(0,4),player=outer[(seed-1)%outer.length]||valid[0];
  if(!player)throw new Error('Map needs a clear player start.');
  const shuffled=valid.filter(p=>p!==player).map(p=>({p,order:rng()})).sort((a,b)=>a.order-b.order).map(v=>v.p);
  const bots=[];
  const accept=p=>Math.hypot(p.x-player.x,p.z-player.z)>=35&&blockedSight(player,p)&&bots.every(b=>Math.hypot(p.x-b.x,p.z-b.z)>14);
  for(const p of shuffled)if(accept(p))bots.push(p);
  // Deterministic clear-ground reserves prevent a scenery edit creating bad spawns.
  for(let i=0;i<300&&bots.length<world.map.botCount;i++){
    const a=rng()*Math.PI*2,r=35+rng()*70,x=Math.cos(a)*r,z=Math.sin(a)*r,y=world.heightAt(x,z),p={x,y,z};
    if(world.canStand(x,y,z,.8)&&accept(p))bots.push(p);
  }
  return {player,bots:bots.slice(0,world.map.botCount)};
}

export function supplySites(world,seed,player){
  const rng=seeded(seed*117+77),sites=[],types=['ammo','shield','wood','health'];
  const clear=(x,z)=>world.canStand(x,world.heightAt(x,z),z,.45)&&world.heightAt(x,z)>.3;
  for(const [index,d] of world.map.districts.entries()){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+.3;let chosen;
      for(let r=9;r<=22;r+=2){const x=d.x+Math.cos(a)*r,z=d.z+Math.sin(a)*r;if(clear(x,z)){chosen={x,z};break;}}
      if(chosen)sites.push({...chosen,type:types[(i+index)%types.length]});
    }
    for(let i=0;i<2;i++)for(let attempt=0;attempt<40;attempt++){
      const x=d.x+(rng()-.5)*30,z=d.z+(rng()-.5)*30;
      if(clear(x,z)){sites.push({x,z,type:'weapon',weapon:(index+i+seed)%4});break;}
    }
  }
  for(let i=0;i<3;i++)for(let j=0;j<20;j++){
    const a=j*.7+i*2,r=3+i*1.8,x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
    if(clear(x,z)){sites.push({x,z,type:['ammo','shield','wood'][i]});break;}
  }
  return sites;
}
