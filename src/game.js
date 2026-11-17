import * as THREE from 'three';
import { RULES, WEAPONS, PARTY_COLORS, DIFFICULTIES, difficultyKey, clamp, applyDamage } from './config.js';
import { World, box, ball, mat } from './world.js';
import { createActor } from './actor.js';
import { Sound } from './audio.js';
import { Navigation } from './navigation.js';
import { BUILD, PIECES, computeBuildPlacement } from './building.js';
import { createWeaponModel } from './weapon-models.js';
import { Gumballs } from './projectiles.js';
import { BotController } from './bots.js';
import { surface, batchDecorations } from './materials.js';
import { FrameMeter, graphicsProfile, qualityKey, renderPixelRatio } from './graphics.js';
import { natureAssets, prepareNatureAssets, natureTextureDiagnostics, natureTextureSet, disposeNatureAssets } from './nature-assets.js';
import { assertShaderRevision, shaderDiagnostics } from './shader-patches.js';
import { ResourceScope, captureSceneResources } from './resource-scope.js';
import { RenderProfiler } from './render-profiler.js';
import { disposeFoliageTemplates } from './nature-foliage.js';
import { disposeCoastalGeometry, coastalGeometryDiagnostics } from './coastal-geometry.js';
import { supportsSceneHDR } from './render-targets.js';
import { NatureRenderer } from './nature-renderer.js';
import { focusSunShadow } from './sun-shadows.js';
import { Movement, bodyHeight } from './movement.js';
import { prepareAuthoredModels } from './authored-models.js';
import { DOCKS_LIGHTING } from './docks-lighting.js';
import { MAPS,mapKey,SUNHAVEN_ROUTES } from './maps.js';
import { spawnLayout,supplySites } from './map-match.js';
const mapParams=new URLSearchParams(globalThis.location?.search||'');
const selectedMap=mapKey(mapParams.get('map')||(__SUNSPARK_TEST__?'breezy':'sunhaven')); 

const $=id=>document.getElementById(id),show=(id,on=true)=>$(id).classList.toggle('hidden',!on),fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const canvas=$('game'),sound=new Sound();
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){show('error');$('error-text').textContent='This game needs WebGL. Try opening it in a recent Chrome or Edge browser with graphics acceleration turned on.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
// During play, shadow casters and their receivers must use the same frame's
// pose. Throttling this pass makes an animated body receive its old shadow.
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;let nextShadow=0;
// Count the whole frame, including a coastal reflection when one is rendered.
renderer.info.autoReset=false;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb7d8e2);scene.fog=new THREE.Fog(0xb7d8e2,95,280);
scene.add(new THREE.HemisphereLight(0xc4e2ff,0x8c9764,.55));const sun=new THREE.DirectionalLight(0xffedce,2.6);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:190});sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
if(selectedMap==='sunhaven'){const light=DOCKS_LIGHTING;renderer.toneMappingExposure=light.exposure;sun.color.set(light.sunColor);sun.intensity=light.sunIntensity;const hemi=scene.children.find(o=>o.isHemisphereLight);hemi.color.set(light.skyColor);hemi.groundColor.set(light.groundColor);hemi.intensity=light.hemisphereIntensity;}
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.1,600),world=new World(scene,selectedMap),player=createActor(scene),navigation=new Navigation(world);
let environmentTarget;
if(renderer.isWebGLRenderer&&supportsSceneHDR(renderer)){const generator=new THREE.PMREMGenerator(renderer),environmentScene=new THREE.Scene();environmentScene.add(world.sky.clone());environmentTarget=generator.fromScene(environmentScene,.04,.1,1000);scene.environment=environmentTarget.texture;scene.environmentIntensity=selectedMap==='sunhaven'?DOCKS_LIGHTING.environmentIntensity:.3;generator.dispose();}
const natureRenderer=new NatureRenderer(renderer);
assertShaderRevision();
const renderProfiler=new RenderProfiler(renderer);
const startup={ready:!renderer.isWebGLRenderer,phase:renderer.isWebGLRenderer?'loading':'ready',error:null,loadedMs:null};
let stopped=false,pendingStart=null;
const ray=new THREE.Raycaster(),v=new THREE.Vector3(),dir=new THREE.Vector3(),right=new THREE.Vector3(),camGoal=new THREE.Vector3(),camTarget=new THREE.Vector3();
const keys=new Set(),inputUntil=new Map(),particles=[],tracers=[],actors=[];
const held=code=>keys.has(code)||(inputUntil.get(code)||0)>globalTime;
let state='title',mode='practice',difficulty='easy',settingsFrom='title',sensitivity=.75,yaw=0,pitch=-.08,mouseDown=false,aim=false,elapsed=0,globalTime=0,lastTime=performance.now(),weapon=0,ammo=WEAPONS.map(w=>w.magazine),reserve=WEAPONS.map(w=>w.reserve),shotCooldown=0,reloadLeft=0,toastLeft=0,announceLeft=0,hitLeft=0,damageLeft=0,pops=0,buildCount=0,wood=RULES.startingWood,buildMode=null,matchId=0;
let pointerFallback=false,lastSnapshot={},fps=null,lastGameplayFPS=null,quality='balanced',showFPS=true,graphicsFrom='game';
const frameMeter=new FrameMeter();
let slideDust=0;
let selectedPiece='wall',buildRotation=0;
let loadout=[0,1],activeSlot=0,charging=false,chargeTime=0,nearbyWeapon=null,pickupCooldown=0,lastWeaponHit=null;
let lastCoverHit=null,coverStatus=null;
const weaponLabels=new Map();
const gumballs=new Gumballs(scene,{
  heightAt:world.heightAt,environment:terrainHit,actor:(o,d,r)=>actorHit(o,d,r,player,.99),
  hit:(actor,damage,point,color)=>{hitActor(actor,damage);weaponFeedback(damage,3);particleBurst(point,color,7);},
  impact:(hit,color,bounced)=>{particleBurst(hit.point,color,5);damageBuild(hit.object,WEAPONS[3].damage);if(bounced)sound.play('bounce');}
});
const botController=new BotController(world,navigation,{environment:terrainHit,fire:fireBot,build:buildBot});
const movement=new Movement(player,world);
const pickups=[],feed=[];
let pickupSpawn=0,stormWarned=false,lastDamage=-100,practiceRespawn=0,buildPreview=null,placement=null;player.noiseTime=-100;player.name='You';
const stormMesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,50,100,1,true),new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){float wisps=sin(vUv.x*110.+sin(vUv.y*18.-time*.3)*2.+time*.16)*.5+.5;float falloff=pow(1.-smoothstep(.04,.78,vUv.y),2.);float edge=pow(1.-vUv.y,9.);float a=falloff*(.07+wisps*.07)+edge*.24;gl_FragColor=vec4(mix(vec3(.42,.30,.77),vec3(.71,.66,1.),edge),a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));stormMesh.position.y=22;stormMesh.visible=false;scene.add(stormMesh);
const stormRing=new THREE.Mesh(new THREE.RingGeometry(.989,1,128),new THREE.MeshBasicMaterial({color:0xc6a0ff,side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false}));stormRing.rotation.x=-Math.PI/2;stormRing.position.y=10.2;stormRing.visible=false;scene.add(stormRing);

