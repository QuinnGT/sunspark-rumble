import test from 'node:test';
import assert from 'node:assert/strict';
import {game,snapshot,advance,key} from './game-harness.mjs';
import {readFileSync} from 'node:fs';

test('bots recover from the same captured rock traps through their ordinary update',()=>{
  const cases=JSON.parse(readFileSync(new URL('./rock-trapping-cases.json',import.meta.url)));
  game.start('match');const a=game.actors[0];
  for(const c of cases){
    a.pos.fromArray(c.trapped);a.vy=0;a.grounded=true;game.botController.reset(a,'easy');
    a.planLeft=a.senseLeft=a.pathTimer=10;a.path=[];
    game.botController.update(1/30,0,game.player,[a]);
    assert.ok(game.world.canStand(a.pos.x,a.pos.y,a.pos.z),`${c.rock}: bot can move after recovery`);
    assert.equal(game.world.nearObstacles(a.pos.x,a.pos.z,a.radius).some(o=>o.shape?.blocks(a.pos.x,a.pos.z,a.radius,a.pos.y,a.height,0)),false);
  }
});

test('shifted storm damage uses the same center as its visible safe circle',()=>{
  game.start('match');game.world.matchSeed=1;game.setElapsed(245);const zone=game.world.stormAt(245),fire=game.botController.callbacks.fire;game.botController.callbacks.fire=()=>{};
  try{
    game.player.pos.set(zone.x,game.world.heightAt(zone.x,zone.z),zone.z);advance(.5);assert.equal(game.player.health,100,'off-center safe ground must protect');
    game.player.pos.set(0,game.world.heightAt(0,0),0);advance(.5);assert.ok(game.player.health<99,'the old map origin is now outside the circle');
  }finally{game.botController.callbacks.fire=fire;}
});
test('Sunhaven bots leave a climbing plan to move toward the shifted safe area',()=>{
  game.start('match');game.world.matchSeed=1;game.setElapsed(200);const a=game.actors[0],fire=game.botController.callbacks.fire;game.botController.callbacks.fire=()=>{};
  try{
    a.pos.set(20,game.world.heightAt(20,38),38);game.botController.reset(a,'easy');a.climbGoal=a.pos.clone().setY(a.pos.y+8);a.climbLeft=20;
    const zone=game.world.stormAt(200),before=Math.hypot(a.pos.x-zone.x,a.pos.z-zone.z);advance(8);
    assert.ok(a.escaping);assert.equal(a.climbGoal,null);assert.ok(Math.hypot(a.pos.x-zone.x,a.pos.z-zone.z)<before-15);
  }finally{game.botController.callbacks.fire=fire;}
});
test('deep-cove falls recover onto a valid shore without consuming health',()=>{
  game.start('practice',true);game.player.pos.set(98,0,27);game.player.grounded=false;game.player.vy=-1;advance(1);
  const p=game.player.pos;assert.ok(p.y>-.5);assert.ok(game.world.canStand(p.x,p.y,p.z));assert.equal(game.player.health,100);assert.equal(game.player.stance,'standing');
});
test('expanded map replays reset resources, structures, posture and all ten bots',()=>{
  for(let i=0;i<4;i++){
    game.start('match');assert.equal(game.actors.length,10);assert.equal(game.world.map.id,'sunhaven');assert.equal(snapshot().wood,80);assert.equal(snapshot().buildCount,0);assert.equal(snapshot().movement.stance,'standing');
    key('KeyC');key('KeyC',false);advance(.1);game.selectBuild('wall');game.placeBuild();advance(.1);
  }
});
test('bots traverse the revised interiors, dock access, rounded hill and grounded roof ramps',()=>{
  const w=game.world,at=([x,z])=>game.player.pos.clone().set(x,w.floorAt(x,z),z);
  const architecture=w.docksArchitecture;assert.ok(architecture?.routes,'the boathouse publishes its supported access routes');
  const supported=([x,y,z])=>{
    // floorAt without a support hint selects the porch canopy above this path.
    // Authored route heights identify the walkable floor beneath that cover.
    const actual=w.floorAt(x,z,y+.1);
    assert.ok(Math.abs(actual-y)<.15,`authored route lost support at ${x},${y},${z}`);
    return game.player.pos.clone().set(x,actual,z);
  };
  const through=[...architecture.routes.rear].reverse().concat(architecture.routes.front.slice(1));
  const routes=[
    {name:'boathouse rear/front doors and porch-to-dock connection',points:through.map(supported)},
    {name:'boathouse folded ramp and workshop terrace',points:architecture.routes.terrace.map(supported)},
    ...[[[70,20],[98,29]],[[-12,-5],[-12,-19]],[[-53,86],[-53,61]]].map((points,i)=>({name:['outer dock access','village interior','quarry crest'][i],points:points.map(at)})),
  ];
  for(const r of w.ramps.filter(r=>r.roofAccess)){
    const end=local=>{const x=r.x+Math.sin(r.yaw)*local,z=r.z+Math.cos(r.yaw)*local;return game.player.pos.clone().set(x,w.floorAt(x,z,r.y+r.rise+.1),z);};
    routes.push({name:`grounded roof ramp ${r.x},${r.z}`,points:[end(r.length/2+.8),end(-r.length/2-.6)]});
  }
  try{
    for(const route of routes)for(const reverse of [false,true]){
      game.setDifficulty('hard');game.start('match');game.player.alive=false;const a=game.actors[0],points=reverse?[...route.points].reverse():route.points;
      a.pos.copy(points[0]);game.botController.reset(a,'hard');
      // Reuse the same actor across every turn/doorway; intermediate points
      // change only its ordinary BotController goal, never its position.
      for(const end of points.slice(1)){
        const start=a.pos.clone();a.climbGoal=end.clone();a.climbLeft=40;a.planLeft=0;a.pathTimer=0;
        for(let i=0;i<900&&a.pos.distanceTo(end)>.65;i++)game.botController.update(1/30,10,game.player,[a]);
        assert.ok(a.pos.distanceTo(end)<.65,`${route.name}: bot stuck ${start.toArray()} → ${end.toArray()} at ${a.pos.toArray()}`);
      }
    }
  }finally{game.setDifficulty('easy');}
});
