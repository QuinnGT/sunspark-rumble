import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),dir=process.argv.includes('--docks')?'tests/artifacts/docks-milestone/compatibility':process.argv.includes('--art')?'tests/artifacts/sunhaven-art/compatibility':'tests/artifacts/threejs-readiness',tag=before?'before':'after';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],samples=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',r=>r.fulfill({path:'tests/before-threejs.qa.bundle.js',contentType:'application/javascript'}));
try{
  for(const map of ['sunhaven','breezy']){
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?map='+map);
    if(before)await page.addStyleTag({content:'#loading{display:none!important}'});
    await page.waitForFunction(before=>window.sunspark&&(before?window.sunspark.snapshot().nature.pending===0:window.sunspark.snapshot().startup.ready||window.sunspark.snapshot().startup.error),before,{timeout:90000});
    assert.deepEqual(errors,[]);
    if(!before){const s=await page.evaluate(()=>window.sunspark.snapshot());assert.equal(s.startup.error,null);assert.equal(s.textures.withinBudget,true);assert.deepEqual(s.shaders.failures,[]);}
    await page.locator('#explore').click();
    for(const quality of ['low','balanced','high']){
      await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
      const views=map==='sunhaven'?[['inlet',98,39,-.6,-.3],['quarry',-53,85,0,-.2],['village',0,32,0,-.15]]:[['shore',43,47,2.25,-.15]];
      for(const [view,x,z,yaw,pitch] of views){
        await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,pitch);},{x,z,yaw,pitch});
        await page.waitForTimeout(1800);
        const timings=await page.evaluate(()=>new Promise(resolve=>{let prev;const values=[];function sample(t){if(prev!==undefined)values.push(t-prev);prev=t;if(values.length<180)requestAnimationFrame(sample);else{values.sort((a,b)=>a-b);resolve({p50:values[90],p95:values[171],max:values.at(-1)});}}requestAnimationFrame(sample);}));
        const s=await page.evaluate(()=>window.sunspark.snapshot());
        samples.push({map,quality,view,timings,drawCalls:s.drawCalls,triangles:s.triangles,performance:s.performance,terrain:s.terrain,nature:s.nature});
        assert.deepEqual(errors,[]);
        if(!before){assert.equal(s.startup.error,null);assert.deepEqual(s.shaders.failures,[]);const counted=Object.values(s.performance.passes).reduce((n,p)=>n+p.calls,0);assert.equal(counted,s.performance.total.calls,'exclusive pass counts sum to the frame');}
        if(view==='inlet'&&quality==='high'&&!before)assert.equal(s.performance.passes.refraction?.passes,1,'inland-facing inlet refracts');
        if(quality==='high'||view==='inlet')await page.screenshot({path:`${dir}/${tag}-${map}-${quality}-${view}.png`});
      }
    }
    if(!before){
      // Real ten/eight-bot render workload with firing, movement and new builds.
      await page.evaluate(()=>window.__test.start('match'));
      await page.keyboard.down('KeyW');await page.mouse.down();await page.waitForTimeout(2800);await page.mouse.up();await page.keyboard.up('KeyW');
      await page.keyboard.press('KeyB');await page.mouse.click(800,500);await page.keyboard.press('KeyB');await page.waitForTimeout(1600);
      const match=await page.evaluate(()=>window.sunspark.snapshot());assert.equal(match.bots.length,map==='sunhaven'?10:8);assert.ok(match.ammo[0]<24||match.reserve[0]<144);assert.equal(match.startup.error,null);
      samples.push({map,view:'combat',quality:match.quality,bots:match.bots.length,builds:match.buildCount,performance:match.performance});
      const counts=[];
      for(let i=0;i<4;i++){await page.evaluate(()=>window.__test.start('match'));await page.waitForTimeout(600);counts.push(await page.evaluate(()=>window.sunspark.snapshot().performance.memory));}
      assert.ok(counts.at(-1).textures<=counts[1].textures+2,'replays keep texture counts bounded');
      assert.ok(counts.at(-1).geometries<=counts[1].geometries+40,'replays keep geometry counts bounded');
      samples.push({map,view:'replay-resources',counts});
    }
  }
  const gpu=await page.evaluate(()=>{const gl=document.getElementById('game').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';});
  const final=await page.evaluate(()=>window.sunspark.snapshot());
  const report={tag,viewport:[1600,1000],gpu,method:'180 post-warmup RAF intervals per view, display-capped; CPU/GPU diagnostics when available. No lower-end device emulation.',samples,assets:final.textures,shaders:final.shaders,startup:final.startup,errors};
  await writeFile(`${dir}/${tag}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({tag,samples:samples.length,errors,startup:final.startup}));
}catch(error){await page.screenshot({path:`${dir}/${tag}-failure.png`});await writeFile(`${dir}/${tag}-failure.json`,JSON.stringify({message:error.message,errors,samples},null,2));throw error;}
finally{await browser.close();}
