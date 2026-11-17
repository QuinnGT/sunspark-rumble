// Engine integration tests; browser QA is documented separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { heightAt } from '../src/world.js';
import { WEAPONS, DIFFICULTIES, difficultyKey, seeded } from '../src/config.js';
import { buildBounds } from '../src/building.js';
import * as THREE from 'three';
import { ROCK_GAPS } from './rock-cases.js';
const elements=new Map(),handlers=new Map();
class Element {
  constructor(){this.style={};this.dataset={};this.value='high';this.textContent='';this.innerHTML='';this.events=new Map();this.classList={toggle(){},contains:()=>true};}
  addEventListener(type,fn){this.events.set(type,fn);}focus(){} getContext(){return new Proxy({},{get:()=>()=>{}});}replaceChildren(){}
}
globalThis.window=globalThis;globalThis.innerWidth=1280;globalThis.innerHeight=720;globalThis.devicePixelRatio=1;globalThis.HTMLInputElement=class {};globalThis.HTMLSelectElement=class {};
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers.set(type,fn),createElement:()=>new Element(),exitPointerLock(){},pointerLockElement:null};
globalThis.addEventListener=(type,fn)=>handlers.set(type,fn);globalThis.localStorage={getItem:()=>null,setItem(){}};
let now=performance.now(),raf;globalThis.requestAnimationFrame=fn=>raf=fn;
const bundle=await build({entryPoints:[resolve('src/game.js')],bundle:true,platform:'node',format:'cjs',write:false,define:{__SUNSPARK_TEST__:'true'},plugins:[{name:'renderer-only',setup(b){b.onResolve({filter:/^three$/},args=>args.importer.endsWith('game.js')?{path:resolve('tests/renderer-stub.mjs')}:undefined);}}]});
const require=createRequire(import.meta.url);new Function('require',bundle.outputFiles[0].text)(require);
const game=window.__test,snapshot=()=>window.sunspark.snapshot();
test.afterEach(()=>{game.setDifficulty('easy');game.botController.rng=Math.random;});
function step(seconds,hz=60){const frames=Math.ceil(seconds*hz);for(let i=0;i<frames;i++){now+=1000/hz;raf(now);}}
function key(code,down=true){handlers.get(down?'keydown':'keyup')({code,repeat:false,target:document.getElementById('game'),preventDefault(){}});}
function tap(code){key(code);key(code,false);step(.08);}
function collectWeapon(index,slot=0){
  game.equip(slot);const pickup=game.pickups.find(p=>p.type==='weapon'&&p.weapon===index&&p.respawn===0);assert.ok(pickup);
  game.player.pos.set(pickup.x,heightAt(pickup.x,pickup.z),pickup.z);game.player.vy=0;step(.4);tap('KeyE');assert.equal(snapshot().weapon,index);
}
function returnToSpawn(){game.player.pos.set(0,heightAt(0,42),42);game.player.vy=0;game.setView(0);step(.1);}
function testBox(w,h,d,x,y,z){const m=game.world.addBox(w,h,d,0xffaa77,x,y,z);game.world.obstacles.find(o=>o.mesh===m).kind='build';return m;}

function botShot(a,point=game.player.pos.clone().add(new THREE.Vector3(0,1.3,0))){game.botController.callbacks.fire(a,point,DIFFICULTIES[a.level]);}
function coverPiece(kind,x,y,z,yaw=0){const p={kind,x,y,z,yaw};p.bounds=buildBounds(p);return game.constructBuild(p,game.player);}

test('graphics controls preserve a paused match, measure gameplay only, and save quality/FPS choices',()=>{
  const originalStorage=globalThis.localStorage;let saved;
  globalThis.localStorage={getItem:()=>null,setItem:(key,value)=>saved=JSON.parse(value)};
  try{
    game.start('practice');game.player.health=63;game.selectBuild('wall');game.placeBuild();step(2.1,30);
    const before=snapshot();assert.ok(before.fps>0);assert.equal(before.buildCount,1);
    elements.get('performance').onclick();assert.equal(snapshot().state,'paused');
    const frozen=snapshot().fps;step(3,144);assert.equal(snapshot().fps,frozen,'pause rendering must not inflate gameplay FPS');
    for(const quality of ['low','balanced','high','balanced']){
      elements.get('quality').value=quality;elements.get('quality').onchange();
      assert.equal(snapshot().quality,quality);assert.equal(snapshot().fps,null);assert.equal(snapshot().lastGameplayFPS,null);
      assert.equal(snapshot().health,63);assert.equal(snapshot().wood,70);assert.equal(snapshot().buildMode,'wall');assert.equal(snapshot().buildCount,before.buildCount);assert.deepEqual(snapshot().structures,before.structures);assert.equal(snapshot().elapsed,before.elapsed);
    }
    elements.get('show-fps').checked=false;elements.get('show-fps').onchange();assert.equal(saved.quality,'balanced');assert.equal(saved.showFPS,false);
    elements.get('close-graphics').onclick();assert.equal(snapshot().state,'playing');assert.equal(snapshot().fps,null);step(2.1,30);assert.ok(snapshot().fps>0);
    elements.get('show-fps').checked=true;elements.get('show-fps').onchange();assert.equal(saved.showFPS,true);
  }finally{globalThis.localStorage=originalStorage;}
});

test('the camera pulls in front of close cover immediately instead of clipping inside it',()=>{
  for(const hz of [20,30,60]){
    game.start('practice');const y=game.player.pos.y;testBox(4,4,.2,0,y+2,42.6);
    game.updateCamera(1/hz);const anchor=game.player.pos.clone().add(new THREE.Vector3(0,1.85,0)),delta=game.camera.position.clone().sub(anchor),distance=delta.length();
    assert.ok(!game.terrainHit(anchor,delta.normalize(),distance),'the actual smoothed camera stays on the player side of cover');
    assert.ok(game.camera.position.z<42.5);assert.equal(game.player.body.visible,false);
  }
});

