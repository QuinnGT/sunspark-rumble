import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFile,readFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1980,height:1140}});await context.setOffline(true);
const page=await context.newPage(),errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
const version=JSON.parse(await readFile('package.json','utf8')).version;
const url=pathToFileURL(resolve(process.argv[2]||'release/Sunspark Rumble/index.html')).href;
try{
  const started=Date.now();await page.goto(url);await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready&&window.sunspark.snapshot().nature.pending===0);const loadedMs=Date.now()-started;
  assert.equal(await page.evaluate(()=>typeof window.__test),'undefined');assert.ok(await page.locator('.top-badge').textContent().then(t=>t.includes(version)));
  await page.locator('#practice').click();await page.waitForFunction(()=>window.sunspark?.snapshot().map==='breezy'&&window.sunspark.snapshot().state==='playing'&&window.sunspark.snapshot().nature.pending===0);await page.waitForTimeout(300);
  const snapshot=()=>page.evaluate(()=>window.sunspark.snapshot());assert.equal((await snapshot()).state,'playing');assert.deepEqual((await snapshot()).nature.failed,[]);
  await page.keyboard.press('KeyC');await page.waitForTimeout(150);assert.equal((await snapshot()).movement.stance,'crouching');
  await page.keyboard.press('KeyC');await page.waitForTimeout(150);assert.equal((await snapshot()).movement.stance,'standing');
  await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await page.waitForTimeout(450);await page.keyboard.press('KeyC');await page.waitForTimeout(100);assert.equal((await snapshot()).movement.stance,'sliding');
  await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal((await snapshot()).grounded,false);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');
  await page.keyboard.press('KeyP');await page.locator('#leave').click();await page.locator('#practice').click();await page.waitForTimeout(150);assert.equal((await snapshot()).movement.stance,'standing');
  await page.keyboard.press('KeyB');await page.keyboard.press('Digit1');await page.mouse.click(990,570);await page.waitForTimeout(200);assert.equal((await snapshot()).buildCount,1);assert.equal((await snapshot()).wood,70);await page.keyboard.press('KeyB');
  await page.mouse.down();await page.waitForTimeout(400);await page.mouse.up();assert.ok((await snapshot()).ammo[0]<24);await page.keyboard.press('KeyR');assert.ok((await snapshot()).reloading>0);await page.waitForFunction(()=>window.sunspark.snapshot().reloading===0);assert.equal((await snapshot()).ammo[0],24);
  await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();await page.waitForTimeout(6500);assert.equal((await snapshot()).quality,'high');await page.screenshot({path:'tests/artifacts/offline-release.png'});
  const first=await snapshot();await page.reload();await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready&&window.sunspark.snapshot().nature.pending===0);assert.equal((await snapshot()).quality,'high');await page.locator('#play').click();await page.waitForTimeout(1500);assert.equal((await snapshot()).bots.length,8);
  await page.keyboard.press('KeyP');await page.locator('#leave').click();
  const switches=[];
  for(let i=0;i<10;i++){
    const map=i%2?'breezy':'sunhaven';await page.locator('#map-select').selectOption(map);await page.waitForFunction(map=>window.sunspark?.snapshot().map===map&&window.sunspark.snapshot().nature.pending===0&&window.sunspark.snapshot().startup.ready,map);
    await page.locator('#explore').click();await page.waitForTimeout(100);const s=await snapshot();assert.equal(s.state,'playing');assert.equal(s.buildCount,0);assert.equal(s.wood,80);assert.equal(s.quality,'high');switches.push({map,position:s.position});
    await page.keyboard.press('KeyP');await page.locator('#leave').click();
  }
  await page.locator('#map-select').selectOption('sunhaven');await page.waitForFunction(()=>window.sunspark?.snapshot().map==='sunhaven'&&window.sunspark.snapshot().nature.pending===0&&window.sunspark.snapshot().startup.ready);await page.locator('#play').click();await page.waitForTimeout(500);assert.equal((await snapshot()).bots.length,10);
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  const report={url,offline:true,loadedMs,switches,network,errors,productionHooksAbsent:true,checks:['crouch, sprint-slide and slide-jump work offline','new practice resets stance','all embedded textures load','build and resource cost','fire and R reload','Detailed quality renders','quality preference survives reload','eight-bot compact match starts','ten map/explore switches reset state and preserve quality','ten-bot Sunhaven match starts offline'],fps:first.fps,nature:first.nature,startup:first.startup,textures:first.textures};
  await writeFile('tests/artifacts/offline-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
