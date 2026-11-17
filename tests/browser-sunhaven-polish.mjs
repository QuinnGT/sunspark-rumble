import{chromium}from'playwright-core';
import{mkdir,writeFile}from'node:fs/promises';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),tag=before?'before':'after',dir=process.argv.includes('--docks')?'tests/artifacts/docks-milestone/traversal':process.argv.includes('--art')?'tests/artifacts/sunhaven-art/traversal':'tests/artifacts/sunhaven-polish';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  if(before)await page.route('**/game.qa.bundle.js',route=>route.fulfill({path:'tests/before-sunhaven-fixes.qa.bundle.js',contentType:'application/javascript'}));
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');await page.waitForFunction(()=>{const s=window.sunspark?.snapshot();return s&&(s.startup?s.startup.ready||s.startup.error:s.nature.pending===0);},{},{timeout:90000});assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup?.error??null),null);await page.locator('#explore').click();
  await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();
  const architecture=await page.evaluate(()=>window.__test.world.docksArchitecture??null);
  if(!before)assert.ok(architecture?.routes,'build the current QA bundle for the revised boathouse');
  const stage=async(x,z,yaw,pitch=-.25,height)=>{await page.evaluate(({x,z,yaw,pitch,height})=>{const g=window.__test;g.start('practice',true);g.player.pos.set(x,g.world.floorAt(x,z,Number.isFinite(height)?height+.1:g.world.heightAt(x,z)+.3),z);g.player.vy=0;g.setView(yaw,pitch);},{x,z,yaw,pitch,height});await page.waitForTimeout(500);};
  const walkRoute=async(name,points)=>{
    const [x,y,z]=points[0];await stage(x,z,0,-.25,y);
    for(const point of points.slice(1)){
      const leg=await page.evaluate(([x,y,z])=>{const g=window.__test,p=g.player.pos,dx=x-p.x,dz=z-p.z,distance=Math.hypot(dx,dz);g.setView(Math.atan2(dx,-dz),-.25);return {fromX:p.x,fromZ:p.z,dx:dx/distance,dz:dz/distance,distance};},point);
      if(leg.distance>.1){
        await page.keyboard.down('KeyW');
        try{await page.waitForFunction(leg=>{const p=window.sunspark.snapshot().position;return (p[0]-leg.fromX)*leg.dx+(p[2]-leg.fromZ)*leg.dz>=leg.distance-.06;},leg,{timeout:7000});}
        finally{await page.keyboard.up('KeyW');}
      }
      await page.waitForTimeout(80);const state=await page.evaluate(()=>window.sunspark.snapshot());
      assert.ok(Math.hypot(state.position[0]-point[0],state.position[2]-point[2])<.55,`${name}: missed ${point}`);
      assert.ok(Math.abs(state.position[1]-point[1])<.15&&state.grounded,`${name}: unsupported ${state.position}`);
    }
    checks.push(name);
  };
  for(const [name,x,z,yaw,pitch]of [['floor',12,-4,0,-.32],['door',76,9,Math.PI,-.12],['orchard',-74,-19,0,-.18],['quarry',-53,88,0,-.18]]){
    await stage(x,z,yaw,pitch,name==='door'?architecture?.floor:undefined);await page.screenshot({path:`${dir}/${tag}-${name}.png`});
  }
  const shadows=[];
  for(const quality of ['balanced','high']){
    await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();await stage(0,44,0,-.25);
    await page.evaluate(()=>{const g=window.__test;window.shadowSamples=[];let last;
      g.world.scene.onBeforeRender=(renderer,scene,camera)=>{if(camera!==g.camera)return;const p=g.player.pos.clone();if(renderer.shadowMap.needsUpdate||renderer.shadowMap.autoUpdate)last=p;window.shadowSamples.push({refresh:renderer.shadowMap.needsUpdate||renderer.shadowMap.autoUpdate,lag:last?p.distanceTo(last):0});};});
    await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');
    const s=await page.evaluate(()=>{window.__test.world.scene.onBeforeRender=()=>{};return window.shadowSamples;});
    shadows.push({quality,frames:s.length,stale:s.filter(x=>!x.refresh).length,maxBodyLag:Math.max(...s.map(x=>x.lag))});
    await page.screenshot({path:`${dir}/${tag}-body-${quality}.png`});if(!before)assert.equal(shadows.at(-1).stale,0,'moving body receives current-pose shadows every frame');
  }
  if(!before){
    for(const x of [-12,12]){await stage(x,-5,0);await page.keyboard.down('KeyW');await page.waitForTimeout(1900);await page.keyboard.up('KeyW');assert.ok((await page.evaluate(()=>window.sunspark.snapshot())).position[2]<-16);}
    checks.push('both village interiors traversed with keyboard');
    const through=[...architecture.routes.rear].reverse().concat(architecture.routes.front.slice(1));
    await walkRoute('boathouse rear-to-front doors and porch-to-dock connection traversed with keyboard',through);
    await walkRoute('boathouse dock-to-porch and front-to-rear doors traversed with keyboard',[...through].reverse());
    await walkRoute('boathouse terrace reached using its folded side ramp, not the pitched ridge',architecture.routes.terrace);
    await stage(-53,85,0);await page.keyboard.down('KeyW');await page.waitForTimeout(3400);await page.keyboard.up('KeyW');assert.ok((await page.evaluate(()=>window.sunspark.snapshot())).position[1]>6.5);checks.push('rounded quarry hill and ramps climb to crest');
    await stage(70,20,Math.PI/2);await page.keyboard.down('KeyW');await page.waitForTimeout(1750);await page.keyboard.up('KeyW');assert.ok((await page.evaluate(()=>window.sunspark.snapshot())).position[0]>80);checks.push('rerouted dock access climbed');
  }
  const report={tag,shadows,checks,errors};await writeFile(`${dir}/${tag}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(errors,[]);
}finally{await browser.close();}