test('players jump onto rooftop crates and bot walking routes go around their sides',()=>{
  for(const [x,z,y] of [[-21,-12,5.5],[18,-19,5.5],[26,21,5],[-31,23,3]]){
    game.start('practice');const roof=y+4.25;
    game.player.pos.set(x,roof,z+1.6);game.player.vy=0;game.setView(0);step(.1);
    key('KeyW');step(.4);key('KeyW',false);step(.12);
    assert.ok(game.player.pos.z>=z+1,'walking stops at the crate');
    tap('Space');key('KeyW');step(.13);key('KeyW',false);step(1);
    assert.ok(Math.abs(game.player.pos.x-x)<.5&&Math.abs(game.player.pos.z-z)<.5,'jump ends over the lid');
    assert.ok(Math.abs(game.player.pos.y-(roof+.65))<.01,'feet land on top of the visible crate');
    assert.equal(game.player.grounded,true);
    const from={x:x+1.6,y:roof,z},to={x:x-1.4,y:roof,z};
    assert.equal(game.world.canWalk(from,to),false,'direct route must be blocked');
    const route=game.navigation.route(from,to);assert.ok(route.length>1,'bots should find a route around the prop');
    let previous=from;for(const p of route){assert.ok(game.world.canWalk(previous,p),'each route segment must be walkable');previous=p;}
  }
});

test('a newly placed wall blocks a bot shot before the next render',()=>{
  const a=duel('hard');game.player.health=100;game.player.shield=100;
  game.selectBuild('wall');game.placeBuild();const wall=game.world.structures[0];
  botShot(a);
  assert.equal(game.player.shield,100,'a wall must protect immediately, not after the next rendered frame');
  assert.equal(wall.health,150-DIFFICULTIES.hard.damage,'the shot should damage the new wall');
});
test('pressing against a wall cannot expose the oversized hit sphere through its far side',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    const a=duel('hard'),f=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const wall=coverPiece('wall',0,heightAt(0,42),42,yaw);wall.group.updateWorldMatrix(true,true);
    game.player.pos.set(f.x*.65,wall.piece.y,42+f.z*.65);game.player.health=100;game.player.shield=100;
    a.pos.set(-f.x*8,wall.piece.y,42-f.z*8);botShot(a);
    assert.equal(game.player.shield,100,`hugging wall yaw ${yaw} must protect the body`);
    assert.equal(wall.health,136,'cover takes the hit');
  }
});
test('a shot grazing the edge cannot hit an enlarged sphere while the body is hidden',()=>{
  const a=duel('hard'),wall=coverPiece('wall',0,heightAt(0,42),42);
  game.player.pos.set(1.4,wall.piece.y,42.65);game.player.shield=100;
  a.pos.set(2.1,wall.piece.y,34);
  botShot(a,new THREE.Vector3(2.1,wall.piece.y+1.3,42.65));
  assert.equal(game.player.shield,100,'grazing aim assistance cannot wrap around solid cover');
  assert.equal(wall.health,150,'a shot past the edge misses the wall too');
});
test('wall and ramp faces, and floor tops and undersides, block bot shots immediately on every difficulty',()=>{
  for(const level of Object.keys(DIFFICULTIES))for(const kind of ['wall','ramp','floor'])for(const yaw of kind==='floor'?[0]:[0,Math.PI/2,Math.PI,Math.PI*1.5])for(const side of [-1,1]){
    const a=duel(level),base=heightAt(0,42),b=coverPiece(kind,0,kind==='floor'?base+4:base,42,yaw);
    if(kind==='floor'){
      game.player.pos.set(0,side===1?base+4:base,42);a.pos.set(0,side===1?base:base+4,42);
    }else{
      const f=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));game.player.pos.set(f.x*side*2.65,base,42+f.z*side*2.65);a.pos.set(-f.x*side*8,base,42-f.z*side*8);
    }
    game.player.shield=100;game.player.health=100;botShot(a);
    assert.equal(game.player.shield,100,`${level} ${kind} yaw ${yaw} side ${side}`);
    assert.equal(b.health,150-DIFFICULTIES[level].damage,`${kind} must absorb the shot`);
  }
});
test('joined walls protect their seam and an inside corner at close range',()=>{
  for(const corner of [false,true]){
    const a=duel('hard'),base=heightAt(0,42);coverPiece('wall',0,base,42);
    coverPiece('wall',corner?2:4,base,corner?40:42,corner?Math.PI/2:0);
    if(corner){game.player.pos.set(1.35,base,41.35);a.pos.set(7,base,47);}else{game.player.pos.set(2,base,42.65);a.pos.set(2,base,34);}
    game.player.shield=100;botShot(a);assert.equal(game.player.shield,100,corner?'inside corner':'seam');
  }
});
test('the shot that destroys cover is absorbed; only a later clear shot damages the player',()=>{
  const a=duel('hard');game.player.health=100;game.player.shield=100;
  game.selectBuild('wall');game.placeBuild();const b=game.world.structures[0];
  for(let i=0;i<11;i++){botShot(a);assert.equal(game.player.shield,100,`blocked shot ${i+1}`);}
  assert.equal(b.health,0);assert.equal(game.world.structures.length,0);
  step(.02);assert.equal(snapshot().cover.broken,true);assert.equal(document.getElementById('cover-label').textContent,'YOUR WALL BROKE!');
  botShot(a);assert.equal(game.player.shield,86,'clear shot after destruction must connect');
  game.start('practice');assert.equal(snapshot().cover,null);
});
test('cached bot awareness cannot bypass cover placed during an active burst at 20/30/60 Hz',()=>{
  for(const hz of [20,30,60]){
    const a=duel('insane');step(.1,hz);assert.equal(a.visibleTarget,true);
    game.player.health=100;game.player.shield=100;game.selectBuild('wall');game.placeBuild();const b=game.world.structures[0];
    // Hold the known firing position so this tests an in-flight burst decision,
    // rather than allowing the bot to flank around the narrow test wall.
    a.cooldown=0;a.senseLeft=1;a.planLeft=1;a.pathTimer=1;a.path=[];
    step(.2,hz);assert.equal(game.player.shield,100,`${hz} Hz`);assert.ok(b.health<150,'cached burst lands on cover');
  }
});
test('a visible target beside or above a wall still takes damage',()=>{
  for(const above of [false,true]){
    const a=duel('hard'),base=heightAt(0,42);coverPiece('wall',0,base,38);
    game.player.pos.set(above?0:3,base+(above?4:0),42);a.pos.set(above?0:3,game.player.pos.y,26);game.player.shield=100;
    botShot(a);assert.equal(game.player.shield,86,above?'above cover':'beside cover');
  }
});

