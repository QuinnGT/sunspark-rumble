import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the shipped startup function, not a second implementation of its
// lifecycle. The VM replaces only external systems and asynchronous boundaries.
const gameSource=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const begin=gameSource.indexOf('async function prepareIsland(){');
const end=gameSource.indexOf('\nlet disposed=false;',begin);
assert.ok(begin>=0&&end>begin,'locate the actual prepareIsland function and its lifecycle declaration');
const startupSource=gameSource.slice(begin,end);

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

function harness({pauseAt=null,compileIndex=0,withDelay=true}={}){
  const gate=deferred(),entered=deferred(),events=[],counts={compiles:0,renders:0,starts:0};
  let context,clock=0;
  const record=(type,detail={})=>events.push({type,...detail,afterDispose:context?.disposed??false});
  const checkpoint=async(stage,index=0)=>{
    if(stage===pauseAt&&(stage!=='compile'||index===compileIndex)){
      record('paused',{stage,index});entered.resolve();await gate.promise;
    }
  };
  const startup=new Proxy({ready:false,phase:'loading',error:null},{set(object,key,value){
    if(key==='ready'&&value)record('ready');object[key]=value;return true;
  }});
  const renderer={isWebGLRenderer:true,debug:{},shadowMap:{},compileAsync:async()=>{const index=counts.compiles++;await checkpoint('compile',index);}};
  context={
    disposed:false,scene:{},renderer,startup,
    world:{map:{shore:100},setQuality(){},foliage:{update(){}}},
    prepareAuthoredModels:async()=>checkpoint('models'),
    prepareNatureAssets:async()=>checkpoint('textures'),
    performance:{now:()=>++clock},
    show:(id,visible=true)=>record('ui',{id,visible}),
    __SUNSPARK_TEST__:withDelay,
    mapParams:new URLSearchParams(withDelay?'warmup-delay=1':''),
    camera:{clone:()=>({position:{set(){}},lookAt(){},updateMatrixWorld(){}})},
    graphicsProfile:()=>({shadows:true}),
    natureRenderer:{setQuality(){},render(){counts.renders++;record('render');}},
    globalTime:0,quality:'high',applyGraphics(){},renderProfiler:{reset(){}},
    pendingStart:{which:'practice',keepMap:true},lastTime:0,
    start:(which,keepMap)=>{counts.starts++;record('start',{which,keepMap});},
    console:{error:error=>record('error',{message:String(error)})},
    $:()=>({set textContent(value){record('error-text',{value});}}),
    // Deliberately controlled timer: no sleeps or browser are needed to keep
    // the real function suspended at its optional warmup delay.
    setTimeout:callback=>{checkpoint('delay').then(callback);return 1;},
  };
  vm.createContext(context);
  const run=vm.runInContext(`${startupSource}\nprepareIsland()`,context);
  return {
    context,events,counts,run,
    waitForPause:()=>Promise.race([entered.promise,run.then(()=>{throw new Error(`Startup finished before reaching ${pauseAt}`);})]),
    dispose(){context.disposed=true;context.world.assetLoadCancelled=true;record('dispose');},
    resume:()=>gate.resolve(),reject:()=>gate.reject(new Error('Pending startup work failed after disposal')),
  };
}

test('actual island startup completes warmup and starts the queued game normally',async()=>{
  const h=harness();await h.run;
  assert.equal(h.context.startup.ready,true);assert.equal(h.context.startup.phase,'ready');
  assert.equal(h.counts.compiles,6);assert.equal(h.counts.renders,6);
  assert.equal(h.counts.starts,1);assert.equal(h.context.pendingStart,null);
  assert.ok(h.events.some(e=>e.type==='ui'&&e.id==='loading'&&!e.visible));
  assert.ok(!h.events.some(e=>e.type==='error'||e.type==='ui'&&e.id==='error'));
});

for(const scenario of [
  {pauseAt:'models'},
  {pauseAt:'textures'},
  {pauseAt:'delay'},
  {pauseAt:'compile',compileIndex:0},
  {pauseAt:'compile',compileIndex:4},
])test(`actual startup stops after disposal during ${scenario.pauseAt}${scenario.compileIndex===undefined?'':` ${scenario.compileIndex+1}`}`,async()=>{
  const h=harness(scenario);await h.waitForPause();
  const rendersBefore=h.counts.renders,compilesBefore=h.counts.compiles;
  h.dispose();h.resume();await h.run;
  assert.equal(h.counts.renders,rendersBefore,'do not render disposed GPU resources');
  assert.equal(h.counts.compiles,compilesBefore,'do not start another shader compile after disposal');
  assert.equal(h.context.startup.ready,false,'cancelled startup never becomes ready');
  assert.equal(h.counts.starts,0,'cancelled startup does not start the queued game');
  assert.deepEqual(h.events.filter(e=>e.afterDispose&&['render','ready','start','ui','error','error-text'].includes(e.type)),[],'no rendering, readiness or UI work after disposal');
});

for(const pauseAt of ['models','compile'])test(`rejected ${pauseAt} work after disposal does not publish an error screen`,async()=>{
  const h=harness({pauseAt});await h.waitForPause();h.dispose();h.reject();await h.run;
  assert.equal(h.context.startup.ready,false);assert.equal(h.counts.starts,0);
  assert.deepEqual(h.events.filter(e=>e.afterDispose&&['render','ready','start','ui','error','error-text'].includes(e.type)),[]);
  assert.notEqual(h.context.startup.phase,'failed','teardown is not a startup failure');
});
