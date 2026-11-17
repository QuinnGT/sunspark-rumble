import {build} from 'esbuild';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
const dir='tests/artifacts/sunhaven-art',sources=new Map();
async function freeze(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=resolve(path,entry.name);if(entry.isDirectory())await freeze(file);else sources.set(file,await readFile(file,'utf8'));}}
await freeze(resolve('src'));
const results=[];
for(const variant of ['before','after']){
  const material=variant==='before'?await readFile(`${dir}/art-batching-before-materials.js`,'utf8'):sources.get(resolve('src/materials.js'));
  const outfile=`${dir}/art-batching-geometry-${variant}.mjs`;
  await build({entryPoints:['src/world.js'],bundle:true,minify:true,platform:'node',format:'esm',packages:'external',outfile,plugins:[{name:'frozen-source',setup(b){b.onLoad({filter:/\.js$/},args=>{if(args.path===resolve('src/materials.js'))return {contents:material,loader:'js'};if(sources.has(args.path))return {contents:sources.get(args.path),loader:'js'};});}}]});
  const {World}=await import(pathToFileURL(resolve(outfile))),world=new World(new THREE.Scene(),'sunhaven'),geometry=new Set();
  const excluded=new Set([world.ground,world.foliage,world.meadowGrass,world.dynamic,world.water,world.sky,...world.clouds,...world.flags]);
  let submissions=0,triangles=0,instanceBytes=0;
  const visit=o=>{if(excluded.has(o)||!o.visible)return;if(o.isMesh){submissions++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);geometry.add(o.geometry);if(o.instanceMatrix)instanceBytes+=o.instanceMatrix.array.byteLength;}o.children.forEach(visit);};visit(world.scene);
  const geometryBytes=[...geometry].reduce((sum,g)=>sum+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),0);
  results.push({variant,submissions,triangles,uniqueGeometry:geometry.size,geometryBytes,instanceBytes,totalGeometryBytes:geometryBytes+instanceBytes,solids:world.solids.length,solidVisuals:world.solidVisuals.children.length});
  world.foliage.dispose();world.ground.dispose();world.water.dispose();
}
await writeFile(`${dir}/art-batching-geometry.json`,JSON.stringify({method:'Unculled actual static Sunhaven scene; same source graph, only batching differs. Typed array and instance-matrix bytes, excluding invisible cache sources and driver overhead.',results},null,2));console.log(JSON.stringify(results,null,2));
