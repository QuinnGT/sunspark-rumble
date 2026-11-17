// Repeatable close-up orbit plus real walking/jump checks in an isolated Chrome.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const tag=process.argv[2]||'after',browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:950},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await mkdir('tests/artifacts/crate',{recursive:true});
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario=roof-crate');
  await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);
  await page.waitForTimeout(6500);
  for(const quality of ['high','balanced','low']){
    await page.locator('#performance').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
    for(let i=0;i<4;i++){
      // Fixture setup puts the player beside the crate; subsequent camera motion
      // and rendering run through the game's normal update loop.
      await page.evaluate(i=>{const g=window.__test,c=g.world.obstacles.find(o=>o.mesh.userData.prop==='roof-crate'),p=c.box.getCenter(g.player.pos.clone()),a=i*Math.PI/2;
        g.player.pos.set(p.x+Math.sin(a)*1.5,c.box.min.y,p.z+Math.cos(a)*1.5);g.player.vy=0;g.setView(-a,-.60);
        // Hide only the avatar for the inspection captures so it cannot obscure
        // the small crate. Reload below restores it for walking/landing checks.
        g.player.root.visible=false;
      },i);
      await page.waitForTimeout(250);await page.keyboard.down('ArrowRight');await page.waitForTimeout(130);await page.keyboard.up('ArrowRight');await page.waitForTimeout(100);
      await page.screenshot({path:`tests/artifacts/crate/${tag}-${quality}-${i}.png`});
    }
  }
  // Restore the landing fixture and use actual keyboard movement.
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario=roof-crate');await page.waitForFunction(()=>window.sunspark?.snapshot().state==='playing');
  const snapshot=()=>page.evaluate(()=>window.sunspark.snapshot()),start=await snapshot();
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');await page.waitForTimeout(100);const stopped=await snapshot();assert.ok(start.position[2]-stopped.position[2]<.7,'crate must stop walking');
  await page.keyboard.press('Space');await page.keyboard.down('KeyW');await page.waitForTimeout(130);await page.keyboard.up('KeyW');await page.waitForTimeout(1100);const landed=await snapshot();assert.ok(landed.position[1]>start.position[1]+.6);assert.equal(landed.grounded,true);
  assert.deepEqual(errors,[]);const result={tag,views:12,qualities:['high','balanced','low'],walkingBlocked:true,jumpLanding:true,errors};await writeFile(`tests/artifacts/crate/${tag}-report.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
