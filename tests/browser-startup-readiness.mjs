import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const dir=process.argv.includes('--rock-fix')?'tests/artifacts/rock-trapping/compatibility':process.argv.includes('--approved')?'tests/artifacts/approved-docks/compatibility':process.argv.includes('--docks')?'tests/artifacts/docks-milestone/compatibility':process.argv.includes('--art')?'tests/artifacts/sunhaven-art':'tests/artifacts/threejs-readiness';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven&warmup-delay=1500');await page.waitForFunction(()=>window.__test&&window.sunspark.snapshot().startup.phase==='warming');
  const waiting=await page.evaluate(()=>{window.__test.start('match');window.__test.start('practice',true);const select=document.getElementById('quality');select.value='low';select.dispatchEvent(new Event('change'));return window.sunspark.snapshot();});
  assert.equal(waiting.state,'title');assert.equal(waiting.elapsed,0);assert.equal(waiting.bots.length,0);
  await page.waitForFunction(()=>window.sunspark.snapshot().startup.ready||window.sunspark.snapshot().startup.error,{},{timeout:90000});
  const ready=await page.evaluate(()=>window.sunspark.snapshot());assert.equal(ready.startup.error,null);assert.equal(ready.mode,'practice');assert.equal(ready.bots.length,1);assert.equal(ready.quality,'low');assert.equal(ready.models.state,'ready');assert.equal(ready.models.models,15);assert.equal(ready.docksTrees.style,'original island woodland');assert.equal(ready.approvedRocks.rocks,13);checks.push('latest pre-ready start queued, simulation frozen, and changed quality preserved');
  const disposed=await page.evaluate(()=>{const g=window.__test;g.disposeIsland();g.disposeIsland();return {textures:window.sunspark.snapshot().textures.sourceCount,coastal:window.sunspark.snapshot().coastal,landscape:window.sunspark.snapshot().landscape,oaks:window.sunspark.snapshot().oaks,memory:g.renderer.info.memory};});
  assert.equal(disposed.textures,0);assert.equal(disposed.memory.geometries,0);assert.equal(disposed.coastal.geometries,0);assert.equal(disposed.landscape.disposed,true);checks.push('double teardown releases scene geometry and texture cache');
  // Hold the real compile promise after WebGL compilation, then dispose the
  // island before readiness resumes. No warmup draw may recreate resources.
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven&warmup-delay=1500');
  await page.waitForFunction(()=>window.__test&&window.sunspark.snapshot().startup.phase==='warming');
  await page.evaluate(()=>{const g=window.__test,compile=g.renderer.compileAsync.bind(g.renderer),render=g.natureRenderer.render.bind(g.natureRenderer);window.warmRenders=0;
    g.natureRenderer.render=(...args)=>{window.warmRenders++;return render(...args);};
    g.renderer.compileAsync=async(...args)=>{await compile(...args);window.compileHeld=true;await new Promise(resolve=>window.releaseHeldCompile=resolve);};});
  await page.waitForFunction(()=>window.compileHeld,{},{timeout:90000});
  const cancelled=await page.evaluate(async()=>{const g=window.__test;g.disposeIsland();const before=window.warmRenders;window.releaseHeldCompile();await window.sunspark.ready;return {startup:window.sunspark.snapshot().startup,renders:window.warmRenders-before,memory:g.renderer.info.memory};});
  assert.equal(cancelled.startup.ready,false);assert.equal(cancelled.startup.error,null);assert.equal(cancelled.renders,0);assert.equal(cancelled.memory.geometries,0);
  checks.push('disposal during actual shader compilation prevents warmup draws and ready-state publication');
  await page.addInitScript(()=>{const get=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){return name==='EXT_color_buffer_float'?null:get.call(this,name);};});
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
  await page.locator('#explore').click();await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();await page.waitForTimeout(300);
  const fallback=await page.evaluate(()=>window.sunspark.snapshot());assert.equal(fallback.startup.error,null);assert.equal(fallback.targets.post.enabled,false);assert.equal(fallback.targets.post.hdrSupported,false);checks.push('full game starts and renders Detailed with safe no-HDR fallback');
  assert.deepEqual(errors,[]);await writeFile(`${dir}/startup-report.json`,JSON.stringify({checks,disposed,cancelled,startup:ready.startup,fallback:fallback.targets,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();}

