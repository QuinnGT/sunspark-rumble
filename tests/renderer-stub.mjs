// Simulation-only renderer, real Three.js geometry.
export * from 'three';
export class WebGLRenderer {
  constructor(){this.shadowMap={};this.info={render:{calls:0,triangles:0}};}
  setPixelRatio(){} setSize(){} render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}
}
