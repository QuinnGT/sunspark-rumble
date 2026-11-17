import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),tag=before?'before':process.argv.includes('--draft')?'draft':'after',dir='tests/artifacts/sunhaven-art';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',route=>route.fulfill({path:'tests/before-sunhaven-art.qa.bundle.js',contentType:'application/javascript'}));
const stage=async(x,z,yaw,pitch)=>{await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,pitch);},{x,z,yaw,pitch});await page.waitForTimeout(1400);};
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);await page.locator('#explore').click();
  for(const quality of ['low','balanced','high']){
    await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
    const cameras=[['docks',98,39,-.6,-.3],['village',0,32,0,-.18]];
    if(quality==='high')cameras.push(['boathouse',76,22,0,-.06],['shore',69,37,1.2,-.24],['boardwalk',98,32,1.25,-.5],['headland',13,-58,-.45,-.06],['orchard',-72,-12,-.65,-.1],['quarry',-53,85,0,-.2]);
    if(quality==='high'&&!before)cameras.push(['headland-path',0,-58,0,-.06]);
    for(const [name,x,z,yaw,pitch]of cameras){
      await stage(x,z,yaw,pitch);
      const frames=await page.evaluate(()=>new Promise(resolve=>{let last;const values=[];const tick=t=>{if(last!==undefined)values.push(t-last);last=t;if(values.length<180)requestAnimationFrame(tick);else{values.sort((a,b)=>a-b);resolve({p50:values[90],p95:values[171],max:values.at(-1)});}};requestAnimationFrame(tick);}));
      const s=await page.evaluate(()=>window.sunspark.snapshot());
      assert.equal(s.startup.error,null);assert.deepEqual(s.shaders.failures,[]);assert.equal(s.textures.withinBudget,true);assert.deepEqual(errors,[]);
      const count=Object.values(s.performance.passes).reduce((total,p)=>total+p.calls,0);assert.equal(count,s.performance.total.calls);
      const path=`${dir}/${tag}-${quality}-${name}.png`;await page.screenshot({path});
      views.push({name,quality,position:s.position,path,frames,performance:s.performance,targets:s.targets,textures:{sourceCount:s.textures.sourceCount,estimatedBytes:s.textures.estimatedBytes,budgetBytes:s.textures.budgetBytes},landscape:s.landscape});
    }
  }
  const gpu=await page.evaluate(()=>{const gl=document.getElementById('game').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';});
  const report={tag,gpu,viewport:[1600,1000],method:'180 warmed-up RAF intervals per view; exclusive complete-frame counters, CPU distribution and optional async GPU sample. Display-capped local GPU.',views,errors};
  await writeFile(`${dir}/${tag}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({tag,views:views.length,errors}));
}catch(error){await page.screenshot({path:`${dir}/${tag}-failure.png`});await writeFile(`${dir}/${tag}-failure.json`,JSON.stringify({message:error.message,errors,views},null,2));throw error;}finally{await browser.close();}
