import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const page=await browser.newPage({viewport:{width:1672,height:940}});
await page.goto('http://127.0.0.1:4173/tests/scenario.html?map=sunhaven');await page.waitForFunction(()=>window.sunspark?.snapshot().startup.ready,{},{timeout:90000});await page.locator('#explore').click();
await page.keyboard.press('KeyP');await page.locator('#pause-graphics').click();await page.locator('#quality').selectOption('high');await page.locator('#close-graphics').click();await page.keyboard.press('KeyP');await page.addStyleTag({content:'#hud,#pause{display:none!important}'});
const poses=[{name:'final-wide',pos:[105.5,7.8,23.4],target:[76,5.2,0],player:[97.3,19.2]}];
for(const c of poses){await page.evaluate(c=>{const g=window.__test;g.player.pos.set(c.player[0],3.3,c.player[1]);g.setView(-1,0);g.camera.position.set(...c.pos);g.camera.lookAt(...c.target);g.camera.fov=62;g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld();g.world.update(10,0,g.camera);},c);await page.waitForTimeout(500);await page.screenshot({path:`tests/artifacts/docks-milestone/camera-${c.name}.png`});}
}finally{await browser.close();}
