import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('tests/artifacts/pose',{recursive:true});
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario=pose-comparison');
  await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);await page.waitForTimeout(1200);
  await page.screenshot({path:'tests/artifacts/pose/comparison.png'});
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario=movement');await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);await page.waitForTimeout(5500);
  await page.keyboard.press('KeyC');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.sunspark.snapshot().movement.stance),'crouching');
  await page.screenshot({path:'tests/artifacts/pose/crouch-gameplay.png'});
  await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.screenshot({path:'tests/artifacts/pose/crouch-walk.png'});await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyC');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.sunspark.snapshot().movement.stance),'standing');
  assert.deepEqual(errors,[]);await writeFile('tests/artifacts/pose/browser-report.json',JSON.stringify({errors,checks:['side-by-side rigid pose capture','C crouch and stand','crouch walk animation'],resolution:[1400,900]},null,2));console.log('Pose captures and keyboard stance checks passed.');
}finally{await browser.close();}
