import {Vector3,Ray,MathUtils} from 'three';
const u=new Vector3(),v=new Vector3(),w=new Vector3(),p=new Vector3(),q=new Vector3(),delta=new Vector3(),closest=new Vector3(),normal=new Vector3(),ray=new Ray();
const clamp=MathUtils.clamp,EPS=1e-12;

// Exact distance between the capsule axis and the triangle: face crossing,
// endpoints against the face, and all three segment/edge pairs. In particular,
// extending the capsule cannot lose a contact against an oblique face.
export function capsuleTriangleContact(capsule,triangle,result){
  const start=capsule.start,end=capsule.end,r= capsule.radius;
  u.subVectors(end,start);const a=u.lengthSq();let distance=Infinity;
  const consider=()=>{delta.subVectors(p,q);const d=delta.lengthSq();if(d<distance){distance=d;closest.copy(delta);}};
  p.copy(start);triangle.closestPointToPoint(p,q);consider();
  p.copy(end);triangle.closestPointToPoint(p,q);consider();
  if(a>EPS){
    ray.origin.copy(start);ray.direction.copy(u).normalize();
    const hit=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,q);
    if(hit&&q.distanceToSquared(start)<=a+EPS){distance=0;closest.set(0,0,0);}
  }
  for(const [first,last]of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){
    v.subVectors(last,first);w.subVectors(start,first);
    const b=u.dot(v),c=v.lengthSq(),d=u.dot(w),e=v.dot(w),den=a*c-b*b;
    let s=a>EPS?(den>EPS?clamp((b*e-c*d)/den,0,1):0):0,t=c>EPS?(b*s+e)/c:0;
    if(t<0){t=0;s=a>EPS?clamp(-d/a,0,1):0;}
    else if(t>1){t=1;s=a>EPS?clamp((b-d)/a,0,1):0;}
    p.copy(start).addScaledVector(u,s);q.copy(first).addScaledVector(v,t);consider();
  }
  if(distance>=(r-.001)**2)return false;
  triangle.getNormal(normal);result.depth=r-Math.sqrt(distance);
  result.normal.copy(distance>EPS?closest.normalize():normal);
  if(result.normal.dot(normal)<0)result.normal.copy(normal);
  return result;
}
