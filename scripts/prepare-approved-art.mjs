import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
globalThis.ProgressEvent??=class{constructor(type,options={}){this.type=type;Object.assign(this,options);}};
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const root='assets/art-proof',models={},scene=new THREE.Scene(),loader=new GLTFLoader();
async function geometryAsset(path){
  const bytes=await readFile(path);let json,binary;
  if(path.endsWith('.glb')){const jsonLength=bytes.readUInt32LE(12);json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());const offset=20+jsonLength;binary=bytes.subarray(offset+8,offset+8+bytes.readUInt32LE(offset));}
  else json=JSON.parse(bytes.toString());
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  delete json.materials;delete json.images;delete json.textures;delete json.samplers;
  for(const buffer of json.buffers){const data=buffer.uri?await readFile(resolve(dirname(path),buffer.uri)):binary;buffer.uri='data:application/octet-stream;base64,'+data.toString('base64');}
  return (await loader.parseAsync(JSON.stringify(json),'')).scene;
}
function add(key,geometry){
  const encode=a=>({type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,base64:Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength).toString('base64')});
  geometry.computeBoundingBox();models[key]={attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([k,a])=>[k,encode(a)])),index:geometry.index?encode(geometry.index):null,bounds:[geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray()]};
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:!!geometry.attributes.color}));mesh.name=key;scene.add(mesh);
}
// The concept oak stays in the art study. Gameplay uses the original woodland
// templates again, so its mesh and leaf atlas are not part of this payload.
for(let i=1;i<=3;i++){
  const asset=await geometryAsset(`${root}/nature/Rock_Medium_${i}.gltf`);asset.updateMatrixWorld(true);asset.traverse(m=>{if(m.isMesh){const g=m.geometry.clone().applyMatrix4(m.matrixWorld);g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());g.translate(-c.x,-b.min.y,-c.z);g.scale(1/size.x,1/size.x,1/size.x);add(`approved-rock-${i}`,g);}});
}
const textures={},records=[],encoded=JSON.parse(await readFile('assets/approved-docks/webp-encode.json','utf8')).textures;
// Colour maps ship as WebP (see scripts/encode-approved-webp.mjs); the PNGs stay as the source of record.
for(const [name,file]of [['approved_teal_color','teal-plank-atlas-v1.webp'],['approved_rock_color','nature/Rocks_Diffuse.webp']]){
  const path=`${root}/${file}`,bytes=await readFile(path),sha256=createHash('sha256').update(bytes).digest('hex'),enc=encoded.find(e=>e.file===path);
  if(enc?.sha256!==sha256)throw new Error(`${path} does not match webp-encode.json; rerun node scripts/encode-approved-webp.mjs`);
  textures[name]='data:image/webp;base64,'+bytes.toString('base64');
  records.push({name,file:path,bytes:bytes.length,sha256,encoder:enc.encoder,quality:enc.quality,lossless:enc.lossless,psnrDb:enc.psnrDb,source:enc.source,sourceBytes:enc.sourceBytes,sourceSha256:enc.sourceSha256});
}
const glb=Buffer.from(await new GLTFExporter().parseAsync(scene,{binary:true}));await mkdir('assets/approved-docks',{recursive:true});await writeFile('assets/approved-docks/approved-models.glb',glb);
await writeFile('src/generated/approved-models.js',`// Generated from approved glTF assets. Rebuild: npm run prepare:approved-art\nexport default ${JSON.stringify({models})};\n`);
await writeFile('src/generated/approved-textures.js',`// Approved textures, embedded for offline play.\nexport default ${JSON.stringify(textures)};\n`);
await writeFile('assets/approved-docks/manifest.json',JSON.stringify({source:'Approved generated timber artwork and Quaternius CC0 stylized rocks; concept oak retained only in art study',modelBytes:glb.length,modelSha256:createHash('sha256').update(glb).digest('hex'),models:Object.keys(models),textures:records},null,2));
console.log(JSON.stringify({models:Object.keys(models),modelBytes:glb.length,textures:records.map(r=>({name:r.name,bytes:r.bytes}))}));