function toast(message){$('toast').textContent=message;toastLeft=2.8;}
function announce(title,body,seconds=4){$('announce-title').textContent=title;$('announce-body').textContent=body;announceLeft=seconds;}
function forward(){return dir.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));}
function lock(){sound.init();canvas.focus();const fallback=()=>{pointerFallback=true;show('capture',false);toast('Hold right mouse + drag to look. Left click fires.');};if(pointerFallback)return;try{if(!canvas.requestPointerLock){fallback();return;}const p=canvas.requestPointerLock();p?.catch(fallback);}catch{fallback();}}
function cancelCharge(){charging=false;chargeTime=0;sound.charge(false);}
function clearInput(){keys.clear();inputUntil.clear();mouseDown=false;aim=false;movement.clearInput();cancelCharge();}
function navigateMap(key,autoplay=''){const url=new URL(location.href);url.searchParams.set('map',key);url.searchParams.delete('scenario');if(autoplay)url.searchParams.set('autoplay',autoplay);else url.searchParams.delete('autoplay');location.assign(url.href);}
function start(which='match',keepMap=false){
  if(!startup.ready){pendingStart={which,keepMap};return;}
  if(which==='practice'&&!keepMap&&!__SUNSPARK_TEST__&&world.map.id!=='breezy'){navigateMap('breezy','practice');return;}
  mode=which;matchId++;world.matchSeed=matchId;state='playing';elapsed=0;pops=0;buildCount=0;wood=RULES.startingWood;loadout=[0,1];activeSlot=0;weapon=0;ammo=WEAPONS.map(w=>w.magazine);reserve=WEAPONS.map(w=>w.reserve);reloadLeft=0;shotCooldown=0;buildMode=null;nearbyWeapon=null;pickupCooldown=0;lastWeaponHit=null;clearInput();gumballs.clear();
  selectedPiece='wall';buildRotation=0;lastCoverHit=null;coverStatus=null;show('cover-status',false);world.resetBuilds();navigation.refresh();clearPreview();for(const a of actors)disposeGroup(a.root);actors.length=0;
  for(const p of pickups)disposeGroup(p.group);pickups.length=0;feed.length=0;stormWarned=false;lastDamage=-100;pickupSpawn=0;practiceRespawn=0;hitLeft=0;damageLeft=0;player.noiseTime=-100;player.name='You';slideDust=0;
  for(const p of particles){p.m.removeFromParent();p.m.geometry.dispose();}particles.length=0;
  for(const t of tracers){t.line.removeFromParent();t.line.geometry.dispose();t.line.material.dispose();}tracers.length=0;
  let layout=null;if(world.map.id==='sunhaven')layout=spawnLayout(world,matchId,(a,b)=>{const from=new THREE.Vector3(a.x,a.y+1.5,a.z),to=new THREE.Vector3(b.x,b.y+1.5,b.z),delta=to.sub(from);return !!terrainHit(from,delta.clone().normalize(),delta.length());});
  movement.reset();player.alive=true;player.health=100;player.shield=100;if(layout)player.pos.set(layout.player.x,layout.player.y,layout.player.z);else player.pos.set(0,world.heightAt(0,42),42);player.vy=0;player.grounded=true;player.walkCycle=0;player.recoil=0;player.flash=0;player.root.visible=true;yaw=0;pitch=-.07;player.animate(0,0,0);setWeaponAppearance();toastLeft=0;$('toast').textContent='';
  if(mode==='practice'){
    const target=createActor(scene,0xf18caa,true);target.pos.set(0,world.heightAt(0,26),26);target.spawnPos=target.pos.clone();target.name='Practice pal';target.health=100;target.shield=0;actors.push(target);
  }else spawnBots(layout?.bots);
  spawnPickups();stormMesh.visible=stormRing.visible=mode==='match';
  for(const id of ['title','pause','result','settings','graphics'])show(id,false);show('hud');$('feed').innerHTML='';
  $('mode-label').textContent=mode==='practice'?'PLAYGROUND':`${difficulty.toUpperCase()} SOLO`;
  announce('HELLO, SUNSHINE.',mode==='practice'?(world.map.id==='sunhaven'?'Explore five districts. C crouches, sprint + C slides, B builds.':'Try all four blasters beside you! Walk near one and press E to swap.'):'Find a new blaster! E swaps your selected slot. B opens build mode.',5);
  lastGameplayFPS=null;resetFPS();updateCamera(.016,true);updateHUD();lock();
}
function pause(){if(state!=='playing')return;state='paused';clearInput();document.exitPointerLock?.();show('pause');show('capture',false);updatePerformanceHUD();syncDiagnostics();}
function resume(){state='playing';show('pause',false);lastTime=performance.now();resetFPS();clearInput();lock();}
function menu(){state='title';clearInput();gumballs.clear();buildMode=null;clearPreview();document.exitPointerLock?.();for(const id of ['hud','pause','settings','result','graphics'])show(id,false);show('title');player.root.visible=false;actors.forEach(a=>a.root.visible=false);world.resetBuilds();stormMesh.visible=stormRing.visible=false;$('storm-tint').style.opacity=0;$('damage-flash').style.opacity=0;syncDiagnostics();}
function reload(){cancelCharge();if(reloadLeft>0)return;if(ammo[weapon]>=WEAPONS[weapon].magazine){toast('Magazine already full.');return;}if(reserve[weapon]<=0){toast('No reserve ammo — find a yellow ammo pickup!');return;}reloadLeft=WEAPONS[weapon].reload;sound.play('reload',weapon);}
function setWeaponAppearance(){
  player.gun.visible=!buildMode;
  if(player.weaponIndex!==weapon){disposeGroup(player.weaponModel);const model=createWeaponModel(weapon);player.gun.add(model.group);player.weaponModel=model.group;player.muzzle=model.muzzle;player.weaponIndex=weapon;}
}
function equip(index){activeSlot=index;weapon=loadout[index];reloadLeft=0;cancelCharge();buildMode=null;clearPreview();mouseDown=false;setWeaponAppearance();sound.tone(450,.06,'sine',.13,650);}
function particleBurst(point,color,count=12){for(let i=0;i<count;i++){const m=box(.09,.09,.09,color,point.x,point.y,point.z,scene);m.castShadow=false;particles.push({m,vel:new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*4,(Math.random()-.5)*5),life:.5+Math.random()*.4,max:.9});}}
function trace(from,to,color,life=.10){const geo=new THREE.BufferGeometry().setFromPoints([from.clone(),to.clone()]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:1}));scene.add(line);tracers.push({line,life,max:life});}
function terrainHit(origin,direction,maxDistance){
  ray.set(origin,direction);ray.far=maxDistance;const solid=ray.intersectObjects(world.solids.filter(m=>m!==world.ground),false)[0],limit=solid?solid.distance:maxDistance;
  const ground=world.ground.userData.heightfield.raycast(origin,direction,limit);
  return ground?{object:world.ground,distance:ground.distance,point:new THREE.Vector3(ground.point.x,ground.point.y,ground.point.z)}:solid;
}
function actorHit(origin,direction,maxDistance,exclude,radius=.83){
  let best=null,dist=maxDistance;const r=new THREE.Ray(origin,direction);
  for(const a of [player,...actors]){
    if(!a.alive||a===exclude||!a.root.visible)continue;
    const center=a.pos.clone().add(new THREE.Vector3(0,bodyHeight(a),0)),hit=r.intersectSphere(new THREE.Sphere(center,a.height<RULES.playerHeight?Math.min(radius,a.height*.37):radius),new THREE.Vector3());if(!hit)continue;
    const d=hit.distanceTo(origin);if(d>=dist)continue;
    // Generous hit spheres keep aiming approachable, but their outer edge can
    // overlap cover. The body must also be visible from the shot's origin;
    // otherwise a grazing ray can hit the enlarged sphere around a wall corner.
    const body=center.clone().sub(origin),length=body.length();
    if(length>.001&&terrainHit(origin,body.divideScalar(length),length))continue;
    dist=d;best={actor:a,distance:d,point:hit};
  }
  return best;
}
function hitActor(a,damage,source=player,bypassShield=false){
  if(!a.alive)return;a.flash=.15;const result=applyDamage(a,damage,bypassShield);
  if(source&&a!==player){a.stagger=.12;botController.hurt(a,source);}
  if(!bypassShield)particleBurst(a.pos.clone().add(new THREE.Vector3(0,1.7,0)),result.absorbed?0x81f5f5:0xffe675,source===player?5:2);
  if(a===player){lastDamage=elapsed;damageLeft=.25;if(damage>1)sound.play('hurt');}
  if(result.eliminated){
    if(a===player)player.finalPlace=actors.filter(b=>b.alive).length+1;
    a.alive=false;a.root.visible=false;
    if(a!==player){if(source===player){pops++;sound.play('pop');toast(`${a.name} popped! +20 wood`);wood=Math.min(RULES.maxWood,wood+20);}particleBurst(a.pos.clone().add(new THREE.Vector3(0,1.3,0)),0xffa5cc,24);addFeed(`${source===player?'You':source?.name||'The storm'} popped ${a.name}`);dropPickup('ammo',a.pos.x,a.pos.z);dropPickup('shield',a.pos.x+1.2,a.pos.z);if(mode==='practice')practiceRespawn=1.8;}
  }
}
function weaponFeedback(damage,index){sound.play('hit');hitLeft=.25;$('hit-number').textContent=Math.round(damage);lastWeaponHit={weapon:index,damage,elapsed};}
function shoot(charged=false){
  if(buildMode){placeBuild();return;}
  if(shotCooldown>0||reloadLeft>0)return;
  const w=WEAPONS[weapon];if(ammo[weapon]<=0){reload();if(!reloadLeft){sound.play('empty');shotCooldown=.4;}return;}
  if(w.charge&&!charged){if(!charging){charging=true;chargeTime=0;sound.charge(true);}return;}
  cancelCharge();ammo[weapon]--;shotCooldown=w.interval;player.recoil=1;sound.play('shot',weapon);botController.noise(player,elapsed);
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);ray.setFromCamera(new THREE.Vector2(0,0),camera);const viewOrigin=ray.ray.origin.clone(),viewDir=ray.ray.direction.clone();
  let env=terrainHit(viewOrigin,viewDir,w.range),max=env?env.distance:w.range;let found=actorHit(viewOrigin,viewDir,max,player);let target=found?found.actor.pos.clone().add(new THREE.Vector3(0,1.3,0)):(env?env.point:viewOrigin.clone().addScaledVector(viewDir,w.range));
  // Soft aim assistance catches close crosshair misses, but never reaches through cover.
  if(!found){let nearest=DIFFICULTIES[difficulty].assist*(aim?1:.8);for(const a of actors){if(!a.alive)continue;const point=a.pos.clone().add(new THREE.Vector3(0,1.3,0)),delta=point.clone().sub(viewOrigin),d=delta.length(),angle=viewDir.angleTo(delta);if(d<w.range&&angle<nearest&&!terrainHit(viewOrigin,delta.normalize(),d-.8)){nearest=angle;target=point;}}}
  const muzzle=player.muzzle.getWorldPosition(new THREE.Vector3()),base=target.clone().sub(muzzle).normalize();let damageDone=0;
  // Resolve an obstruction between the body and an extended barrel before
  // spawning a projectile or firing a ray; long barrels cannot poke through cover.
  const chest=player.pos.clone().add(new THREE.Vector3(0,bodyHeight(player),0)),barrel=muzzle.clone().sub(chest),barrelHit=terrainHit(chest,barrel.clone().normalize(),barrel.length());
  if(barrelHit){particleBurst(barrelHit.point,w.color,4);damageBuild(barrelHit.object,w.damage);return;}
  if(weapon===3){gumballs.launch(muzzle,base);particleBurst(muzzle,PARTY_COLORS[gumballs.serial%5],3);return;}
  const pushed=new Set();
  if(__SUNSPARK_TEST__)window.__shotDebug={viewOrigin:viewOrigin.toArray(),viewDir:viewDir.toArray(),target:target.toArray(),muzzle:muzzle.toArray(),found:found?.actor.name,viewEnvironment:env?.distance};
  for(let i=0;i<w.pellets;i++){
    const shot=base.clone();if(i>0||w.pellets===1){const spread=w.spread*(aim?.4:1);shot.x+=(Math.random()-.5)*spread;shot.y+=(Math.random()-.5)*spread;shot.z+=(Math.random()-.5)*spread;shot.normalize();}
    const hitEnv=terrainHit(muzzle,shot,w.range),limit=hitEnv?hitEnv.distance:w.range,hit=actorHit(muzzle,shot,limit,player);let end=hit?hit.point:(hitEnv?hitEnv.point:muzzle.clone().addScaledVector(shot,w.range));
    if(__SUNSPARK_TEST__)Object.assign(window.__shotDebug,{limit,hit:hit?.actor.name,end:end.toArray(),ground:hitEnv?.object===world.ground});
    if(hit){const damage=w.damage*(weapon===1?clamp(1-hit.distance/42,.3,1):1);hitActor(hit.actor,damage);damageDone+=damage;if(weapon===1&&hit.distance<14)pushed.add(hit.actor);}
    else if(hitEnv){particleBurst(end,w.color,2);damageBuild(hitEnv.object,w.damage);}
    if(weapon===2){const side=new THREE.Vector3().crossVectors(base,new THREE.Vector3(0,1,0)).normalize();for(let c=0;c<5;c++){const offset=side.clone().multiplyScalar((c-2)*.045);trace(muzzle.clone().add(offset),end.clone().add(offset),PARTY_COLORS[c],.23);}}
    else trace(muzzle,end,weapon===1?PARTY_COLORS[i%5]:w.color,weapon===1?.14:.11);
  }
  for(const a of pushed){const push=a.pos.clone().sub(player.pos);push.y=0;push.normalize();for(let n=0;n<6;n++)world.move(a,push.x*.14,push.z*.14);a.stagger=.3;}
  if(weapon===1)for(const color of PARTY_COLORS)particleBurst(muzzle,color,2);else particleBurst(muzzle,w.color,4);
  if(damageDone)weaponFeedback(damageDone,weapon);
  // Empty magazines reload on the simulation clock, so pause and rematch cannot leak timers.
}
function updatePlayer(dt){
  yaw+=((held('ArrowRight')?1:0)-(held('ArrowLeft')?1:0))*1.4*dt;pitch=clamp(pitch+((held('ArrowUp')?1:0)-(held('ArrowDown')?1:0))*1.1*dt,-.9,.68);
  const f=new THREE.Vector2(Math.sin(yaw),-Math.cos(yaw)),r=new THREE.Vector2(Math.cos(yaw),Math.sin(yaw)),move=new THREE.Vector2();
  if(held('KeyW'))move.add(f);if(held('KeyS'))move.sub(f);if(held('KeyD'))move.add(r);if(held('KeyA'))move.sub(r);
  for(const event of movement.update(dt,{x:move.x,z:move.y,sprint:held('ShiftLeft')||held('ShiftRight'),aim:aim&&!buildMode,jumpHeld:held('Space')}))sound.play(event);
  if(world.map.id==='sunhaven'&&player.pos.y<-.6){
    const shore=botController.groundGoal(player.pos.x,player.pos.z);player.pos.copy(shore);movement.reset();player.vy=0;player.grounded=true;toast('Back on dry land! Take the boardwalk around the cove.');
  }
  player.animate(dt,movement.speed,-yaw,aim&&!buildMode,{reload:reloadLeft>0?1-reloadLeft/WEAPONS[weapon].reload:0,charge:charging?chargeTime/WEAPONS[weapon].charge:0,time:globalTime});
  slideDust-=dt;
  if(player.stance==='sliding'&&player.grounded&&movement.speed>4&&slideDust<=0){
    slideDust=.07;
    for(const side of [-1,1]){const m=ball(.10,0xe7dabb,player.pos.x+Math.cos(yaw)*side*.35,player.pos.y+.12,player.pos.z+Math.sin(yaw)*side*.35,scene,1);m.castShadow=false;particles.push({m,vel:new THREE.Vector3(-movement.vx*.13,1.2,-movement.vz*.13),life:.26,max:.26});}
  }
  if(mouseDown&&!buildMode)shoot();
}
function updateCamera(dt,snap=false){
  const direction=forward().clone();right.set(Math.cos(yaw),0,Math.sin(yaw));const anchor=player.pos.clone().add(new THREE.Vector3(0,1.85-(RULES.playerHeight-player.poseHeight)*.85-movement.landing*.08,0));
  const aiming=aim&&!buildMode,distance=aiming?3.5:6.7;camGoal.copy(anchor).addScaledVector(direction,-distance).addScaledVector(right,aiming?.72:1.05);camGoal.y+=aiming?.35:.85;
  const delta=camGoal.clone().sub(anchor),len=delta.length();const collision=terrainHit(anchor,delta.normalize(),len);if(collision)camGoal.copy(anchor).addScaledVector(delta,Math.max(.08,collision.distance-.3));
  camGoal.y=Math.max(camGoal.y,world.heightAt(camGoal.x,camGoal.z)+.5);camera.position.lerp(camGoal,snap?1:1-Math.exp(-18*dt));
  // Smoothing must not leave the lens inside a nearby wall while it pulls in.
  if(collision){const actual=camera.position.clone().sub(anchor),distance=actual.length(),hit=terrainHit(anchor,actual.normalize(),distance);if(hit)camera.position.copy(anchor).addScaledVector(actual,Math.max(.08,hit.distance-.3));}
  player.body.visible=camera.position.distanceTo(anchor)>2.25;
  camTarget.copy(anchor).addScaledVector(direction,35);camera.lookAt(camTarget);camera.fov=THREE.MathUtils.lerp(camera.fov,aiming?(weapon===2?40:49):player.stance==='sliding'?67:movement.speed>8?65:62,1-Math.exp(-12*dt));camera.updateProjectionMatrix();
}
function updateHUD(){
  const stance=player.stance,ready=movement.cooldown===0&&movement.speed>7.5;
  $('movement-state').textContent=stance==='sliding'?'SLIDING':stance==='crouching'?'CROUCHING':!player.grounded?'AIRBORNE':ready?'SPRINTING':'ON YOUR FEET';
  $('movement-help').textContent=stance==='sliding'?'Space · Jump out   /   C · Brake':stance==='crouching'?'C · Stand when clear':ready?'C · Slide':'C · Crouch   /   Shift + move, then C · Slide';
  $('movement-status').dataset.stance=stance;
  $('health-value').textContent=Math.ceil(player.health);$('shield-value').textContent=Math.ceil(player.shield);$('health-bar').style.width=`${player.health}%`;$('shield-bar').style.width=`${player.shield}%`;
  $('remaining').textContent=mode==='practice'?'∞':1+actors.filter(a=>a.alive).length;$('elims').textContent=pops;$('ammo').textContent=ammo[weapon];$('reserve').textContent=reserve[weapon];$('weapon-name').textContent=WEAPONS[weapon].name.toUpperCase();$('wood').textContent=wood;
  $('reload-hint').textContent=reloadLeft>0?'RELOADING…':ammo[weapon]===WEAPONS[weapon].magazine?'MAGAZINE FULL':reserve[weapon]>0?'R RELOAD':'NO RESERVE AMMO';
  for(let i=0;i<2;i++){const w=WEAPONS[loadout[i]];$('slot-'+i).classList.toggle('selected',activeSlot===i&&!buildMode);$('slot-icon-'+i).textContent=w.icon;$('slot-icon-'+i).style.color='#'+w.color.toString(16).padStart(6,'0');$('slot-name-'+i).textContent=w.short;}
  $('weapon-role').textContent=WEAPONS[weapon].role;$('weapon-use').textContent=WEAPONS[weapon].hint;
  show('charge-panel',charging&&!buildMode);$('charge-fill').style.width=`${charging?chargeTime/WEAPONS[weapon].charge*100:0}%`;$('charge-text').textContent=`PRISM CHARGING ${Math.round(charging?chargeTime/WEAPONS[weapon].charge*100:0)}%`;
  show('pickup-hint',!!nearbyWeapon&&!buildMode);$('hud').classList.toggle('has-pickup',!!nearbyWeapon&&!buildMode);
  if(nearbyWeapon){const w=WEAPONS[nearbyWeapon.weapon],carried=loadout.indexOf(nearbyWeapon.weapon);$('pickup-name').textContent=w.name.toUpperCase();$('pickup-role').textContent=w.role+' · '+w.hint;$('pickup-action').textContent=carried>=0?`E · Equip your slot ${carried+1} ${w.short}`:`E · Replace slot ${activeSlot+1}: ${WEAPONS[weapon].short}`;}
  show('gun-ammo',!buildMode);show('gun-slots',!buildMode);show('build-slots',!!buildMode);show('build-mode-label',!!buildMode);
  for(const kind of PIECES)$('build-'+kind).classList.toggle('selected',kind===buildMode);
  $('build-toggle-hint').textContent=buildMode?'Back to blaster':'Build mode';
  $('hud').classList.toggle('building',!!buildMode);
  $('crosshair').classList.toggle('aim',aim&&!buildMode);$('action-message').textContent=mode==='match'&&outsideStorm(player.pos)?'IN THE STORM! Follow the arrow to the safe circle.':reloadLeft>0?`Reloading… ${reloadLeft.toFixed(1)}s`:'';
  const storm=world.stormAt(elapsed);$('storm-label').textContent=mode==='practice'?'STORM':storm.phase==='waiting'?'STORM IN':'STORM CLOSING';$('storm-time').textContent=mode==='practice'?'OFF':fmt(storm.remaining);
  const district=world.map.districts.reduce((a,b)=>Math.hypot(b.x-player.pos.x,b.z-player.pos.z)<Math.hypot(a.x-player.pos.x,a.z-player.pos.z)?b:a,{name:world.map.name,x:1e6,z:1e6});$('map-name').textContent=district.name.toUpperCase();
  show('safe-arrow',mode==='match'&&outsideStorm(player.pos));$('safe-arrow-icon').style.transform=`rotate(${Math.atan2(storm.x-player.pos.x,-(storm.z-player.pos.z))-yaw}rad)`;
  $('heading').textContent=['N','NE','E','SE','S','SW','W','NW'][((Math.round(yaw/(Math.PI/4))%8)+8)%8];
  $('hitmarker').style.opacity=hitLeft>0?1:0;$('hit-number').style.opacity=hitLeft>0?1:0;$('toast').style.opacity=toastLeft>0?1:0;$('announce').style.opacity=announceLeft>0?1:0;
  $('damage-flash').style.opacity=damageLeft>0?damageLeft/.25:0;drawMap();syncDiagnostics();
}
function drawMap(){const c=$('minimap').getContext('2d'),s=190/(world.map.radius*2+10),cx=95,cz=95;c.clearRect(0,0,190,190);c.fillStyle='#50baca';c.fillRect(0,0,190,190);c.fillStyle='#ead99b';c.beginPath();c.arc(cx,cz,world.map.radius*s,0,Math.PI*2);c.fill();c.fillStyle='#79b76a';c.beginPath();c.arc(cx,cz,world.map.grassRadius*s,0,Math.PI*2);c.fill();
  for(const o of world.obstacles){c.fillStyle=o.kind==='build'?'#e6b571':'#507868';const b=o.box;c.fillRect(cx+b.min.x*s,cz+b.min.z*s,Math.max(2,(b.max.x-b.min.x)*s),Math.max(2,(b.max.z-b.min.z)*s));}
  if(world.map.id==='sunhaven'){
    c.strokeStyle='#c9b58a';c.lineWidth=2;for(const route of SUNHAVEN_ROUTES){c.beginPath();route.forEach(([x,z],i)=>i?c.lineTo(cx+x*s,cz+z*s):c.moveTo(cx+x*s,cz+z*s));c.stroke();}
    c.fillStyle='#366978';c.beginPath();c.ellipse(cx+98*s,cz+26*s,8*s,16*s,0,0,Math.PI*2);c.fill();
    for(const d of world.map.districts){c.fillStyle='#f8eac3';c.beginPath();c.arc(cx+d.x*s,cz+d.z*s,3,0,Math.PI*2);c.fill();}
  }
  if(mode==='match'){const zone=world.stormAt(elapsed),r=zone.radius*s,x=cx+zone.x*s,z=cz+zone.z*s;c.fillStyle='#954ece88';c.beginPath();c.rect(0,0,190,190);c.arc(x,z,r,0,Math.PI*2,true);c.fill('evenodd');c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.arc(x,z,r,0,Math.PI*2);c.stroke();
    if(world.map.id==='sunhaven'){c.setLineDash([3,3]);c.lineWidth=1;c.beginPath();c.arc(cx+zone.next.x*s,cz+zone.next.z*s,zone.next.radius*s,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  }
  for(const p of pickups){c.fillStyle=p.type==='ammo'?'#ffe36d':p.type==='health'?'#fc9b96':'#a0edff';c.fillRect(cx+p.x*s-1,cz+p.z*s-1,2,2);}
  for(const a of actors)if(a.alive&&(difficulty==='easy'||a.pos.distanceTo(player.pos)<28)){c.fillStyle='#ed8779';c.beginPath();c.arc(cx+a.pos.x*s,cz+a.pos.z*s,2.8,0,Math.PI*2);c.fill();}
  c.save();c.translate(cx+player.pos.x*s,cz+player.pos.z*s);c.rotate(yaw);c.fillStyle='#ffffff';c.strokeStyle='#193e50';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-6);c.lineTo(4.5,5);c.lineTo(0,3);c.lineTo(-4.5,5);c.closePath();c.fill();c.stroke();c.restore();
}
function effects(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vel.y-=10*dt;p.m.position.addScaledVector(p.vel,dt);p.m.rotation.x+=dt*5;p.m.scale.setScalar(Math.max(.01,p.life/p.max));if(p.life<=0){p.m.removeFromParent();p.m.geometry.dispose();particles.splice(i,1);}}for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;t.line.material.opacity=t.life/t.max;if(t.life<=0){t.line.removeFromParent();t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1);}}}

