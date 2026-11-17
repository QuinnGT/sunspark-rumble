import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const elements=new Map(),handlers=new Map();
class Element{
  constructor(){this.style={};this.dataset={};this.value='high';this.textContent='';this.innerHTML='';this.classList={toggle(){},contains:()=>true};}
  addEventListener(){}focus(){}getContext(){return new Proxy({},{get:()=>()=>{}});}replaceChildren(){}
}
globalThis.window=globalThis;globalThis.innerWidth=1280;globalThis.innerHeight=720;globalThis.devicePixelRatio=1;globalThis.HTMLInputElement=class{};globalThis.HTMLSelectElement=class{};
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},querySelectorAll:()=>[],addEventListener:(type,fn)=>handlers.set(type,fn),createElement:()=>new Element(),exitPointerLock(){},pointerLockElement:null};
globalThis.addEventListener=(type,fn)=>handlers.set(type,fn);globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.location={search:'?map=sunhaven',href:'http://localhost/?map=sunhaven'};
let now=performance.now(),raf;globalThis.requestAnimationFrame=fn=>raf=fn;
const bundle=await build({entryPoints:[resolve('src/game.js')],bundle:true,platform:'node',format:'cjs',write:false,define:{__SUNSPARK_TEST__:'true'},plugins:[{name:'renderer-only',setup(b){b.onResolve({filter:/^three$/},args=>args.importer.endsWith('game.js')?{path:resolve('tests/renderer-stub.mjs')}:undefined);}}]});
new Function('require',bundle.outputFiles[0].text)(createRequire(import.meta.url));
export const game=window.__test,snapshot=()=>window.sunspark.snapshot();
export function advance(seconds,hz=30){for(let i=0;i<Math.ceil(seconds*hz);i++){now+=1000/hz;raf(now);}}
export function key(code,down=true){handlers.get(down?'keydown':'keyup')({code,repeat:false,target:document.getElementById('game'),preventDefault(){}});}
