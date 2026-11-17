// Procedural toy blasters.
import * as THREE from 'three';
import { ball,cylinder,mat } from './world.js';
import { rounded, surface, batchDecorations } from './materials.js';
import { WEAPONS,PARTY_COLORS } from './config.js';
const box=(w,h,d,color,x,y,z,parent)=>rounded(w,h,d,typeof color==='number'?mat(color):color,x,y,z,parent,.035);

export function createWeaponModel(index){
  const g=new THREE.Group(),dark=0x284557,cream=0xfff4df,w=WEAPONS[index];
  box(.16,.3,.2,surface('fabric',dark,2,2),0,-.23,.06,g);
  const magazine=new THREE.Group();magazine.position.set(0,-.2,-.06);g.add(magazine);
  box(.19,.26,.25,w.color,0,-.12,0,magazine);
  let tip=-.9,core=null,spinner=null;
  if(index===0){
    box(.25,.3,.8,dark,0,0,-.17,g);box(.31,.26,.5,w.color,0,.05,-.4,g);
    for(const x of [-.17,.17])box(.03,.08,.38,cream,x,.05,-.38,g);
    box(.21,.16,.19,0x6feecf,0,.03,-.75,g);box(.08,.08,.18,dark,0,.22,-.17,g);
    for(const x of [-.163,.163])for(let i=0;i<3;i++)box(.018,.07,.035,dark,x,.12,-.3-i*.08,g);
  }else if(index===1){
    const barrel=cylinder(.26,.32,.72,w.color,0,.03,-.35,g,16);barrel.rotation.x=Math.PI/2;
    const rim=cylinder(.275,.275,.065,cream,0,.03,-.70,g,16);rim.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ball(.055,PARTY_COLORS[i%5],Math.cos(a)*.25,.03+Math.sin(a)*.25,-.73,g);}
    box(.38,.25,.3,cream,0,.03,.06,g);spinner=cylinder(.2,.2,.22,0x69dcd2,0,-.12,0,magazine);spinner.rotation.z=Math.PI/2;
  }else if(index===2){
    tip=-1.25;box(.25,.26,.75,0x735bb8,0,0,-.24,g);
    for(const x of [-.12,.12])box(.075,.11,.87,0x7eedd5,x,.02,-.78,g);
    const crystal=ball(.2,mat(0xb7abff,{emissive:0x8f7bff,emissiveIntensity:.35}),0,.03,-.9,g,0);crystal.scale.set(.65,.85,1.7);crystal.material.userData.owned=true;core=crystal;
    box(.13,.15,.31,cream,0,.22,-.21,g);ball(.065,0x71efcf,0,.25,-.4,g);
    for(let i=0;i<3;i++)box(.27,.04,.045,cream,0,-.015,-.28+i*.10,g);
  }else{
    box(.3,.29,.62,0x4ac6b0,0,0,-.22,g);const nozzle=cylinder(.16,.21,.26,0xff8bb6,0,.03,-.63,g,16);nozzle.rotation.x=Math.PI/2;
    const globe=ball(.29,mat(0xe0fff2,{transparent:true,opacity:.24,depthWrite:false}),0,.38,-.2,g,1);globe.material.userData.owned=true;
    spinner=new THREE.Group();spinner.position.set(0,.38,-.2);g.add(spinner);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(.075,PARTY_COLORS[i%5],Math.cos(a)*.15,Math.sin(a*2)*.09,Math.sin(a)*.15,spinner);}
    box(.2,.08,.25,cream,0,.64,-.2,g);
  }
  const muzzle=new THREE.Object3D();muzzle.position.set(0,.04,tip);g.add(muzzle);
  batchDecorations(magazine,new Set(),new Set([spinner]));
  batchDecorations(g,new Set(),new Set([magazine,core,spinner]));
  g.userData.parts={magazine,core,spinner,index};return {group:g,muzzle};
}

export function animateWeapon(g,{reload=0,charge=0,recoil=0,time=0}){
  const {magazine,core,spinner,index}=g.userData.parts;
  const dip=Math.sin(Math.PI*reload);
  g.rotation.x=dip*(index===2?-.24:.32);g.rotation.z=dip*(index===1?-.35:.22);
  magazine.position.y=-.2-dip*(index===1?.16:.35);magazine.rotation.z=dip*.4;
  if(spinner)spinner.rotation.y=time*(index===3?1.4:.3)+recoil*1.1;
  if(core){core.material.emissiveIntensity=.35+charge*2;core.scale.y=.85+charge*.25;}
}
