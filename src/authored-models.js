import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sphere } from 'three';
import modelData from './generated/docks-models.js';

// Physics uses the same authored source geometry synchronously. Before play,
// WebGL replaces its visible slots with the corresponding embedded glTF meshes.
// No URL fetch, decoder download or opaque fallback is allowed at startup.
export async function prepareAuthoredModels(world, data=modelData) {
  const slots=world.authoredModelSlots??[];
  const status=world.authoredModelStatus={state:slots.length?'loading':'unused',models:0,bytes:0};
  if(!slots.length)return status;
  let asset;
  try{
    if(!data?.base64)throw new Error('Authored docks models have not been prepared.');
    const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));
    asset=await new GLTFLoader().parseAsync(bytes.buffer,'');
    if(world.assetLoadCancelled){status.state='cancelled';return status;}
    const meshes=new Map();asset.scene.traverse(o=>{if(o.isMesh)meshes.set(o.name,o);});
    const validated=[];
    for(const slot of slots){
      const mesh=meshes.get(slot.key);
      if(!mesh)throw new Error(`Authored model missing: ${slot.key}`);
      // Reject stale exports before replacing any visible geometry. Every
      // collision vertex, normal, UV and index must describe the same asset.
      assertMatchingGeometry(slot.source,mesh.geometry,slot.key);
      validated.push({slot,mesh});
    }
    const shared=new Map();
    const replacements=validated.map(({slot,mesh})=>{
      const key=slot.key+':'+slot.matrix.elements.join(',')+':'+(slot.boundsPadding?.toArray().join(',')??'');
      if(!shared.has(key)){
        const geometry=mesh.geometry.clone().applyMatrix4(slot.matrix);
        if(slot.boundsPadding){geometry.computeBoundingBox();geometry.boundingBox.expandByVector(slot.boundsPadding);geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new Sphere());}
        shared.set(key,geometry);
      }
      return {slot,geometry:shared.get(key)};
    });
    for(const {slot,geometry} of replacements){
      if(slot.releaseOldGeometry!==false)slot.visual.geometry.dispose();
      slot.visual.geometry=geometry;slot.retainGeometry?.(geometry);
      slot.visual.userData.authoredGLTF=true;
    }
    status.state='ready';status.models=replacements.length;status.bytes=bytes.byteLength;return status;
  }catch(error){status.state='failed';status.error=String(error.message||error);throw error;}
  finally{
    if(asset){const resources=new Set();asset.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);});for(const r of resources)r.dispose();}
  }
}

export function assertMatchingGeometry(source, imported, name='model'){
  for(const key of Object.keys(source.attributes)){
    const a=source.attributes[key],b=imported.attributes[key];
    if(!b||a.itemSize!==b.itemSize||a.count!==b.count)throw new Error(`${name}: stale or incomplete ${key} attribute`);
    for(let i=0;i<a.array.length;i++)if(Math.abs(a.array[i]-b.array[i])>1e-6)throw new Error(`${name}: imported ${key} differs from collision geometry`);
  }
  if(Boolean(source.index)!==Boolean(imported.index)||source.index?.count!==imported.index?.count)throw new Error(`${name}: imported topology differs`);
  if(source.index)for(let i=0;i<source.index.count;i++)if(source.index.getX(i)!==imported.index.getX(i))throw new Error(`${name}: imported winding differs`);
}