test('walking, sprinting and jumping respond; pause freezes simulation and reload',()=>{
  game.start('practice');step(.1);const z=game.player.pos.z;key('KeyW');step(.5);key('KeyW',false);step(.2);assert.ok(z-game.player.pos.z>2.5);
  const walking=z-game.player.pos.z;game.start('practice');key('ShiftLeft');key('KeyW');step(.5);key('KeyW',false);key('ShiftLeft',false);step(.2);assert.ok(z-game.player.pos.z>walking*1.3);
  key('Space');step(.15);assert.equal(snapshot().grounded,false);step(1);assert.equal(snapshot().grounded,true);
  game.shoot();game.reload();game.pause();const before=snapshot();step(2);assert.equal(snapshot().elapsed,before.elapsed);assert.equal(snapshot().reloading,before.reloading);game.resume();step(2);assert.equal(snapshot().ammo[0],24);
});
test('a blaster hits a visible opponent, but a placed wall blocks it and costs wood once',()=>{
  game.start('practice');step(.1);game.shoot();assert.ok(game.actors[0].health<100,JSON.stringify(window.__shotDebug));const before=game.actors[0].health;step(.2);game.selectBuild('wall');game.placeBuild();assert.equal(snapshot().wood,70);assert.equal(snapshot().buildCount,1);
  game.selectBuild('wall');game.placeBuild();assert.equal(snapshot().wood,70);assert.equal(snapshot().placement.valid,false);game.equip(0);step(.2);game.shoot();assert.equal(game.actors[0].health,before);
  key('KeyW');step(1);key('KeyW',false);assert.ok(game.player.pos.z>38.6,'player cannot walk through the wall');
});
test('a ramp can be placed and climbed through ordinary movement',()=>{
  game.start('practice');step(.1);const y=game.player.pos.y;game.selectBuild('ramp');game.placeBuild();assert.equal(snapshot().wood,70);key('KeyW');step(.8);key('KeyW',false);assert.ok(game.player.pos.y>y+1.4);assert.equal(snapshot().buildCount,1);
});
test('every permanent cabin ramp can be entered from the ground and climbed onto its roof',()=>{
  for(const hz of [60,30,20])for(const sprint of [false,true])for(const ramp of game.world.ramps.filter(r=>!r.build)){
    game.start('practice');
    const lowX=ramp.x+ramp.length/2+1,roofX=ramp.x-ramp.length/2-.6;
    game.player.pos.set(lowX,heightAt(lowX,ramp.z),ramp.z);game.player.vy=0;
    key('KeyA');if(sprint)key('ShiftLeft');
    for(let i=0;i<hz*3&&game.player.pos.x>roofX;i++)step(1/hz,hz);
    key('KeyA',false);key('ShiftLeft',false);
    assert.ok(game.player.pos.x<=roofX,`cannot reach roof at ${ramp.x}, ${ramp.z}, sprint=${sprint}, ${hz}Hz: ${game.player.pos.toArray()}`);
    assert.ok(Math.abs(game.player.pos.y-(ramp.y+ramp.rise))<.15,`feet must meet roof height at ${ramp.x}, ${ramp.z}`);
  }
});
test('R can reload both weapons repeatedly without a stale timer blocking the next reload',()=>{
  for(const index of [0,1]){
    game.start('practice');game.equip(index);const w=WEAPONS[index];
    for(let cycle=0;cycle<3;cycle++){
      game.shoot();step(w.interval+.05);key('KeyR');key('KeyR',false);
      assert.ok(snapshot().reloading>0,`weapon ${index}, manual reload ${cycle+1} must start`);
      step(w.reload+.1);
      assert.equal(snapshot().ammo[index],w.magazine);
      assert.equal(snapshot().reserve[index],w.reserve-cycle-1);
      assert.equal(snapshot().reloading,0,'completed reloads must leave an idle timer');
    }
  }
});
test('automatic reload keeps working after emptying a second magazine',()=>{
  for(const index of [0,1]){
    game.start('practice');game.equip(index);const w=WEAPONS[index];
    for(let cycle=0;cycle<2;cycle++){
      for(let shot=0;shot<w.magazine;shot++){game.shoot();step(w.interval+.05);}
      assert.ok(snapshot().reloading>0,`weapon ${index}, automatic reload ${cycle+1} must start`);
      step(w.reload+.1);assert.equal(snapshot().ammo[index],w.magazine);assert.equal(snapshot().reserve[index],w.reserve-(cycle+1)*w.magazine);
    }
  }
});
test('pickups replenish the correct resource and do not waste full health',()=>{
  game.start('practice');game.player.pos.set(3,1.5,37);game.player.shield=10;step(.1);assert.ok(game.player.shield>=50);assert.ok(game.pickups.find(p=>p.type==='shield'&&p.x===3).respawn>0);
  game.player.pos.set(4,1.5,32);game.player.health=100;step(.1);assert.equal(game.pickups.find(p=>p.type==='health'&&p.x===4).respawn,0);game.player.health=20;step(.1);assert.equal(game.player.health,60);
});
test('all eight bots move, fight each other, and steer inside the storm',()=>{
  game.start('match');const initial=game.actors.map(a=>a.pos.clone());step(15);assert.equal(game.actors.length,8);assert.ok(game.actors.filter((a,i)=>a.pos.distanceTo(initial[i])>3).length>=6);
  game.setElapsed(210);step(1);assert.ok(game.actors.some(a=>a.escaping));
});
test('storm defeat shows a result and replay clears builds, timers, health and opponents',()=>{
  game.start('match');game.selectBuild('wall');game.placeBuild();game.player.health=1;game.setElapsed(220);step(.3);assert.equal(snapshot().state,'result');assert.equal(document.getElementById('result-title').textContent,'NICE RUMBLE!');game.start('match');assert.equal(snapshot().state,'playing');assert.equal(snapshot().health,100);assert.equal(snapshot().shield,100);assert.equal(snapshot().elapsed,0);assert.equal(snapshot().buildCount,0);assert.equal(game.actors.length,8);assert.equal(game.world.obstacles.filter(o=>o.kind==='build').length,0);
});
test('eliminating the final opponent awards victory with correct results',()=>{
  game.start('match');for(const a of game.actors)game.hitActor(a,300);step(.1);assert.equal(snapshot().state,'result');assert.equal(snapshot().pops,8);assert.equal(document.getElementById('result-place').textContent,'#1');assert.equal(document.getElementById('result-title').textContent,'SUNSATIONAL!');
});
test('building cannot spend more wood than available',()=>{
  game.start('practice');let placed=0;
  for(let z=44;z<=54&&placed<8;z+=7)for(let x=-42;x<=42&&placed<8;x+=7){game.player.pos.set(x,heightAt(x,z),z);game.selectBuild('wall');if(snapshot().placement?.valid){game.placeBuild();placed++;}else game.equip(0);}
  assert.equal(placed,8);assert.equal(snapshot().wood,0);game.player.pos.set(0,heightAt(0,42),42);game.selectBuild('wall');game.placeBuild();assert.equal(snapshot().wood,0);assert.equal(snapshot().buildCount,8);
});
test('shots destroy player cover but preserve permanent cabin access ramps',()=>{
  game.start('practice');const permanent=game.world.ramps.find(r=>!r.build);game.damageBuild(permanent.mesh,300);assert.ok(game.world.ramps.includes(permanent));game.selectBuild('wall');game.placeBuild();const wall=game.world.obstacles.find(o=>o.kind==='build');assert.ok(wall);game.damageBuild(wall.mesh,300);assert.ok(!game.world.obstacles.includes(wall));
});
test('B keeps building active, keys select all three pieces, and B restores the equipped blaster',()=>{
  game.start('practice');tap('Digit2');const before=snapshot().ammo;
  tap('KeyB');assert.equal(snapshot().buildMode,'wall');assert.equal(game.player.gun.visible,false);
  tap('Digit2');assert.equal(snapshot().buildMode,'ramp');assert.equal(snapshot().weapon,1);
  game.shoot();assert.equal(snapshot().buildCount,1);assert.equal(snapshot().buildMode,'ramp');assert.deepEqual(snapshot().ammo,before);
  game.shoot();assert.equal(snapshot().buildCount,1);assert.equal(snapshot().wood,70,'duplicate placement must not spend wood');
  tap('Digit3');assert.equal(snapshot().buildMode,'floor');tap('KeyQ');assert.equal(snapshot().buildMode,'ramp');tap('KeyE');assert.equal(snapshot().buildMode,'floor');
  tap('Digit1');const rotation=snapshot().placement.yaw;tap('KeyR');assert.ok(Math.abs(snapshot().placement.yaw-rotation-Math.PI/2)<.01);assert.equal(snapshot().reloading,0);
  tap('KeyB');assert.equal(snapshot().buildMode,null);assert.equal(snapshot().weapon,1);assert.equal(game.player.gun.visible,true);
  game.shoot();assert.equal(snapshot().ammo[1],before[1]-1);tap('KeyR');assert.ok(snapshot().reloading>0);step(2);assert.equal(snapshot().ammo[1],before[1]);
  tap('KeyB');assert.equal(snapshot().buildMode,'wall');game.pause();const p=snapshot();step(1);assert.equal(snapshot().buildCount,p.buildCount);game.resume();assert.equal(snapshot().buildMode,'wall');
});
test('normal movement builds and climbs a two-ramp staircase, extends a floor bridge, and stacks a wall',()=>{
  for(const hz of [60,30,20]){
    game.start('practice');step(.1,hz);const base=game.player.pos.y;
    tap('KeyB');tap('Digit2');game.shoot();assert.equal(snapshot().buildCount,1);
    key('KeyW');step(.5,hz);key('KeyW',false);step(.08,hz);
    assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));
    assert.equal(snapshot().placement.snapped,true);assert.ok(Math.abs(snapshot().placement.y-base-3)<.2);
    game.shoot();assert.equal(snapshot().buildCount,2);key('KeyW');step(.52,hz);key('KeyW',false);step(.08,hz);
    tap('Digit3');assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();assert.equal(snapshot().buildCount,3);
    key('KeyW');step(.55,hz);key('KeyW',false);step(.08,hz);
    assert.ok(game.player.pos.y>base+5.8,JSON.stringify(snapshot().position));assert.equal(snapshot().grounded,true);
    assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();assert.equal(snapshot().buildCount,4);
    const floors=game.world.structures.filter(b=>b.piece.kind==='floor');assert.equal(floors.length,2);assert.equal(floors[0].piece.y,floors[1].piece.y);assert.equal(Math.abs(floors[0].piece.z-floors[1].piece.z),4);
    key('KeyW');step(.5,hz);key('KeyW',false);step(.08,hz);assert.equal(snapshot().grounded,true);assert.ok(game.player.pos.y>base+5.8);
    tap('Digit1');assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();assert.equal(snapshot().buildCount,5);
    const firstWall=game.world.structures.at(-1).piece;game.setView(0,.65);step(.08,hz);
    assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();assert.equal(snapshot().buildCount,6);
    const secondWall=game.world.structures.at(-1).piece;assert.equal(secondWall.y,firstWall.y+3);assert.equal(secondWall.z,firstWall.z);
    game.start('practice');assert.equal(game.world.structures.length,0,'replay must discard snap anchors');
  }
});
test('elevated floors support feet, block jumping and shots from below, and clean up when destroyed',()=>{
  game.start('practice');tap('KeyB');game.shoot();const wall=game.world.structures[0].piece;
  game.setView(0,.65);tap('Digit3');assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();
  const floor=game.world.structures.find(b=>b.piece.kind==='floor');assert.ok(floor);assert.equal(floor.piece.y,wall.y+3);
  game.player.pos.set(floor.piece.x,heightAt(floor.piece.x,floor.piece.z),floor.piece.z);game.player.vy=0;step(.1);
  const ground=game.player.pos.y;tap('Space');step(.12);assert.ok(game.player.pos.y+2.25<=floor.box.min.y+.01,'head cannot jump through floor');step(1);assert.ok(Math.abs(game.player.pos.y-ground)<.05);
  const hit=game.terrainHit(game.player.pos.clone().add({x:0,y:1,z:0}),game.player.pos.clone().set(0,1,0),10);assert.equal(hit?.object,floor.mesh);
  assert.equal(game.navigation.free(floor.piece.x,floor.piece.z),true,'bots can walk under floors with headroom');
  game.player.pos.y=floor.piece.y;step(.2);assert.equal(game.player.pos.y,floor.piece.y);assert.equal(snapshot().grounded,true);
  game.damageBuild(floor.mesh,300);assert.ok(!game.world.structures.includes(floor));step(1);assert.ok(game.player.pos.y<floor.piece.y-1);
});
test('snapped stairs work in every compass direction and floor bridges can turn a corner',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    game.start('practice');const fx=Math.round(Math.sin(yaw)),fz=Math.round(-Math.cos(yaw));
    const x=-fx*3,z=48-fz*3;game.player.pos.set(x,heightAt(x,z),z);game.player.vy=0;game.setView(yaw);
    tap('KeyB');tap('Digit2');assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();
    const first=game.world.structures[0].piece;key('KeyW');step(.65);key('KeyW',false);step(.1);
    assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();
    const second=game.world.structures[1].piece;assert.equal(second.y,first.y+3);assert.equal(second.x,first.x+fx*4);assert.equal(second.z,first.z+fz*4);
    key('KeyW');step(.55);key('KeyW',false);step(.1);tap('Digit3');assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();
    key('KeyW');step(.55);key('KeyW',false);step(.1);assert.ok(game.player.pos.y>first.y+5.8);assert.equal(snapshot().grounded,true);
    const floor=game.world.structures.at(-1).piece;game.setView(yaw+Math.PI/2);step(.1);
    assert.equal(snapshot().placement.valid,true,JSON.stringify(snapshot().placement));game.shoot();const corner=game.world.structures.at(-1).piece;
    assert.equal(corner.y,floor.y);assert.equal(Math.abs(corner.x-floor.x)+Math.abs(corner.z-floor.z),4);
    key('KeyW');step(.55);key('KeyW',false);step(.1);assert.equal(snapshot().grounded,true);assert.equal(game.player.pos.y,floor.y);
  }
});
test('weapon pickups require E, replace the selected slot, and preserve magazines when swapped back',()=>{
  game.start('practice');const prism=game.pickups.find(p=>p.weapon===2);game.player.pos.set(prism.x,heightAt(prism.x,prism.z),prism.z);step(.4);assert.deepEqual(snapshot().loadout,[0,1]);
  game.shoot();step(.2);tap('Digit2');tap('KeyE');assert.deepEqual(snapshot().loadout,[0,2]);assert.equal(snapshot().activeSlot,1);assert.equal(prism.respawn>0,true);
  assert.ok(document.getElementById('weapon-name').textContent.includes('PRISM'));
  collectWeapon(3,0);assert.deepEqual(snapshot().loadout,[3,2]);assert.equal(snapshot().ammo[0],23);
  collectWeapon(0,0);assert.deepEqual(snapshot().loadout,[0,2]);assert.equal(snapshot().ammo[0],23,'picking the starter back up must not create free ammo');
  const before=snapshot().loadout;tap('KeyB');tap('KeyE');assert.deepEqual(snapshot().loadout,before);assert.equal(snapshot().buildMode,'ramp','E cycles builds instead of swapping while building');
});
test('Prism charges before firing, hits at long range, and repeatedly reloads',()=>{
  game.start('practice');collectWeapon(2);testBox(4,.25,4,0,19.875,42);game.player.pos.set(0,20,42);game.player.vy=0;game.actors[0].pos.set(0,20,-10);game.setView(0,-.02);step(.1);
  for(let cycle=0;cycle<3;cycle++){
    game.actors[0].alive=true;game.actors[0].root.visible=true;game.actors[0].health=100;
    game.shoot();assert.equal(snapshot().charging,true);step(.3);assert.equal(snapshot().ammo[2],4);assert.equal(game.actors[0].health,100);
    step(.55);assert.equal(snapshot().ammo[2],3);assert.equal(snapshot().charging,false);assert.equal(game.actors[0].health,12,'charged rainbow shot must hit the target 52 units away');
    assert.equal(snapshot().lastWeaponHit.weapon,2);tap('KeyR');step(2);assert.equal(snapshot().ammo[2],4);assert.equal(snapshot().reserve[2],19-cycle);assert.equal(snapshot().reloading,0);
  }
});
test('pending Prism shots cancel on pause, reload, slot change, building, and replay',()=>{
  for(const action of ['pause','reload','equip','build','replay']){
    game.start('practice');collectWeapon(2);returnToSpawn();game.shoot();step(.25);assert.equal(snapshot().charging,true);
    if(action==='pause'){game.pause();step(1);game.resume();}else if(action==='reload')tap('KeyR');else if(action==='equip')tap('Digit2');else if(action==='build')tap('KeyB');else game.start('practice');
    step(1);assert.equal(snapshot().charging,false);assert.equal(snapshot().ammo[2],4);assert.equal(game.actors[0].health,100,action+' must not fire a delayed shot');
  }
});
test('Gumball travels before hitting, freezes during pause, and reloads without affecting the other slot',()=>{
  game.start('practice');collectWeapon(3);returnToSpawn();game.shoot();assert.equal(game.actors[0].health,100);assert.equal(snapshot().projectiles,1);step(.12);
  game.pause();const before=game.gumballs.items[0].mesh.position.clone();step(1);assert.ok(game.gumballs.items[0].mesh.position.equals(before));game.resume();step(.6);
  assert.equal(game.actors[0].health,70);assert.equal(snapshot().projectiles,0);assert.equal(snapshot().lastWeaponHit.weapon,3);
  tap('KeyR');step(1.7);assert.equal(snapshot().ammo[3],12);assert.equal(snapshot().reserve[3],71);assert.equal(snapshot().ammo[1],6);
  game.shoot();game.start('match');assert.equal(snapshot().projectiles,0);assert.equal(snapshot().bounces,0);assert.deepEqual(snapshot().loadout,[0,1]);
});
test('Gumballs ricochet into a target once and stop at the second thin wall at 20/30/60 Hz',()=>{
  for(const hz of [20,30,60]){
    game.start('practice');testBox(.2,7,18,4,22,36);testBox(.2,7,18,-4,22,36);game.actors[0].pos.set(0,20.7,32);step(.1,hz);
    game.gumballs.launch(new THREE.Vector3(0,22,40),new THREE.Vector3(1,0,-1));step(.45,hz);
    assert.equal(snapshot().bounces,1);assert.equal(game.actors[0].health,76,'one bounce deals 24 damage');assert.equal(snapshot().projectiles,0);
    game.actors[0].pos.x=20;game.gumballs.launch(new THREE.Vector3(0,22,40),new THREE.Vector3(1,0,-1));step(.7,hz);
    assert.equal(snapshot().bounces,2,'only one additional bounce');assert.equal(snapshot().projectiles,0,'second wall must absorb projectile');
  }
});
test('ammo pickups restock both carried weapon types and leave uncarried ammo alone',()=>{
  game.start('practice');collectWeapon(2,0);collectWeapon(3,1);const before=snapshot().reserve;
  game.player.pos.set(-3,heightAt(-3,37),37);step(.1);
  assert.deepEqual(snapshot().reserve,[before[0],before[1],before[2]+6,before[3]+18]);
});
test('Confetti has close-range knockback, while cover still blocks every weapon type',()=>{
  game.start('practice');game.equip(1);game.actors[0].pos.set(0,heightAt(0,34),34);const z=game.actors[0].pos.z;game.shoot();assert.ok(game.actors[0].health<100);assert.ok(game.actors[0].pos.z<z-.5);
  for(const index of [0,1,2,3]){
    game.start('practice');if(index>1)collectWeapon(index);else game.equip(index);returnToSpawn();game.selectBuild('wall');game.placeBuild();tap('KeyB');game.shoot();step(1.1);assert.equal(game.actors[0].health,100,'wall must block '+WEAPONS[index].short);
  }
});
test('new weapons automatically reload after two full magazines',()=>{
  for(const index of [2,3]){
    game.start('practice');collectWeapon(index);returnToSpawn();const w=WEAPONS[index];
    for(let cycle=0;cycle<2;cycle++){
      for(let n=0;n<w.magazine;n++){game.shoot();step((w.charge||0)+w.interval+.05);}
      assert.ok(snapshot().reloading>0);step(w.reload+.1);assert.equal(snapshot().ammo[index],w.magazine);assert.equal(snapshot().reserve[index],w.reserve-w.magazine*(cycle+1));assert.equal(snapshot().reloading,0);
    }
  }
});
test('nearby weapon pickups cannot be collected through a wall',()=>{
  game.start('practice');game.player.pos.set(1,heightAt(1,42),42);testBox(.2,4,4,2,3,42);step(.4);tap('KeyE');assert.deepEqual(snapshot().loadout,[0,1]);assert.equal(snapshot().nearbyWeapon,null);
});


