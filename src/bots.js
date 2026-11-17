// Perception, combat, and terrain-aware tactics.
import * as THREE from 'three';
import { RULES,DIFFICULTIES,clamp } from './config.js';
import { bodyHeight } from './movement.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export class BotController {
  constructor(world,navigation,callbacks,rng=Math.random){this.world=world;this.nav=navigation;this.callbacks=callbacks;this.rng=rng;this.storm={x:0,z:0};this.point=(x,z,y=world.heightAt(x,z))=>new THREE.Vector3(x,y,z);}
  reset(a,level){
    const d=DIFFICULTIES[level];Object.assign(a,{rockSafePosition:null,rockSupportPosition:null,level,provokedPlayer:false,ammo:d.magazine,reloadLeft:0,cooldown:d.reaction,senseLeft:0,planLeft:0,pathTimer:0,path:[],goal:a.pos.clone(),target:null,visibleTarget:false,memoryLeft:0,lastSeen:null,targetVelocity:new THREE.Vector3(),senseTime:0,stagger:0,warning:0,stuck:0,strafe:this.rng()<.5?-1:1,strafeLeft:2,walkYaw:0,burstLeft:d.burst,wood:d.builds*RULES.buildCost,buildCooldown:2,buildPause:0,climbGoal:null,climbLeft:0,jumpCooldown:0,hurtLeft:0,noiseTime:-100,heardTime:-100,nextHighGround:4+this.rng()*3,patrolUntil:0,escaping:false,action:'PATROLLING',stats:{shots:0,hits:0,reloads:0,builds:0,ramps:0,floors:0,cover:0,climbed:0},peakY:a.pos.y});
  }
  noise(source,time){source.noiseTime=time;source.noisePos=source.pos.clone();}
  hurt(a,source){
    if(!a.stats||!source)return;
    const surprised=a.target!==source||!a.visibleTarget;
    if(!source.isBot)a.provokedPlayer=true;
    a.hurtLeft=3;a.lastSeen=source.pos.clone();a.target=source;a.memoryLeft=DIFFICULTIES[a.level].memory;a.senseLeft=0;a.planLeft=0;
    // A hit causes a flinch, but repeated hits cannot keep restarting reaction
    // time forever while the bot is already engaged with the same opponent.
    if(surprised)a.cooldown=Math.max(a.cooldown,DIFFICULTIES[a.level].reaction);
  }
  visible(a,b,d){
    const delta=b.pos.clone().sub(a.pos),range=delta.length();if(range>d.vision)return false;
    const facing=new THREE.Vector3(-Math.sin(a.walkYaw),0,-Math.cos(a.walkYaw));
    if(range>6&&delta.clone().setY(0).normalize().dot(facing)<Math.cos(d.fov*Math.PI/360))return false;
    const from=a.pos.clone().add(new THREE.Vector3(0,1.5,0)),to=b.pos.clone().add(new THREE.Vector3(0,bodyHeight(b),0)),direction=to.sub(from);
    return !this.callbacks.environment(from,direction.clone().normalize(),direction.length()-.65);
  }
  sense(a,all,player,time,d){
    let best=null,score=Infinity,heard=null;
    for(const b of all){
      if(b===a||!b.alive||b===player&&time<d.grace&&!a.provokedPlayer)continue;
      // Limit simultaneous attackers on the gentler levels. Other bots keep
      // fighting each other instead of all piling onto a new player at spawn.
      if(b===player&&!(a.target===player&&a.visibleTarget)&&!a.provokedPlayer&&all.filter(other=>other!==a&&other.alive&&other.target===player&&other.visibleTarget).length>=d.maxAttackers)continue;
      if(this.visible(a,b,d)){const value=a.pos.distanceTo(b.pos)*(b===player?.85:1)*(b===a.target?.8:1);if(value<score){score=value;best=b;}}
      else if(b.noiseTime>a.heardTime&&time-b.noiseTime<1.25&&b.noisePos&&a.pos.distanceTo(b.noisePos)<d.hearing)heard=b;
    }
    a.visibleTarget=!!best;
    if(best){
      if(a.target!==best){a.cooldown=Math.max(a.cooldown,d.reaction);a.burstLeft=d.burst;a.planLeft=0;a.targetVelocity.set(0,0,0);}
      else if(a.lastSeen&&time>a.senseTime){a.targetVelocity.copy(best.pos).sub(a.lastSeen).divideScalar(time-a.senseTime);a.targetVelocity.clampLength(0,RULES.sprint);}
      a.target=best;a.lastSeen=best.pos.clone();a.memoryLeft=d.memory;a.senseTime=time;
    }else if(heard){a.target=heard;a.lastSeen=heard.noisePos.clone();a.targetVelocity.set(0,0,0);a.memoryLeft=d.memory;a.heardTime=heard.noiseTime;a.planLeft=0;}
    else if(a.memoryLeft<=0||!a.target?.alive){a.target=null;a.lastSeen=null;}
  }
  safeDistance(x,z){return Math.hypot(x-this.storm.x,z-this.storm.z);}
  groundGoal(x,z){
    if(this.world.map.id==='breezy')return this.point(x,z);
    let best=Infinity,result;for(let i=0;i<this.nav.blocked.length;i++){if(this.nav.blocked[i])continue;const p=this.nav.nodes[i],d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;result=p;}}
    return result?this.point(result.x,result.z,result.y):this.point(x,z);
  }
  cover(a,enemy,safe){
    let best=null,score=Infinity;
    for(const o of this.world.obstacles){const b=o.box,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2;if(Math.hypot(cx-a.pos.x,cz-a.pos.z)>14||b.max.y<a.pos.y+1)continue;
      const away=this.point(cx-enemy.x,cz-enemy.z,0).normalize();
      const reach=Math.abs(away.x)*(b.max.x-b.min.x)/2+Math.abs(away.z)*(b.max.z-b.min.z)/2+1.2;
      for(const side of [-1,0,1]){const x=cx+away.x*reach+away.z*side*1.8,z=cz+away.z*reach-away.x*side*1.8,y=this.world.floorAt(x,z,a.pos.y),p=this.point(x,z,y);
        if(this.safeDistance(x,z)>safe-1||!this.world.canStand(x,y,z)||Math.abs(y-a.pos.y)>1.2)continue;
        const from=p.clone().add(new THREE.Vector3(0,1.4,0)),delta=enemy.clone().add(new THREE.Vector3(0,1.4,0)).sub(from);
        if(!this.callbacks.environment(from,delta.clone().normalize(),delta.length()-.5))continue;
        const cost=a.pos.distanceTo(p);if(cost<score&&this.nav.route(a.pos,p).length){score=cost;best=p;}
      }
    }return best;
  }
  build(a,kind,enemy,d){
    if(a.wood<RULES.buildCost||a.buildCooldown>0||a.buildPause>0||!a.grounded)return null;
    const yaw=Math.atan2(enemy.x-a.pos.x,-(enemy.z-a.pos.z)),b=this.callbacks.build(a,kind,yaw);a.buildCooldown=b?d.buildDelay:1.5;
    if(!b)return null;a.wood-=RULES.buildCost;a.stats.builds++;a.buildPause=.45;a.action='BUILDING';a.pathTimer=0;
    if(kind==='ramp'){
      a.stats.ramps++;const local=-b.length/2+.25;a.climbGoal=this.point(b.x+Math.sin(b.yaw)*local,b.z+Math.cos(b.yaw)*local,b.y+b.rise*(1-.25/b.length));a.climbLeft=8;
    }else if(kind==='floor')a.stats.floors++;
    return b;
  }
  plan(a,d,safe,time){
    const enemy=a.lastSeen,range=enemy?a.pos.distanceTo(enemy):Infinity;
    if(a.escaping){const zone=this.world.map.id==='sunhaven'?this.world.stormAt(time+18):this.storm,angle=Math.atan2(a.pos.z-zone.z,a.pos.x-zone.x),r=Math.max(0,Math.min(safe,zone.radius??safe)-(this.world.map.id==='sunhaven'?14:10));a.goal=this.groundGoal(zone.x+Math.cos(angle)*r,zone.z+Math.sin(angle)*r);a.action='ESCAPING STORM';a.climbGoal=null;return;}
    if(a.climbGoal&&a.climbLeft>0&&a.pos.distanceTo(a.climbGoal)>.45){a.goal=a.climbGoal;a.action='CLIMBING';return;}a.climbGoal=null;
    if(enemy){
      const threatened=a.reloadLeft>0||a.hurtLeft>0&&a.health+a.shield<90;
      if(threatened&&this.rng()<d.cover){
        const shelter=this.cover(a,enemy,safe);if(shelter){a.goal=shelter;a.action=a.reloadLeft>0?'RELOADING IN COVER':'TAKING COVER';a.stats.cover++;return;}
        if(this.build(a,'wall',enemy,d)){a.goal=a.pos.clone();return;}
      }
      // Build a staircase or a landing to reach a known elevated opponent.
      if(d.highGround>0&&enemy.y>a.pos.y+1.7&&range<27&&a.reloadLeft<=0){
        if(this.build(a,'ramp',enemy,d)){a.goal=a.climbGoal;return;}
      }
      if(d.highGround>0&&a.pos.y>this.world.heightAt(a.pos.x,a.pos.z)+2&&range>9&&a.reloadLeft<=0){
        const ahead=a.pos.clone().lerp(enemy,Math.min(1,4/range));if(this.world.floorAt(ahead.x,ahead.z,a.pos.y)<a.pos.y-1&&this.build(a,'floor',enemy,d)){a.goal=this.point(ahead.x,ahead.z,a.pos.y);return;}
      }
      if(!a.visibleTarget){a.goal=enemy.clone();a.action='SEARCHING';return;}
      if(d.highGround>0&&range>12&&time>a.nextHighGround){
        a.nextHighGround=time+12;
        const tops=this.nav.highSpots.filter(p=>p.y>a.pos.y+1&&distance(p,a.pos)<22&&this.safeDistance(p.x,p.z)<safe-3&&distance(p,enemy)<d.vision).sort((x,y)=>distance(x,a.pos)-distance(y,a.pos));
        if(tops.length&&this.rng()<d.highGround){const path=this.nav.route(a.pos,tops[0]);if(path.length){a.climbGoal=this.point(tops[0].x,tops[0].z,tops[0].y);a.climbLeft=14;a.goal=a.climbGoal;a.action='CLIMBING';return;}}
      }
      const dx=enemy.x-a.pos.x,dz=enemy.z-a.pos.z,len=Math.hypot(dx,dz)||1;
      if(range>23||Math.abs(enemy.y-a.pos.y)>2){a.goal=enemy.clone();a.action='CLOSING IN';return;}
      const retreat=range<10?-4:0,x=a.pos.x+dx/len*retreat+dz/len*a.strafe*d.strafe,z=a.pos.z+dz/len*retreat-dx/len*a.strafe*d.strafe,y=this.world.floorAt(x,z,a.pos.y);
      if(this.safeDistance(x,z)<safe-1&&Math.abs(y-a.pos.y)<.8&&this.world.canStand(x,y,z)){a.goal=this.point(x,z,y);a.action='FLANKING';}else{a.strafe*=-1;a.goal=a.pos.clone();a.action='AIMING';}
      return;
    }
    if(distance(a.goal,a.pos)<2||time>a.patrolUntil){
      const angle=this.rng()*Math.PI*2,r=8+this.rng()*Math.min(28,Math.max(0,safe-12));
      if(this.world.map.id==='sunhaven'){
        const toward=.22,px=a.pos.x*(1-toward)+this.storm.x*toward+Math.sin(angle)*r,pz=a.pos.z*(1-toward)+this.storm.z*toward+Math.cos(angle)*r;
        a.goal=this.groundGoal(px,pz);a.patrolUntil=time+12;
      }else{a.goal=this.point(Math.sin(angle)*r,Math.cos(angle)*r);a.patrolUntil=time+8;}
    }
    a.action='PATROLLING';
  }
  update(dt,time,player,actors){
    this.storm=this.world.stormAt(time);const safe=this.storm.radius,all=[player,...actors];this.nav.refresh();
    for(const a of actors){
      if(!a.alive)continue;const d=DIFFICULTIES[a.level];
      for(const key of ['cooldown','senseLeft','planLeft','pathTimer','memoryLeft','stagger','buildCooldown','buildPause','climbLeft','jumpCooldown','hurtLeft','strafeLeft'])a[key]=Math.max(0,a[key]-dt);
      if(a.strafeLeft<=0){a.strafe*=-1;a.strafeLeft=2+this.rng()*2;}
      if(a.reloadLeft>0){a.reloadLeft=Math.max(0,a.reloadLeft-dt);if(!a.reloadLeft){a.ammo=d.magazine;a.cooldown=d.reaction;a.planLeft=0;}}
      if(a.ammo<=0&&!a.reloadLeft){a.reloadLeft=d.reload;a.stats.reloads++;a.planLeft=0;}
      if(a.senseLeft<=0){a.senseLeft=d.sense;this.sense(a,all,player,time,d);}
      const ahead=this.world.map.id==='sunhaven'?this.world.stormAt(time+12):this.storm;const escaping=Math.hypot(a.pos.x-ahead.x,a.pos.z-ahead.z)>Math.max(0,ahead.radius-5);if(escaping!==a.escaping){a.escaping=escaping;a.planLeft=0;a.pathTimer=0;}
      if(a.planLeft<=0){a.planLeft=.75+this.rng()*.45;const old=a.goal;this.plan(a,d,safe,time);if(distance(old,a.goal)>1||Math.abs(old.y-a.goal.y)>1)a.pathTimer=0;}
      if(a.pathTimer<=0){a.pathTimer=.8+this.rng()*.5;a.path=this.nav.route(a.pos,a.goal);}
      while(a.path.length&&a.pos.distanceTo(a.path[0])<.35)a.path.shift();const waypoint=a.path[0];let moved=0;
      if(waypoint&&a.stagger<=0&&a.buildPause<=0){const dx=waypoint.x-a.pos.x,dz=waypoint.z-a.pos.z,len=Math.hypot(dx,dz)||1,speed=d.speed*(a.escaping?1.45:a.reloadLeft>0?1.12:1),travel=Math.min(len,speed*dt);moved=this.world.move(a,dx/len*travel,dz/len*travel);if(!a.visibleTarget)a.walkYaw=Math.atan2(-dx,-dz);a.stuck=moved<dt*.25?a.stuck+dt:0;}
      else if(!a.target)a.walkYaw+=dt*.55;
      if(a.stuck>.5){a.pathTimer=0;a.planLeft=0;a.strafe*=-1;if(d.jump&&a.grounded&&a.jumpCooldown<=0){a.vy=8;a.grounded=false;a.jumpCooldown=2.5;}a.stuck=0;}
      const floor=Math.max(this.world.floorAt(a.pos.x,a.pos.z,a.pos.y),this.world.rockContactFloor(a)),ceiling=this.world.ceilingAt(a.pos.x,a.pos.z,a.pos.y+RULES.playerHeight);a.vy-=RULES.gravity*dt;a.pos.y+=a.vy*dt;if(a.vy>0&&a.pos.y+RULES.playerHeight>ceiling){a.pos.y=ceiling-RULES.playerHeight;a.vy=0;}if(a.pos.y<=floor){a.pos.y=floor;a.vy=0;a.grounded=true;}else a.grounded=false;
        this.world.resolveRockContacts(a);
        if(a.grounded&&a.pos.y>a.peakY+.5){a.stats.climbed+=a.pos.y-a.peakY;a.peakY=a.pos.y;}
      const canFire=a.visibleTarget&&a.target?.alive&&a.reloadLeft<=0&&a.buildPause<=0&&a.stagger<=0;
      a.warning=canFire&&a.cooldown<d.reaction+.1?1:0;
      if(a.visibleTarget&&a.lastSeen){const delta=a.lastSeen.clone().sub(a.pos);a.walkYaw=Math.atan2(-delta.x,-delta.z);}
      if(canFire&&a.cooldown<=0){
        const aim=a.lastSeen.clone().add(new THREE.Vector3(0,bodyHeight(a.target),0)).addScaledVector(a.targetVelocity,d.lead*(d.sense+.12)),range=a.pos.distanceTo(aim),error=Math.max(.12,range*d.spread);
        aim.x+=(this.rng()*2-1)*error;aim.z+=(this.rng()*2-1)*error*.35;aim.y+=(this.rng()*2-1)*error*.8;
        this.callbacks.fire(a,aim,d);a.ammo--;a.stats.shots++;this.noise(a,time);a.burstLeft--;
        if(a.burstLeft<=0){a.burstLeft=d.burst;a.cooldown=d.burstPause;}else a.cooldown=d.shotInterval;
      }
      if(a.reloadLeft>0&&!a.action.includes('COVER'))a.action='RELOADING';
      a.ring.material.color.setHex(a.reloadLeft>0?0x78eaff:a.buildPause>0?0x8affca:a.warning?0xffec72:0xffa596);a.ring.scale.setScalar(a.warning?1.35:1);
      a.animate(dt,moved/dt,a.walkYaw,canFire,{reload:a.reloadLeft>0?1-a.reloadLeft/d.reload:0,time});
    }
  }
}



