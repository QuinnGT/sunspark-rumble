import { chromium } from 'playwright-core';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const output='tests/artifacts/art-proof/tree-v2';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1560,height:1010}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://127.0.0.1:4173/design/art-proof/index.html?asset=oak');
  await page.waitForFunction(()=>window.artProof?.ready||window.artProof?.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.artProof.error),undefined);
  for(const [name,position,target]of [['hero',[10,6.8,15],[0,4.6,0]],['front',[0,5,17],[0,4.5,0]],['side',[17,5,0],[0,4.5,0]],['rear',[0,5,-17],[0,4.5,0]],['gameplay',[10,4.3,27],[0,4.5,0]],['crown',[7,8,9],[0,6,0]]]){
    await page.evaluate(({position,target})=>{const a=window.artProof;a.camera.position.set(...position);a.controls.target.set(...target);a.controls.update();},{position,target});
    await page.waitForTimeout(500);const path=`${output}/${name}.png`;await page.locator('#viewport').screenshot({path});views.push({name,path,position,target});
  }
  // The default current comparison must use IslandFoliage, not a landmark oak.
  await page.locator('[data-version="current"]').click();
  assert.equal(await page.locator('#variant').inputValue(),'island');
  assert.equal(await page.locator('#view-label').innerText(),'Island oak');
  const current=await page.evaluate(()=>{const a=window.artProof,o=a.currentTreeVariants.island;return {name:o.constructor.name,trees:o.trees.length,variant:o.trees[0].variant,branchInstances:o.branchBatches[0].count,leafInstances:o.batches.reduce((n,m)=>n+m.count,0),docksVisible:a.currentTreeVariants.docks.visible};});
  assert.deepEqual(current,{name:'IslandFoliage',trees:1,variant:0,branchInstances:1,leafInstances:1,docksVisible:false});
  await page.locator('#reset').click();await page.waitForTimeout(300);await page.locator('#viewport').screenshot({path:`${output}/actual-island-oak.png`});
  await page.locator('[data-version="candidate"]').click();assert.equal(await page.locator('#variant').inputValue(),'concept');
  const tree=await page.evaluate(()=>{const root=window.artProof.treeVariants.concept,leaf=root.children[1],map=leaf.material.map,canvas=document.createElement('canvas');canvas.width=map.image.width;canvas.height=map.image.height;const c=canvas.getContext('2d');c.drawImage(map.image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let cut=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<26)cut++;if(pixels[i]>204)solid++;}return {metadata:root.userData.artProof,alphaTest:leaf.material.alphaTest,shadowAlphaTest:leaf.customDepthMaterial.alphaTest,distanceAlphaTest:leaf.customDistanceMaterial.alphaTest,depthTest:leaf.material.depthTest,depthWrite:leaf.material.depthWrite,transparent:leaf.material.transparent,image:[canvas.width,canvas.height],cutFraction:cut/(pixels.length/4),solidFraction:solid/(pixels.length/4)};});
  assert.equal(tree.alphaTest,tree.shadowAlphaTest);assert.equal(tree.alphaTest,tree.distanceAlphaTest);assert.equal(tree.depthTest,true);assert.equal(tree.depthWrite,true);assert.equal(tree.transparent,false);assert.ok(tree.cutFraction>.3&&tree.solidFraction>.2,'leaf atlas must contain actual alpha cutouts');
  // Exercise the identical wind patch used by color and shadow passes.
  await page.evaluate(()=>window.artProof.treeVariants.concept.update(2.1));await page.waitForTimeout(300);await page.locator('#viewport').screenshot({path:`${output}/wind.png`});
  await page.evaluate(()=>window.artProof.treeVariants.concept.update(0));await page.locator('#reset').click();await page.waitForTimeout(300);await page.screenshot({path:`${output}/viewer.png`});
  const exported=await page.evaluate(async()=>{const a=window.artProof,buffer=await a.exportConceptOak(),bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {base64:btoa(binary),roundtrip:await a.importConceptOak(buffer)};});
  assert.equal(exported.roundtrip.meshes.length,2);assert.ok(exported.roundtrip.meshes.every(m=>m.hasMap&&m.vertices>100));assert.equal(exported.roundtrip.meshes.find(m=>m.name.includes('foliage')).alphaTest,.5);
  const model=Buffer.from(exported.base64,'base64');await writeFile('assets/art-proof/sunhaven-concept-oak-v2.glb',model);
  const modelInfo={bytes:model.length,sha256:createHash('sha256').update(model).digest('hex'),...exported.roundtrip};
  assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({views,current,tree,model:modelInfo,errors,method:'Actual IslandFoliage baseline; six fixed views, alpha/wind-shadow checks and textured GLB export/import. Screenshots manually reviewed; art quality is not an automated assertion.'},null,2));console.log(JSON.stringify({views:views.length,current,tree,model:modelInfo,errors}));
}catch(error){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
