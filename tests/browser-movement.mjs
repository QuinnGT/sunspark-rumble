import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('tests/artifacts/movement',{recursive:true});const snap=()=>page.evaluate(()=>window.sunspark.snapshot());
const hold=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
async function load(query='movement'){await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario='+query);await page.waitForFunction(()=>window.sunspark?.snapshot().state==='playing'&&window.sunspark.snapshot().nature.pending===0);await page.waitForTimeout(5500);}
try{
  await load('movement&low');await hold('KeyW',850);await page.waitForTimeout(150);assert.ok((await snap()).position[2]>44.9);
  await page.keyboard.press('KeyC');await hold('KeyW',900);await page.waitForTimeout(100);assert.ok((await snap()).position[2]<44);assert.equal((await snap()).movement.stance,'crouching');
  await page.screenshot({path:'tests/artifacts/movement/crouch-under-cover.png'});
  await page.keyboard.press('KeyC');await page.keyboard.press('Space');await page.waitForTimeout(250);assert.equal((await snap()).movement.stance,'crouching');assert.equal((await snap()).position[1],20);
  await hold('KeyW',1800);await page.waitForTimeout(300);assert.equal((await snap()).movement.stance,'standing');checks.push('walk blocked by low roof; crouch fits; stand and jump blocked underneath; automatically stands once clear');
  await load();await page.keyboard.down('Shift');await hold('KeyW',450);await page.keyboard.down('KeyW');await page.keyboard.press('KeyC');await page.waitForTimeout(120);
  assert.equal((await snap()).movement.stance,'sliding');assert.ok((await snap()).movement.speed>10.6);await page.mouse.click(800,500);assert.ok((await snap()).ammo[0]<24);await page.screenshot({path:'tests/artifacts/movement/slide.png'});
  await page.keyboard.press('Space');await page.waitForTimeout(120);assert.equal((await snap()).grounded,false);assert.equal((await snap()).movement.stance,'standing');await page.screenshot({path:'tests/artifacts/movement/slide-jump.png'});
  await page.keyboard.up('KeyW');await page.keyboard.up('Shift');checks.push('sprint into slide, shoot while sliding, visible low pose and slide-jump using keyboard');
  await load();await page.keyboard.press('KeyC');await page.waitForTimeout(250);await page.mouse.click(800,500);await page.waitForTimeout(120);assert.ok((await snap()).ammo[0]<24);await page.keyboard.press('KeyR');await page.waitForFunction(()=>window.sunspark.snapshot().reloading===0);assert.equal((await snap()).ammo[0],24);
  await page.keyboard.press('KeyB');await page.mouse.click(800,500);await page.waitForTimeout(200);assert.equal((await snap()).buildCount,1);assert.equal((await snap()).movement.stance,'crouching');await page.keyboard.press('KeyB');checks.push('crouch still allows shooting, reloading and placing cover');
  await page.keyboard.press('KeyP');const frozen=await snap();await page.waitForTimeout(500);assert.deepEqual((await snap()).position,frozen.position);await page.locator('#leave').click();await page.locator('#practice').click();await page.waitForTimeout(300);assert.equal((await snap()).movement.stance,'standing');checks.push('pause freezes and new practice clears stance');
  // Recheck the actual island at normal speed, with no test deck.
  await load('cabin-ramp');await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await page.waitForTimeout(200);await page.keyboard.press('KeyC');await page.waitForTimeout(950);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await page.waitForTimeout(250);
  const ramp=await snap();assert.ok(ramp.position[1]>await page.evaluate(()=>window.__test.world.ramps.find(r=>!r.build).y+2));checks.push('slide climbs permanent cabin ramp without snagging');
  await load('rock-gap&gap=0');await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await page.waitForTimeout(240);await page.keyboard.press('KeyC');await page.waitForTimeout(240);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');await page.keyboard.press('KeyC');const gap=await snap();assert.ok(Math.hypot(gap.position[0]+32.280907,gap.position[2]+4.821141)<1.3);checks.push('sprint-slide crosses actual rock gap');
  assert.deepEqual(errors,[]);const report={checks,errors,resolution:[1600,1000],last:await snap()};await writeFile('tests/artifacts/movement/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks,errors}));
}catch(e){await page.screenshot({path:'tests/artifacts/movement/failure.png'});console.log(JSON.stringify(await snap()));throw e;}
finally{await browser.close();}
