import{chromium}from'playwright-core';
import{writeFile}from'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),samples=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  for(const map of ['breezy','sunhaven']){
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?map='+map);await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);await page.locator('#explore').click();
    await page.evaluate(()=>{const g=window.__test;g.player.pos.set(0,g.world.floorAt(0,42),42);g.player.vy=0;g.setView(0,-.16);});
    for(const quality of ['low','balanced','high']){
      await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();await page.waitForTimeout(2200);
      const timings=await page.evaluate(()=>new Promise(resolve=>{const times=[];let prev;function next(t){if(prev!==undefined)times.push(t-prev);prev=t;if(times.length===360){times.sort((a,b)=>a-b);resolve({medianMs:times[180],p95Ms:times[342],p99Ms:times[356],maxMs:times.at(-1)});}else requestAnimationFrame(next);}requestAnimationFrame(next);}));
      const s=await page.evaluate(()=>window.sunspark.snapshot());samples.push({map,quality,...timings,fps:s.fps,drawCalls:s.drawCalls,triangles:s.triangles});
    }
  }
  const gpu=await page.evaluate(()=>{const gl=document.getElementById('game').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';});
  const report={gpu,viewport:[1600,1000],method:'Fixed camera and player position (0,42), 360 post-warmup rendered frames per preset; capped display, not a low-end hardware test',samples,errors};
  await writeFile('tests/artifacts/sunhaven/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
