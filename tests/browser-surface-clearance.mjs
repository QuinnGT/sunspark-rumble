// Geometry is gated by surface-clearance.test.js. These actual textured WebGL
// views exercise depth rendering during camera movement; inspect the saved views.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const cameraFixes=process.argv.includes('--camera-fixes'),onlyTarget=process.argv.find(arg=>arg.startsWith('--target='))?.slice(9);
const before=process.argv.includes('--before'),tag=before?'before':'after',dir=process.argv.includes('--beam-fix')?'tests/artifacts/beam-clearance/surfaces':process.argv.includes('--rock-fix')?'tests/artifacts/rock-trapping/surfaces':process.argv.includes('--approved')?'tests/artifacts/approved-docks/surfaces':process.argv.includes('--docks')?'tests/artifacts/docks-milestone/surfaces':'tests/artifacts/surface-clearance';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[],views=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',r=>r.fulfill({path:`${dir}/before.qa.bundle.js`,contentType:'application/javascript'}));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);
  await page.locator('#explore').click();await page.keyboard.press('KeyP');
  await page.addStyleTag({content:'#pause,#hud{display:none!important}'});
  const targetSet=await page.evaluate(()=>{
    const g=window.__test,w=g.world,architecture=w.docksArchitecture;
    const unchanged=w.coastalAssets.flatMap(a=>{
      if(architecture&&a.kind==='boathouse')return [];
      if(Number.isFinite(a.roof))return [{name:`roof-${a.x}-${a.z}`,x:a.x,z:a.z,top:a.roof,width:a.width,depth:a.depth,view:'legacy'}];
      if(a.kind==='coastal-shed')return [{name:`floor-${a.x}-${a.z}`,x:a.x,z:a.z,top:a.y+.18,width:6,depth:5,view:'legacy'}];
      if(a.kind==='boardwalk')return [{name:`dock-${a.x}-${a.z}`,x:a.x,z:a.z,top:a.y,width:a.width,depth:a.depth,view:'legacy'}];
      return [];
    });
    const added=[];w.scene.updateMatrixWorld(true);
    if(architecture){
      const names=new Set(architecture.surfaceLayers.map(layer=>layer.name));
      w.scene.traverse(parent=>{for(const layer of parent.userData.surfaceLayers??[]){
        if(!names.has(layer.name))continue;
        const points=layer.points.map(point=>parent.localToWorld(g.player.pos.clone().fromArray(point)));
        const normal=g.player.pos.clone().fromArray(layer.normal).transformDirection(parent.matrixWorld.clone().invert().transpose()).toArray();
        const bounds=points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y),minZ:Math.min(b.minZ,p.z),maxZ:Math.max(b.maxZ,p.z)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity});
        const centre=points.reduce((p,point)=>p.add(point),g.player.pos.clone().set(0,0,0)).multiplyScalar(1/points.length);
        const view=Math.abs(normal[1])<.5?(layer.name.includes('interior')?'interior-wall':'facade'):layer.name.includes('main timber floor')?'interior':layer.name.includes('workshop floor')?'workshop':layer.name.includes('porch deck')?'porch':layer.name.includes('rear entry')?'rear':layer.name.includes('pitched roof')?'pitched':layer.name.includes('canopy')?'canopy':'terrace';
        added.push({name:layer.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),surface:layer.name,x:centre.x,z:centre.z,top:centre.y,width:Math.max(1,bounds.maxX-bounds.minX),depth:Math.max(1,bounds.maxZ-bounds.minZ),normal,view,samples:points.length});
      }});
    }
    return {targets:[...unchanged,...added],unchanged:unchanged.length,added:added.length,expectedAdded:architecture?.surfaceLayers.length??0,hasArchitecture:!!architecture};
  });
  const {targets}=targetSet;
  if(before)assert.equal(targets.length,12,'saved pre-fix build retains its twelve original surfaces');
  else{
    assert.ok(targetSet.hasArchitecture,'build the current QA bundle before the docks regression');
    assert.equal(targetSet.unchanged,11,'all eleven unchanged roofs, floors and boardwalks remain covered');
    assert.equal(targetSet.added,targetSet.expectedAdded,'every authored boathouse finish has camera coverage');
    assert.ok(targetSet.added>=9,'both pitched roofs, canopy, floors and terrace remain covered');
    assert.equal(new Set(targets.map(target=>target.name)).size,targets.length);
  }
  for(const quality of ['low','balanced','high']){
    await page.evaluate(quality=>{const select=document.getElementById('quality');select.value=quality;select.dispatchEvent(new Event('change'));},quality);
    // Changing quality clears the profiler until the next completed render.
    await page.waitForFunction(()=>Number.isFinite(window.sunspark.snapshot().performance.frame));
    for(const target of targets)for(const angle of ['elevated','grazing']){
      if(onlyTarget&&target.name!==onlyTarget)continue;
      if(cameraFixes&&!(target.name==='workshop-west-wall-exterior'||angle==='grazing'&&(target.view==='facade'||target.view==='pitched')))continue;
      const motion=await page.evaluate(async({target,angle})=>{
        const g=window.__test,start=window.sunspark.snapshot().performance.frame;
        g.player.root.visible=false;g.player.pos.set(target.x,target.top,target.z);
        g.camera.fov=55;g.camera.updateProjectionMatrix();
        const radius=Math.max(target.width,target.depth)*1.25+3,height=angle==='grazing'?(target.view==='pitched'?Math.max(1,radius*.18):1):radius*.6;
        for(let i=0;i<16;i++){
          const a=.55+i*.013;
          if(target.name==='workshop-west-wall-exterior'){
            // View the exposed upper/front wall above the legitimate access ramp.
            g.camera.position.set((angle==='grazing'?62.5:58.5)+Math.sin(a)*.35,angle==='grazing'?6.5:8.5,(angle==='grazing'?16.8:15)+Math.cos(a)*.35);
          }else if(target.view==='interior-wall'){
            const [nx,ny,nz]=target.normal,outward=angle==='grazing'?.45:1.8,along=angle==='grazing'?1.6:.6;
            g.camera.position.set(target.x+nx*outward-nz*along*Math.cos(a),target.top+.3,target.z+nz*outward+nx*along*Math.cos(a));
          }else if(target.view==='facade'){
            const [nx,ny,nz]=target.normal,outward=angle==='grazing'?2:radius*.85,along=angle==='grazing'?radius*(target.name.includes('gable')?.25:.45):radius*.3;
            g.camera.position.set(target.x+nx*outward-nz*along*Math.cos(a),target.top+ny*outward+(angle==='grazing'?.1:radius*.12),target.z+nz*outward+nx*along*Math.cos(a));
          }else if(target.view==='interior'||target.view==='workshop'){
            const workshop=target.view==='workshop';
            g.camera.position.set(target.x+Math.sin(a)*.4,target.top+(angle==='grazing'?.45:workshop?2.6:3.7),target.z+(angle==='grazing'?2.8:3.5));
          }else if(target.view==='porch'||target.view==='rear'){
            const side=target.view==='rear'?-1:1;
            g.camera.position.set(target.x+Math.sin(a)*.8,target.top+(angle==='grazing'?.45:3.1),target.z+side*(angle==='grazing'?4.2:6));
          }else if(target.view==='pitched'||target.view==='canopy'){
            // Move above the actual finish plane. Each pitch is approached from
            // its eave, keeping the opposite roof from hiding the target shell.
            const [nx,ny,nz]=target.normal,span=radius*Math.cos(a),across=radius*Math.sin(a);
            const downhill=target.view==='pitched'?[Math.sign(nx)*ny,-Math.abs(nx),0]:[0,-nz,ny];
            const tangent=target.view==='pitched'?[0,0,1]:[1,0,0];
            g.camera.position.set(target.x+downhill[0]*span+tangent[0]*across+nx*height,target.top+downhill[1]*span+ny*height,target.z+downhill[2]*span+tangent[2]*across+nz*height);
          }else{
            const azimuth=target.view==='terrace'?Math.PI-a:a;
            g.camera.position.set(target.x+Math.cos(azimuth)*radius,target.top+height,target.z+Math.sin(azimuth)*radius);
          }
          g.camera.lookAt(target.x,target.name==='workshop-west-wall-exterior'?6.3:target.top,target.name==='workshop-west-wall-exterior'?13:target.z);g.camera.updateMatrixWorld();
          g.world.update(10,0,g.camera);
          await new Promise(requestAnimationFrame);
        }
        const s=window.sunspark.snapshot(),material=g.world.ground.children.find(m=>m.isMesh&&!m.userData.docksCliff).material;
        const program=g.renderer.properties.get(material).currentProgram;
        const terrainShadows=g.renderer.getContext().getShaderSource(program.fragmentShader).includes('#define USE_SHADOWMAP');
        return {frames:s.performance.frame-start,error:s.startup.error,shaderFailures:s.shaders.failures,calls:s.performance.total.calls,terrainShadows};
      },{target,angle});
      assert.ok(motion.frames>=12&&motion.calls>0,JSON.stringify(motion));assert.equal(motion.error,null);assert.deepEqual(motion.shaderFailures,[]);
      if(!before)assert.equal(motion.terrainShadows,quality!=='low','rendered terrain shader must match the selected shadow mode');
      const path=`${dir}/${tag}-${quality}-${target.name}-${angle}.png`;await page.screenshot({path});views.push({quality,target:target.name,angle,path,motion});
    }
  }
  checks.push(cameraFixes?`${views.length} corrected facade and roof camera views render in all presets`:`${targets.length} registered finishes render during elevated and grazing camera motion in all three presets`);
  if(!before&&!cameraFixes){
    // Recreate normal gameplay, restoring the avatar, HUD and camera controls.
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
    await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready,{},{timeout:90000});await page.locator('#explore').click();
    const roofs=await page.evaluate(()=>window.__test.world.coastalAssets.filter(a=>Number.isFinite(a.roof)&&a.kind!=='boathouse').map(a=>({x:a.x,z:a.z,top:a.roof})));
    assert.equal(roofs.length,5,'five original roofs retain their original access');
    for(const roof of roofs){
      const ramp=await page.evaluate(roof=>{const g=window.__test,r=g.world.ramps.find(r=>Math.abs(r.z-roof.z)<.01&&Math.abs(r.y+r.rise-roof.top)<.01&&r.x>roof.x&&r.x<roof.x+15);if(!r)return null;
        const x=r.x+Math.sin(r.yaw)*(r.length/2+.6),z=r.z+Math.cos(r.yaw)*(r.length/2+.6);
        g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(-r.yaw,-.45);return {length:r.length};
      },roof);
      assert.ok(ramp,`missing access ramp at ${roof.x},${roof.z}`);
      await page.keyboard.down('KeyW');await page.waitForTimeout(2300);await page.keyboard.up('KeyW');
      const s=await page.evaluate(()=>window.sunspark.snapshot());assert.ok(s.position[1]>=roof.top-.04,`roof climb at ${roof.x},${roof.z}`);
    }
    checks.push('all five unchanged roofs remain reachable through ordinary keyboard climbing');
    const routes=await page.evaluate(()=>window.__test.world.docksArchitecture.routes);
    const walkRoute=async(name,points)=>{
      await page.evaluate(([x,y,z])=>{const g=window.__test;g.movement.reset();g.player.pos.set(x,g.world.floorAt(x,z,y+.1),z);g.player.vy=0;g.player.grounded=true;},points[0]);
      await page.waitForTimeout(100);
      for(const point of points.slice(1)){
        const leg=await page.evaluate(([x,y,z])=>{const g=window.__test,from=g.player.pos.clone(),dx=x-from.x,dz=z-from.z,distance=Math.hypot(dx,dz);g.setView(Math.atan2(dx,-dz),-.25);return {x,z,y,fromX:from.x,fromZ:from.z,dx:dx/distance,dz:dz/distance,distance};},point);
        if(leg.distance>.1){
          await page.keyboard.down('KeyW');
          try{await page.waitForFunction(leg=>{const p=window.sunspark.snapshot().position;return (p[0]-leg.fromX)*leg.dx+(p[2]-leg.fromZ)*leg.dz>=leg.distance-.06;},leg,{timeout:7000});}
          finally{await page.keyboard.up('KeyW');}
        }
        await page.waitForTimeout(80);
        const snapshot=await page.evaluate(()=>window.sunspark.snapshot());
        assert.ok(Math.hypot(snapshot.position[0]-point[0],snapshot.position[2]-point[2])<.55,`${name}: missed waypoint ${point}`);
        assert.ok(Math.abs(snapshot.position[1]-point[1])<.15&&snapshot.grounded,`${name}: unsupported waypoint ${JSON.stringify(snapshot.position)}`);
      }
      checks.push(name);
    };
    await walkRoute('new terrace reached through its folded access ramp with ordinary keyboard movement',routes.terrace);
    for(const [name,points] of [['front door and porch-to-dock connection',routes.front],['rear door and graded mainland approach',routes.rear]]){
      await walkRoute(`boathouse ${name} traversed outward`,points);
      await walkRoute(`boathouse ${name} traversed inward`,[...points].reverse());
    }

    const sheds=await page.evaluate(()=>window.__test.world.coastalAssets.filter(a=>a.kind==='coastal-shed').map(a=>({x:a.x,z:a.z})));
    for(const shed of sheds){
      await page.evaluate(({x,z})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z+4),z+4);g.player.vy=0;g.setView(0,-.25);},shed);
      await page.keyboard.down('KeyW');await page.waitForTimeout(2100);await page.keyboard.up('KeyW');
      const s=await page.evaluate(()=>window.sunspark.snapshot());assert.ok(s.position[2]<shed.z-3,`shed traversal at ${shed.x},${shed.z}`);
    }
    checks.push('both graded shed floors remain traversable with ordinary keyboard movement');
    const height=await page.evaluate(()=>{const g=window.__test;g.start('practice',true);const c=g.world.obstacles.find(o=>o.mesh.userData.prop==='roof-crate'),p=c.box.getCenter(g.player.pos.clone());g.player.pos.set(p.x,c.box.min.y,p.z+1.25);g.player.vy=0;g.setView(0,-.45);return c.box.max.y;});
    await page.waitForTimeout(150);await page.keyboard.press('Space');await page.keyboard.down('KeyW');await page.waitForTimeout(240);await page.keyboard.up('KeyW');await page.waitForTimeout(1100);
    const landed=await page.evaluate(()=>window.sunspark.snapshot());assert.ok(Math.abs(landed.position[1]-height)<.04&&landed.grounded);checks.push('rooftop crate still supports a jump landing');
  }
  assert.deepEqual(errors,[]);await writeFile(`${dir}/${tag}-${onlyTarget?onlyTarget+'-camera':cameraFixes?'camera-corrections':'browser'}-report.json`,JSON.stringify({tag,views,checks,errors},null,2));console.log(JSON.stringify({tag,views:views.length,checks,errors}));
}catch(error){await page.screenshot({path:`${dir}/${tag}-failure.png`});await writeFile(`${dir}/${tag}-failure.json`,JSON.stringify({message:error.message,views,checks,errors},null,2));throw error;}finally{await browser.close();}

