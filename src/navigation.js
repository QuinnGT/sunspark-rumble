const CELL=2.5;
export class Navigation {
  constructor(world){this.world=world;this.half=Math.ceil(world.map.radius/CELL);this.size=this.half*2+1;this.walkCache=new Map();this.groundEdges=new Map();this.colliderIds=new WeakMap();this.nextColliderId=0;this.refresh();}
  groundHeight(x,z){const y=this.world.heightAt(x,z);return this.world.map.id==='sunhaven'?this.world.floorAt(x,z,y):y;}
  refresh(){
    if(this.version===this.world.navVersion)return;this.version=this.world.navVersion;
    const geometry=new Map(this.world.obstacles.map(o=>[o,o.box]));
    for(const r of this.world.ramps){const x=Math.abs(Math.cos(r.yaw))*r.width/2+Math.abs(Math.sin(r.yaw))*r.length/2,z=Math.abs(Math.sin(r.yaw))*r.width/2+Math.abs(Math.cos(r.yaw))*r.length/2;geometry.set(r,{min:{x:r.x-x,z:r.z-z},max:{x:r.x+x,z:r.z+z}});}
    const dirty=new Set(),mark=b=>{for(let z=Math.max(0,Math.floor(b.min.z/CELL)+this.half-1);z<=Math.min(this.size-1,Math.ceil(b.max.z/CELL)+this.half+1);z++)for(let x=Math.max(0,Math.floor(b.min.x/CELL)+this.half-1);x<=Math.min(this.size-1,Math.ceil(b.max.x/CELL)+this.half+1);x++)dirty.add(z*this.size+x);};
    if(!this.blocked){this.blocked=new Uint8Array(this.size*this.size);for(let i=0;i<this.blocked.length;i++)dirty.add(i);}
    else{for(const [o,b] of geometry)if(!this.previousGeometry.has(o))mark(b);for(const [o,b] of this.previousGeometry)if(!geometry.has(o))mark(b);}
    for(const i of dirty){const p=this.point(i),y=this.groundHeight(p.x,p.z);if(this.groundNodes)this.groundNodes[i].y=y;this.blocked[i]=Math.hypot(p.x,p.z)>this.world.map.navRadius||!this.world.canStand(p.x,y,p.z,.7)?1:0;}
    for(const id of dirty)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const other=id+dz*this.size+dx;this.groundEdges.delete(id+','+other);this.groundEdges.delete(other+','+id);}
    this.lastDirtyCount=dirty.size;this.previousGeometry=geometry;this.buildSurfaces();
  }
  buildSurfaces(){
    // Reuse unchanged surface edges after a build. Only nearby geometry can
    // affect a short walking segment, so placing cover need not recheck every roof.
    if(this.walkCache.size>50000)this.walkCache.clear();
    const geometry=[...this.world.obstacles.map(o=>({item:o,minX:o.box.min.x,maxX:o.box.max.x,minZ:o.box.min.z,maxZ:o.box.max.z})),...this.world.ramps.map(r=>{const x=Math.abs(Math.cos(r.yaw))*r.width/2+Math.abs(Math.sin(r.yaw))*r.length/2,z=Math.abs(Math.sin(r.yaw))*r.width/2+Math.abs(Math.cos(r.yaw))*r.length/2;return {item:r,minX:r.x-x,maxX:r.x+x,minZ:r.z-z,maxZ:r.z+z};})];
    for(const g of geometry)if(!this.colliderIds.has(g.item))this.colliderIds.set(g.item,++this.nextColliderId);
    const signature=p=>geometry.filter(g=>p.x+4>g.minX&&p.x-4<g.maxX&&p.z+4>g.minZ&&p.z-4<g.maxZ).map(g=>this.colliderIds.get(g.item)).join(',');
    const keyOf=p=>`${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
    const base=this.size*this.size;this.groundNodes??=Array.from({length:base},(_,i)=>{const p=this.point(i);return {...p,y:this.groundHeight(p.x,p.z)};});this.nodes=this.groundNodes.slice();this.links=new Map();this.highSpots=[];
    const add=(x,z,expected)=>{const y=this.world.floorAt(x,z,expected);if(Math.abs(y-expected)>.6||!this.world.canStand(x,y,z))return;this.nodes.push({x,y,z});};
    for(const r of this.world.ramps){const c=Math.cos(r.yaw),s=Math.sin(r.yaw),n=Math.ceil((r.length+1.4)/.7);for(let i=0;i<=n;i++){const local=r.length/2+.7-i*(r.length+1.4)/n,x=r.x+s*local,z=r.z+c*local,expected=r.y+Math.max(0,Math.min(1,.5-local/r.length))*r.rise;add(x,z,expected);}}
    for(const o of this.world.obstacles){const b=o.box,w=b.max.x-b.min.x,d=b.max.z-b.min.z,y=b.max.y;if(w<2||d<2||y<this.world.heightAt((b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2)+.7)continue;
      const nx=Math.ceil(w/1.6),nz=Math.ceil(d/1.6);for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){const x=b.min.x+.4+(w-.8)*ix/nx,z=b.min.z+.4+(d-.8)*iz/nz,top=o.shape?o.shape.surfaceAt(x,z):y;if(Number.isFinite(top))add(x,z,top);}
      const p={x:(b.min.x+b.max.x)/2,y,z:(b.min.z+b.max.z)/2};if(o.shape)p.y=o.shape.surfaceAt(p.x,p.z);if(Number.isFinite(p.y)&&this.world.canStand(p.x,p.y,p.z))this.highSpots.push(p);
    }
    const buckets=new Map(),key=(x,z)=>`${Math.floor(x/3)},${Math.floor(z/3)}`;
    this.nodeBuckets=buckets;this.nodes.forEach((p,i)=>{if(i<base&&this.blocked[i])return;const k=key(p.x,p.z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);});
    const link=(a,b,cost)=>{if(!this.links.has(a))this.links.set(a,[]);this.links.get(a).push({id:b,cost});};
    for(let i=base;i<this.nodes.length;i++){const a=this.nodes[i],bx=Math.floor(a.x/3),bz=Math.floor(a.z/3),stamp=signature(a),aKey=keyOf(a);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const j of buckets.get(`${bx+dx},${bz+dz}`)||[]){
      if(j>=i)continue;const b=this.nodes[j],distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance>3.1||Math.abs(a.y-b.y)>4)continue;
      const cost=Math.hypot(distance,a.y-b.y),key=aKey+'>'+keyOf(b);let cached=this.walkCache.get(key);
      if(!cached||cached.stamp!==stamp){cached={stamp,forward:this.world.canWalk(a,b),back:this.world.canWalk(b,a)};this.walkCache.set(key,cached);}
      if(cached.forward)link(i,j,cost);if(cached.back)link(j,i,cost);
    }}
  }
  neighbors(i){
    const result=[...(this.links.get(i)||[])];if(i>=this.size*this.size)return result;
    const cx=i%this.size,cz=Math.floor(i/this.size);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;const x=cx+dx,z=cz+dz,n=z*this.size+x;if(x<0||z<0||x>=this.size||z>=this.size||this.blocked[n])continue;
      if(dx&&dz&&(this.blocked[cz*this.size+x]||this.blocked[z*this.size+cx]))continue;
      if(this.world.map.id==='sunhaven'){const key=i+','+n;let clear=this.groundEdges.get(key);if(clear===undefined){clear=this.world.canWalk(this.nodes[i],this.nodes[n]);this.groundEdges.set(key,clear);}if(!clear)continue;}
      result.push({id:n,cost:CELL*(dx&&dz?1.414:1)});
    }return result;
  }
  nearNodes(p){const found=[];for(let x=Math.floor(p.x/3)-2;x<=Math.floor(p.x/3)+2;x++)for(let z=Math.floor(p.z/3)-2;z<=Math.floor(p.z/3)+2;z++)found.push(...(this.nodeBuckets.get(x+','+z)||[]));return found;}
  route(from,to){
    this.refresh();const start={x:from.x,y:from.y??this.world.heightAt(from.x,from.z),z:from.z},end={x:to.x,y:to.y??this.world.heightAt(to.x,to.z),z:to.z};
    if(Math.hypot(start.x-end.x,start.z-end.z)<6&&this.world.canWalk(start,end))return [end];
    const connect=(p,reverse)=>this.nearNodes(p).map(id=>({id,n:this.nodes[id],d:Math.hypot(this.nodes[id].x-p.x,this.nodes[id].z-p.z,this.nodes[id].y-p.y)})).filter(c=>(c.id>=this.size*this.size||!this.blocked[c.id])&&c.d<4).sort((a,b)=>a.d-b.d).slice(0,18).filter(c=>this.world.canWalk(reverse?c.n:p,reverse?p:c.n)).slice(0,5);
    const starts=connect(start,false),ends=connect(end,true);if(!starts.length||!ends.length)return [];
    const goals=new Map(ends.map(e=>[e.id,e.d])),g=new Float64Array(this.nodes.length).fill(Infinity),came=new Int32Array(this.nodes.length).fill(-1),closed=new Set(),open=new Queue();
    const estimate=i=>Math.hypot(this.nodes[i].x-end.x,this.nodes[i].z-end.z,this.nodes[i].y-end.y);
    for(const s of starts){g[s.id]=s.d;open.push(s.id,s.d+estimate(s.id));}
    while(open.length){const current=open.pop();if(closed.has(current))continue;if(goals.has(current)){const path=[end];let n=current;while(n>=0){path.push({...this.nodes[n]});n=came[n];}return path.reverse();}closed.add(current);
      for(const edge of this.neighbors(current)){if(closed.has(edge.id))continue;const cost=g[current]+edge.cost;if(cost<g[edge.id]){g[edge.id]=cost;came[edge.id]=current;open.push(edge.id,cost+estimate(edge.id));}}
    }return [];
  }
  node(x,z){return Math.max(0,Math.min(this.size-1,Math.round(x/CELL)+this.half))+Math.max(0,Math.min(this.size-1,Math.round(z/CELL)+this.half))*this.size;}
  point(i){return {x:(i%this.size-this.half)*CELL,z:(Math.floor(i/this.size)-this.half)*CELL};}
  free(x,z){return !this.blocked[this.node(x,z)];}
  path(from,to){
    let start=this.node(from.x,from.z),end=this.node(to.x,to.z);
    if(this.blocked[end]){let best=Infinity,found=end;for(let i=0;i<this.blocked.length;i++){if(this.blocked[i])continue;const p=this.point(i),d=Math.hypot(p.x-to.x,p.z-to.z);if(d<best){best=d;found=i;}}end=found;}
    const open=[start],came=new Int32Array(this.size*this.size).fill(-1),g=new Float32Array(this.size*this.size).fill(Infinity),closed=new Uint8Array(this.size*this.size);g[start]=0;
    const heuristic=i=>Math.hypot(i%this.size-end%this.size,Math.floor(i/this.size)-Math.floor(end/this.size));let loops=0;
    while(open.length&&loops++<1600){let best=0;for(let j=1;j<open.length;j++)if(g[open[j]]+heuristic(open[j])<g[open[best]]+heuristic(open[best]))best=j;const current=open.splice(best,1)[0];if(current===end){const path=[];let p=end;while(p!==start&&p>=0){path.push(this.point(p));p=came[p];}return path.reverse();}closed[current]=1;
      const cx=current%this.size,cz=Math.floor(current/this.size);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=this.size||z>=this.size)continue;const n=z*this.size+x;if(this.blocked[n]||closed[n])continue;if(dx&&dz&&(this.blocked[cz*this.size+x]||this.blocked[z*this.size+cx]))continue;const next=g[current]+(dx&&dz?1.414:1);if(next<g[n]){came[n]=current;g[n]=next;if(!open.includes(n))open.push(n);}}
    }return [];
  }
}

class Queue {
  constructor(){this.items=[];}get length(){return this.items.length;}
  push(id,score){const item={id,score},a=this.items;let i=a.length;a.push(item);while(i>0){const p=(i-1)>>1;if(a[p].score<=score)break;a[i]=a[p];i=p;}a[i]=item;}
  pop(){const a=this.items,result=a[0].id,last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return result;}
}
