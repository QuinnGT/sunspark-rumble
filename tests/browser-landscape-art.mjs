import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// An isolated in-memory QA build lets an artist inspect current source without
// replacing the shared gameplay test bundle during parallel asset work.
const bundle=await build({entryPoints:['tests/visual-scenario.js'],bundle:true,minify:true,format:'iife',define:{__SUNSPARK_TEST__:'true'},write:false});
const dir='tests/artifacts/terrain-art';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/game.qa.bundle.js',r=>r.fulfill({body:bundle.outputFiles[0].text,contentType:'application/javascript'}));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{timeout:90000});
  assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);
  await page.evaluate(()=>{const g=window.__test;g.start('practice',true);g.pause();g.player.root.visible=false;g.actors.forEach(a=>a.root.visible=false);document.getElementById('quality').value='high';document.getElementById('quality').dispatchEvent(new Event('change'));});
  await page.addStyleTag({content:'body > :not(canvas){display:none!important}'});
  const views=[
    ['dock-bank',[91,7,-14],[86,3,-3]],['dock-south',[101,5,56],[90,3,49]],
    ['harbor-landscape',[104,7,45],[78,3,9]],['lantern-plants',[26,10,-101],[19,7,-86]],
    ['orchard-plants',[-110,7,-36],[-102,4,-25]],['quarry-plants',[-80,6,90],[-75,3,78]]
  ];
  for(const [name,from,toward] of views){
    await page.evaluate(({from,toward})=>{const g=window.__test;g.camera.position.set(...from);g.camera.lookAt(...toward);g.camera.fov=53;g.camera.updateProjectionMatrix();g.player.pos.set(toward[0],g.world.heightAt(toward[0],toward[2]),toward[2]);g.world.update(16,0,g.camera);g.world.scene.updateMatrixWorld(true);},{from,toward});
    await page.waitForTimeout(600);await page.screenshot({path:`${dir}/${name}.png`});
  }
  const snapshot=await page.evaluate(()=>window.sunspark.snapshot());assert.deepEqual(errors,[]);assert.equal(snapshot.startup.error,null);
  await writeFile(`${dir}/report.json`,JSON.stringify({purpose:'Static composition inspection; no performance claim.',views,landscape:snapshot.landscape,errors},null,2));
  console.log(JSON.stringify({landscape:snapshot.landscape,errors}));
}finally{await browser.close();}
