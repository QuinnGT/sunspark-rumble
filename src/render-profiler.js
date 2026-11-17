// Whole-frame diagnostics. Nested passes subtract their children so draw counts
// add up; timer queries are polled on later frames and never block the GPU.
const profilers=new WeakMap();
const fields=['calls','triangles','points','lines'];
const counters=renderer=>Object.fromEntries(fields.map(key=>[key,renderer.info?.render?.[key]||0]));
const zero=()=>Object.fromEntries(fields.map(key=>[key,0]));
const now=()=>globalThis.performance?.now?.()??Date.now();

export function profileRenderPass(renderer,name,render){
  const profiler=profilers.get(renderer);
  return profiler?.active?profiler.pass(name,render):render();
}

export class RenderProfiler {
  constructor(renderer,{clock=now,historySize=180,gpu=true}={}){
    if(profilers.has(renderer))throw new Error('A renderer already has a frame profiler');
    this.renderer=renderer;this.clock=clock;this.historySize=historySize;this.history=[];
    this.active=false;this.disposed=false;this.stack=[];this.pending=[];this.query=null;this.frame=0;this.gpuMs=null;this.gpuFrame=null;
    this.gl=gpu?renderer.getContext?.():null;
    this.ext=this.gl?.getExtension?.('EXT_disjoint_timer_query_webgl2')||null;
    this.gpuStatus=this.ext?'waiting':'unsupported';
    this.previousAutoReset=renderer.info?.autoReset;
    if(renderer.info)renderer.info.autoReset=false;
    this.originalShadowRender=renderer.shadowMap?.render;
    if(this.originalShadowRender){
      const profiler=this;
      this.shadowRender=function(...args){return profileRenderPass(renderer,'shadow',()=>profiler.originalShadowRender.apply(this,args));};
      renderer.shadowMap.render=this.shadowRender;
    }
    profilers.set(renderer,this);
  }
  beginFrame(frameSeconds){
    if(this.disposed)return;
    if(this.active)throw new Error('The previous render frame was not ended');
    this.pollGPU();this.frame++;this.active=true;this.start=this.clock();this.frameMs=Number.isFinite(frameSeconds)&&frameSeconds>0?frameSeconds*1000:null;
    this.passes={};this.stack=[];this.renderer.info?.reset?.();this.before=counters(this.renderer);
  }
  beginRender(){
    if(!this.active||!this.ext||this.query||this.pending.length>=4||this.gl.isContextLost?.())return;
    // Another profiler/tool may own the sole TIME_ELAPSED query slot.
    if(this.gl.getQuery?.(this.ext.TIME_ELAPSED_EXT,this.gl.CURRENT_QUERY))return;
    const query=this.gl.createQuery();if(!query)return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,query);this.query={query,frame:this.frame};if(this.gpuMs===null)this.gpuStatus='waiting';
  }
  pass(name,render){
    const start=this.clock(),before=counters(this.renderer),entry={children:zero(),childMs:0};this.stack.push(entry);
    try{return render();}
    finally{
      const elapsed=this.clock()-start,after=counters(this.renderer),total=zero();
      this.stack.pop();const parent=this.stack.at(-1);
      const pass=this.passes[name]??={...zero(),passes:0,cpuMs:0};
      for(const key of fields){total[key]=Math.max(0,after[key]-before[key]);pass[key]+=Math.max(0,total[key]-entry.children[key]);if(parent)parent.children[key]+=total[key];}
      // Disabled/cached shadow updates execute the hook but contain no draw calls.
      if(name!=='shadow'||total.calls>0)pass.passes++;
      pass.cpuMs+=Math.max(0,elapsed-entry.childMs);if(parent)parent.childMs+=elapsed;
    }
  }
  endFrame(){
    if(!this.active)return;
    if(this.query){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.query);this.query=null;}
    const after=counters(this.renderer),total=Object.fromEntries(fields.map(key=>[key,Math.max(0,after[key]-this.before[key])]));
    this.last={frame:this.frame,frameMs:this.frameMs,cpuMs:this.clock()-this.start,total,passes:this.passes};
    this.history.push({frameMs:this.frameMs,cpuMs:this.last.cpuMs});if(this.history.length>this.historySize)this.history.shift();
    this.active=false;
  }
  pollGPU(){
    if(!this.ext)return;
    if(this.gl.isContextLost?.()){this.dropQueries();this.gpuMs=null;this.gpuFrame=null;this.gpuStatus='context-lost';return;}
    if(this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)){
      this.dropQueries();this.gpuMs=null;this.gpuFrame=null;this.gpuStatus='disjoint';return;
    }
    while(this.pending.length){
      const item=this.pending[0];
      if(!this.gl.getQueryParameter(item.query,this.gl.QUERY_RESULT_AVAILABLE))break;
      const result=this.gl.getQueryParameter(item.query,this.gl.QUERY_RESULT);this.gl.deleteQuery(item.query);this.pending.shift();
      if(Number.isFinite(result)&&result>=0){this.gpuMs=result/1e6;this.gpuFrame=item.frame;this.gpuStatus='available';}
    }
  }
  snapshot(){
    const distribution=key=>{
      const values=this.history.map(item=>item[key]).filter(Number.isFinite).sort((a,b)=>a-b);
      const percentile=p=>values.length?values[Math.max(0,Math.ceil(values.length*p)-1)]:null;
      return {samples:values.length,p50:percentile(.5),p95:percentile(.95),max:values.at(-1)??null};
    };
    return {...this.last,frameTimes:distribution('frameMs'),cpuTimes:distribution('cpuMs'),gpu:{status:this.gpuStatus,ms:this.gpuMs,frame:this.gpuFrame,pending:this.pending.length},memory:{...this.renderer.info?.memory},programs:this.renderer.info?.programs?.length??null};
  }
  reset(){this.dropQueries();this.history=[];this.last=null;this.gpuMs=null;this.gpuFrame=null;this.gpuStatus=this.ext?'waiting':'unsupported';}
  dropQueries(){
    if(this.query){if(!this.gl.isContextLost?.())this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.gl.deleteQuery(this.query.query);this.query=null;}
    for(const item of this.pending)this.gl.deleteQuery(item.query);this.pending=[];
  }
  dispose(){
    if(this.disposed)return;this.dropQueries();this.disposed=true;this.active=false;
    if(this.renderer.shadowMap?.render===this.shadowRender)this.renderer.shadowMap.render=this.originalShadowRender;
    if(this.renderer.info)this.renderer.info.autoReset=this.previousAutoReset;
    profilers.delete(this.renderer);
  }
}
