import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const before=process.argv.includes('--before'),tag=before?'before':process.argv.includes('--draft')?'draft':'after';
const dir=process.argv.includes('--rock-fix')?'tests/artifacts/rock-trapping/docks':process.argv.includes('--approved')?'tests/artifacts/approved-docks':'tests/artifacts/docks-milestone';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1672,height:940}}),errors=[],views=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
if(before)await page.route('**/game.qa.bundle.js',r=>r.fulfill({path:`${dir}/before.qa.bundle.js`,contentType:'application/javascript'}));
try{
  await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');
  await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready||window.sunspark?.snapshot().startup.error,{},{timeout:90000});
  assert.equal(await page.evaluate(()=>window.sunspark.snapshot().startup.error),null);
  await page.locator('#explore').click();
  const cameras=[
    {name:'reference',x:97.3,z:19.2,yaw:-1.1,pitch:0,position:[105.5,7.8,23.4],target:[76,5.2,0],fov:62},
    {name:'gameplay',x:98,z:39,yaw:-.58,pitch:-.035},
    {name:'entrance',x:80,z:20,yaw:-.22,pitch:.08},
    {name:'cove',x:80,z:31,yaw:1.45,pitch:-.1},
    {name:'backdrop',x:69,z:27,yaw:-.35,pitch:.07},
  ];
  for(const quality of ['low','balanced','high']){
    await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption(quality);await page.locator('#close-graphics').click();
    for(const camera of cameras){
      if(quality!=='high'&&!['reference','gameplay'].includes(camera.name))continue;
      await page.evaluate(c=>{const g=window.__test;g.player.pos.set(c.x,g.world.floorAt(c.x,c.z,5),c.z);g.player.vy=0;g.setView(c.yaw,c.pitch);},camera);
      await page.waitForTimeout(500);
      let referenceUI;
      if(camera.position){
        await page.keyboard.press('KeyP');
        referenceUI=await page.addStyleTag({content:'#pause{display:none!important}'});
        await page.evaluate(c=>{const g=window.__test;g.camera.position.set(...c.position);g.camera.lookAt(...c.target);g.camera.fov=c.fov;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld();g.world.update(10,0,g.camera);},camera);
      }
      await page.evaluate(()=>new Promise(resolve=>{let n=0;const tick=()=>++n>=210?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}));
      const s=await page.evaluate(()=>window.sunspark.snapshot());
      assert.equal(s.startup.error,null);assert.deepEqual(s.shaders.failures,[]);assert.equal(s.textures.withinBudget,true);assert.deepEqual(errors,[]);
      if((process.argv.includes('--approved')||process.argv.includes('--rock-fix'))&&!before){
        assert.equal(s.models.state,'ready');assert.equal(s.models.models,15);assert.equal(s.docksTrees.style,'original island woodland');assert.equal(s.approvedRocks.rocks,13);
        for(const name of ['approved_teal_color','approved_rock_color'])assert.ok(s.textures.assets.some(a=>a.name===name&&a.width>1000));

      }
      const geometry=await page.evaluate(()=>{const g=window.__test,owned=new Set();g.world.scene.traverse(o=>{if(o.geometry)owned.add(o.geometry);});return {count:owned.size,bytes:[...owned].reduce((n,g)=>n+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((a,v)=>a+v.array.byteLength,0),0)};});
      const ui=await page.addStyleTag({content:'#hud,#pause{display:none!important}'});
      const path=`${dir}/${tag}-${quality}-${camera.name}.png`;await page.screenshot({path});await ui.evaluate(e=>e.remove());
      views.push({name:camera.name,quality,camera,path,position:s.position,performance:s.performance,textures:s.textures,geometry,targets:s.targets,models:s.models,oaks:s.oaks,docksTrees:s.docksTrees,approvedRocks:s.approvedRocks});
      if(camera.position){await referenceUI.evaluate(e=>e.remove());await page.keyboard.press('KeyP');}
    }
  }
  const gpu=await page.evaluate(()=>{const gl=window.__test.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable';});
  await writeFile(`${dir}/${tag}-report.json`,JSON.stringify({tag,gpu,viewport:[1672,940],method:'Matched cameras,210 warm frames per view; whole-frame CPU/GPU/draw accounting. Reference camera paused after posing avatar; gameplay cameras use normal controls.',views,errors},null,2));
  console.log(JSON.stringify({tag,views:views.length,errors}));
}catch(error){await page.screenshot({path:`${dir}/${tag}-failure.png`});await writeFile(`${dir}/${tag}-failure.json`,JSON.stringify({message:error.message,views,errors},null,2));throw error;}finally{await browser.close();}

