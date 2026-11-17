// Fixed-view visual regression for the coastal foam grid. Private bundles keep
// the shared QA build untouched; only the water module differs between variants.
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const dir='tests/artifacts/sunhaven-art',sources=new Map();await mkdir(dir,{recursive:true});
async function freeze(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=resolve(path,entry.name);if(entry.isDirectory())await freeze(file);else sources.set(file,await readFile(file,'utf8'));}}
await freeze(resolve('src'));sources.set(resolve('tests/visual-scenario.js'),await readFile('tests/visual-scenario.js','utf8'));
const historical=await readFile(`${dir}/water-foam-before.js`,'utf8'),variants=['before','after'];
for(const variant of variants){
  await build({entryPoints:['tests/visual-scenario.js'],bundle:true,minify:true,format:'iife',define:{__SUNSPARK_TEST__:'true'},outfile:`${dir}/water-foam-${variant}.bundle.js`,plugins:[{name:'frozen-source',setup(b){b.onLoad({filter:/\.(js|mjs)$/},args=>{if(args.path===resolve('src/nature-water.js')&&variant==='before')return {contents:historical,loader:'js'};if(sources.has(args.path))return {contents:sources.get(args.path),loader:'js'};});}}]});
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[];
try{
  for(const variant of variants){
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.route('**/game.qa.bundle.js',route=>route.fulfill({path:`${dir}/water-foam-${variant}.bundle.js`,contentType:'application/javascript'}));
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
    await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
    assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);await page.locator('#explore').click();
    await page.evaluate(()=>{const water=window.__test.world.water,update=water.update.bind(water);water.update=()=>update(10);});
    for(const quality of ['low','balanced','high']){
      await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
      for(const [name,x,z,yaw,pitch]of [['boardwalk',98,32,1.25,-.5],['inward-docks',98,39,-.6,-.3]]){
        await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,pitch);g.world.water.nextReflection=0;},{x,z,yaw,pitch});
        await page.waitForTimeout(1500);
        const snapshot=await page.evaluate(()=>window.sunspark.snapshot());
        assert.equal(snapshot.startup.error,null);assert.deepEqual(snapshot.shaders.failures,[]);assert.deepEqual(errors,[]);assert.equal(snapshot.textures.withinBudget,true);
        const path=`${dir}/water-foam-${variant}-${quality}-${name}.png`;await page.screenshot({path});
        results.push({variant,quality,name,path,water:snapshot.targets.water,textureCount:snapshot.textures.sourceCount,textureBytes:snapshot.textures.estimatedBytes,shaders:snapshot.shaders,performance:snapshot.performance});
        console.log(JSON.stringify({variant,quality,name,errors}));
      }
    }
    await page.close();
  }
  for(const before of results.filter(r=>r.variant==='before')){
    const after=results.find(r=>r.variant==='after'&&r.quality===before.quality&&r.name===before.name);
    assert.equal(after.water.estimatedBytes,before.water.estimatedBytes);assert.equal(after.textureCount,before.textureCount);assert.equal(after.textureBytes,before.textureBytes);
    assert.deepEqual(after.water.targets.map(t=>[t.name,t.width,t.height,t.samples,t.color]),before.water.targets.map(t=>[t.name,t.width,t.height,t.samples,t.color]));
  }
  const graph=Object.fromEntries([...sources].map(([name,value])=>[relative(resolve('.'),name),createHash('sha256').update(value).digest('hex')]));
  await writeFile(`${dir}/water-foam-report.json`,JSON.stringify({method:'Frozen source graph, only water module differs; actual Chrome WebGL at 1600x1000, fixed water time 10 seconds and fixed camera views. Visual/budget verification, not a frame-time benchmark.',graph,results},null,2));
}finally{await browser.close();}
