import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('tests/artifacts/sunhaven',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven&scenario=sunhaven-tour');
  await page.waitForFunction(()=>window.sunspark?.snapshot().nature.pending===0);await page.waitForTimeout(5500);
  await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();
  for(const [name,x,z,yaw,pitch] of [['village',0,32,0,-.1],['grove',-70,-3,0,-.1],['heights',8,-62,0,-.08],['docks',88,39,0,-.16],['quarry',-53,85,0,-.13]]){
    await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,pitch);},{x,z,yaw,pitch});
    await page.waitForTimeout(2000);views.push({name,...await page.evaluate(()=>window.sunspark.snapshot())});await page.screenshot({path:`tests/artifacts/sunhaven/${name}.png`});
  }
  await page.keyboard.press('KeyP');await page.locator('#leave').click();await page.waitForTimeout(700);await page.screenshot({path:'tests/artifacts/sunhaven/title.png'});
  console.log(JSON.stringify({errors,views:views.map(v=>({name:v.name,fps:v.fps,drawCalls:v.drawCalls,triangles:v.triangles,position:v.position}))}));
  await writeFile('tests/artifacts/sunhaven/visual-report.json',JSON.stringify({errors,views},null,2));
  if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();}
