// Use the same irregular oak/ash templates as the earlier island woodland.
// Bank sites clear the new rock bodies so the trunk grows from visible ground.
export const NATURAL_DOCKS_SITES=Object.freeze([
  {id:'north-bank-tree',x:91,z:-5.5,scale:1.2},
  {id:'south-bank-tree',x:88,z:55.5,scale:1.25},
  {id:'boathouse-backdrop-tree',x:68,z:-5,scale:1.1},
]);
export function addNaturalDocksTrees(world){
  let relocated=0;
  for(const tree of world.foliage.trees){
    const radius=.5*tree.scale,height=3.4*tree.scale;
    if(!world.approvedRocks.rocks.some(r=>r.obstacle.shape.blocks(tree.x,tree.z,radius,tree.y,height,0)))continue;
    const collider=world.obstacles.find(o=>o.kind==='tree'&&Math.hypot(o.mesh.matrix.elements[12]-tree.x,o.mesh.matrix.elements[14]-tree.z)<.001);
    let site;
    for(let distance=1;distance<=8&&!site;distance+=.5)for(let i=0;i<24;i++){
      const angle=i*Math.PI/12,x=tree.x+Math.cos(angle)*distance,z=tree.z+Math.sin(angle)*distance,y=world.heightAt(x,z);
      if(y<.6||world.isRampApproach(x,z,1))continue;
      if(world.nearObstacles(x,z,radius+.3).some(o=>o!==collider&&(o.shape?o.shape.blocks(x,z,radius+.3,y,height,0):world.obstacleBlocks(o,x,y,z,radius+.3,height))))continue;
      site={x,y,z};break;
    }
    if(!site)throw new Error('No grounded tree site beside approved rock formation');
    Object.assign(tree,site);tree.matrix.elements[12]=site.x;tree.matrix.elements[13]=site.y;tree.matrix.elements[14]=site.z;
    collider.mesh.matrix.copy(tree.matrix);collider.mesh.updateWorldMatrix(true,false);
    collider.box.min.set(site.x-.35*tree.scale,site.y,site.z-.35*tree.scale);collider.box.max.set(site.x+.35*tree.scale,site.y+height,site.z+.35*tree.scale);
    world.foliage.dirty=true;world.navVersion++;relocated++;
  }
  for(const site of NATURAL_DOCKS_SITES)world.tree(site.x,site.z,site.scale,false);
  world.docksTrees={style:'original island woodland',landmarks:NATURAL_DOCKS_SITES.length,relocated};
}
