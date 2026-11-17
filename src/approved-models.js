import * as THREE from 'three';
import data from './generated/approved-models.js';

export const APPROVED_MODEL_DATA=data;
const types={Float32Array,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array};
export function approvedGeometry(name){
  const definition=data.models[name];if(!definition)throw new Error(`Approved model missing: ${name}`);
  const decode=d=>{const bytes=Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0));return new THREE.BufferAttribute(new types[d.type](bytes.buffer),d.itemSize,d.normalized);};
  const geometry=new THREE.BufferGeometry();for(const [key,value]of Object.entries(definition.attributes))geometry.setAttribute(key,decode(value));if(definition.index)geometry.setIndex(decode(definition.index));
  geometry.name=name;geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.approvedAsset=name;return geometry;
}