function disposeGroup(group){group.removeFromParent();group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.userData.owned)o.material.dispose();});}
function addFeed(message){feed.unshift({message,time:elapsed});feed.length=Math.min(feed.length,3);$('feed').replaceChildren(...feed.map(f=>{const d=document.createElement('div');d.textContent=f.message;return d;}));}
function spawnBots(spawns){
  const names=['Peach','Pebble','Mochi','Sprout','Fizz','Noodle','Pippin','Bubbles','Sunny','Kiwi','Poppy','Tango'],colors=[0xf38eae,0x88a4e1,0xcba1e5,0x74b957,0xee9667,0x72cbcd,0xebbc65,0x81bce7],points=[[7,23],[-17,35],[33,5],[-40,-6],[27,-37],[-16,-43],[43,32],[-43,32]],d=DIFFICULTIES[difficulty];
  for(let i=0;i<(spawns?spawns.length:8);i++){
    const a=createActor(scene,colors[i%colors.length],true);let [x,z]=points[(i+matchId-1)%8];if(spawns){x=spawns[i].x;z=spawns[i].z;}else{x+=(Math.random()-.5)*5;z+=(Math.random()-.5)*5;}
    if(!spawns&&!navigation.free(x,z)){const path=navigation.path({x:0,z:42},{x,z});const p=path.at(-1)||{x:5+i*2,z:20};x=p.x;z=p.z;}
    a.pos.set(x,spawns?spawns[i].y:world.heightAt(x,z),z);a.name=names[i];a.health=d.health;a.shield=d.shield;botController.reset(a,difficulty);a.walkYaw=Math.atan2(a.pos.x-player.pos.x,a.pos.z-player.pos.z);actors.push(a);
  }
}
function updateBots(dt){
  if(mode==='practice'){
    for(const a of actors)if(a.alive)a.animate(dt,0,Math.PI);
    if(practiceRespawn>0){practiceRespawn-=dt;if(practiceRespawn<=0){const a=actors[0];a.health=100;a.shield=0;a.alive=true;a.root.visible=true;a.pos.copy(a.spawnPos);}}
    return;
  }
  botController.update(dt,elapsed,player,actors);
}
function fireBot(a,point,d){
  const from=a.pos.clone().add(new THREE.Vector3(0,1.45,0)),direction=point.clone().sub(from).normalize(),env=terrainHit(from,direction,d.vision+5),limit=env?env.distance:d.vision+5,hit=actorHit(from,direction,limit,a);
  const end=hit?hit.point:(env?env.point:from.clone().addScaledVector(direction,limit));trace(from,end,0xffa581,.12);a.recoil=1;
  if(a.pos.distanceTo(player.pos)<35)sound.tone(260,.08,'triangle',.05,80);
  if(hit){a.stats.hits++;hitActor(hit.actor,d.damage*(hit.actor===player?1:.75),a);}else if(env){damageBuild(env.object,d.damage);particleBurst(end,0xffd189,2);}
}
function buildBot(a,kind,yaw){
  const p=computeBuildPlacement(world,{kind,position:a.pos,yaw,wood:a.wood,actors:[player,...actors]});if(!p.valid)return null;
  const b=constructBuild(p,a);particleBurst(new THREE.Vector3(p.x,p.y+.5,p.z),0x9aefd6,6);if(a.pos.distanceTo(player.pos)<25)sound.play('build');navigation.refresh();return b;
}
function spawnPickups(){
  if(world.map.id==='sunhaven'){for(const p of supplySites(world,matchId,player.pos)){if(p.type==='weapon')dropWeapon(p.weapon,p.x,p.z,true);else dropPickup(p.type,p.x,p.z,true);}return;}
  const spots=[['ammo',-3,37],['shield',3,37],['wood',-4,32],['health',4,32],['ammo',-13,-6],['shield',-24,-5],['wood',-17,-18],['ammo',15,-12],['health',25,-12],['shield',24,-25],['ammo',24,28],['wood',34,28],['shield',-24,28],['health',-34,19],['ammo',6,-25],['shield',-6,-25],['wood',-6,3],['health',7,4]];
  for(const [type,x,z] of spots)dropPickup(type,x,z,true);
  const armory=mode==='practice'?[[0,-7,42],[2,-3,42],[3,3,42],[1,7,42]]:[[2,-6,37],[3,6,37],[2,-17,-18],[3,34,28],[1,-24,28],[0,15,-12],[2,6,-25],[3,-6,3]];
  for(const [index,x,z] of armory)dropWeapon(index,x,z,true);
}
function weaponLabel(index){
  if(!weaponLabels.has(index)){
    const c=document.createElement('canvas');c.width=384;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#193e50';ctx.fillRect(0,0,384,96);ctx.fillStyle='#'+WEAPONS[index].color.toString(16).padStart(6,'0');ctx.fillRect(0,0,384,6);ctx.fillStyle='#fff9e9';ctx.font='bold 28px Trebuchet MS';ctx.textAlign='center';ctx.fillText(WEAPONS[index].short,192,44);ctx.font='18px Trebuchet MS';ctx.fillText(WEAPONS[index].role,192,76);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;weaponLabels.set(index,new THREE.SpriteMaterial({map:texture,transparent:true}));
  }return weaponLabels.get(index);
}
function dropWeapon(index,x,z,fixed=false){
  const dropped=pickups.filter(p=>p.type==='weapon'&&!p.fixed);if(dropped.length>=10){disposeGroup(dropped[0].group);pickups.splice(pickups.indexOf(dropped[0]),1);}
  const g=new THREE.Group(),model=createWeaponModel(index);model.group.scale.setScalar(1.3);model.group.rotation.z=-.15;g.add(model.group);g.position.set(x,world.heightAt(x,z)+.8,z);scene.add(g);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.78,24),new THREE.MeshBasicMaterial({color:WEAPONS[index].color,side:THREE.DoubleSide}));ring.material.userData.owned=true;ring.rotation.x=-Math.PI/2;ring.position.y=-.6;g.add(ring);
  const label=new THREE.Sprite(weaponLabel(index));label.position.set(0,1.15,0);label.scale.set(2.4,.6,1);g.add(label);pickups.push({group:g,type:'weapon',weapon:index,x,z,fixed,respawn:0,phase:index});
}
function closestWeapon(){
  let result=null,closest=2.15;
  for(const p of pickups){if(p.type!=='weapon'||p.respawn>0||Math.abs(player.pos.y-world.heightAt(p.x,p.z))>1.5)continue;const distance=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);if(distance>=closest)continue;
    const from=player.pos.clone().add(new THREE.Vector3(0,bodyHeight(player),0)),delta=p.group.position.clone().sub(from);if(terrainHit(from,delta.clone().normalize(),delta.length()-.1))continue;result=p;closest=distance;
  }return result;
}
function swapWeapon(){
  if(buildMode||pickupCooldown>0)return;const p=closestWeapon();if(!p)return;const already=loadout.indexOf(p.weapon);if(already>=0){equip(already);toast(`${WEAPONS[p.weapon].name} is already in slot ${already+1}.`);return;}
  const old=weapon;loadout[activeSlot]=p.weapon;equip(activeSlot);pickupCooldown=.35;if(p.fixed){p.respawn=30;p.group.visible=false;}else{disposeGroup(p.group);pickups.splice(pickups.indexOf(p),1);}
  dropWeapon(old,p.x,p.z+.75);nearbyWeapon=null;sound.play('pickup');toast(`${WEAPONS[weapon].name} equipped! ${WEAPONS[weapon].hint}`);updateHUD();
}
function dropPickup(type,x,z,fixed=false){
  if(pickups.length>(world.map.id==='sunhaven'?100:55))return;const g=new THREE.Group(),color={ammo:0xffdc69,shield:0x60e7f0,health:0xfa8d9b,wood:0xe3ae64}[type];g.position.set(x,world.heightAt(x,z)+.7,z);scene.add(g);
  if(type==='shield'){const m=ball(.36,color,0,0,0,g,1);m.scale.y=1.3;box(.23,.14,.23,0xfff7de,0,.47,0,g);}
  else if(type==='health'){box(.7,.5,.32,0xfff0de,0,0,0,g);box(.34,.1,.03,color,0,0,.18,g);box(.1,.34,.03,color,0,0,.18,g);}
  else if(type==='wood'){for(let i=0;i<3;i++){const m=box(.13,.7,.15,color,(i-1)*.18,0,0,g);m.rotation.z=.1;}}
  else{box(.62,.43,.45,color,0,0,0,g);for(let i=0;i<3;i++)box(.07,.25,.03,0x7d7954,(i-1)*.15,0,.24,g);}
  const ring=new THREE.Mesh(new THREE.RingGeometry(.55,.64,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide}));ring.material.userData.owned=true;ring.rotation.x=-Math.PI/2;ring.position.y=-.55;g.add(ring);
  pickups.push({group:g,type,x,z,fixed,respawn:0,phase:Math.random()*6});
}
function updatePickups(dt){
  pickupCooldown=Math.max(0,pickupCooldown-dt);
  for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];if(p.respawn>0){p.respawn-=dt;if(p.respawn<=0)p.group.visible=true;else continue;}
    p.group.rotation.y+=dt*.75;p.group.position.y=world.heightAt(p.x,p.z)+.8+Math.sin(globalTime*2+p.phase)*.15;if(p.type==='weapon')continue;
    if(Math.hypot(player.pos.x-p.x,player.pos.z-p.z)>1.8||Math.abs(player.pos.y-world.heightAt(p.x,p.z))>2)continue;
    let message='';if(p.type==='ammo'&&loadout.some(i=>reserve[i]<WEAPONS[i].maxReserve)){const filled=[];for(const i of loadout){const amount=Math.min(WEAPONS[i].pickupAmmo,WEAPONS[i].maxReserve-reserve[i]);reserve[i]+=amount;if(amount)filled.push(`+${amount} ${WEAPONS[i].short.toLowerCase()}`);}message='Ammo stocked! '+filled.join(' · ');}
    if(p.type==='shield'&&player.shield<100){player.shield=Math.min(100,player.shield+40);message='Feeling shiny. +40 shield';}
    if(p.type==='health'&&player.health<100){player.health=Math.min(100,player.health+40);message='Good as new. +40 health';}
    if(p.type==='wood'&&wood<RULES.maxWood){wood=Math.min(RULES.maxWood,wood+40);message='+40 wood. Build something good!';}
    if(message){sound.play('pickup');toast(message);if(p.fixed){p.respawn=30;p.group.visible=false;}else{disposeGroup(p.group);pickups.splice(i,1);}}
  }nearbyWeapon=buildMode?null:closestWeapon();if(difficulty==='easy'&&elapsed-lastDamage>9)player.shield=Math.min(100,player.shield+dt*3);
}
function outsideStorm(p){const s=world.stormAt(elapsed);return Math.hypot(p.x-s.x,p.z-s.z)>s.radius;}
function updateStorm(dt){
  if(mode==='practice'){$('storm-tint').style.opacity=0;return;}
  const zone=world.stormAt(elapsed),radius=zone.radius;stormMesh.position.set(zone.x,22,zone.z);stormRing.position.set(zone.x,10.2,zone.z);stormMesh.scale.set(radius,1,radius);stormRing.scale.setScalar(radius);stormMesh.material.uniforms.time.value=globalTime;
  if(zone.phase==='closing'&&!stormWarned){stormWarned=true;announce('THE STORM IS MOVING!','Follow the white safe circle. The dashed circle shows where it goes next.',4);sound.play('reload');}
  const outside=outsideStorm(player.pos);$('storm-tint').style.opacity=outside?1:0;
  if(outside)hitActor(player,(elapsed>zone.end?18:RULES.stormDamage)*dt,null,true);
  for(const a of actors)if(a.alive&&outsideStorm(a.pos))hitActor(a,(elapsed>zone.end?18:RULES.stormDamage)*dt,null,true);
}
function clearPreview(){if(buildPreview)disposeGroup(buildPreview);buildPreview=null;placement=null;show('build-hint',false);}
function toggleBuild(){if(buildMode){buildMode=null;clearPreview();mouseDown=false;aim=false;setWeaponAppearance();updateHUD();return;}selectBuild(selectedPiece);toast('Build mode! 1 wall · 2 ramp · 3 floor. B returns to your blaster.');}
function selectBuild(kind){
  mouseDown=false;aim=false;reloadLeft=0;cancelCharge();nearbyWeapon=null;clearPreview();selectedPiece=buildMode=kind;setWeaponAppearance();
  const g=new THREE.Group(),m=new THREE.MeshBasicMaterial({color:0x86ffe0,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide});m.userData.owned=true;
  if(kind==='wall')box(4,3,.3,m,0,1.5,0,g);else if(kind==='floor')box(4,BUILD.thickness,4,m,0,-BUILD.thickness/2,0,g);else{const ramp=box(4,.12,5,m,0,1.5,0,g);ramp.rotation.x=Math.atan2(3,4);}
  const frame=new THREE.LineSegments(new THREE.EdgesGeometry(g.children[0].geometry),new THREE.LineBasicMaterial({color:0xe6fff6,transparent:true,opacity:.85}));frame.material.userData.owned=true;frame.position.copy(g.children[0].position);frame.rotation.copy(g.children[0].rotation);g.add(frame);scene.add(g);buildPreview=g;updateBuilding();updateHUD();
}
function computePlacement(){return computeBuildPlacement(world,{kind:buildMode,position:player.pos,yaw,pitch,rotation:buildRotation,wood,actors:[player,...actors]});}
function updateBuilding(){if(!buildMode||!buildPreview)return;placement=computePlacement();buildPreview.position.set(placement.x,placement.y,placement.z);buildPreview.rotation.y=placement.yaw;buildPreview.traverse(o=>{if(o.material)o.material.color.setHex(placement.valid?0x70ffdb:0xff806d);});show('build-hint');$('build-hint').classList.toggle('invalid',!placement.valid);$('build-hint').textContent=placement.valid?`${placement.snapped?'SNAPPED':'READY'} · ${buildMode.toUpperCase()} · Click to place · 10 wood`:placement.reason;}
function placeBuild(){
  if(!buildMode)return;placement=computePlacement();if(!placement.valid){toast(placement.reason);return;}const p=placement;constructBuild(p,player);
  wood-=RULES.buildCost;buildCount++;sound.play('build');particleBurst(new THREE.Vector3(p.x,p.y+.5,p.z),0xffdc82,14);mouseDown=false;navigation.refresh();updateBuilding();updateHUD();toast(`${p.kind[0].toUpperCase()+p.kind.slice(1)} built! Keep building · B equips your blaster.`);
}
function constructBuild(p,owner){
  let b;
  if(p.kind==='wall'){
    const g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;scene.add(g);const m=box(4,3,.32,surface('wood',0xdba35e,2,1),0,1.5,0,g);for(let i=0;i<7;i++)box(4,.045,.35,0xffd78c,0,.18+i*.43,0,g);for(const x of [-1.65,1.65])box(.18,3,.38,surface('wood',0xc69154),x,1.5,0,g);
    for(const side of [-1,1]){
      const brace=box(3.6,.14,.055,surface('wood',0xffd78c),0,1.5,side*.196,g);brace.rotation.z=side*.57;
      for(const x of [-1.65,1.65])for(const y of [.25,2.75]){const bolt=ball(.055,0x405b63,x,y,side*.20,g,1);bolt.scale.z=.4;}
      box(.32,.22,.025,0x52bfae,0,1.5,side*.236,g);
    }
    b=world.collider(m,p.bounds.min.clone().add(new THREE.Vector3(0,-.03,0)),p.bounds.max.clone().add(new THREE.Vector3(0,.03,0)),'build');Object.assign(b,{group:g,health:RULES.wallHealth});m.userData.build=b;batchDecorations(g,new Set([m]));
  }else if(p.kind==='floor'){
    const g=new THREE.Group();g.position.set(p.x,p.y,p.z);scene.add(g);const m=box(4,BUILD.thickness,4,surface('wood',0xdba35e,2,2),0,-BUILD.thickness/2,0,g);for(let i=0;i<7;i++)box(.035,.012,3.9,0xaa7f50,-1.5+i*.5,.006,0,g);for(const x of [-1.85,1.85]){box(.18,.025,4,0xffdb95,x,.012,0,g);for(const z of [-1.75,1.75]){const bolt=ball(.06,0x405b63,x,.03,z,g,1);bolt.scale.y=.3;}}b=world.collider(m,p.bounds.min.clone(),p.bounds.max.clone(),'build');Object.assign(b,{group:g,health:RULES.wallHealth});m.userData.build=b;batchDecorations(g,new Set([m]));
  }else b=world.addRamp(p,p.yaw,BUILD.size,BUILD.size,BUILD.height);
  b.owner=owner;b.piece={kind:p.kind,x:p.x,y:p.y,z:p.z,yaw:p.yaw};world.structures.push(b);return b;
}
function damageBuild(mesh,damage){
  const b=mesh.userData.build;if(!b||b.build===false||!world.ramps.includes(b)&&!world.obstacles.includes(b))return;
  b.health=Math.max(0,b.health-damage);if(b.owner===player)lastCoverHit={build:b,time:elapsed};
  const point=(b.group||b.mesh).position.clone().add(new THREE.Vector3(0,1,0));
  if(point.distanceTo(player.pos)<25)sound.tone(b.health?180:120,b.health?.065:.22,'triangle',b.health?.09:.2,60);
  if(b.health<=0){
    particleBurst(point,0xffd394,12);world.removeBuild(b);navigation.refresh();
    if(b.owner===player)toast(`Your ${b.piece.kind} broke!`);
  }
}
function updateTargetLabel(){
  ray.setFromCamera(new THREE.Vector2(),camera);const origin=ray.ray.origin.clone(),direction=ray.ray.direction.clone(),obstacle=terrainHit(origin,direction,75),hit=actorHit(origin,direction,obstacle?obstacle.distance:75,player);
  $('enemy-label').textContent=hit?`${hit.actor.name} · ${Math.ceil(hit.actor.health+hit.actor.shield)} HP${hit.actor.action?' · '+hit.actor.action:''}`:'';
  const recent=lastCoverHit&&elapsed-lastCoverHit.time<2.5?lastCoverHit.build:null,lookedAt=obstacle?.object.userData.build;
  const build=recent||(lookedAt&&world.structures.includes(lookedAt)?lookedAt:null);
  coverStatus=build?{kind:build.piece.kind,health:build.health,maxHealth:RULES.wallHealth,own:build.owner===player,recent:!!recent,broken:build.health<=0}:null;
  show('cover-status',!!coverStatus);
  if(coverStatus){
    $('cover-label').textContent=`${coverStatus.own?'YOUR':'BOT'} ${coverStatus.kind.toUpperCase()}${coverStatus.broken?' BROKE!':recent?' HIT':''}`;
    $('cover-health').textContent=`${Math.ceil(coverStatus.health)} / ${RULES.wallHealth}`;
    $('cover-fill').style.width=`${100*coverStatus.health/RULES.wallHealth}%`;
    $('cover-status').classList.toggle('damaged',!!recent);
  }
}
function finish(won){
  state='result';clearInput();gumballs.clear();clearPreview();buildMode=null;document.exitPointerLock?.();show('hud',false);show('result');$('storm-tint').style.opacity=0;$('damage-flash').style.opacity=0;
  const place=won?1:player.finalPlace||actors.filter(a=>a.alive).length+1;
  $('result-badge').textContent=won?'✳':'♡';$('result-eyebrow').textContent=won?'THE BAY HAS A NEW CHAMPION':'THERE’S ALWAYS ANOTHER SUNRISE';$('result-title').textContent=won?'SUNSATIONAL!':'NICE RUMBLE!';$('result-description').textContent=won?'The last spark standing. That’s you.':'A fresh island adventure is one click away.';
  $('result-place').textContent='#'+place;$('result-pops').textContent=pops;$('result-time').textContent=fmt(elapsed);$('result-builds').textContent=buildCount;sound.play(won?'win':'lose');if(won){for(let i=0;i<7;i++)particleBurst(player.pos.clone().add(new THREE.Vector3((Math.random()-.5)*8,4+Math.random()*3,(Math.random()-.5)*8)),[0xffdf70,0xff94b6,0x74efd6][i%3],22);}syncDiagnostics();
}
function syncDiagnostics(){canvas.dataset.gameState=JSON.stringify(window.sunspark?.snapshot());}
function tick(now){if(stopped)return;const rawDt=Math.max(0,(now-lastTime)/1000),dt=Math.min(rawDt,.05);lastTime=now;if(dt===0||!startup.ready){requestAnimationFrame(tick);return;}renderProfiler.beginFrame(rawDt);try{globalTime+=dt;
  if(state==='playing'&&frameMeter.sample(rawDt)){fps=frameMeter.value;lastGameplayFPS=fps;updatePerformanceHUD();}
  if(state==='playing'){
    elapsed+=dt;shotCooldown=Math.max(0,shotCooldown-dt);toastLeft-=dt;announceLeft-=dt;hitLeft-=dt;damageLeft-=dt;
    if(reloadLeft>0){reloadLeft=Math.max(0,reloadLeft-dt);if(reloadLeft===0){const count=Math.min(WEAPONS[weapon].magazine-ammo[weapon],reserve[weapon]);ammo[weapon]+=count;reserve[weapon]-=count;sound.tone(780,.09,'triangle',.2,1000);}}
    if(ammo[weapon]===0&&reserve[weapon]>0&&shotCooldown<=0&&!reloadLeft&&!buildMode)reload();
    if(charging){chargeTime=Math.min(WEAPONS[weapon].charge,chargeTime+dt);if(chargeTime>=WEAPONS[weapon].charge)shoot(true);}
    updatePlayer(dt);if(gumballs.items.length){scene.updateMatrixWorld(true);gumballs.update(dt);}updateBots(dt);updatePickups(dt);updateStorm(dt);updateBuilding();updateCamera(dt);effects(dt);updateTargetLabel();updateHUD();
    if(mode==='match'){if(!player.alive)finish(false);else if(actors.every(a=>!a.alive))finish(true);}
  }else if(state==='title'){
    const a=.35+Math.sin(globalTime*.045)*.12;const overview=world.map.id==='sunhaven'?1.55:1;camera.position.set(Math.sin(a)*98*overview,53*overview,Math.cos(a)*98*overview);camera.lookAt(0,3,-8);camera.fov=53;camera.updateProjectionMatrix();
  }else if(state==='result'){effects(dt);}
  if(state==='playing'||state==='title')world.update(globalTime,dt,camera);
  if(world.map.id==='sunhaven'){scene.fog.near=state==='title'?190:130;scene.fog.far=state==='title'?440:350;}
  const profile=graphicsProfile(quality);
  for(const actor of actors)actor.setDetail(camera.position.distanceTo(actor.pos)>profile.actorDistance+(actor.distant?-3:3));
  if(profile.shadows&&(state==='playing'||globalTime>=nextShadow)){
    const extent=state==='title'?world.map.radius+20:48,center=state==='title'?new THREE.Vector3():player.pos.clone().add(new THREE.Vector3(Math.sin(yaw)*12,0,-Math.cos(yaw)*12));
    focusSunShadow(sun,center,extent,profile.shadowSize);
    renderer.shadowMap.needsUpdate=true;nextShadow=globalTime+1/profile.shadowHz;
  }
  renderProfiler.beginRender();natureRenderer.render(scene,camera);
  }catch(error){stopped=true;startup.error=String(error.message||error);show('error');$('error-text').textContent='The island could not finish drawing. Please try again.';console.error(error);}
  finally{renderProfiler.endFrame();}
  if(!stopped)requestAnimationFrame(tick);
}

