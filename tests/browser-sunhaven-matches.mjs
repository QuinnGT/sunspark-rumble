// Real-time rendered matches. The driver reads QA routes and sets camera direction;
// movement, firing and reloading use browser input. No time/health/damage overrides.
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('tests/artifacts/sunhaven',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[],matches=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);
  for(const difficulty of ['easy','easy','easy','medium','hard','insane']){
    await page.locator(`[data-difficulty="${difficulty}"]`).click();await page.locator('#play').click();await page.waitForTimeout(300);
    const start=await page.evaluate(()=>window.sunspark.snapshot());let firstEnemy=null,firstHit=null,frames=[];
    const deadline=Date.now()+340000;let walking=false,firing=false;
    while(Date.now()<deadline){
      const driver=await page.evaluate(()=>{
        const g=window.__test,s=window.sunspark.snapshot();if(s.state!=='playing')return {s};
        const origin=g.player.pos.clone();origin.y+=1.3;
        const enemies=g.actors.filter(a=>a.alive&&a.pos.distanceTo(g.player.pos)<50).filter(a=>{const target=a.pos.clone();target.y+=1.3;const d=target.sub(origin);return !g.terrainHit(origin,d.clone().normalize(),d.length()-.6);}).sort((a,b)=>a.pos.distanceTo(g.player.pos)-b.pos.distanceTo(g.player.pos));
        const zone=g.world.stormAt(s.elapsed+15),outside=Math.hypot(g.player.pos.x-zone.x,g.player.pos.z-zone.z)>zone.radius-8;
        if(enemies.length&&!outside){
          const target=enemies[0].pos.clone();target.y+=1.3;
          for(let i=0;i<3;i++){const d=target.clone().sub(g.camera.position);g.setView(Math.atan2(d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z)));}
          return {s,walk:false,fire:true,enemy:enemies[0].name};
        }
        const goal=g.botController.groundGoal(zone.x,zone.z),path=g.navigation.route(g.player.pos,goal),p=path.find(p=>Math.hypot(p.x-g.player.pos.x,p.z-g.player.pos.z)>.8);
        if(p)g.setView(Math.atan2(p.x-g.player.pos.x,-(p.z-g.player.pos.z)),-.12);
        return {s,walk:!!p,fire:false};
      });
      if(driver.s.state!=='playing')break;
      if(driver.enemy&&firstEnemy===null)firstEnemy=driver.s.elapsed;if(driver.s.pops>0&&firstHit===null)firstHit=driver.s.elapsed;
      if(driver.walk!==walking){await page.keyboard[driver.walk?'down':'up']('KeyW');walking=driver.walk;}
      if(driver.fire!==firing){await page.mouse[driver.fire?'down':'up']();firing=driver.fire;}
      if(driver.s.ammo[0]===0&&driver.s.reloading===0)await page.keyboard.press('KeyR');
      if(frames.length===0||driver.s.elapsed-frames.at(-1).time>5)frames.push({time:driver.s.elapsed,fps:driver.s.fps,alive:driver.s.bots.filter(b=>b.alive).length,position:driver.s.position,pops:driver.s.pops,health:driver.s.health});
      await page.waitForTimeout(350);
    }
    await page.keyboard.up('KeyW');await page.mouse.up();const end=await page.evaluate(()=>window.sunspark.snapshot());assert.equal(end.state,'result','match must resolve in real time');
    const result=await page.locator('#result-title').textContent(),record={difficulty,start:start.position,time:end.elapsed,pops:end.pops,result,firstEnemy,firstPop:firstHit,frames};matches.push(record);
    await page.screenshot({path:`tests/artifacts/sunhaven/match-${matches.length}-${difficulty}.png`});await writeFile('tests/artifacts/sunhaven/live-matches.json',JSON.stringify({driver:'QA route/camera guidance; browser movement/fire inputs; normal time and damage',matches,errors},null,2));
    console.log(JSON.stringify({...record,frames:undefined}));await page.locator('#result-menu').click();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