function duel(level='easy',seed=42){
  game.setDifficulty(level);game.start('match');game.setElapsed(10);
  const bot=game.actors[0];for(const a of game.actors.slice(1)){a.alive=false;a.root.visible=false;}
  game.player.health=10000;game.player.shield=0;bot.pos.set(0,heightAt(0,26),26);bot.vy=0;bot.grounded=true;
  game.botController.rng=seeded(seed);game.botController.reset(bot,level);bot.walkYaw=Math.PI;bot.nextHighGround=Infinity;
  return bot;
}

test('bots traverse both formerly blocked rock gaps using their normal movement and navigation',()=>{
  for(const gap of ROCK_GAPS)for(const reverse of [false,true]){
    const a=duel('hard'),from=new THREE.Vector3().fromArray(reverse?gap.to:gap.from),to=new THREE.Vector3().fromArray(reverse?gap.from:gap.to);
    a.pos.copy(from);a.climbGoal=to;a.climbLeft=10;a.planLeft=0;a.pathTimer=0;game.player.alive=false;
    for(let i=0;i<150&&a.pos.distanceTo(to)>.4;i++)game.botController.update(1/30,10,game.player,[a]);
    assert.ok(a.pos.distanceTo(to)<.45,`bot stuck in rock gap: ${a.pos.toArray()}`);
  }
});
test('four difficulties deliver increasing fire pressure in the same live duel',()=>{
  const report=[];
  for(const level of Object.keys(DIFFICULTIES)){
    let damage=0,shots=0,first=0,reloads=0;
    for(const seed of [42,77,101]){
      const a=duel(level,seed);let firstShot=0;
      for(let i=0;i<600;i++){step(1/30,30);if(a.stats.shots&&!firstShot)firstShot=(i+1)/30;}
      damage+=10000-game.player.health;shots+=a.stats.shots;first+=firstShot;reloads+=a.stats.reloads;
      assert.ok(a.stats.shots>5,`${level} must actively engage`);assert.ok(a.stats.reloads>=1,`${level} must reload`);
      assert.ok(firstShot>0&&firstShot<2,`${level} must react promptly after grace`);
    }
    report.push({level,damage:Math.round(damage/3),shots:Math.round(shots/3),firstShot:+(first/3).toFixed(2),reloads});
  }
  console.log('20-second stationary duel averages:',JSON.stringify(report));
  for(let i=1;i<report.length;i++){assert.ok(report[i].damage>report[i-1].damage*1.15,JSON.stringify(report));assert.ok(report[i].shots>report[i-1].shots);assert.ok(report[i].firstShot<report[i-1].firstShot);}
  assert.equal(difficultyKey('normal'),'medium');assert.equal(difficultyKey('unknown'),'easy');game.setDifficulty('easy');
});
test('perception respects cover, hears shots, and forgets an unseen opponent',()=>{
  const a=duel('hard'),ai=game.botController,d=DIFFICULTIES.hard;
  assert.ok(ai.visible(a,game.player,d));testBox(12,8,.4,0,heightAt(0,34)+4,34);step(.02);
  assert.equal(ai.visible(a,game.player,d),false);a.target=null;a.lastSeen=null;a.memoryLeft=0;
  ai.sense(a,[a,game.player],game.player,10,d);assert.equal(a.target,null);
  ai.noise(game.player,10);ai.sense(a,[a,game.player],game.player,10.1,d);
  assert.equal(a.target,game.player);assert.equal(a.visibleTarget,false);const known=a.lastSeen.clone();
  game.player.pos.x+=8;ai.sense(a,[a,game.player],game.player,11.5,d);assert.ok(a.lastSeen.equals(known),'hearing stores a position, not hidden tracking');
  a.memoryLeft=0;ai.sense(a,[a,game.player],game.player,20,d);assert.equal(a.target,null);
  game.setDifficulty('easy');
});
test('bot empty magazines pause firing, refill after reload, and freeze when paused',()=>{
  const a=duel('medium');a.ammo=0;step(.05);assert.ok(a.reloadLeft>0);const shots=a.stats.shots;
  game.pause();const left=a.reloadLeft;step(3);assert.equal(a.reloadLeft,left);game.resume();step(1);
  assert.equal(a.stats.shots,shots);assert.equal(a.ammo,0);step(1.6);assert.equal(a.ammo,DIFFICULTIES.medium.magazine);
  step(1);assert.ok(a.stats.shots>shots);game.setDifficulty('easy');
});
test('bot routes climb every permanent cabin ramp and descend using real movement',()=>{
  for(const ramp of game.world.ramps.filter(r=>!r.build)){
    const a=duel('hard');game.player.pos.set(0,heightAt(0,60),60);game.player.alive=false;
    const from=new THREE.Vector3(ramp.x+ramp.length/2+1,heightAt(ramp.x+ramp.length/2+1,ramp.z),ramp.z),roof=new THREE.Vector3(ramp.x-ramp.length/2-.7,ramp.y+ramp.rise,ramp.z);
    a.pos.copy(from);a.goal=roof.clone();a.climbGoal=roof.clone();a.climbLeft=20;
    const route=game.navigation.route(from,roof);assert.ok(route.length,`no route up cabin ${ramp.x},${ramp.z}`);
    for(let i=0;i<360&&a.pos.distanceTo(roof)>.65;i++)game.botController.update(1/30,10,game.player,[a]);
    assert.ok(a.pos.distanceTo(roof)<.65,`stuck climbing ${ramp.x}: ${a.pos.toArray()} goal ${roof.toArray()}`);
    a.climbGoal=from.clone();a.climbLeft=20;a.planLeft=0;a.pathTimer=0;
    for(let i=0;i<360&&a.pos.distanceTo(from)>.65;i++)game.botController.update(1/30,10,game.player,[a]);
    assert.ok(a.pos.distanceTo(from)<.65,`stuck descending ${ramp.x}: ${a.pos.toArray()}`);
  }
  game.setDifficulty('easy');
});
test('bots spend their own limited wood and their structures remain destructible',()=>{
  const a=duel('hard'),ai=game.botController,d=DIFFICULTIES.hard;a.pos.set(0,heightAt(0,42),42);game.player.pos.set(15,heightAt(15,42),42);
  const enemy=new THREE.Vector3(0,a.pos.y,26);a.buildCooldown=0;
  const wall=ai.build(a,'wall',enemy,d);assert.ok(wall);assert.equal(a.wood,40);assert.equal(snapshot().wood,80);assert.equal(snapshot().buildCount,0);assert.equal(wall.owner,a);
  assert.equal(ai.build(a,'ramp',enemy,d),null,'cooldown prevents spam');game.damageBuild(wall.mesh,300);assert.ok(!game.world.structures.includes(wall));
  a.buildCooldown=0;a.buildPause=0;const ramp=ai.build(a,'ramp',enemy,d);assert.ok(ramp);assert.ok(a.climbGoal.y>a.pos.y+2);
  game.player.alive=false;a.planLeft=0;
  for(let i=0;i<240&&a.pos.distanceTo(a.climbGoal)>.5;i++)ai.update(1/30,10,game.player,[a]);
  assert.ok(a.pos.y>ramp.y+2.4,`bot must climb its ramp: ${a.pos.toArray()}`);
  a.wood=0;a.buildCooldown=0;a.buildPause=0;assert.equal(ai.build(a,'wall',enemy,d),null);
  game.start('match');assert.equal(game.world.structures.length,0);assert.ok(game.actors.every(b=>b.ammo===d.magazine&&b.stats.shots===0));game.setDifficulty('easy');
});

