import type {Position} from '../sim/types';

/** Clip the camera polygon itself: clamping each corner invents false diagonals. */
export function clipMapViewport(points:readonly Position[],size:number):Position[]{
 if(!Number.isFinite(size)||size<=0||points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return[];
 let result=points.map(p=>({...p}));
 for(const [axis,boundary,greater]of [['x',0,true],['x',size,false],['y',0,true],['y',size,false]] as const){
  const output:Position[]=[];if(!result.length)return[];
  const inside=(p:Position)=>greater?p[axis]>=boundary:p[axis]<=boundary;
  for(let i=0;i<result.length;i++){
   const a=result[i],b=result[(i+1)%result.length],aIn=inside(a),bIn=inside(b);
   if(aIn)output.push(a);
   if(aIn!==bIn){const t=(boundary-a[axis])/(b[axis]-a[axis]);output.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
  }
  result=output.filter((p,i)=>!output.slice(0,i).some(q=>Math.abs(p.x-q.x)<1e-8&&Math.abs(p.y-q.y)<1e-8));
 }
 return result;
}
