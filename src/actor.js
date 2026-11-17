import * as THREE from 'three';
import { box, ball, cylinder, mat } from './world.js';
import { createWeaponModel,animateWeapon } from './weapon-models.js';
import { surface, rounded, batchDecorations } from './materials.js';
export function createActor(scene,color=0xffcd53,isBot=false) {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);scene.add(root);
  const suit=surface('fabric',color,3,3).clone(),dark=0x284557,white=0xfff4df;suit.userData.owned=true;
  const rubber=mat(dark),cream=mat(white,{flatShading:false}),shell=mat(color,{roughness:.42,flatShading:false});shell.userData.owned=true;cream.userData.owned=true;
  const R=(w,h,d,m,x,y,z,parent=body,r=.07)=>rounded(w,h,d,m,x,y,z,parent,r);
  const torso=box(.87,.95,.55,suit,0,1.12,0,body);torso.geometry.dispose();torso.geometry=new THREE.CapsuleGeometry(.41,.38,3,6);torso.scale.set(1,1,.8);
  const pelvis=new THREE.Group();pelvis.name='Pelvis joint';body.add(pelvis);
  // Explorer jacket, harness, and a rounded day pack with the Sunspark badge.
  R(.75,.16,.61,rubber,0,.79,0,pelvis);R(.12,.72,.04,cream,-.27,1.2,-.28);R(.12,.72,.04,cream,.27,1.2,-.28);
  R(.16,.15,.05,shell,0,.79,-.33,pelvis);R(.035,.68,.035,rubber,0,1.18,-.33);
  const packStart=new Set(body.children);
  R(.69,.67,.32,surface('fabric',0x39b2b1,2,2),0,1.22,.36);
  R(.56,.2,.36,mat(0x78d6bd),0,1.52,.37);R(.44,.23,.08,mat(0x277d86),0,1.08,.56);
  for(const x of [-.23,.23])R(.07,.53,.055,cream,x,1.27,.55);
  const badge=cylinder(.125,.125,.035,0xffe291,0,1.35,.55,body,16);badge.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i*Math.PI/4,b=box(.022,.06,.028,0xffe291,Math.sin(a)*.165,1.35+Math.cos(a)*.165,.572,body);b.rotation.z=-a;}
  const bottle=cylinder(.07,.08,.35,mat(0x8eeddf,{roughness:.25}),.4,1.18,.34,body,10);bottle.material.userData.owned=true;
  cylinder(.045,.045,.07,dark,.4,1.39,.34,body,8);
  const backpack=new THREE.Group();backpack.name='Rigid backpack';
  for(const child of [...body.children])if(!packStart.has(child)){body.remove(child);backpack.add(child);}body.add(backpack);
  const headStart=new Set(body.children);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.48,20,12),cream);head.position.set(0,1.97,0);head.scale.set(1,.98,.92);head.castShadow=true;body.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.51,20,12,0,Math.PI*2,0,Math.PI*.56),shell);helmet.position.set(0,2.08,.02);helmet.scale.y=.65;helmet.castShadow=true;body.add(helmet);
  const band=cylinder(.497,.497,.055,dark,0,2.07,.02,body,20);band.scale.z=.94;
  R(.12,.06,.72,cream,0,2.39,.025,body,.025);
  R(.7,.30,.17,rubber,0,1.99,-.36,body,.065);
  const visorMaterial=mat(0x327b91,{roughness:.15,metalness:.38});visorMaterial.userData.owned=true;
  R(.6,.20,.035,visorMaterial,0,2,-.455,body,.04);R(.2,.035,.012,mat(0xa3f3df),-.14,2.045,-.48,body,.01);
  for(const side of [-1,1]){const ear=cylinder(.13,.13,.08,white,side*.47,2.03,0,body,12);ear.rotation.z=Math.PI/2;}
  if(isBot){cylinder(.035,.035,.3,dark,0,2.58,0,body);ball(.095,0xfff292,0,2.77,0,body);}
  const neck=new THREE.Group();neck.name='Neck joint';neck.position.y=1.55;
  for(const child of [...body.children])if(!headStart.has(child)){body.remove(child);child.position.y-=1.55;neck.add(child);}body.add(neck);
  const legs=[],knees=[],feet=[];for(const x of [-.23,.23]){
    const g=new THREE.Group();g.position.set(x,.72,0);R(.29,.33,.32,rubber,0,-.13,0,g);R(.23,.16,.065,shell,0,-.23,-.18,g);
    const knee=new THREE.Group();knee.position.y=-.32;g.add(knee);R(.27,.30,.30,rubber,0,-.13,0,knee);
    const foot=new THREE.Group();foot.position.y=-.32;knee.add(foot);feet.push(foot);R(.34,.20,.5,rubber,0,.05,-.1,foot);R(.35,.07,.51,cream,0,-.045,-.1,foot,.025);
    for(const y of [.10,.04])R(.22,.025,.025,cream,0,y,-.354,foot,.008);body.add(g);legs.push(g);knees.push(knee);
  }
  const arms=[],elbows=[],hands=[];
  for(const x of [-.56,.56]){
    const shoulder=new THREE.Group();shoulder.position.set(x,1.5,0);body.add(shoulder);
    R(.26,.3,.29,suit,0,-.13,-.02,shoulder);R(.28,.19,.32,shell,0,.005,-.02,shoulder);
    const elbow=new THREE.Group();elbow.position.y=-.29;shoulder.add(elbow);
    R(.24,.25,.27,suit,0,-.11,0,elbow);R(.26,.1,.29,rubber,0,-.22,0,elbow);
    const hand=ball(.15,white,0,-.28,0,elbow,1);arms.push(shoulder);elbows.push(elbow);hands.push(hand);
  }
  const gun=new THREE.Group();gun.position.set(.54,1.28,-.55);body.add(gun);
  const model=createWeaponModel(0);gun.add(model.group);const muzzle=model.muzzle;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.68,.78,28),new THREE.MeshBasicMaterial({color:isBot?0xffa596:0xffec82,transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.material.userData.owned=true;ring.rotation.x=-Math.PI/2;ring.position.y=.035;root.add(ring);
  for(const limb of [...feet,...elbows])batchDecorations(limb,new Set(hands));
  for(const arm of arms)batchDecorations(arm,new Set(),new Set(elbows));
  for(const knee of knees)batchDecorations(knee,new Set(),new Set(feet));
  for(const leg of legs)batchDecorations(leg,new Set(),new Set(knees));
  const upper=new THREE.Group();upper.position.y=.72;
  for(const child of [...body.children])if(!legs.includes(child)&&child!==gun&&child!==pelvis){body.remove(child);child.position.y-=.72;upper.add(child);}
  body.add(upper);upper.name='Hip and spine joint';
  batchDecorations(pelvis);batchDecorations(neck,new Set([head]));batchDecorations(backpack);
  batchDecorations(upper,new Set([torso]),new Set([...arms,neck,backpack]));
  // Beyond fighting-detail range, keep the same silhouette and suit color with
  // a few simple meshes. The real pose/muzzle remain updated for combat.
  const distantBody=new THREE.Group(),distantLegs=[];distantBody.visible=false;root.add(distantBody);
  if(isBot){
    box(.84,.96,.54,suit,0,1.13,0,distantBody);ball(.47,cream,0,1.98,0,distantBody,1);
    const cap=ball(.5,shell,0,2.15,0,distantBody,1);cap.scale.y=.48;
    box(.60,.27,.12,rubber,0,2,-.4,distantBody);box(.65,.65,.28,surface('fabric',0x39b2b1,2,2),0,1.25,.38,distantBody);
    for(const x of [-.55,.55])box(.25,.61,.28,suit,x,1.22,-.1,distantBody);
    box(.2,.23,.9,shell,.54,1.32,-.82,distantBody);cylinder(.035,.035,.3,dark,0,2.58,0,distantBody);
    ball(.095,0xfff292,0,2.77,0,distantBody);
    for(const x of [-.23,.23]){const leg=box(.30,.72,.4,rubber,x,.35,-.02,distantBody);distantLegs.push(leg);}
    batchDecorations(distantBody,new Set(distantLegs));
  }
  return {root,body,pelvis,upper,neck,backpack,knees,feet,elbows,hands,torso,head,gun,muzzle,weaponModel:model.group,weaponIndex:0,legs,arms,ring,pos:root.position,health:100,shield:100,vy:0,grounded:true,radius:.48,alive:true,flash:0,recoil:0,walkCycle:0,isBot,distant:false,
    setDetail(distant){if(!isBot)return;this.distant=distant;body.visible=!distant;distantBody.visible=distant;},
    animate(dt,speed,yaw,aim=false,weaponState={}){
      root.rotation.y=yaw;this.walkCycle+=dt*speed*1.7;const low=Math.max(0,Math.min(1,(2.25-(this.poseHeight??2.25))/.55)),slide=Math.max(0,Math.min(1,(1.7-(this.poseHeight??2.25))/.2));
      // Pose only through rigid joint rotations/translations. In particular,
      // never scale a parent of the helmet, backpack or equipped weapon.
      const lean=low*1.04+slide*.19,hipY=.72-low*.38-slide*.07,hipZ=low*.58-slide*.04;
      const stride=Math.min(speed/6,1)*.7*(1-low*.65)*(1-slide);
      pelvis.position.set(0,hipY-.72,hipZ);upper.position.set(0,hipY,hipZ);upper.rotation.x=-lean;neck.rotation.x=lean;
      body.position.set(0,0,0);
      for(let i=0;i<2;i++){
        const leg=legs[i],phase=this.walkCycle+i*Math.PI;
        leg.position.set((i===0?-1:1)*(.23+low*.055),hipY,hipZ);leg.rotation.z=0;
        if(low>.001&&this.grounded){
          const swing=Math.sin(phase),travel=Math.min(speed/3.3,1)*(1-slide);
          const footZ=low*(i===0?-.015:.12)+swing*.14*travel,footY=.08+Math.max(0,Math.cos(phase))*.055*travel;
          const dz=footZ-hipZ,dy=footY-hipY,d=Math.min(.6399,Math.hypot(dy,dz));
          const bend=2*Math.acos(d/.64),thigh=Math.atan2(-dz,-dy)+bend/2;
          leg.rotation.x=thigh;knees[i].rotation.x=-bend;feet[i].rotation.x=bend-thigh;
        }else{
          leg.rotation.x=this.grounded?Math.sin(phase)*stride:i===0?-.35:.1;
          knees[i].rotation.x=this.grounded?0:i===0?.6:.4;feet[i].rotation.x=0;
        }
      }
      distantLegs.forEach((leg,i)=>leg.rotation.x=legs[i].rotation.x);
      this.recoil=Math.max(0,this.recoil-dt*7);
      gun.position.set(.54-low*.04,1.28-low*.36-slide*.2,-.55-low*.12-slide*.12+this.recoil*.2);gun.rotation.x=0;
      // The right hand follows the grip through a two-link shoulder/elbow
      // solution. The spare arm balances the squat instead of stretching.
      for(let i=0;i<2;i++){
        const shoulder=arms[i];shoulder.rotation.x=0;
        const sy=hipY+.78*Math.cos(lean),sz=hipZ-.78*Math.sin(lean);
        const handY=i===1?gun.position.y-.2:sy-.36+low*.08;
        const handZ=i===1?gun.position.z+.06:sz-.12-low*.08;
        const dy=handY-sy,dz=handZ-sz,d=Math.min(.5699,Math.hypot(dy,dz));
        const bend=Math.acos(Math.max(-1,Math.min(1,(d*d-.29*.29-.28*.28)/(2*.29*.28))));
        const angle=Math.atan2(-dz,-dy)-Math.atan2(.28*Math.sin(bend),.29+.28*Math.cos(bend));
        shoulder.rotation.x=angle+lean;elbows[i].rotation.x=bend;
      }
      animateWeapon(this.weaponModel,{time:this.walkCycle,recoil:this.recoil,...weaponState});
      this.flash=Math.max(0,this.flash-dt);suit.emissive.setHex(this.flash>0?0xffe1ad:0);suit.emissiveIntensity=this.flash>0?.7:0;
    }
  };
}