test('hard bots choose defensive cover and build upward toward elevated opponents',()=>{
  const a=duel('hard'),ai=game.botController,d=DIFFICULTIES.hard;a.pos.set(0,heightAt(0,52),52);a.buildCooldown=0;a.health=40;a.shield=0;
  game.player.pos.set(0,heightAt(0,36),36);ai.hurt(a,game.player);a.visibleTarget=true;ai.rng=()=>0;
  ai.plan(a,d,65,10);assert.ok(a.action.includes('COVER')||a.stats.builds>0,`defensive decision: ${a.action}`);
  const b=duel('hard');b.pos.set(0,heightAt(0,42),42);b.buildCooldown=0;
  const platformY=b.pos.y+6;testBox(5,.2,5,0,platformY-.1,26);game.player.pos.set(0,platformY,26);step(.02);b.lastSeen=game.player.pos.clone();b.visibleTarget=true;
  ai.plan(b,d,65,10);assert.equal(b.stats.ramps,1,'high target triggers a ramp');
  const top=b.climbGoal.clone();game.player.alive=false;
  for(let i=0;i<240&&b.pos.distanceTo(top)>.4;i++)ai.update(1/30,10,game.player,[b]);
  assert.ok(b.pos.y>top.y-.4);b.climbGoal=null;b.climbLeft=0;b.buildCooldown=0;b.buildPause=0;b.lastSeen=new THREE.Vector3(0,b.pos.y,20);b.visibleTarget=true;
  ai.plan(b,d,65,10);assert.equal(b.stats.floors,1,'elevated edge triggers a connected landing');
  const landing=game.world.structures.find(s=>s.owner===b&&s.piece.kind==='floor');assert.ok(landing);assert.ok(game.navigation.route(b.pos,new THREE.Vector3(landing.piece.x,landing.piece.y,landing.piece.z)).length);
  game.damageBuild(landing.mesh,300);assert.equal(game.navigation.route(b.pos,new THREE.Vector3(landing.piece.x,landing.piece.y,landing.piece.z)).length,0,'destroyed landing must invalidate cached navigation');game.setDifficulty('easy');
});
test('storm takes priority over climbing and bots descend to a reachable safe point',()=>{
  const a=duel('hard'),r=game.world.ramps.find(r=>!r.build);a.pos.set(r.x-r.length/2-.7,r.y+r.rise,r.z);a.climbGoal=a.pos.clone().add(new THREE.Vector3(0,3,0));a.climbLeft=20;game.player.alive=false;
  const initial=Math.hypot(a.pos.x,a.pos.z);
  for(let i=0;i<450;i++)game.botController.update(1/30,200,game.player,[a]);
  assert.ok(Math.hypot(a.pos.x,a.pos.z)<initial-8,`storm retreat stuck ${a.pos.toArray()}`);assert.ok(a.pos.y<r.y+r.rise-1);game.setDifficulty('easy');
});
test('the opening grace survives bot crossfire but ends if the player attacks',()=>{
  const a=duel('easy'),ai=game.botController,d=DIFFICULTIES.easy;
  ai.hurt(a,game.actors[1]);ai.sense(a,[a,game.player],game.player,1,d);assert.equal(a.visibleTarget,false);
  ai.hurt(a,game.player);ai.sense(a,[a,game.player],game.player,1,d);assert.equal(a.visibleTarget,true);game.setDifficulty('easy');
});

