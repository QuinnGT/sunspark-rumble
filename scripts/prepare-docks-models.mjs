import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {World} from '../src/world.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// GLTFExporter uses FileReader for its final Blob on browsers. Node has Blob,
// but needs this small asynchronous adapter for offline, texture-free export.
globalThis.FileReader=class{
  readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();}).catch(e=>this.onerror?.(e));}
  readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(value).toString('base64')}`;this.onloadend?.();}).catch(e=>this.onerror?.(e));}
};
const world=new World(new THREE.Scene(),'sunhaven'),scene=new THREE.Scene(),names=new Set(),metadata=[];
for(const source of world.solids){
  const name=source.userData.authoredModel;if(!name)continue;
  if(names.has(name))throw new Error(`Duplicate authored model key: ${name}`);names.add(name);
  const geometry=source.geometry.clone(),material=new THREE.MeshStandardMaterial({name:'Runtime coastal material binding',vertexColors:!!geometry.attributes.color});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;scene.add(mesh);
  geometry.computeBoundingBox();metadata.push({name,vertices:geometry.attributes.position.count,triangles:(geometry.index?.count??geometry.attributes.position.count)/3,attributes:Object.keys(geometry.attributes),bounds:[geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray()]});
}
if(!names.size)throw new Error('No authored dock models were registered.');
for(const slot of world.approvedModelSlots??[]){
  if(names.has(slot.key))continue;names.add(slot.key);
  const geometry=slot.source.clone(),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:!!geometry.attributes.color}));mesh.name=slot.key;scene.add(mesh);
  geometry.computeBoundingBox();metadata.push({name:slot.key,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3,attributes:Object.keys(geometry.attributes),bounds:[geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray()]});
}
const glb=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true}));
const sha256=createHash('sha256').update(glb).digest('hex');
await mkdir('assets/docks',{recursive:true});await writeFile('assets/docks/docks-landmarks.glb',glb);
await writeFile('assets/docks/manifest.json',JSON.stringify({format:'glTF 2.0 binary',units:'metres',up:'+Y',source:'Original Sunspark architecture; three CC0 Quaternius Stylized Nature MegaKit Standard rock models. Runtime textures are embedded separately; see assets/approved-docks/manifest.json and THIRD-PARTY-NOTICES.txt.',generator:'scripts/prepare-docks-models.mjs',bytes:glb.length,sha256,models:metadata},null,2));
await writeFile('src/generated/docks-models.js',`// Generated offline model payload; rebuild with npm run prepare:docks.\nexport default ${JSON.stringify({base64:glb.toString('base64'),sha256,models:metadata})};\n`);
console.log(JSON.stringify({models:metadata.length,bytes:glb.length,sha256}));

