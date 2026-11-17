import { RULES, clamp } from './config.js';

export const MOVEMENT=Object.freeze({crouchHeight:1.7,slideHeight:1.5,crouchSpeed:3.3,acceleration:55,braking:72,airControl:14,coyote:.12,buffer:.15,slideSpeed:13.5,slideMax:16,slideDuration:1.15,slideCooldown:.65});
export const bodyHeight=a=>(a.height??RULES.playerHeight)/RULES.playerHeight*1.3;

// One controller for all player locomotion; bounded physics steps keep fast
// slides and jumping consistent even when a rendered frame takes 50 ms.
export class Movement {
  constructor(actor,world){this.actor=actor;this.world=world;this.reset();}
  reset(){this.vx=0;this.vz=0;this.jumpBuffer=0;this.coyote=0;this.crouchWanted=false;this.crouchPress=false;this.slideLeft=0;this.cooldown=0;this.events=[];this.speed=0;this.landing=0;this.actor.rockSafePosition=null;this.actor.rockSupportPosition=null;this.actor.height=RULES.playerHeight;this.actor.stance='standing';this.actor.poseHeight=RULES.playerHeight;}
  clearInput(){this.jumpBuffer=0;this.crouchPress=false;}
  jump(){this.jumpBuffer=MOVEMENT.buffer;}
  crouch(){this.crouchPress=true;}
  fits(height){const a=this.actor;return this.world.canStand(a.pos.x,a.pos.y,a.pos.z,a.radius,height)&&this.world.ceilingAt(a.pos.x,a.pos.z,a.pos.y+a.height)>=a.pos.y+height+.02;}
  update(dt,input){
    this.events.length=0;let moved=0;
    const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
    for(let i=0;i<steps;i++)moved+=this.step(h,input);
    this.speed=moved/dt;const a=this.actor;
    a.poseHeight+=(a.height-a.poseHeight)*(1-Math.exp(-22*dt));this.landing=Math.max(0,this.landing-dt*4);
    return this.events;
  }
  step(dt,input){
    const a=this.actor,w=this.world,m=MOVEMENT;
    const length=Math.hypot(input.x,input.z),ix=length?input.x/length:0,iz=length?input.z/length:0;
    this.cooldown=Math.max(0,this.cooldown-dt);this.coyote=a.grounded?m.coyote:Math.max(0,this.coyote-dt);
    if(this.crouchPress){
      this.crouchPress=false;
      if(this.slideLeft>0){this.slideLeft=0;this.crouchWanted=true;}
      else if(a.grounded&&input.sprint&&!input.aim&&Math.hypot(this.vx,this.vz)>7.5&&this.cooldown===0){
        const speed=Math.hypot(this.vx,this.vz);this.vx=this.vx/speed*m.slideSpeed;this.vz=this.vz/speed*m.slideSpeed;
        this.slideLeft=m.slideDuration;this.crouchWanted=false;this.events.push('slide');
      }else this.crouchWanted=!this.crouchWanted;
    }
    if(this.slideLeft>0){this.slideLeft=Math.max(0,this.slideLeft-dt);this.cooldown=m.slideCooldown;}
    // Never stand into a ceiling. Release the low pose automatically once clear.
    const wanted=this.slideLeft>0?m.slideHeight:this.crouchWanted?m.crouchHeight:RULES.playerHeight;
    if(wanted<=a.height||this.fits(wanted))a.height=wanted;
    a.stance=this.slideLeft>0?'sliding':a.height<RULES.playerHeight?'crouching':'standing';
    if(this.jumpBuffer>0&&this.coyote>0&&this.fits(RULES.playerHeight)){
      this.jumpBuffer=this.coyote=0;this.slideLeft=0;this.crouchWanted=false;a.height=RULES.playerHeight;a.stance='standing';
      a.vy=RULES.jump;a.grounded=false;this.events.push('jump');
    }else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    if(this.slideLeft>0){
      let speed=Math.hypot(this.vx,this.vz),angle=Math.atan2(this.vx,this.vz);
      if(length){const target=Math.atan2(ix,iz),turn=Math.atan2(Math.sin(target-angle),Math.cos(target-angle));angle+=clamp(turn,-1.7*dt,1.7*dt);}
      // Only sample the reachable surface: floors above us are not slopes.
      const ahead=w.floorAt(a.pos.x+Math.sin(angle)*.3,a.pos.z+Math.cos(angle)*.3,a.pos.y);
      const slope=a.grounded?clamp((a.pos.y-ahead)/.3,-.8,.8):0;
      speed=clamp(speed+(slope*14-5.5)*dt,0,m.slideMax);this.vx=Math.sin(angle)*speed;this.vz=Math.cos(angle)*speed;
      if(speed<4.2)this.slideLeft=0;
    }else{
      const speed=a.height<RULES.playerHeight?m.crouchSpeed:input.aim?RULES.aimSpeed:input.sprint?RULES.sprint:RULES.walk;
      // In the air, preserve takeoff momentum while allowing useful steering.
      const targetSpeed=!a.grounded?Math.max(speed,Math.hypot(this.vx,this.vz)):speed;
      const tx=ix*targetSpeed,tz=iz*targetSpeed,dx=tx-this.vx,dz=tz-this.vz,d=Math.hypot(dx,dz);
      const acceleration=a.grounded?(length?m.acceleration:m.braking):(length?m.airControl:1.5),change=Math.min(d,acceleration*dt);
      if(d){this.vx+=dx/d*change;this.vz+=dz/d*change;}
    }
    const ox=a.pos.x,oz=a.pos.z,wasGrounded=a.grounded;
    const distance=w.move(a,this.vx*dt,this.vz*dt);
    if(Math.abs(a.pos.x-ox)<Math.abs(this.vx*dt)*.1)this.vx=0;
    if(Math.abs(a.pos.z-oz)<Math.abs(this.vz*dt)*.1)this.vz=0;
    if(this.slideLeft>0&&Math.hypot(this.vx,this.vz)<4.2)this.slideLeft=0;
    const floor=Math.max(w.floorAt(a.pos.x,a.pos.z,a.pos.y),w.rockContactFloor?.(a)??-Infinity),ceiling=w.ceilingAt(a.pos.x,a.pos.z,a.pos.y+a.height);
    const gravity=RULES.gravity*(a.vy>0&&!input.jumpHeld?2.2:1);
    a.pos.y+=a.vy*dt-gravity*dt*dt*.5;a.vy-=gravity*dt;
    if(a.vy>0&&a.pos.y+a.height>ceiling){a.pos.y=ceiling-a.height-.005;a.vy=0;this.jumpBuffer=0;}
    // Follow shallow downhill changes rather than bouncing off every ramp seam.
    if(a.pos.y<=floor||(wasGrounded&&a.vy<=0&&a.pos.y-floor<.16)){
      if(!wasGrounded&&a.vy<-3){this.events.push('land');this.landing=clamp(-a.vy/22,0,1);}
      a.pos.y=floor;a.vy=0;a.grounded=true;
    }else a.grounded=false;
    w.resolveRockContacts?.(a);
    return distance;
  }
}


