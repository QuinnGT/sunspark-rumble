// Swept gumball flight with one ricochet.
import * as THREE from 'three';
import { ball,heightAt } from './world.js';
import { WEAPONS,PARTY_COLORS } from './config.js';

export class Gumballs {
  constructor(scene,callbacks){this.scene=scene;this.callbacks=callbacks;this.items=[];this.serial=0;this.bounces=0;}
  launch(origin,direction){
    const w=WEAPONS[3],color=PARTY_COLORS[this.serial++%PARTY_COLORS.length],mesh=ball(.17,color,...origin.toArray(),this.scene,1);
    mesh.castShadow=false;
    this.items.push({mesh,direction:direction.clone().normalize(),remaining:w.range,bounces:0,color});
  }
  remove(p){p.mesh.removeFromParent();p.mesh.geometry.dispose();this.items.splice(this.items.indexOf(p),1);}
  clear(){for(const p of [...this.items])this.remove(p);this.bounces=0;}
  update(dt){
    const w=WEAPONS[3];
    for(const p of [...this.items]){
      let travel=Math.min(w.speed*dt,p.remaining),alive=true;
      // Consume the remainder after a bounce in the same step. Sweeps prevent
      // passing through thin walls even at the slowest supported update rate.
      for(let collision=0;travel>0&&alive&&collision<3;collision++){
        const origin=p.mesh.position.clone(),env=this.callbacks.environment(origin,p.direction,travel),limit=env?env.distance:travel;
        const hit=this.callbacks.actor(origin,p.direction,limit);
        if(hit){this.callbacks.hit(hit.actor,w.damage*(p.bounces?.8:1),hit.point,p.color);this.remove(p);alive=false;break;}
        if(!env){p.mesh.position.addScaledVector(p.direction,travel);p.remaining-=travel;travel=0;break;}
        p.remaining-=env.distance;travel-=env.distance;
        if(p.bounces){this.callbacks.impact(env,p.color,false);this.remove(p);alive=false;break;}
        let normal;
        if(env.face)normal=env.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(env.object.matrixWorld)).normalize();
        else{const {x,z}=env.point,e=.05,sample=this.callbacks.heightAt||heightAt;normal=new THREE.Vector3(sample(x-e,z)-sample(x+e,z),2*e,sample(x,z-e)-sample(x,z+e)).normalize();}
        if(normal.dot(p.direction)>0)normal.negate();
        p.direction.reflect(normal).normalize();p.mesh.position.copy(env.point).addScaledVector(normal,.04);p.bounces++;this.bounces++;
        this.callbacks.impact(env,p.color,true);
      }
      if(alive&&p.remaining<=.001)this.remove(p);
    }
  }
}