$('map-select').value=world.map.id;$('map-select').onchange=()=>navigateMap(mapKey($('map-select').value));
$('island-name').textContent=world.map.name.toUpperCase();$('island-description').textContent=`${world.map.botCount+1} players · ${world.map.id==='sunhaven'?'5 districts · storm closes at 4:45':'1 island · storm closes at 4:15'}`;$('welcome-name').textContent='Welcome to '+world.map.name+'.';
$('explore').onclick=()=>start('practice',true);
$('play').onclick=()=>start('match');$('practice').onclick=()=>start('practice');$('resume').onclick=resume;$('pause-button').onclick=pause;$('leave').onclick=menu;$('replay').onclick=()=>start('match');$('result-menu').onclick=menu;$('capture').onclick=lock;
function setDifficulty(value){difficulty=difficultyKey(value);document.querySelectorAll('[data-difficulty]').forEach(b=>{const selected=b.dataset.difficulty===difficulty;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});}
for(const b of document.querySelectorAll('[data-difficulty]'))b.onclick=()=>{setDifficulty(b.dataset.difficulty);saveSettings();};
function openSettings(from){settingsFrom=from;show('settings');if(from==='paused')show('pause',false);}
$('how-to').onclick=()=>openSettings('title');$('pause-settings').onclick=()=>openSettings('paused');$('close-settings').onclick=()=>{show('settings',false);if(settingsFrom==='paused')show('pause');};
function saveSettings(){try{localStorage.setItem('sunspark-settings',JSON.stringify({sensitivity:sensitivity,volume:sound.volume,difficulty,quality,showFPS}));}catch{}}
$('sensitivity').oninput=e=>{sensitivity=Number(e.target.value)/100;$('sensitivity-value').textContent=`${e.target.value}%`;saveSettings();};$('volume').oninput=e=>{sound.volume=Number(e.target.value)/100;$('volume-value').textContent=`${e.target.value}%`;sound.init();saveSettings();};
function updatePerformanceHUD(){
  const profile=graphicsProfile(quality);
  $('fps-value').textContent=fps===null?'—':String(Math.round(fps));$('quality-badge').textContent=profile.name;
  $('performance').dataset.speed=fps===null?'waiting':Math.round(fps)>=60?'fast':Math.round(fps)>=30?'okay':'slow';show('performance',showFPS);
  $('graphics-fps').textContent=lastGameplayFPS===null?'—':String(Math.round(lastGameplayFPS));
  $('graphics-fps-context').textContent=lastGameplayFPS===null?(state==='title'?'Start playing to measure.':'Resume playing to measure this setting.'):`Last gameplay reading · ${profile.name}`;
}
function resetFPS(){frameMeter.reset();fps=null;updatePerformanceHUD();}
function applyGraphics(value,persist=true){
  quality=qualityKey(value);const profile=graphicsProfile(quality);$('quality').value=quality;
  const shadowsChanged=renderer.shadowMap.enabled!==profile.shadows;
  renderer.setPixelRatio(renderPixelRatio(profile,innerWidth,innerHeight,devicePixelRatio,renderer.capabilities?.maxTextureSize));renderer.shadowMap.enabled=profile.shadows;
  // Shadow defines are compiled into material programs. Turning the renderer's
  // shadow flag off alone can leave cached programs sampling a disposed map.
  if(shadowsChanged){
    const materials=new Set();scene.traverse(o=>{if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);});
    for(const material of materials)material.needsUpdate=true;
  }
  if(sun.shadow.mapSize.x!==profile.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(profile.shadowSize,profile.shadowSize);}
  renderer.shadowMap.needsUpdate=profile.shadows;nextShadow=0;world.setQuality(quality);natureRenderer.setQuality(profile);world.foliage.update(globalTime,camera);
  renderProfiler.reset();
  $('quality-description').textContent=profile.description;lastGameplayFPS=null;resetFPS();if(persist)saveSettings();
}
function openGraphics(from='game'){
  graphicsFrom=from;if(state==='playing')pause();show('pause',false);show('settings',false);show('graphics');
  $('close-graphics').textContent=from==='settings'?'BACK TO CONTROLS ←':'BACK TO THE RUMBLE ➜';updatePerformanceHUD();
}
function closeGraphics(){show('graphics',false);if(graphicsFrom==='settings')show('settings');else if(state==='paused')resume();}
$('performance').onclick=()=>openGraphics();$('pause-graphics').onclick=()=>openGraphics();$('settings-graphics').onclick=()=>openGraphics('settings');$('close-graphics').onclick=closeGraphics;
$('quality').onchange=()=>applyGraphics($('quality').value);
$('show-fps').onchange=()=>{showFPS=$('show-fps').checked;updatePerformanceHUD();saveSettings();};
try{const s=JSON.parse(localStorage.getItem('sunspark-settings')||'null');if(s){sensitivity=clamp(s.sensitivity||.75,.2,1.8);sound.volume=clamp(s.volume??.35,0,1);setDifficulty(s.difficulty);$('sensitivity').value=sensitivity*100;$('sensitivity-value').textContent=`${Math.round(sensitivity*100)}%`;$('volume').value=sound.volume*100;$('volume-value').textContent=`${Math.round(sound.volume*100)}%`;quality=qualityKey(s.quality);showFPS=s.showFPS!==false;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===difficulty));}}catch{}
$('show-fps').checked=showFPS;applyGraphics(quality,false);
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP'){if(!$('graphics').classList.contains('hidden'))closeGraphics();else if(!$('settings').classList.contains('hidden'))$('close-settings').click();else if(state==='playing')pause();else if(state==='paused')resume();return;}
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&state==='playing')e.preventDefault();
  if(state!=='playing')return;keys.add(e.code);inputUntil.set(e.code,globalTime+.07);if(e.repeat)return;
  if(e.code==='Space')movement.jump();
  if(e.code==='KeyC')movement.crouch();
  if(e.code==='KeyB')toggleBuild();
  if(buildMode){
    const index=['Digit1','Digit2','Digit3'].indexOf(e.code);if(index>=0)selectBuild(PIECES[index]);
    if(e.code==='KeyQ'||e.code==='KeyE')selectBuild(PIECES[(PIECES.indexOf(buildMode)+(e.code==='KeyQ'?2:1))%3]);
    if(e.code==='KeyR'){buildRotation=(buildRotation+1)%4;updateBuilding();}
  }else{if(e.code==='KeyR')reload();if(e.code==='Digit1')equip(0);if(e.code==='Digit2')equip(1);if(e.code==='KeyE')swapWeapon();}
});window.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousemove',e=>{if(state==='playing'&&(document.pointerLockElement===canvas||(pointerFallback&&aim))){yaw+=e.movementX*.0026*sensitivity;pitch=clamp(pitch-e.movementY*.0022*sensitivity,-.9,.68);}});
canvas.tabIndex=0;canvas.addEventListener('mousedown',e=>{if(state!=='playing')return;if(document.pointerLockElement!==canvas&&!pointerFallback){lock();return;}if(e.button===0){mouseDown=true;shoot();}if(e.button===2)aim=true;});document.addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false;if(e.button===2)aim=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{show('capture',false);if(!document.pointerLockElement&&state==='playing')pause();});window.addEventListener('blur',()=>{if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(renderPixelRatio(graphicsProfile(quality),innerWidth,innerHeight,devicePixelRatio,renderer.capabilities?.maxTextureSize));renderer.setSize(innerWidth,innerHeight);});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();show('error');$('error-text').textContent='The graphics connection took a break. Close other graphics-heavy tabs and try again.';});
// Read-only diagnostics make browser smoke checks observable without changing the game.
window.sunspark={snapshot:()=>({map:world.map.id,mapName:world.map.name,storm:world.stormAt(elapsed),nature:{...natureAssets,trees:world.foliage.trees.length,leafCards:world.foliage.leafCount,reflections:world.water.reflectionPasses,refractions:world.water.refractionPasses},state,mode,difficulty,elapsed,position:player.pos.toArray(),health:player.health,shield:player.shield,grounded:player.grounded,movement:{stance:player.stance,height:player.height,speed:movement.speed,slideLeft:movement.slideLeft,slideCooldown:movement.cooldown,velocity:[movement.vx,player.vy,movement.vz]},yaw,pitch,weapon,activeSlot,loadout:[...loadout],charging,charge:chargeTime,projectiles:gumballs.items.length,bounces:gumballs.bounces,lastWeaponHit,nearbyWeapon:nearbyWeapon?{weapon:nearbyWeapon.weapon,replace:weapon,slot:activeSlot}:null,ammo:[...ammo],reserve:[...reserve],reloading:reloadLeft,wood,buildCount,buildMode,placement:placement?{valid:placement.valid,reason:placement.reason,x:placement.x,z:placement.z,y:placement.y,yaw:placement.yaw,snapped:placement.snapped}:null,cover:coverStatus,structures:world.structures.map(b=>({...b.piece,health:b.health,owner:b.owner===player?'You':b.owner?.name})),pops,stormRadius:world.stormAt(elapsed).radius,bots:actors.map(a=>({name:a.name,alive:a.alive,position:a.pos.toArray(),health:a.health,shield:a.shield,escaping:a.escaping,action:a.action,ammo:a.ammo,reloading:a.reloadLeft,wood:a.wood,target:a.target?.name||null,visible:a.visibleTarget,pathLength:a.path?.length,stats:a.stats?{...a.stats}:null})),fps,quality,showFPS,lastGameplayFPS,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pointerLocked:document.pointerLockElement===canvas,pointerFallback})};
// Optional browser-native tools use exactly the same menu actions as the visible buttons.
const gameplaySnapshot=window.sunspark.snapshot;
window.sunspark.snapshot=()=>({...gameplaySnapshot(),startup:{...startup},performance:renderProfiler.snapshot(),textures:natureTextureDiagnostics(),targets:{water:world.water.diagnostics?.(),post:natureRenderer.diagnostics?.()},shaders:shaderDiagnostics(),models:{...world.authoredModelStatus},landforms:world.docksLandforms?.diagnostics(),oaks:world.docksOaks?.diagnostics?.(),docksTrees:world.docksTrees,approvedRocks:world.approvedRocks?.diagnostics?.(),terrain:{chunks:world.ground.children.filter(m=>!m.userData.docksCliff).length,spacing:world.ground.userData.heightfield.spacing},landscape:world.landscape?.diagnostics(),coastal:coastalGeometryDiagnostics()});
async function prepareIsland(){
  if(!renderer.isWebGLRenderer){show('loading',false);return;}
  const began=performance.now();show('loading');
  try{
    await prepareAuthoredModels(world);if(disposed)return;
    await prepareNatureAssets(renderer);if(disposed)return;startup.phase='warming';
    if(__SUNSPARK_TEST__&&mapParams.has('warmup-delay'))await new Promise(resolve=>setTimeout(resolve,Math.min(2000,Number(mapParams.get('warmup-delay'))||0)));
    if(disposed)return;
    renderer.debug.checkShaderErrors=true;
    renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw new Error(`Island shader failed: ${gl.getProgramInfoLog(program)}\n${gl.getShaderInfoLog(vertex)}\n${gl.getShaderInfoLog(fragment)}`);};
    const warmCamera=camera.clone();
    for(const preset of ['low','balanced','high']){
      const warmProfile=graphicsProfile(preset);
      renderer.shadowMap.enabled=warmProfile.shadows;world.setQuality(preset);natureRenderer.setQuality(warmProfile);
      for(const coast of [false,true]){
        const radius=world.map.shore;
        warmCamera.position.set(coast?radius*.75:0,coast?8:38,coast?radius*.25:radius*.65);
        warmCamera.lookAt(coast?radius:0,0,0);warmCamera.updateMatrixWorld(true);
        world.foliage.update(globalTime+1,warmCamera);renderer.shadowMap.needsUpdate=true;
        await renderer.compileAsync(scene,warmCamera);
        if(disposed)return;
        natureRenderer.render(scene,warmCamera);
      }
    }
    applyGraphics(quality,false);world.foliage.update(globalTime,camera);renderProfiler.reset();
    startup.ready=true;startup.phase='ready';startup.warmupMs=performance.now()-began;startup.loadedMs=performance.now();lastTime=performance.now();show('loading',false);
    if(pendingStart){const next=pendingStart;pendingStart=null;start(next.which,next.keepMap);}
  }catch(error){if(disposed)return;startup.phase='failed';startup.error=String(error.message||error);show('loading',false);show('error');$('error-text').textContent='Some island details could not load. Please try again.';console.error(error);}
}
let disposed=false;
function disposeIsland(){
  if(disposed)return;disposed=true;stopped=true;
  world.assetLoadCancelled=true;
  const scope=captureSceneResources(scene,new ResourceScope('island'),{externalTextures:natureTextureSet(),skipRoots:new Set([world.ground,world.water,world.foliage,world.landscape,world.docksOaks,world.approvedRocks])});
  scope.dispose();world.docksOaks?.dispose();world.approvedRocks?.dispose();world.landscape?.dispose();world.ground.dispose?.();world.water.dispose?.();world.foliage.dispose?.();disposeFoliageTemplates();disposeCoastalGeometry();natureRenderer.dispose?.();renderProfiler.dispose();sun.shadow.dispose?.();environmentTarget?.dispose();disposeNatureAssets();renderer.dispose?.();
}
window.addEventListener('pagehide',event=>{if(!event.persisted)disposeIsland();});
window.sunspark.ready=prepareIsland();
const toolContext=document.modelContext;
if(toolContext?.registerTool){
  for(const tool of [
    {name:'read_match',title:'Read Sunspark match',description:'Read the current local Sunspark Rumble match, player resources, safe area and opponent status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>window.sunspark.snapshot()},
    {name:'start_match',title:'Start Sunspark Rumble',description:'Start a fresh local match or practice playground. Replaces any match in progress.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['match','practice']}},required:['mode'],additionalProperties:false},execute:input=>{if(!input||!['match','practice'].includes(input.mode))throw new Error('Choose match or practice.');start(input.mode);return window.sunspark.snapshot();}},
    {name:'pause_match',title:'Pause Sunspark Rumble',description:'Pause the running match and open the pause menu.',inputSchema:{type:'object',properties:{},additionalProperties:false},execute:()=>{pause();return {state};}},
  ]){try{Promise.resolve(toolContext.registerTool(tool)).catch(()=>{});}catch{}}
}
player.root.visible=false;requestAnimationFrame(tick);
if(mapParams.has('autoplay')){const auto=mapParams.get('autoplay');globalThis.history?.replaceState(null,'',location.href.replace(/([?&])autoplay=[^&]*&?/,(_,sep)=>sep==='?'?'?':''));start(auto==='match'?'match':'practice',auto==='explore');}
// Removed from the shipped bundle. Simulation tests use the real rules, scene and inputs.
if(__SUNSPARK_TEST__)window.__test={disposeIsland,renderer,natureRenderer,movement,actorHit,start,player,actors,world,camera,navigation,botController,buildBot,constructBuild,setDifficulty,shoot,reload,equip,hitActor,toggleBuild,selectBuild,placeBuild,pause,resume,menu,pickups,gumballs,swapWeapon,dropWeapon,updateCamera,terrainHit,damageBuild,finish,setElapsed:t=>elapsed=t,setView:(y,p=-.07)=>{yaw=y;pitch=p;updateCamera(1/60,true);updateBuilding();}};








