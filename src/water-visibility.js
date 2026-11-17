import * as THREE from 'three';

const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];

// Derive conservative wet bounds from the same depth field used by the shader.
// This includes harbors/inlets regardless of the direction away from the origin.
export class WaterVisibility {
  constructor(depthTexture,extent,seaLevel,outerRadius){
    this.boxes=[];this.matrix=new THREE.Matrix4();this.frustum=new THREE.Frustum();this.eye=new THREE.Vector3();
    this.projectedBounds={minX:1,minY:1,maxX:-1,maxY:-1};
    this.corners=Array.from({length:8},()=>new THREE.Vector4());this.intersection=new THREE.Vector4();
    const {data,width:size}=depthTexture.image,stride=16;
    const add=(x0,z0,x1,z1)=>this.boxes.push(new THREE.Box3(new THREE.Vector3(x0,seaLevel-.15,z0),new THREE.Vector3(x1,seaLevel+.15,z1)));
    const world=value=>(value/(size-1)-.5)*extent;
    for(let y=0;y<size-1;y+=stride)for(let x=0;x<size-1;x+=stride){
      const endX=Math.min(size-1,x+stride),endY=Math.min(size-1,y+stride);let wet=false;
      for(let row=Math.max(0,y-1);row<=Math.min(size-1,endY+1)&&!wet;row++)for(let col=Math.max(0,x-1);col<=Math.min(size-1,endX+1);col++)if(data[(row*size+col)*4]>0){wet=true;break;}
      if(wet)add(world(x),world(y),world(endX),world(endY));
    }
    const half=extent/2;
    add(-outerRadius,-outerRadius,-half,outerRadius);add(half,-outerRadius,outerRadius,outerRadius);
    add(-half,-outerRadius,half,-half);add(-half,half,half,outerRadius);
  }
  projectedArea(box){
    const {corners,matrix}=this;let minX=1,minY=1,maxX=-1,maxY=-1;
    const include=p=>{if(p.w<=0)return;const x=Math.max(-1,Math.min(1,p.x/p.w)),y=Math.max(-1,Math.min(1,p.y/p.w));minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);};
    for(let i=0;i<8;i++){
      const p=corners[i].set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z,1).applyMatrix4(matrix);
      if(p.z+p.w>=0)include(p);
    }
    // Clip edges crossing the near plane before projecting. Dividing corners
    // behind the eye otherwise invents a full-screen water region.
    for(const [a,b] of edges){const p=corners[a],q=corners[b],da=p.z+p.w,db=q.z+q.w;if((da<0)!==(db<0))include(this.intersection.copy(p).lerp(q,da/(da-db)));}
    Object.assign(this.projectedBounds,{minX,minY,maxX,maxY});
    return Math.max(0,maxX-minX)*Math.max(0,maxY-minY)/4;
  }
  isVisible(camera,minFraction=.01,detailDistance=Infinity){
    const views=camera.isArrayCamera?camera.cameras:[camera];
    for(const view of views){
      this.matrix.multiplyMatrices(view.projectionMatrix,view.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.matrix);this.eye.setFromMatrixPosition(view.matrixWorld);
      let minX=1,minY=1,maxX=-1,maxY=-1;
      // Budget against the nearest point of actual wet terrain tiles, never
      // distance from the island origin or the camera's inward/outward bearing.
      // Distant ocean retains the shader's analytic sky/depth fallback.
      for(const box of this.boxes)if(box.distanceToPoint(this.eye)<=detailDistance&&this.frustum.intersectsBox(box)){
        if(!this.projectedArea(box))continue;
        const bounds=this.projectedBounds;minX=Math.min(minX,bounds.minX);minY=Math.min(minY,bounds.minY);maxX=Math.max(maxX,bounds.maxX);maxY=Math.max(maxY,bounds.maxY);
        // The union's bounding rectangle is an upper bound, deliberately keeping
        // marginal inlet views without adding the same horizon sliver repeatedly.
        // This is visibility culling, not land occlusion.
        if((maxX-minX)*(maxY-minY)/4>=minFraction)return true;
      }
    }
    return false;
  }
  dispose(){this.boxes.length=0;}
}