test('Easy limits simultaneous player focus and repeated hits cannot restart reaction forever',()=>{
  const a=duel('easy'),ai=game.botController,d=DIFFICULTIES.easy,b=game.actors[1];b.alive=true;b.target=game.player;b.visibleTarget=true;b.pos.set(0,heightAt(0,-55),-55);
  ai.sense(a,[a,b,game.player],game.player,10,d);assert.equal(a.target,null,'an unprovoked second attacker waits');
  ai.hurt(a,game.player);ai.sense(a,[a,b,game.player],game.player,10,d);assert.equal(a.target,game.player,'a bot responds when the player attacks it');
  a.cooldown=.05;ai.hurt(a,game.player);assert.equal(a.cooldown,.05,'existing duel does not restart the reaction timer');
});

// Elevated, flat test deck isolates input/physics from decorative terrain.
function movementDeck(){game.start('practice');testBox(30,.2,30,0,19.9,40);game.player.pos.set(0,20,48);game.player.vy=0;game.player.grounded=true;game.setView(0);step(.1);}
test('C crouches with a smaller body, walks slower, and cannot stand or jump into a low ceiling',()=>{
  movementDeck();testBox(4,.2,5,0,21.9,42);key('KeyW');step(.6);key('KeyW',false);step(.15);assert.ok(game.player.pos.z>44.9);
  tap('KeyC');assert.equal(snapshot().movement.stance,'crouching');key('KeyW');step(.9);key('KeyW',false);step(.12);assert.ok(game.player.pos.z<44.5&&game.player.pos.z>40);
  tap('KeyC');assert.equal(snapshot().movement.stance,'crouching','blocked stand remains low');tap('Space');assert.equal(game.player.pos.y,20);
  key('KeyW');step(1.7);key('KeyW',false);step(.1);assert.equal(snapshot().movement.stance,'standing');assert.ok(game.player.pos.z<39);
});
test('sprint then C slides, Space cancels into a jump, C brakes, and repeated C cannot add unlimited speed',()=>{
  movementDeck();key('ShiftLeft');key('KeyW');step(.45);tap('KeyC');assert.equal(snapshot().movement.stance,'sliding');assert.ok(snapshot().movement.speed>11);
  tap('Space');assert.ok(!game.player.grounded);assert.equal(snapshot().movement.stance,'standing');assert.ok(Math.hypot(...[snapshot().movement.velocity[0],snapshot().movement.velocity[2]])>10);
  for(let i=0;i<6;i++)tap('KeyC');assert.ok(snapshot().movement.speed<=16.1);key('KeyW',false);key('ShiftLeft',false);
  movementDeck();key('ShiftLeft');key('KeyW');step(.45);tap('KeyC');tap('KeyC');assert.equal(snapshot().movement.stance,'crouching');step(.3);assert.ok(snapshot().movement.speed<3.4);
});
test('slides cannot tunnel through a thin player wall at 20, 60 or 144 FPS',()=>{
  for(const hz of [20,60,144]){movementDeck();const wall=coverPiece('wall',0,20,37);key('ShiftLeft');key('KeyW');step(.5,hz);tap('KeyC');step(1.3,hz);assert.ok(game.player.pos.z>=37.6,'slide must stop outside the wall');assert.equal(wall.health,150);}
});
test('jump hold height, buffered landing, coyote time and no air jumping work at multiple frame rates',()=>{
  const peaks=[];
  for(const hz of [20,60,144]){
    movementDeck();key('Space');step(.07,hz);key('Space',false);let short=0;for(let i=0;i<hz;i++){step(1/hz,hz);short=Math.max(short,game.player.pos.y-20);}
    movementDeck();key('Space');let tall=0;for(let i=0;i<hz;i++){step(1/hz,hz);tall=Math.max(tall,game.player.pos.y-20);}key('Space',false);assert.ok(tall>short+.5);peaks.push(tall);
    // A jump queued just before touching down fires once on the next support.
    game.player.pos.y=20.3;game.player.vy=-5;game.player.grounded=false;game.movement.coyote=0;tap('Space');step(.08,hz);assert.ok(game.player.vy>0);
    game.movement.coyote=0;game.player.grounded=false;game.player.vy=-2;tap('Space');assert.ok(game.player.vy<0,'no double jump');
    movementDeck();game.player.pos.z=25.1;key('KeyW');for(let i=0;i<30&&game.player.grounded;i++)step(1/hz,hz);assert.equal(game.player.grounded,false);tap('Space');assert.ok(game.player.vy>0,'a late ledge press still jumps');
  }
  assert.ok(Math.max(...peaks)-Math.min(...peaks)<.09,'peak should not depend on frame rate');
});
test('crouching and sliding lower actual hit targets and bot aim without making the player invulnerable',()=>{
  movementDeck();const origin=new THREE.Vector3(0,22,43),direction=new THREE.Vector3(0,0,1);
  assert.equal(game.actorHit(origin,direction,10,null)?.actor,game.player);tap('KeyC');assert.equal(game.actorHit(origin,direction,10,null),null,'high shot passes above crouch');
  origin.y=20.9;assert.equal(game.actorHit(origin,direction,10,null)?.actor,game.player,'low shot can still hit');
  const a=game.actors[0];a.pos.set(0,20,40);game.botController.reset(a,'hard');a.walkYaw=Math.PI;game.player.shield=100;
  botShot(a,new THREE.Vector3(0,20.95,48));assert.ok(game.player.shield<100);
});
test('pause freezes movement timers and replay clears crouch, slide and queued jumps',()=>{
  movementDeck();key('ShiftLeft');key('KeyW');step(.4);tap('KeyC');const slideBefore=snapshot().movement.slideLeft;game.pause();const p=snapshot();assert.equal(p.movement.slideLeft,slideBefore);step(2);assert.deepEqual(snapshot().position,p.position);assert.deepEqual(snapshot().movement,p.movement);
  game.start('practice');assert.equal(snapshot().movement.stance,'standing');assert.equal(snapshot().movement.slideLeft,0);assert.equal(snapshot().movement.speed,0);step(.3);assert.ok(game.player.grounded);
});

