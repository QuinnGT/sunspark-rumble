// One sampled, indexed surface serves rendering, navigation, planting and water.
// Cells use the a-c-b / b-c-d diagonal; bilinear interpolation would disagree
// with the triangles and make sharp shelves float above collision.
export class TerrainHeightfield {
  constructor(source,{extent,spacing=1,chunkCells=32}){
    if(!Number.isFinite(extent)||extent<=0||!Number.isFinite(spacing)||spacing<=0||!Number.isInteger(extent/spacing)||!Number.isInteger(chunkCells)||chunkCells<1)throw new Error('Terrain extent must contain whole positive cells');
    this.extent=extent;this.spacing=spacing;this.chunkCells=chunkCells;this.cells=extent/spacing;this.min=-extent/2;this.max=extent/2;
    const stride=this.cells+1;this.stride=stride;this.heights=new Float32Array(stride*stride);
    for(let z=0;z<stride;z++)for(let x=0;x<stride;x++){
      const value=source(this.min+x*spacing,this.min+z*spacing);
      if(!Number.isFinite(value))throw new Error(`Non-finite terrain height at ${x},${z}`);
      this.heights[z*stride+x]=value;
    }
    // Accumulate area-weighted triangle normals across the WHOLE field before
    // chunks duplicate their boundary vertices. No lighting seams at chunk edges.
    const normals=new Float64Array(this.heights.length*3),s=spacing,h=this.heights;
    const add=(ids,nx,ny,nz)=>{for(const id of ids){normals[id*3]+=nx;normals[id*3+1]+=ny;normals[id*3+2]+=nz;}};
    for(let z=0;z<this.cells;z++)for(let x=0;x<this.cells;x++){
      const a=z*stride+x,b=a+1,c=a+stride,d=c+1;
      add([a,c,b],(h[a]-h[b])*s,s*s,(h[a]-h[c])*s);
      add([b,c,d],(h[c]-h[d])*s,s*s,(h[b]-h[d])*s);
    }
    this.normals=new Float32Array(normals.length);
    for(let i=0;i<normals.length;i+=3){const n=Math.hypot(normals[i],normals[i+1],normals[i+2]);for(let j=0;j<3;j++)this.normals[i+j]=normals[i+j]/n;}
    this.heightAt=this.heightAt.bind(this);
  }
  contains(x,z){return x>=this.min&&x<=this.max&&z>=this.min&&z<=this.max;}
  heightAt(x,z){
    // Out-of-bounds placement queries clamp to the edge; collision rays below
    // remain bounded to the rendered surface. Gameplay bounds are well inside it.
    const fx=Math.max(0,Math.min(this.cells,(x-this.min)/this.spacing)),fz=Math.max(0,Math.min(this.cells,(z-this.min)/this.spacing));
    const ix=Math.min(this.cells-1,Math.floor(fx)),iz=Math.min(this.cells-1,Math.floor(fz)),u=fx-ix,v=fz-iz,a=iz*this.stride+ix,h=this.heights;
    return u+v<=1?h[a]+(h[a+1]-h[a])*u+(h[a+this.stride]-h[a])*v:h[a+this.stride+1]+(h[a+this.stride]-h[a+this.stride+1])*(1-u)+(h[a+1]-h[a+this.stride+1])*(1-v);
  }
  // Exact segment/triangle hits, traversing only crossed grid cells. This cannot
  // jump over a narrow crest as fixed-distance height marching can.
  raycast(origin,direction,maxDistance=Infinity){
    if(maxDistance<0||Math.hypot(direction.x,direction.y,direction.z)<1e-12)return null;
    let start=0,end=maxDistance;
    for(const axis of ['x','z']){
      const o=origin[axis],d=direction[axis];
      if(Math.abs(d)<1e-12){if(o<this.min||o>this.max)return null;continue;}
      const a=(this.min-o)/d,b=(this.max-o)/d;start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
    }
    if(end<start)return null;
    const s=this.spacing,probe=start+1e-8;
    let ix=Math.max(0,Math.min(this.cells-1,Math.floor((origin.x+direction.x*probe-this.min)/s))),iz=Math.max(0,Math.min(this.cells-1,Math.floor((origin.z+direction.z*probe-this.min)/s)));
    const stepX=Math.sign(direction.x),stepZ=Math.sign(direction.z),deltaX=Math.abs(direction.x)>1e-12?s/Math.abs(direction.x):Infinity,deltaZ=Math.abs(direction.z)>1e-12?s/Math.abs(direction.z):Infinity;
    let nextX=Number.isFinite(deltaX)?(this.min+(ix+(stepX>0?1:0))*s-origin.x)/direction.x:Infinity,nextZ=Number.isFinite(deltaZ)?(this.min+(iz+(stepZ>0?1:0))*s-origin.z)/direction.z:Infinity;
    while(ix>=0&&ix<this.cells&&iz>=0&&iz<this.cells&&start<=end+1e-8){
      const until=Math.min(end,nextX,nextZ),a=iz*this.stride+ix,h=this.heights,x=this.min+ix*s,z=this.min+iz*s;
      const heights=[h[a],h[a+1],h[a+this.stride],h[a+this.stride+1]];
      let closest=null;
      for(const second of [false,true]){
        const slopeX=(second?heights[3]-heights[2]:heights[1]-heights[0])/s,slopeZ=(second?heights[3]-heights[1]:heights[2]-heights[0])/s;
        const planeY=second?heights[1]+slopeX*(origin.x-x-s)+slopeZ*(origin.z-z):heights[0]+slopeX*(origin.x-x)+slopeZ*(origin.z-z);
        const divisor=direction.y-slopeX*direction.x-slopeZ*direction.z;
        if(Math.abs(divisor)<1e-12)continue;
        const distance=(planeY-origin.y)/divisor;
        if(distance<start-1e-7||distance>until+1e-7||distance<0)continue;
        const px=origin.x+direction.x*distance,pz=origin.z+direction.z*distance,u=(px-x)/s,v=(pz-z)/s;
        if(u< -1e-6||v< -1e-6||u>1+1e-6||v>1+1e-6||(second?u+v<1-1e-6:u+v>1+1e-6))continue;
        const length=Math.hypot(slopeX,1,slopeZ);
        if(!closest||distance<closest.distance)closest={distance,point:{x:px,y:origin.y+direction.y*distance,z:pz},normal:{x:-slopeX/length,y:1/length,z:-slopeZ/length}};
      }
      if(closest)return closest;
      if(until>=end||(!Number.isFinite(nextX)&&!Number.isFinite(nextZ)))break;
      start=until;
      const crossX=nextX<=until+1e-9,crossZ=nextZ<=until+1e-9;
      if(crossX){ix+=stepX;nextX+=deltaX;}if(crossZ){iz+=stepZ;nextZ+=deltaZ;}
    }
    return null;
  }
}
