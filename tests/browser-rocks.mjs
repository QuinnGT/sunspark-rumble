import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { ROCK_GAPS } from './rock-cases.js';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1980,height:1140},deviceScaleFactor:1}),errors=[],checks=[],performanceSamples=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('tests/artifacts/rocks',{recursive:true});const snapshot=()=>page.evaluate(()=>window.sunspark.snapshot());
async function load(query){await page.goto('http://127.0.0.1:4173/tests/scenario.html?'+query);await page.waitForFunction(()=>window.sunspark?.snapshot().state==='playing'&&window.sunspark.snapshot().nature.pending===0);await page.waitForTimeout(300);}
try{
  for(const quality of ['high','low'])for(let gap=0;gap<2;gap++)for(const reverse of [false,true]){
    await load('scenario=rock-gap&gap='+gap+(reverse?'&reverse':''));
    await page.locator('#performance').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
    const target=reverse?ROCK_GAPS[gap].from:ROCK_GAPS[gap].to,sprint=reverse;
    if(sprint)await page.keyboard.down('Shift');await page.keyboard.down('KeyW');
    await page.waitForFunction(target=>{const p=window.sunspark.snapshot().position;return Math.hypot(p[0]-target[0],p[2]-target[2])<.45;},target,{timeout:2500});
    await page.keyboard.up('KeyW');if(sprint)await page.keyboard.up('Shift');await page.waitForTimeout(150);
    const s=await snapshot();assert.ok(Math.hypot(s.position[0]-target[0],s.position[2]-target[2])<1);checks.push({gap,reverse,quality,sprint,position:s.position});
    if(quality==='high')await page.screenshot({path:`tests/artifacts/rocks/gap-${gap}-${reverse?'return':'forward'}.png`});
  }
  await load('scenario=rock-approach');
  const expected=await page.evaluate(()=>{const b=window.__test.world.obstacles.find(o=>o.kind==='rock').box;return b.max.x+.48+.08;});
  await page.keyboard.down('KeyW');await page.waitForFunction(x=>window.sunspark.snapshot().position[0]<x,expected,{timeout:1800});await page.keyboard.up('KeyW');await page.waitForTimeout(100);
  assert.ok((await snapshot()).position[0]<expected);await page.screenshot({path:'tests/artifacts/rocks/close-approach.png'});checks.push({closeApproach:true,position:(await snapshot()).position});
  // A normal eight-bot match exercises the extra collision work at gameplay speed.
  await page.keyboard.press('KeyP');await page.locator('#leave').click();await page.locator('#play').click();await page.waitForTimeout(2500);
  await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();await page.waitForTimeout(2500);
  for(let i=0;i<6;i++){await page.waitForTimeout(1000);const s=await snapshot();performanceSamples.push({fps:s.fps,alive:s.bots.filter(b=>b.alive).length});}
  assert.deepEqual(errors,[]);const report={resolution:[1980,1140],checks,performanceSamples,errors};await writeFile('tests/artifacts/rocks/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await page.screenshot({path:'tests/artifacts/rocks/failure.png'});console.log('Failure state',JSON.stringify(await snapshot()));throw e;}
finally{await browser.close();}
