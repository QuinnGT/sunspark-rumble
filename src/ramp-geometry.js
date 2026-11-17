// Permanent access ramps have a timber foundation down to the actual terrain.
// Keep the sloping top identical to the shared movement/placement surface.
export function groundedRampVertices(width,length,rise,p,yaw,heightAt){
  const v=[],rows=Math.ceil(length/.5),w=width/2,l=length/2,c=Math.cos(yaw),s=Math.sin(yaw);
  const point=(x,i,bottom=false)=>{const z=l-i/rows*length,ground=heightAt(p.x+c*x+s*z,p.z-s*x+c*z)-p.y-.16;return [x,bottom?Math.min(0,ground):i/rows*rise,z];};
  const quad=(a,b,c,d)=>v.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<rows;i++){
    for(const [a,b] of [[-w,0],[0,w]]){
      quad(point(a,i),point(b,i),point(b,i+1),point(a,i+1));
      quad(point(a,i,true),point(a,i+1,true),point(b,i+1,true),point(b,i,true));
    }
    quad(point(-w,i),point(-w,i+1),point(-w,i+1,true),point(-w,i,true));
    quad(point(w,i),point(w,i,true),point(w,i+1,true),point(w,i+1));
  }
  quad(point(-w,0),point(-w,0,true),point(w,0,true),point(w,0));
  quad(point(-w,rows),point(w,rows),point(w,rows,true),point(-w,rows,true));
  return v;
}
