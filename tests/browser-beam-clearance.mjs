import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const before=process.argv.includes('--before'),tag=before?'before':'after',dir='tests/artifacts/beam-clearance';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',r=>r.fulfill({path:`${dir}/before.qa.bundle.js`,contentType:'application/javascript'}));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready,{},{timeout:90000});
  await page.locator('#explore').click();await page.keyboard.press('KeyP');
  await page.addStyleTag({content:'#pause,#hud{display:none!important}'});
  const doors=await page.evaluate(()=>{
    const w=window.__test.world;
    const houses=w.coastalAssets.filter(a=>a.kind==='coastal-house').flatMap(a=>[-1,1].map(side=>({name:`house-${a.x}-${a.z}-${side}`,x:a.x,z:a.z+side*a.depth/2,y:a.y,side,width:3,height:2.9})));
    return [...houses,{name:'harbor-rear',x:76,z:5,y:3.3,side:-1,width:4.8,height:4.5},{name:'harbor-front',x:76,z:15,y:3.3,side:1,width:4.8,height:4.5},{name:'workshop',x:67.5,z:15,y:3.3,side:1,width:2.4,height:2.85}];
  });
  assert.equal(doors.length,9);
  for(const quality of ['low','balanced','high']){
    await page.evaluate(quality=>{const el=document.getElementById('quality');el.value=quality;el.dispatchEvent(new Event('change'));},quality);
    await page.waitForFunction(()=>Number.isFinite(window.sunspark.snapshot().performance.frame));
    for(const door of doors)for(const view of [-1,0,1]){
      const result=await page.evaluate(async({door,view})=>{
        const g=window.__test;g.player.root.visible=false;g.player.pos.set(door.x,door.y,door.z);
        g.camera.fov=60;g.camera.updateProjectionMatrix();
        const start=window.sunspark.snapshot().performance.frame;
        for(let i=0;i<16;i++){
          // Walk obliquely past the frame at eye height, looking into the reveal.
          g.camera.position.set(door.x+view*(door.width*.48+.9)+(i-7.5)*.045,door.y+1.85,door.z+door.side*(door.height>4?4.5:3.5));
          g.camera.lookAt(door.x,door.y+door.height*.49,door.z);g.camera.updateMatrixWorld();g.world.update(10,0,g.camera);
          await new Promise(requestAnimationFrame);
        }
        const s=window.sunspark.snapshot();return {frames:s.performance.frame-start,shaders:s.shaders.failures,startup:s.startup.error};
      },{door,view});
      assert.ok(result.frames>=12);assert.deepEqual(result.shaders,[]);assert.equal(result.startup,null);
      const path=`${dir}/${tag}-${quality}-${door.name}-${view}.png`;await page.screenshot({path});views.push({quality,door:door.name,view,path,...result});
    }
  }
  assert.deepEqual(errors,[]);assert.equal(views.length,81);
  await writeFile(`${dir}/${tag}-browser-report.json`,JSON.stringify({tag,doors,views,errors,method:'Nine door frames; three eye-height walk-by angles in each graphics preset. Saved views require visual review.'},null,2));
  console.log(JSON.stringify({tag,views:views.length,errors}));
}finally{await browser.close();}