test('bots aim at the crouched body and lose sight of it behind low cover',()=>{
  // Median RNG zeroes the shot spread, which exceeds the .17 m headroom above the torso once the bot backs off to ~12 m. afterEach restores Math.random.
  movementDeck();const a=game.actors[0];a.pos.set(0,20,40);game.botController.rng=()=>.5;game.botController.reset(a,'hard');a.walkYaw=Math.PI;game.player.noiseTime=-100;
  const slab=testBox(4,1.3,.3,0,20.65,44);game.world.scene?.updateMatrixWorld(true);slab.updateWorldMatrix(true,true);
  assert.equal(game.botController.visible(a,game.player,DIFFICULTIES.hard),true);tap('KeyC');assert.equal(game.botController.visible(a,game.player,DIFFICULTIES.hard),false);
  game.world.removeBuild(game.world.obstacles.find(o=>o.mesh===slab));let aimed;
  const fire=game.botController.callbacks.fire;
  try{game.botController.callbacks.fire=(actor,target)=>{aimed=target.clone();};game.setElapsed(10);game.player.shield=100;for(let i=0;i<90;i++)game.botController.update(1/60,10+i/60,game.player,[a]);assert.ok(aimed);assert.ok(aimed.y<21.15&&aimed.y>20.7,'live bot fire aims at lowered torso');}
  finally{game.botController.callbacks.fire=fire;}
});
