import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const before=process.argv.includes('--before'),tag=before?'before':'after',dir='tests/artifacts/rock-trapping';await mkdir(dir,{recursive:true});
const cases=JSON.parse(await readFile('tests/rock-trapping-cases.json','utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',r=>r.fulfill({path:`${dir}/before.qa.bundle.js`,contentType:'application/javascript'}));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);await page.locator('#explore').click();
  const state=()=>page.evaluate(()=>{const g=window.__test,a=g.player,p=a.pos;return {position:p.toArray(),clear:g.world.canStand(p.x,p.y,p.z,a.radius,a.height),embedded:g.world.nearObstacles(p.x,p.z,a.radius).some(o=>o.shape?.blocks(p.x,p.z,a.radius,p.y,a.height,0)),health:a.health};});
  const place=async position=>page.evaluate(position=>{const g=window.__test;g.movement.reset();g.player.pos.fromArray(position);g.player.vy=0;g.player.grounded=false;g.setView(.8,-.27);},position);
  for(const quality of ['low','balanced','high']){
    await page.evaluate(q=>{const el=document.getElementById('quality');el.value=q;el.dispatchEvent(new Event('change'));},quality);
    for(const c of cases){
      await place(c.drop);await page.waitForTimeout(1600);const fallen=await state();
      if(!before){assert.equal(fallen.embedded,false,`${c.rock} fall at ${quality}`);assert.equal(fallen.clear,true);}
      if(c===cases[0])await page.screenshot({path:`${dir}/${tag}-${quality}-fall.png`});
      await place(c.trapped);await page.waitForTimeout(120);const recovered=await state();
      if(!before){assert.equal(recovered.embedded,false,`${c.rock} recovery at ${quality}`);assert.equal(recovered.clear,true);}
      results.push({quality,rock:c.rock,fallen,recovered});
    }
    // Keyboard jump and movement must work after the captured stuck position.
    await place(cases[0].trapped);await page.waitForTimeout(180);const start=await state();
    await page.keyboard.down('Space');await page.waitForTimeout(300);const jumped=await state();await page.keyboard.up('Space');
    if(!before)assert.ok(jumped.position[1]>start.position[1]+1,'ordinary Space works after recovery');
    let escaped=false;
    for(let i=0;i<8&&!escaped;i++){
      await place(cases[0].trapped);await page.waitForTimeout(180);const from=await state();
      await page.evaluate(yaw=>window.__test.setView(yaw,-.27),i*Math.PI/4);await page.keyboard.down('KeyW');await page.waitForTimeout(700);await page.keyboard.up('KeyW');const to=await state();
      escaped=to.clear&&Math.hypot(to.position[0]-from.position[0],to.position[2]-from.position[2])>1;
    }
    assert.equal(escaped,!before,'ordinary movement escapes only in the corrected build');
    results.push({quality,keyboardEscape:escaped,jumpGain:jumped.position[1]-start.position[1]});
  }
  if(before)assert.ok(results.filter(r=>r.fallen?.embedded).length>=30,'saved release reproduces trapping across presets');
  const snapshot=await page.evaluate(()=>window.sunspark.snapshot());assert.deepEqual(errors,[]);
  await writeFile(`${dir}/${tag}-browser-report.json`,JSON.stringify({tag,results,errors,trees:snapshot.docksTrees,models:snapshot.models,checks:'13 rock-edge falls and 13 embedded recoveries in each preset; real keyboard jumping and escape; old build must reproduce the trap.'},null,2));console.log(JSON.stringify({tag,results:results.length,embeddedFalls:results.filter(r=>r.fallen?.embedded).length,errors}));
}catch(e){await page.screenshot({path:`${dir}/${tag}-failure.png`});await writeFile(`${dir}/${tag}-failure.json`,JSON.stringify({message:e.message,results,errors},null,2));throw e;}finally{await browser.close();}
