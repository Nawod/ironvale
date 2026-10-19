import {Scene,Group,Mesh,Box3,Vector3,OrthographicCamera,WebGLRenderer,HemisphereLight,DirectionalLight,ACESFilmicToneMapping,PCFSoftShadowMap} from 'three';
import {MedievalBuildings} from './medieval-buildings3d';
import {ImportedModels} from './imported-models3d';
import {ImportedScenery} from './imported-scenery3d';
import {HistoricalModels} from './historical-models3d';
import {HistoricalScenery} from './historical-scenery3d';
import {ModelLibrary,type ModelPart} from './models3d';
import {LankaModels} from './lanka-models3d';
import {LankaArchitecture} from './lanka-architecture3d';
import {portraitCatalog,lankaPortraitCatalog} from './portraits';
import {BUILDINGS,UNITS} from '../sim/definitions';
import type {Entity,FactionId} from '../sim/types';

/** Pure framing policy, testable without a renderer. Large units and the mythic
 * giant retain their measured silhouette; human infantry crops face/uniform. */
export function portraitFraming(kind:Entity['kind'],type:Entity['type'],bounds:Box3,faction?:FactionId):{bounds:Box3;center:Vector3;direction:Vector3;half?:number}{
 const direction=kind==='unit'?new Vector3(.65,.32,1).normalize():new Vector3(1,.78,1.2).normalize();
 const human=kind==='unit'&&!['scout','cavalry','heavyCavalry','ram','trebuchet','warElephant','cannon','danduMonara'].includes(type)&&!(type==='champion'&&faction==='ravana');
 if(!human)return{bounds,center:bounds.getCenter(new Vector3()),direction};
 const native=!!faction,champion=type==='champion',center=new Vector3(0,native?(champion?1.5:1.4):1.31,0),half=native?(champion?1.15:faction==='british'?.99:.85):.62;
 const size=new Vector3(half*2,half*2,half*2),crop=new Box3(center.clone().addScaledVector(size,-.5),center.clone().addScaledVector(size,.5));
 return{bounds:crop,center,direction,half};
}

/** Offline only: one renderer bakes the actual game models into lightweight UI art. */
export async function bakeCommandPortraits(save:(name:string,data:string)=>Promise<void>,preview=false,historicalOnly=false,lankaOnly=false):Promise<{count:number;size:number}>{
 const renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(192,192);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.shadowMap.type=PCFSoftShadowMap;
 const scene=new Scene(),root=new Group();scene.add(root,new HemisphereLight('#e9eff7','#746345',2.6));const key=new DirectionalLight('#ffedcb',3.8);key.position.set(-4,7,7);scene.add(key);const fill=new DirectionalLight('#b9d4e0',1.2);fill.position.set(5,3,-4);scene.add(fill);
 const camera=new OrthographicCamera(-1,1,1,-1,.01,100),buildings=new MedievalBuildings(),actors=new ImportedModels(),scenery=new ImportedScenery(),historical=new HistoricalModels(),nature=new HistoricalScenery(),lanka=new LankaModels(),architecture=new LankaArchitecture(),fallback=new ModelLibrary();
 try{
  await Promise.all([lanka.load(),...(lankaOnly?[]:[actors.load(),scenery.load(),historical.load(),nature.load()])]);
  if(lanka.status!=='ready')throw new Error(`Lanka portrait sources failed to load: ${lanka.error??lanka.status}`);
  if(!lankaOnly&&(historical.status!=='ready'||nature.status!=='ready'))throw new Error('Historical portrait sources failed to load.');
  const catalog=(lankaOnly?lankaPortraitCatalog():portraitCatalog()).filter(p=>(!preview||p.owner===0&&p.age===1)&&(!historicalOnly||['spearman','swordsman','archer','pikeman','wood','berries','gold'].includes(p.type)));let count=0;
  for(const record of catalog){
   root.clear();const entity:Entity={id:3,kind:Object.hasOwn(BUILDINGS,record.type)?'building':Object.hasOwn(UNITS,record.type)?'unit':'resource',type:record.type,owner:record.owner,x:0,y:0,hp:100,maxHp:100,order:{kind:'idle'},path:[],progress:1,queue:[],amount:500,cooldown:0,stance:'hold',garrison:[],wallTier:record.wallTier};
   const pose={time:0,moving:false,working:false,attacking:false,detail:'full' as const};
   const parts=lanka.get(entity,record.faction,pose)??buildings.get(entity,record.age)??historical.get(entity,pose)??actors.get(entity,pose)??nature.get(entity)??scenery.get(entity,record.age,1)??fallback.get(entity.type,entity.owner);
   const append=(parts:ModelPart[])=>{for(const part of parts){const mesh=new Mesh(part.geometry,part.material);mesh.position.fromArray(part.position);mesh.rotation.set(...part.rotation);mesh.scale.fromArray(part.scale);root.add(mesh);}};
   append(parts);const adornment=record.type==='capital'?architecture.get(entity,record.faction,record.age):undefined;if(adornment)append(adornment);
   root.updateMatrixWorld(true);const {bounds,center,direction,half:cropHalf}=portraitFraming(entity.kind,entity.type,new Box3().setFromObject(root),record.faction);
   camera.position.copy(center).addScaledVector(direction,12);camera.lookAt(center);camera.updateMatrixWorld();
   let half=0;const corners:Vector3[]=[];
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
   for(const p of corners)half=Math.max(half,Math.abs(p.x),Math.abs(p.y));half=cropHalf??Math.max(.3,half*1.06);camera.left=camera.bottom=-half;camera.right=camera.top=half;camera.updateProjectionMatrix();
   renderer.render(scene,camera);await save(record.url.split('/').at(-1)!,renderer.domElement.toDataURL('image/webp',.88));count++;
   if(count%32===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  return{count,size:192};
 }finally{root.clear();buildings.dispose();actors.dispose();scenery.dispose();historical.dispose();nature.dispose();lanka.dispose();architecture.dispose();fallback.dispose();renderer.dispose();renderer.forceContextLoss();}
}
