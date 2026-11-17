// Presentation fixture, excluded from the release.
import '../src/game.js';
import { buildBounds } from '../src/building.js';
import { DIFFICULTIES } from '../src/config.js';
import { createActor } from '../src/actor.js';
import { ROCK_GAPS } from './rock-cases.js';
async function runScenario(){
await window.sunspark.ready;
const game=window.__test;
const scenario=new URLSearchParams(location.search).get('scenario');
if(scenario==='rock-gap'){
  game.start('practice');const params=new URLSearchParams(location.search),gap=ROCK_GAPS[Number(params.get('gap')||0)],reverse=params.has('reverse');
  const from=reverse?gap.to:gap.from,to=reverse?gap.from:gap.to;
  game.player.pos.fromArray(from);game.player.vy=0;game.setView(Math.atan2(to[0]-from[0],-(to[2]-from[2])),-.32);
}
if(scenario==='rock-approach'){
  game.start('practice');const rock=game.world.obstacles.find(o=>o.kind==='rock'),b=rock.box;
  game.player.pos.set(b.max.x+2,game.world.floorAt(b.max.x+2,(b.min.z+b.max.z)/2), (b.min.z+b.max.z)/2);game.player.vy=0;game.setView(-Math.PI/2,-.32);
}
if(scenario==='camera-cover'){
  game.start('practice');game.world.addBox(4,4,.2,0xe4ae62,0,game.player.pos.y+2,42.6);game.setView(0);
}
if(scenario==='roof-crate'){
  game.start('practice');
  const crate=game.world.obstacles.find(o=>o.mesh.userData.prop==='roof-crate');
  const center=crate.box.getCenter(game.player.pos.clone());
  game.player.pos.set(center.x,crate.box.min.y,center.z+1.6);game.player.vy=0;game.setView(0,-.35);
}
if(scenario==='scenery-spacing'){
  game.start('practice');
  game.player.pos.set(35,game.world.floorAt(35,32),32);game.player.vy=0;game.setView(-2.49,-.13);
}
if(scenario==='art-tour'){
  game.start('practice');
  const spot=new URLSearchParams(location.search).get('spot')||'cabin';
  const views={cabin:[-19,1,0,-.03],coast:[43,47,2.25,-.10],sunlit:[-48,40,-2.1,-.17],shore:[-47,40,-1.5,-.10],meadow:[-10,30,-.45,-.05]};
  const [x,z,yaw,pitch]=views[spot]||views.cabin;
  game.player.pos.set(x,game.world.floorAt(x,z),z);game.player.vy=0;
  const pal=game.actors[0];pal.pos.set(x+2,game.world.floorAt(x+2,z-4),z-4);pal.spawnPos=pal.pos.clone();game.setView(yaw,pitch);
}
if(scenario==='victory'){
  game.start('match');game.setElapsed(211);
  for(const actor of game.actors)game.hitActor(actor,300);
}
if(scenario==='cabin-ramp'){
  game.start('practice');
  const index=Number(new URLSearchParams(location.search).get('ramp')||0),ramp=game.world.ramps.filter(r=>!r.build)[index];
  if(!ramp)throw new Error('Choose a cabin ramp from 0 to 3.');
  const x=ramp.x+ramp.length/2+1,z=ramp.z;
  game.player.pos.set(x,game.world.floorAt(x,z),z);game.player.vy=0;game.setView(-Math.PI/2);
}
if(scenario==='bot-tactics'){
  game.setDifficulty('hard');game.start('match');game.setElapsed(10);
  // Staged elevated target with extra health gives the observer time to see
  // ordinary bot decisions; it does not command a build or teleport the bot.
  const a=game.actors[0];for(const other of game.actors.slice(1)){other.alive=false;other.root.visible=false;}
  a.pos.set(0,game.world.floorAt(0,42),42);game.botController.reset(a,'hard');a.walkYaw=0;a.buildCooldown=0;
  const y=game.world.floorAt(0,22)+6,mesh=game.world.addBox(5,.2,5,0x69cfbd,0,y-.1,22);game.world.obstacles.find(o=>o.mesh===mesh).kind='build';
  game.player.pos.set(0,y,22);game.player.health=1000;game.setView(Math.PI,-.25);
}

if(scenario==='cover-check'){
  game.setDifficulty('hard');game.start('practice');
  const params=new URLSearchParams(location.search),kind=params.get('kind')||'wall',side=params.get('side')||'below',a=game.actors[0];
  game.botController.reset(a,'hard');a.name='Fixed cover tester';
  if(kind==='floor'){
    const base=game.player.pos.y,p={kind:'floor',x:0,y:base+4,z:42,yaw:0};p.bounds=buildBounds(p);game.constructBuild(p,game.player);
    a.pos.set(0,side==='below'?base+4:base,42);game.player.pos.y=side==='below'?base:base+4;
  }
  const panel=document.createElement('section');panel.id='cover-test-controls';
  panel.style.cssText='position:fixed;left:16px;top:38%;z-index:15;width:240px;padding:14px;background:#193e50f2;color:#fff4d5;border:1px solid #ffe36c;border-radius:10px;font:12px Trebuchet MS;line-height:1.5';
  panel.innerHTML=`<strong>COVER CHECK · FIXED SHOOTER</strong><p>${kind==='floor'?`Floor shots from ${side==='below'?'above':'below'}.`:`Press B, then ${kind==='ramp'?'2 for ramp':'1 for wall'}, then click to build. For walls, walk up against the cover.`} Use these buttons to fire controlled bot shots.</p>`;
  for(const count of [1,3,8]){
    const button=document.createElement('button');button.textContent=`Fire ${count} bot shot${count===1?'':'s'}`;button.style.cssText='margin:4px;padding:7px;border-radius:5px;background:#ffe36c;color:#193e50;font-size:12px';
    button.onclick=()=>{
      if(window.sunspark.snapshot().state!=='playing')return;
      for(let i=0;i<count;i++){game.botController.callbacks.fire(a,game.player.pos.clone().add({x:0,y:1.3,z:0}),DIFFICULTIES.hard);a.stats.shots++;}
    };panel.append(button);
  }
  document.body.append(panel);game.setView(0);
}



if(scenario==='movement'){
  game.start('practice');const params=new URLSearchParams(location.search),low=params.has('low');
  const add=(w,h,d,x,y,z)=>{const mesh=game.world.addBox(w,h,d,0x50b6ac,x,y,z);game.world.obstacles.find(o=>o.mesh===mesh).kind='build';};
  add(24,.2,30,0,19.9,40);game.player.pos.set(0,20,49);game.player.vy=0;game.player.grounded=true;game.setView(0,-.15);
  if(low){add(4,.2,5,0,21.9,42);add(.2,1.8,5,-2.1,20.9,42);add(.2,1.8,5,2.1,20.9,42);}
}

if(scenario==='pose-comparison'){
  game.start('practice');game.pause();game.player.root.visible=false;game.actors.forEach(a=>a.root.visible=false);
  for(const id of ['hud','pause'])document.getElementById(id).classList.add('hidden');
  const roof=game.world.floorAt(20,-16);
  for(const [x,height] of [[18.5,2.25],[21.5,1.7]]){const actor=createActor(game.world.scene);actor.pos.set(x,roof,-16);actor.poseHeight=height;actor.animate(.1,0,-.75);}
  game.camera.position.set(20,roof+3.4,-7.8);game.camera.lookAt(20,roof+1.1,-16);game.camera.fov=39;game.camera.updateProjectionMatrix();
  const label=document.createElement('div');label.style.cssText='position:fixed;inset:0;pointer-events:none;color:#fff9e9;font-family:Trebuchet MS;text-shadow:0 2px 5px #193e50';label.innerHTML='<div style="position:absolute;top:30px;left:40px;font-size:24px;font-weight:bold">SUNSPARK · CROUCH POSE</div><div style="position:absolute;bottom:34px;left:23%;font-size:20px;font-weight:bold">STANDING</div><div style="position:absolute;bottom:34px;left:66%;font-size:20px;font-weight:bold">CROUCHING</div>';document.body.append(label);
}

if(scenario==='sunhaven-tour'){
 game.start('practice',true);const spot=new URLSearchParams(location.search).get('spot')||'village';
 const views={village:[0,28,0,-.10],interior:[-12,-5,0,-.1],grove:[-70,-3,0,-.10],heights:[8,-62,0,-.08],docks:[88,39,0,-.16],quarry:[-53,85,0,-.13],coast:[96,39,0,-.17]};
 const [x,z,yaw,pitch]=views[spot]||views.village;game.player.pos.set(x,game.world.floorAt(x,z),z);game.player.vy=0;game.setView(yaw,pitch);
}

}
runScenario().catch(error=>{console.error(error);throw error;});
