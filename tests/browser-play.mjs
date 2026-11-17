// Real Chrome keyboard/mouse regression checks. Fresh profile; no personal data.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('tests/artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1980,height:1140},deviceScaleFactor:1});
const errors=[],checks=[],profiles=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.sunspark.snapshot());
const hold=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await page.waitForTimeout(100);};
const fire=async()=>{await page.mouse.click(990,570);await page.waitForTimeout(120);};
async function load(scenario=''){
  await page.goto('http://127.0.0.1:4173/tests/scenario.html'+scenario);
  // Textures can finish before startup does; scenarios place the player only once startup is ready.
  await page.waitForFunction(()=>{const s=window.sunspark?.snapshot();return s&&(s.startup.ready||s.startup.error)&&s.nature.pending===0;},{},{timeout:90000});
  const s=await snap();assert.equal(s.startup.error,null);assert.deepEqual(s.nature.failed,[]);
}
async function practice(){
  const s=await snap();if(s.state==='playing')await page.keyboard.press('KeyP');
  if((await snap()).state==='paused')await page.locator('#leave').click();
  await page.locator('#practice').click();await page.waitForTimeout(250);
}
try{
  await load();await practice();
  const alpha=await page.evaluate(()=>{const img=window.__test.world.foliage.texture.image,c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>200)opaque++;}return{width:img.width,transparent,opaque};});
  assert.ok(alpha.width>=512&&alpha.transparent>10000&&alpha.opaque>5000);checks.push('embedded leaf image decoded with opaque and transparent pixels');
  const origin=(await snap()).position;await hold('KeyW',400);const walk=(await snap()).position;
  await page.keyboard.down('Shift');await hold('KeyW',400);await page.keyboard.up('Shift');const sprint=(await snap()).position;
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);assert.ok(distance(origin,walk)>2);assert.ok(distance(walk,sprint)>distance(origin,walk)*1.15);
  await page.keyboard.press('Space');await page.waitForTimeout(230);assert.equal((await snap()).grounded,false);await page.waitForTimeout(1000);assert.equal((await snap()).grounded,true);checks.push('WASD, sprint and jump respond in rendered play');
  const before=(await snap()).ammo[0];await page.mouse.move(990,570);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();assert.ok((await snap()).ammo[0]<before);
  await page.keyboard.press('KeyR');assert.ok((await snap()).reloading>0);await page.waitForFunction(()=>window.sunspark.snapshot().reloading===0);assert.equal((await snap()).ammo[0],24);checks.push('automatic fire and R reload');
  // Exercise the pointer-captured camera, or the shipped right-drag fallback.
  const view=(await snap()).yaw;await page.mouse.down({button:'right'});await page.mouse.move(1150,610,{steps:12});await page.mouse.up({button:'right'});assert.notEqual((await snap()).yaw,view);checks.push('mouse aim/look responds');
  await practice();const base=(await snap()).position[1];
  await page.keyboard.press('KeyB');await page.keyboard.press('Digit2');assert.ok((await snap()).placement.valid);await fire();assert.equal((await snap()).buildCount,1);
  await hold('KeyW',500);assert.ok((await snap()).placement.valid);assert.ok((await snap()).placement.snapped);await fire();assert.equal((await snap()).buildCount,2);
  await hold('KeyW',520);await page.keyboard.press('Digit3');assert.ok((await snap()).placement.valid);await fire();
  await hold('KeyW',550);assert.ok((await snap()).position[1]>base+5.8);await page.keyboard.press('Digit1');assert.ok((await snap()).placement.valid);await fire();assert.equal((await snap()).buildCount,4);
  await page.keyboard.press('KeyB');assert.equal((await snap()).buildMode,null);await page.screenshot({path:'tests/artifacts/built-staircase.png'});checks.push('B/1/2/3 places connected stairs, floor and wall; climbed using W; B restores weapon');
  // Preset changes through the visible pause menu preserve the exact match state.
  for(const quality of ['low','balanced','high']){
    await page.keyboard.press('KeyP');const frozen=await snap();await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);
    await page.waitForTimeout(350);const paused=await snap();assert.equal(paused.elapsed,frozen.elapsed);assert.deepEqual(paused.structures,frozen.structures);assert.equal(paused.wood,frozen.wood);
    await page.locator('#close-graphics').click();await page.waitForTimeout(2500);const samples=[];
    for(let i=0;i<6;i++){await page.waitForTimeout(1000);const s=await snap();samples.push({fps:s.fps,drawCalls:s.drawCalls,triangles:s.triangles});}
    profiles.push({quality,samples});assert.equal((await snap()).quality,quality);
  }
  checks.push('all three graphics presets render and preserve a paused match');
  await load('?scenario=roof-crate');const crateStart=await snap();await hold('KeyW',450);const stopped=await snap();assert.ok(distance(stopped.position,crateStart.position)<.7);
  await page.keyboard.press('Space');await hold('KeyW',130);await page.waitForTimeout(1100);assert.ok((await snap()).position[1]>crateStart.position[1]+.6);assert.equal((await snap()).grounded,true);checks.push('rooftop crate blocks walking and supports jump landing');
  // Controlled bot firing isolates cover from tactical randomness; no hit function is called directly.
  await load('?scenario=cover-check');await page.keyboard.press('KeyB');await page.keyboard.press('Digit1');await fire();await page.keyboard.press('KeyB');
  // Play holds pointer lock, so Chrome sends real clicks to the canvas; press the test-only fixture buttons directly.
  const botShots=text=>page.locator('#cover-test-controls button').filter({hasText:text}).dispatchEvent('click');
  await botShots('Fire 8 bot shots');let cover=await snap();assert.equal(cover.shield,100);assert.equal(cover.structures[0].health,38);
  await botShots('Fire 3 bot shots');assert.equal((await snap()).structures.length,0);assert.equal((await snap()).shield,100);
  await botShots('Fire 1 bot shot');assert.ok((await snap()).shield<100);checks.push('bot shots damage cover, destruction shot absorbed, following clear shot hits player');
  // Real, unmodified Easy match. Observe autonomous combat through a natural result.
  await load();await page.locator('[data-difficulty="easy"]').click();await page.locator('#play').click();await page.waitForTimeout(200);
  await page.keyboard.press('KeyB');await page.keyboard.press('Digit2');await fire();await page.keyboard.press('KeyB');await hold('KeyW',600);await page.mouse.down();
  const started=Date.now(),round=[];
  while((await snap()).state==='playing'&&Date.now()-started<290000){await page.waitForTimeout(10000);const s=await snap();round.push({elapsed:s.elapsed,health:s.health,shield:s.shield,alive:s.bots.filter(b=>b.alive).length,fps:s.fps});console.log('Match',JSON.stringify(round.at(-1)));}
  await page.mouse.up();assert.equal((await snap()).state,'result');await page.screenshot({path:'tests/artifacts/natural-match-result.png'});checks.push('unmodified Easy match reaches a natural result');
  await page.locator('#replay').click();let fresh=await snap();assert.equal(fresh.state,'playing');assert.equal(fresh.buildCount,0);assert.equal(fresh.health,100);assert.equal(fresh.bots.filter(b=>b.alive).length,8);checks.push('instant replay restores a fresh eight-bot match');
  // Presentation fixture advances the clock solely to inspect the late storm.
  await page.evaluate(()=>window.__test.setElapsed(150));await page.waitForTimeout(500);await page.screenshot({path:'tests/artifacts/late-storm.png'});
  await load('?scenario=victory');await page.waitForFunction(()=>window.sunspark.snapshot().state==='result');assert.equal(await page.locator('#result-title').textContent(),'SUNSATIONAL!');await page.screenshot({path:'tests/artifacts/victory.png'});checks.push('staged victory presentation and late-storm visual capture');
  assert.deepEqual(errors,[]);await writeFile('tests/artifacts/browser-play-report.json',JSON.stringify({resolution:[1980,1140],checks,alpha,profiles,round,errors},null,2));console.log(JSON.stringify({checks,profiles,errors},null,2));
}catch(e){await page.screenshot({path:'tests/artifacts/browser-failure.png'});console.error('State at failure',JSON.stringify(await snap()));throw e;}
finally{await browser.close();}
