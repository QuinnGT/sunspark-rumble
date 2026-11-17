import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const dir='tests/artifacts/render-readiness';await mkdir(dir,{recursive:true});
await build({entryPoints:['tests/render-readiness-fixture.js'],bundle:true,minify:true,format:'iife',outfile:`${dir}/fixture.bundle.js`});
await writeFile(`${dir}/fixture.html`,'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Sunspark render reference</title><style>html,body{margin:0;background:#accbdb}canvas{display:block}</style></head><body><canvas></canvas><script src="fixture.bundle.js"></script></body></html>');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage({viewport:{width:960,height:640}}),errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('request',request=>requests.push(request.url()));
try{
  await page.goto(`http://127.0.0.1:4173/${dir}/fixture.html`);await page.waitForFunction(()=>window.renderReadiness?.ready||window.renderReadiness?.error);assert.equal(await page.evaluate(()=>window.renderReadiness.error),undefined);
  const colors={};for(const quality of ['low','balanced','high']){colors[quality]=await page.evaluate(quality=>window.renderReadiness.captureColors(quality),quality);await page.screenshot({path:`${dir}/colors-${quality}.png`});}
  const maxColorDifference=Math.max(...colors.low.flatMap((sample,i)=>sample.map((value,c)=>Math.abs(value-colors.high[i][c]))));
  assert.ok(maxColorDifference<=3,`Direct vs Detailed color shift ${maxColorDifference}/255 (AO disabled)`);assert.deepEqual(colors.low,colors.balanced);
  const profiles={};for(const quality of ['low','balanced','high']){profiles[quality]=await page.evaluate(quality=>window.renderReadiness.draw('shore',quality),quality);await page.screenshot({path:`${dir}/shore-${quality}.png`});}
  assert.equal(profiles.low.profile.passes.refraction,undefined);assert.ok(profiles.balanced.profile.passes.refraction.calls>0);assert.ok(profiles.high.profile.passes.reflection.calls>0);assert.equal(profiles.high.profile.passes.contact.calls,1);
  for(const sample of Object.values(profiles)){const passCalls=Object.values(sample.profile.passes).reduce((sum,pass)=>sum+pass.calls,0);assert.equal(passCalls,sample.profile.total.calls);assert.deepEqual(sample.shaders.failures,[]);}
  const layers=await page.evaluate(()=>window.renderReadiness.draw('layers','high'));await page.screenshot({path:`${dir}/vertical-material-layers.png`});assert.ok(layers.shaders.applied['terrain.normal']>0);assert.ok(layers.shaders.applied['terrain.roughness']>0);
  assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:4173/')||url.startsWith('data:')),'all assets remain local');assert.deepEqual(errors,[]);
  const terrain=await page.evaluate(()=>window.renderReadiness.terrain);
  await page.addInitScript(()=>{const get=WebGL2RenderingContext.prototype.getExtension;WebGL2RenderingContext.prototype.getExtension=function(name){return name==='EXT_color_buffer_float'?null:get.call(this,name);};});
  await page.reload();await page.waitForFunction(()=>window.renderReadiness?.ready||window.renderReadiness?.error);assert.equal(await page.evaluate(()=>window.renderReadiness.error),undefined);
  const fallbackColors={};for(const quality of ['low','balanced','high'])fallbackColors[quality]=await page.evaluate(quality=>window.renderReadiness.captureColors(quality),quality);
  const fallbackDifference=Math.max(...fallbackColors.low.flatMap((sample,i)=>sample.map((value,c)=>Math.abs(value-fallbackColors.high[i][c]))));assert.equal(fallbackDifference,0,'No-HDR fallback must preserve final output color');
  const fallback=await page.evaluate(()=>window.renderReadiness.draw('shore','high'));assert.equal(fallback.profile.passes.contact,undefined);assert.equal(fallback.profile.passes.refraction,undefined);assert.equal(fallback.profile.passes.reflection,undefined);assert.equal(fallback.contact.hdrSupported,false);
  await page.screenshot({path:`${dir}/shore-no-hdr.png`});assert.deepEqual(errors,[]);
  const report={maxColorDifference,colors,profiles,terrain,fallback:{maxColorDifference:fallbackDifference,colors:fallbackColors,render:fallback},errors,requests};await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({maxColorDifference,fallbackDifference,errors}));
}finally{await browser.close();}
