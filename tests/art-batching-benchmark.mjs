// Private frozen-source A/B run: never overwrites the shared QA bundle.
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve('.'),dir='tests/artifacts/sunhaven-art',sources=new Map();
await mkdir(dir,{recursive:true});
async function freeze(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=resolve(path,entry.name);if(entry.isDirectory())await freeze(file);else sources.set(file,await readFile(file,'utf8'));}}
await freeze(resolve('src'));sources.set(resolve('tests/visual-scenario.js'),await readFile('tests/visual-scenario.js','utf8'));
const variants=process.argv.includes('--final')?['before','after']:['before','threshold16','threshold64'];
// CRLF is normalized only in the materials module so the substitution is exact.
sources.set(resolve('src/materials.js'),sources.get(resolve('src/materials.js')).replaceAll('\r\n','\n'));
const normalized=sources.get(resolve('src/materials.js'));
let historical;try{historical=await readFile(`${dir}/art-batching-before-materials.js`,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;historical=normalized;await writeFile(`${dir}/art-batching-before-materials.js`,historical);}
for(const variant of variants){
  let material=variant==='before'?historical:variant==='after'?normalized:historical.replace('if(sources.length<2)continue;\n      const mesh=new THREE.InstancedMesh',`if(sources.length<2)continue;
      const bytes=Object.values(geometry.attributes).reduce((sum,a)=>sum+a.array.byteLength,geometry.index?.array.byteLength??0);
      if(sources.length!==b.meshes.length&&(sources.length-1)*bytes-sources.length*64<${variant==='threshold16'?16384:65536})continue;
      const mesh=new THREE.InstancedMesh`);
  assert.ok(variant==='before'||variant==='after'||material!==historical,'candidate patch applied');
  await build({entryPoints:['tests/visual-scenario.js'],bundle:true,minify:true,format:'iife',define:{__SUNSPARK_TEST__:'true'},outfile:`${dir}/art-batching-${variant}.bundle.js`,plugins:[{name:'frozen-source',setup(b){b.onLoad({filter:/\.(js|mjs)$/},async args=>{if(args.path===resolve('src/materials.js'))return {contents:material,loader:'js'};if(sources.has(args.path))return {contents:sources.get(args.path),loader:'js'};});}}]});
}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),results=[];
try{
  // Reverse the second round to reduce warm cache and order bias.
  for(const [round,order]of [[0,variants],[1,[...variants].reverse()]])for(const variant of order){
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.route('**/game.qa.bundle.js',route=>route.fulfill({path:`${dir}/art-batching-${variant}.bundle.js`,contentType:'application/javascript'}));
    await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
    await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
    assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);await page.locator('#explore').click();
    for(const quality of ['low','high']){
      await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
      for(const [name,x,z,yaw,pitch]of [['docks',98,39,-.6,-.3],['village',0,32,0,-.18]]){
        await page.evaluate(({x,z,yaw,pitch})=>{const g=window.__test;g.player.pos.set(x,g.world.floorAt(x,z),z);g.player.vy=0;g.setView(yaw,pitch);},{x,z,yaw,pitch});
        await page.waitForTimeout(1200);
        const sample=await page.evaluate(()=>new Promise(resolve=>{
          const rows=[];let last;
          const tick=t=>{const p=window.sunspark.snapshot().performance;if(last!==undefined)rows.push({frameMs:t-last,cpu:p.cpuMs,gpu:p.gpu.ms,mainCPU:p.passes.main.cpuMs,mainCalls:p.passes.main.calls,mainTriangles:p.passes.main.triangles,calls:p.total.calls,triangles:p.total.triangles,passes:p.passes});last=t;if(rows.length<180)requestAnimationFrame(tick);else{
            const stats=key=>{const sorted=rows.map(r=>r[key]).filter(Number.isFinite).sort((a,b)=>a-b);return {p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)]};};
            resolve({stats:Object.fromEntries(['frameMs','cpu','gpu','mainCPU','mainCalls','mainTriangles','calls','triangles'].map(key=>[key,stats(key)])),snapshot:window.sunspark.snapshot(),rows});
          }};requestAnimationFrame(tick);
        }));
        assert.deepEqual(errors,[]);assert.equal(sample.snapshot.startup.error,null);
        results.push({round,variant,name,quality,...sample});
        if(round===0&&quality==='high')await page.screenshot({path:`${dir}/art-batching-${variant}-${name}.png`});
        console.log(JSON.stringify({round,variant,name,quality,stats:sample.stats}));
      }
    }
    await page.close();
  }
  const graph=Object.fromEntries([...sources].map(([name,value])=>[relative(root,name),createHash('sha256').update(value).digest('hex')]));
  await writeFile(`${dir}/art-batching-${process.argv.includes('--final')?'final':'comparison'}.json`,JSON.stringify({method:'Frozen source graph; material batching is the only variant. Serial real Chrome WebGL, 1600x1000, 180 warmed frames per view, two rounds in reversed order. GPU timers are asynchronous samples. RTX 5090 local desktop only.',graph,results},null,2));
}finally{await browser.close();}
