import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output='tests/artifacts/art-proof';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1560,height:1010}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  await page.goto('http://127.0.0.1:4173/design/art-proof/index.html');
  await page.waitForFunction(()=>window.artProof?.ready||window.artProof?.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.artProof.error),undefined);
  for(const [asset,version,variant] of [['wall','current','1'],['wall','candidate','1'],['cliff','current','stylized'],['cliff','candidate','stylized'],['cliff','candidate','scan'],...['island','ash','docks'].map(i=>['oak','current',i]),...['concept','previous'].map(i=>['oak','candidate',i])]) {
    await page.evaluate(([a,v,n])=>window.artProof.select(a,v,n),[asset,version,variant]);
    await page.waitForTimeout(650);
    const path=`${output}/${asset}-${version}-${variant}.png`;await page.locator('#viewport').screenshot({path});
    const d=await page.evaluate(()=>window.artProof.diagnostics());assert.deepEqual(d.failures,[]);assert.deepEqual(d.audit.violations,[]);views.push({path,...d});
  }
  await page.locator('[data-asset="wall"]').click();await page.locator('[data-version="candidate"]').click();
  await page.screenshot({path:`${output}/viewer.png`});
  // Inspect real geometry clearance at different view directions. These captures
  // support manual review; they do not automatically classify pixel flicker.
  for(const [name,position]of [['grazing',[8,2,1.7]],['elevated',[6,7,8]],['close',[-.8,2.4,4]]]){
    await page.evaluate(p=>{const a=window.artProof;a.camera.position.set(...p);a.controls.target.set(0,2,0);a.controls.update();},position);await page.waitForTimeout(350);await page.locator('#viewport').screenshot({path:`${output}/wall-${name}.png`});
  }
  await page.locator('#reset').click();const camera=await page.evaluate(()=>window.artProof.camera.position.toArray());assert.ok(Math.abs(camera[0]-4.1)<.01);
  const programs=await page.evaluate(()=>window.artProof.renderer.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??true})));assert.ok(programs.every(p=>p.runnable));assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({views,programs,errors,method:'Same lighting/camera per asset; original current materials and oak, actual terrain crop. Captures require visual judgement.'},null,2));console.log(JSON.stringify({views:views.length,errors,programs:programs.length,audit:views[0].audit}));
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});await writeFile(`${output}/failure.json`,JSON.stringify({message:error.message,errors},null,2));throw error;}finally{await browser.close();}
