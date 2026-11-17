// Dedicated browser profile for local rendering checks; never uses a personal profile.
import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('tests/artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1980,height:1140},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const reports=[];
try{
  for(const spot of process.argv.slice(2).length?process.argv.slice(2):['meadow','cabin','coast']){
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?scenario=art-tour&spot='+spot);
    await page.waitForFunction(()=>window.sunspark?.snapshot().state==='playing');
    // Use the same public graphics menu as the player.
    await page.locator('#performance').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();
    await page.waitForFunction(()=>window.sunspark.snapshot().nature.pending===0);
    await page.waitForTimeout(7000);
    reports.push({spot,snapshot:await page.evaluate(()=>window.sunspark.snapshot())});
    await page.screenshot({path:'tests/artifacts/'+spot+'.png'});
  }
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
  await writeFile('tests/artifacts/visual-report.json',JSON.stringify({gpu,errors,reports},null,2));
  console.log(JSON.stringify({gpu,errors,views:reports.map(r=>({spot:r.spot,fps:r.snapshot.fps,drawCalls:r.snapshot.drawCalls,triangles:r.snapshot.triangles}))},null,2));
  if(errors.length)process.exitCode=1;
}finally{await browser.close();}
