import {Scene,Group,Mesh,Box3,Vector3,OrthographicCamera,WebGLRenderer,HemisphereLight,DirectionalLight,ACESFilmicToneMapping,PCFSoftShadowMap} from 'three';
import {MedievalBuildings} from './medieval-buildings3d';
import {ImportedModels} from './imported-models3d';
import {ImportedScenery} from './imported-scenery3d';
import {ModelLibrary} from './models3d';
import {portraitCatalog} from './portraits';
import {BUILDINGS,UNITS} from '../sim/definitions';
import type {Entity} from '../sim/types';

/** Offline only: one renderer bakes the actual game models into lightweight UI art. */
export async function bakeCommandPortraits(save:(name:string,data:string)=>Promise<void>,preview=false):Promise<{count:number;size:number}>{
 const renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.type=PCFSoftShadowMap;
 const scene=new Scene(),root=new Group();scene.add(root,new HemisphereLight('#e9eff7','#746345',2.6));const key=new DirectionalLight('#ffedcb',3.8);key.position.set(-4,7,7);scene.add(key);const fill=new DirectionalLight('#b9d4e0',1.2);fill.position.set(5,3,-4);scene.add(fill);
 const camera=new OrthographicCamera(-1,1,1,-1,.01,100),buildings=new MedievalBuildings(),actors=new ImportedModels(),scenery=new ImportedScenery(),fallback=new ModelLibrary();
 try{
  await Promise.all([actors.load(),scenery.load()]);const catalog=portraitCatalog().filter(p=>!preview||p.owner===0&&p.age===1);let count=0;
  for(const record of catalog){
   root.clear();const entity:Entity={id:3,kind:Object.hasOwn(BUILDINGS,record.type)?'building':Object.hasOwn(UNITS,record.type)?'unit':'resource',type:record.type,owner:record.owner,x:0,y:0,hp:100,maxHp:100,order:{kind:'idle'},path:[],progress:1,queue:[],amount:500,cooldown:0,stance:'hold',garrison:[],wallTier:record.wallTier};
   const parts=buildings.get(entity,record.age)??actors.get(entity,{time:0,moving:false,working:false,attacking:false,detail:'full'})??scenery.get(entity,record.age,1)??fallback.get(entity.type,entity.owner);
   for(const part of parts){const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.rotation.set(...part.rotation);mesh.scale.fromArray(part.scale);root.add(mesh);}
   root.updateMatrixWorld(true);let bounds=new Box3().setFromObject(root),center=bounds.getCenter(new Vector3()),size=bounds.getSize(new Vector3());
   // Infantry reads as a face, uniform and weapon; horses and siege keep full silhouettes.
   if(entity.kind==='unit'&&!['scout','cavalry','heavyCavalry','ram','trebuchet'].includes(entity.type)){
    center.set(0,1.31,0);size.set(1.18,1.35,1.18);
   }
   const direction=entity.kind==='unit'?new Vector3(.65,.32,1).normalize():new Vector3(1,.78,1.2).normalize();camera.position.copy(center).addScaledVector(direction,12);camera.lookAt(center);camera.updateMatrixWorld();
   let half=0;const corners:Vector3[]=[];
   if(entity.kind==='unit'&&!['scout','cavalry','heavyCavalry','ram','trebuchet'].includes(entity.type))bounds=new Box3(center.clone().addScaledVector(size,-.5),center.clone().addScaledVector(size,.5));
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
   for(const p of corners)half=Math.max(half,Math.abs(p.x),Math.abs(p.y));half=Math.max(.3,half*1.06);if(entity.kind==='unit'&&!['scout','cavalry','heavyCavalry','ram','trebuchet'].includes(entity.type))half=.62;camera.left=camera.bottom=-half;camera.right=camera.top=half;camera.updateProjectionMatrix();
   renderer.render(scene,camera);await save(record.url.split('/').at(-1)!,renderer.domElement.toDataURL('image/webp',.88));count++;
   if(count%32===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return{count,size:192};
 }finally{root.clear();buildings.dispose();actors.dispose();scenery.dispose();fallback.dispose();renderer.dispose();renderer.forceContextLoss();}
}
