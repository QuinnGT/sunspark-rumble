import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir=process.argv.includes('--docks')?'tests/artifacts/docks-milestone/gameplay':process.argv.includes('--art')?'tests/artifacts/sunhaven-art/gameplay':'tests/artifacts/sunhaven';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[],checks=[],profiles=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snap=()=>page.evaluate(()=>window.sunspark.snapshot());
const hold=async(code,ms)=>{await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code);await page.waitForTimeout(120);};
const fire=async()=>{await page.mouse.click(800,500);await page.waitForTimeout(150);};
async function fixture(x,z,yaw=0){await page.evaluate(({x,z,yaw})=>{const g=window.__test;g.start('practice',true);g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,-.2);},{x,z,yaw});await page.waitForTimeout(200);}
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready,{},{timeout:90000});
  await page.screenshot({path:`${dir}/title.png`});await page.locator('#explore').click();await page.waitForTimeout(300);assert.equal((await snap()).map,'sunhaven');
  await fixture(0,42);const start=(await snap()).position;await hold('KeyW',350);await page.keyboard.down('Shift');await hold('KeyW',350);await page.keyboard.up('Shift');assert.ok((await snap()).position[2]<start[2]-4);
  await page.keyboard.press('KeyC');await page.waitForTimeout(100);assert.equal((await snap()).movement.stance,'crouching');await page.keyboard.press('KeyC');await page.keyboard.press('Space');await page.waitForTimeout(150);assert.equal((await snap()).grounded,false);await page.waitForTimeout(1000);checks.push('walking, sprinting, crouching and jumping');
  await fixture(0,42);const base=(await snap()).position[1];await page.keyboard.press('KeyB');await page.keyboard.press('Digit2');assert.ok((await snap()).placement.valid);await fire();
  await hold('KeyW',500);assert.ok((await snap()).placement.snapped);await fire();await hold('KeyW',520);await page.keyboard.press('Digit3');assert.ok((await snap()).placement.valid);await fire();await hold('KeyW',550);await page.keyboard.press('Digit1');assert.ok((await snap()).placement.valid);await fire();
  assert.equal((await snap()).buildCount,4);assert.ok((await snap()).position[1]>base+5.7);await page.keyboard.press('KeyB');await fire();await page.keyboard.press('KeyR');assert.ok((await snap()).reloading>0);await page.waitForTimeout(1600);assert.equal((await snap()).ammo[0],24);checks.push('connected ramps, floor, wall, climbing, firing and reloading');
  await page.screenshot({path:`${dir}/built-cover.png`});
  await fixture(-12,-5);await hold('KeyW',1900);assert.ok((await snap()).position[2]<-16,'walk through both doors');checks.push('actual keyboard traversal through village interior');
  await fixture(-53,85);await hold('KeyW',3200);assert.ok((await snap()).position[1]>6.7,'climb two quarry terraces');
  await page.evaluate(()=>window.__test.setView(Math.PI,-.2));await page.keyboard.down('Shift');await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.press('KeyC');await page.waitForTimeout(100);assert.equal((await snap()).movement.stance,'sliding');await page.waitForTimeout(1700);await page.keyboard.up('KeyW');await page.keyboard.up('Shift');assert.ok((await snap()).position[1]<4.8);checks.push('quarry climb and downhill slide');
  for(const z of [20,39]){await fixture(70,z,Math.PI/2);await hold('KeyW',1600);assert.ok((await snap()).position[0]>79,'walk onto dock from mainland');assert.ok((await snap()).position[1]>3.2);}
  checks.push('both mainland ramps onto dock without catching a deck edge');
  // An accidental jump into the decorative deep cove returns to real dry ground.
  await fixture(98,27);await page.evaluate(()=>{const g=window.__test;g.player.pos.y=0;g.player.grounded=false;g.player.vy=-1;});await page.waitForTimeout(1200);assert.ok((await snap()).position[1]>-.5);assert.ok(await page.evaluate(()=>{const g=window.__test,p=g.player.pos;return g.world.canStand(p.x,p.y,p.z);}));checks.push('deep-water recovery');
  for(const quality of ['low','balanced','high']){
    await fixture(88,39);await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();await page.waitForTimeout(5500);
    const s=await snap();profiles.push({quality,fps:s.fps,drawCalls:s.drawCalls,triangles:s.triangles});assert.equal(s.quality,quality);await page.screenshot({path:`${dir}/docks-${quality}.png`});
  }
  await page.keyboard.press('KeyP');await page.locator('#leave').click();await page.locator('#map-select').selectOption('breezy');await page.waitForFunction(()=>window.sunspark?.snapshot().map==='breezy');await page.locator('#practice').click();assert.equal((await snap()).map,'breezy');checks.push('map selection and compact playground');
  console.log(JSON.stringify({checks,profiles,errors}));await writeFile(`${dir}/browser-report.json`,JSON.stringify({checks,profiles,errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
