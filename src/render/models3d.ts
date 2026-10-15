import {BoxGeometry,SphereGeometry,CylinderGeometry,ConeGeometry,DodecahedronGeometry,TorusGeometry,BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,CapsuleGeometry,LatheGeometry,Vector2,Object3D,PlaneGeometry,Texture,DoubleSide} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SurfaceLibrary,type Surface} from './surfaces3d';
import type {Entity} from '../sim/types';
import {BUILDINGS,COLORS} from '../sim/definitions';
export interface ModelPart {geometry:BufferGeometry;material:MeshStandardMaterial;position:[number,number,number];scale:[number,number,number];rotation:[number,number,number];motion?:'legL'|'legR'|'arm'|'weapon'|'flag'|'gate'}
export class ModelLibrary {
 private surfaces=new SurfaceLibrary();private merged=new Map<string,BufferGeometry>();private cache=new Map<string,ModelPart[]>();private materials=new Map<string,MeshStandardMaterial>();private naturalTextures?:Map<string,Texture>;
 private geometries={box:new BoxGeometry(1,1,1),sphere:new SphereGeometry(.5,12,8),limb:new CapsuleGeometry(.5,1,3,8).scale(1,.5,1).translate(0,-.5,0),torso:new LatheGeometry([new Vector2(.14,0),new Vector2(.19,.08),new Vector2(.16,.25),new Vector2(.23,.45),new Vector2(.17,.52)],10),cylinder:new CylinderGeometry(.5,.5,1,10),cone:new ConeGeometry(.5,1,10),rock:this.organic(false),foliage:this.organic(true),branch:this.branch(),bow:new TorusGeometry(.5,.055,4,10,Math.PI),roof:this.roof()};
 private branch():BufferGeometry{const parts=[new PlaneGeometry(1,1),new PlaneGeometry(1,1).rotateY(Math.PI/2),new PlaneGeometry(1,1).rotateX(-Math.PI/2)];const geometry=mergeGeometries(parts,false)!;for(const part of parts)part.dispose();
  // This photo atlas contains cones and bark as well as foliage. Sample its upper-left needle sprig.
  const uv=geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,.05+uv.getX(i)*.15,.62+uv.getY(i)*.34);return geometry;}
 setNaturalTextures(textures:Map<string,Texture>):void{this.naturalTextures=textures;for(const [color,material]of this.materials)this.applyNaturalTexture(color,material);for(const key of this.cache.keys())if(key.startsWith('wood:'))this.cache.delete(key);}
 private applyNaturalTexture(color:string,m:MeshStandardMaterial):void{
  if(!this.naturalTextures)return;
  if(color==='#705139'){m.map=this.naturalTextures.get('bark_diff')??m.map;m.normalMap=this.naturalTextures.get('bark_nor_gl')??null;m.roughnessMap=this.naturalTextures.get('bark_arm')??null;m.color.setHex(0xddd4c2);m.bumpMap=null;}
  if(color==='#274f38'){m.map=this.naturalTextures.get('twig_diff')??m.map;m.alphaMap=this.naturalTextures.get('twig_alpha')??null;m.normalMap=this.naturalTextures.get('twig_nor_gl')??null;m.alphaTest=.42;m.side=DoubleSide;m.color.setHex(0xffffff);m.bumpMap=null;}
  m.needsUpdate=true;
 }
 private organic(leaf:boolean):BufferGeometry{const g=leaf?new SphereGeometry(.5,12,9):new DodecahedronGeometry(.5,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+Math.sin(x*27+y*19+z*11)*(leaf?.13:.2)+Math.cos(x*13-z*23)*(leaf?.08:.12);p.setXYZ(i,x*n,y*n,z*n);}g.computeVertexNormals();return g;}
 private roof():BufferGeometry{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5],3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,.5,0,0,1,1,1,.5,1],2));const roof=g.toNonIndexed();g.dispose();roof.computeVertexNormals();return roof;}
 private material(color:string):MeshStandardMaterial{
  let m=this.materials.get(color);if(m)return m;
  const stone=['#6c7563','#a5aa9b','#c1bfaa','#a9ad9e','#848f81','#bcc0ac','#9ba391','#89958c','#c8a84e','#9b8a55','#b2b19f'];
  const wood=['#705139','#765d42','#826143','#7a5836','#8f714a','#7c603d','#8c6a45','#795c39','#805f39','#8e6b3e','#947249','#9e8258','#8b6e43','#bba075','#896c45'];
  const surface:Surface|undefined=['#89958c','#c8a84e','#9b8a55'].includes(color)?'rock':stone.includes(color)?'stone':wood.includes(color)?'wood':['#a76042','#824c39','#596369'].includes(color)?'roof':color==='#d5ceb0'||color==='#d1c3a2'?'plaster':COLORS.includes(color)?'cloth':color==='#aeb9b9'||color==='#5e6c70'?'metal':['#2e5740','#3d6b43','#557c47'].includes(color)?'leaf':color==='#725e3d'?'earth':undefined;
  const textures=surface?this.surfaces.get(surface):undefined;
  m=new MeshStandardMaterial({color,roughness:surface==='metal'?.43:.94,metalness:surface==='metal'?.65:0,flatShading:false,map:textures?.map,bumpMap:textures?.bump,bumpScale:surface==='stone'?.055:surface==='wood'?.025:.012});
  this.applyNaturalTexture(color,m);this.materials.set(color,m);return m;
 }
 private compile(parts:ModelPart[]):ModelPart[]{
  const result=parts.filter(p=>p.motion),groups=new Map<MeshStandardMaterial,ModelPart[]>();
  for(const p of parts)if(!p.motion){const group=groups.get(p.material)??[];group.push(p);groups.set(p.material,group);}
  const transform=new Object3D();
  for(const [material,group] of groups){
   if(group.length<3){result.push(...group);continue;}
   const key=group.map(p=>`${p.geometry.uuid}:${p.position}:${p.rotation}:${p.scale}`).join('|');let geometry=this.merged.get(key);
   if(!geometry){const copies=group.map(p=>{transform.position.fromArray(p.position);transform.rotation.set(...p.rotation);transform.scale.fromArray(p.scale);transform.updateMatrix();return p.geometry.clone().applyMatrix4(transform.matrix);});geometry=mergeGeometries(copies,false)??copies[0].clone();for(const g of copies)g.dispose();this.merged.set(key,geometry);}
   result.push({geometry,material,position:[0,0,0],scale:[1,1,1],rotation:[0,0,0]});
  }
  return result;
 }

 get(type:Entity['type'],owner:number,variant=0):ModelPart[]{const key=`${type}:${owner}:${type==='wood'?variant%4:0}`;const cached=this.cache.get(key);if(cached)return cached;const parts:ModelPart[]=[],team=COLORS[Math.max(0,owner)]??COLORS[0];
  const add=(shape:keyof typeof this.geometries,color:string,p:[number,number,number],s:[number,number,number],r:[number,number,number]=[0,0,0],motion?:ModelPart['motion'])=>parts.push({geometry:this.geometries[shape],material:this.material(color),position:p,scale:s,rotation:r,motion});
  const box=(color:string,x:number,y:number,z:number,w:number,h:number,d:number,motion?:ModelPart['motion'])=>add('box',color,[x,y,z],[w,h,d],[0,0,0],motion);
  const post=(x:number,z:number,h:number,color='#705139')=>add('cylinder',color,[x,h/2,z],[.1,h,.1]);
  const flag=(h:number,x=0,z=0)=>{post(x,z,h,'#d2be83');box(team,x+.22,h-.22,z,.44,.3,.025,'flag');};
  const person=(base=0,armored=false)=>{
   add('torso',armored?'#5e6c70':team,[0,base+.77,0],[1,1,.72]);
   add('cylinder','#765d42',[0,base+.84,0],[.36,.06,.27]);
   add('sphere',team,[0,base+1.13,.125],[.32,.28,.055]);
   add('cylinder','#dab78a',[0,base+1.33,0],[.105,.15,.105]);
   add('sphere','#dab78a',[0,base+1.49,0],[.24,.31,.25]);
   add('sphere','#c89c75',[0,base+1.47,.122],[.055,.07,.07]);
   for(const side of [-1,1]){
    add('limb','#5a4939',[side*.105,base+.8,0],[.16,.72,.18],[0,0,side*.025],side<0?'legL':'legR');
    add('sphere','#383c32',[side*.105,base+.09,.045],[.18,.17,.29]);
    add('sphere',armored?'#aeb9b9':team,[side*.235,base+1.19,0],[.18,.19,.22]);
    add('limb',team,[side*.245,base+1.17,0],[.13,.43,.14],[0,0,side*.13],'arm');
    add('sphere','#dab78a',[side*.29,base+.74,.015],[.115,.13,.11],[0,0,0],'arm');
    add('sphere','#352e24',[side*.054,base+1.51,.113],[.022,.018,.014]);
   }
   if(armored){add('sphere','#aeb9b9',[0,base+1.58,-.013],[.28,.25,.28]);box('#5e6c70',0,base+1.49,.133,.025,.11,.035);}
   else{add('sphere','#5a4939',[0,base+1.59,-.025],[.25,.17,.24]);add('cylinder','#a18a58',[0,base+1.64,0],[.36,.035,.36]);}
  };
  if(type==='wood'){
   const species=variant%4;
   if(species<2){const birch=species===1;add('cylinder',birch?'#d3cdb6':'#705139',[0,birch?1.35:1,0],[birch?.16:.3,birch?2.7:2,birch?.16:.3],[0,0,birch?-.065:.045]);
    if(birch)for(let i=0;i<7;i++)add('cylinder','#5c6255',[0,.35+i*.32,0],[.17,.035,.17],[0,i,0]);
    for(let i=0;i<(birch?7:6);i++){const a=i*2.4,x=Math.sin(a),z=Math.cos(a),y=birch?2+i*.16:1.9+(i%3)*.4;add('cylinder',birch?'#d3cdb6':'#705139',[x*.31,y-.4,z*.31],[.09,.9,.09],[z*.6,0,-x*.6]);add('foliage',birch?(i%2?'#7d9854':'#91a85d'):(i%2?'#3d6b43':'#2e5740'),[x*(birch?.4:.65),y+.3,z*.48],[birch?1:1.5,birch?.72:1.08,birch?.8:1.32],[.1,a,.1]);}
    add('foliage',birch?'#a5b66a':'#557c47',[0,birch?3.5:3,0],[1,.9,1]);
   }else{const fir=species===3,height=fir?4.1:3.7;add('cylinder','#705139',[0,height/2,0],[fir?.22:.18,height,fir?.22:.18]);
    for(let layer=0;layer<6;layer++){const y=.85+layer*.48,radius=(fir?1.15:.9)*(1-layer*.125);for(let j=0;j<5;j++){const a=j*Math.PI*2/5+layer*.8,x=Math.cos(a)*radius,z=Math.sin(a)*radius;add('cylinder','#705139',[x*.45,y-.05,z*.45],[.045,radius*1.1,.045],[Math.sin(a)*1.15,0,-Math.cos(a)*1.15]);if(this.naturalTextures?.has('twig_diff'))add('branch','#274f38',[x*.64,y,z*.64],[radius*1.55,.72,radius*1.2],[fir?-.15:.15,a,fir?-.15:.15]);else add('foliage',fir?'#2e5740':'#3d6b43',[x*.6,y,z*.6],[radius*1.4,.45,radius*1.1],[0,a,.1]);}}
   }
  }
  else if(type==='berries'){for(let i=0;i<5;i++){const a=i*2.4;add('foliage',i%2?'#496c37':'#64823f',[Math.cos(a)*.35,.35+i%2*.15,Math.sin(a)*.3],[.95,.65,.85],[0,a,0]);}for(let i=0;i<18;i++){const a=i*2.4,r=.38+(i%3)*.08;add('sphere',i%3?'#a93148':'#d15154',[Math.cos(a)*r,.45+i%4*.1,Math.sin(a)*r],[.11,.12,.11]);}}
  else if(type==='stone'||type==='gold'){for(let i=0;i<4;i++)add('rock',type==='gold'?(i%2?'#c8a84e':'#9b8a55'):'#89958c',[(i%2-.5)*.5,.24+(i===3?.15:0),(Math.floor(i/2)-.5)*.5],[.75,.55,.7],[0,i*.9,.15]);}
  else if(type==='deer'){
   add('sphere','#997654',[0,.79,0],[1.05,.47,.4]);add('sphere','#b18c65',[-.25,.77,0],[.4,.43,.38]);add('sphere','#dab78a',[0,.65,0],[.65,.16,.28]);
   for(const x of [-.31,.3])for(const z of [-.13,.13]){add('limb','#6f5039',[x,.72,z],[.075,.65,.075],[0,0,x<0?-.07:.09],x<0?'legL':'legR');}
   add('sphere','#a78158',[.36,1.02,0],[.23,.62,.26],[0,0,-.38]);add('sphere','#b18c65',[.51,1.28,0],[.39,.24,.24]);add('sphere','#352e24',[.7,1.24,0],[.1,.1,.18]);
   for(const z of [-.13,.13]){add('sphere','#352e24',[.54,1.32,z],[.035,.035,.025]);add('sphere','#a78158',[.39,1.47,z],[.15,.29,.07],[z*2,0,.3]);add('cylinder','#634c35',[.39,1.59,z*.6],[.03,.5,.03],[0,0,.3]);add('cylinder','#634c35',[.3,1.7,z*.6],[.025,.21,.025],[0,0,-.7]);}add('sphere','#dab78a',[-.51,.87,0],[.14,.2,.16],[0,0,.5]);
  }
  else if(type==='cow'||type==='alpaca'||type==='fox'){
   const fox=type==='fox',alpaca=type==='alpaca',body=fox?'#a86b3b':alpaca?'#d4c6a3':'#b6aa91',height=fox?.48:.9,length=fox?1:1.3;
   add('sphere',body,[0,height,0],[length,fox?.36:.65,fox?.32:.6]);for(const x of [-.4,.4])for(const z of [-.18,.18])add('limb',fox?'#4b4031':'#77664e',[x,height-.06,z],[fox?.075:.13,height-.07,fox?.08:.13],[0,0,0],x<0?'legL':'legR');
   add('sphere',body,[.48,height+(alpaca?.55:.16),0],[.3,alpaca?.95:.35,.32]);add('sphere',body,[alpaca?.54:.66,height+(alpaca?.95:.25),0],[fox?.36:.43,.28,.33]);for(const z of [-.13,.13]){add('sphere','#403b30',[.72,height+(alpaca?1.02:.29),z],[.04,.035,.035]);add('limb',body,[.52,height+(alpaca?1.1:.45),z],[.1,alpaca?.35:.19,.1],[0,0,Math.PI]);}
   add('sphere',fox?'#dfcfac':body,[-.65,height+.02,0],[fox?.72:.12,fox?.28:.55,.15],[0,0,fox?-.4:0]);
  }
  else if(type in BUILDINGS){const def=BUILDINGS[type as keyof typeof BUILDINGS],n=def.size;
   box('#6c7563',0,.055,0,n*.96,.11,n*.96);
   if(type==='farm'){box('#725e3d',0,.13,0,n*.94,.08,n*.94);for(let i=0;i<6;i++){box('#495c35',(i-2.5)*.43,.19,0,.16,.09,2.65);for(let j=0;j<4;j++)add('cone','#c4b76a',[(i-2.5)*.43,.4,(j-1.5)*.62],[.15,.42,.15]);}}
   else if(type==='wall'||type==='palisade'){box(type==='wall'?'#a5aa9b':'#7c603d',0,.8,0,.93,1.5,.5);for(let i=0;i<3;i++)box(type==='wall'?'#c1bfaa':'#8f714a',(i-1)*.3,1.65,0,.2,.35,.52);}
   else if(type==='gate'){for(const x of [-.78,.78])box('#a5aa9b',x,1,0,.43,2,.7);box('#b2b19f',0,1.86,0,2,.4,.7);box('#7a5836',0,.85,0,1.12,1.55,.13,'gate');flag(2.7,.75);}
   else if(type==='tower'||type==='fortress'){const h=type==='fortress'?2.5:2.2;box('#a9ad9e',0,h/2,0,n*.72,h,n*.72);box('#848f81',0,.2,n*.38,n*.8,.25,.14);for(const x of [-1,1])for(const z of [-1,1]){const px=x*n*.35,pz=z*n*.35;box('#bcc0ac',px,h+.17,pz,n*.28,.35,n*.28);if(type==='fortress'){box('#9ba391',px,1.6,pz,.95,3.2,.95);add('cone',team,[px,3.6,pz],[1.2,.9,1.2]);}}box('#363c32',0,.55,n*.365,.5,1.05,.05);flag(h+1);}
   else{const capital=type==='capital'||type==='outpost',h=capital?1.85:1.2,w=n*.82,d=n*.75;
    box('#d5ceb0',0,h/2+.15,0,w,h,d);for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])box('#765d42',x,h/2+.15,z,.1,h,.1);
    box('#826143',0,.34,d/2+.03,w*.93,.09,.1);add('roof',type==='smithy'?'#596369':'#a76042',[0,h+.15,0],[w*1.17,.9,d*1.25]);
    box('#423f30',0,.52,d/2+.025,.44,.78,.04);for(const x of [-w*.3,w*.3])box('#7e9f9e',x,.95,d/2+.032,.32,.35,.055);
    if(capital){box('#d1c3a2',.75,1.15,-.4,.78,2.2,.78);add('roof','#824c39',[.75,2.25,-.4],[1.05,.9,1.05]);flag(3.7,.75,-.4);}
    else flag(h+1.65,-w*.35,0);
    if(type==='smithy'){box('#696e65',w*.28,1.85,-d*.2,.35,1.3,.4);box('#434b46',w*.3,.5,d*.8,.52,.23,.3);}
    if(type==='storage'||type==='market')for(let i=0;i<3;i++)add('cylinder','#8c6a45',[(i-1)*.43,.35,d*.72],[.35,.65,.35]);
    if(type==='market'){box(team,0,1.25,d*.7,w, .08,.8);for(const x of [-w*.45,w*.45])post(x,d,1.2);}
    if(type==='range'){add('cylinder','#d4bd82',[w*.3,.8,d*.7],[.6,.1,.6],[Math.PI/2,0,0]);add('cylinder','#9f5240',[w*.3,.8,d*.76],[.25,.1,.25],[Math.PI/2,0,0]);}
    if(type==='stable')for(let i=0;i<3;i++)box('#795c39',(i-1)*.6,.43,d*.75,.08,.7,.6);
    if(type==='barracks')for(const x of [-.5,.5])add('cylinder','#b5aa7b',[x,.7,d*.7],[.055,1.2,.055]);
    if(type==='workshop'){box('#805f39',0,.6,d*.72,1.3,.4,.6);add('cylinder','#5a4d38',[.45,.32,d*.9],[.6,.12,.6],[Math.PI/2,0,0]);}
   }
  }else if(type==='ram'||type==='trebuchet'){box('#8e6b3e',0,.5,0,1.1,.32,1.5);for(const x of [-.63,.63])for(const z of [-.5,.5])add('cylinder','#504733',[x,.25,z],[.5,.15,.5],[0,0,Math.PI/2]);
   if(type==='ram'){box('#b69b6a',0,.83,0,.23,.23,2,'weapon');add('roof',team,[0,1.1,0],[1.4,.6,1.65]);}
   else{for(const x of [-.38,.38])add('box','#8b6e43',[x,1.05,0],[.14,1.9,.14],[.3,0,0]);add('box','#bba075',[0,1.9,.1],[.13,.15,2.3],[.6,0,0],'weapon');box('#706c55',0,1.55,-.85,.45,.5,.4);}
  }else{const mounted=type==='scout'||type==='cavalry'||type==='heavyCavalry';if(mounted){add('sphere','#93744f',[0,.87,0],[.55,.65,1.3]);for(const x of [-.15,.15])for(const z of [-.4,.4])add('limb','#594635',[x,.76,z],[.13,.7,.14],[0,0,0],z<0?'legL':'legR');add('sphere','#9e8058',[0,1.17,.45],[.29,.7,.36],[.25,0,0]);add('sphere','#9e8058',[0,1.35,.55],[.27,.32,.5]);add('sphere',team,[0,1.13,0],[.58,.14,.75]);add('sphere','#383c32',[0,1.42,.78],[.23,.21,.23]);for(const x of [-.09,.09])add('sphere','#9e8058',[x,1.63,.53],[.09,.27,.12]);add('limb','#594635',[0,1.04,-.61],[.09,.7,.12],[.25,0,0]);}person(mounted?.78:0,type!=='villager');const b=mounted?.78:0;
   if(type==='heavyCavalry'){box('#aeb9b9',0,.82,.32,.5,.42,.6);box(team,0,1.05,0,.58,.15,.85);}
   if(type==='pikeman'){box('#aeb9b9',-.3,.85,.08,.12,.65,.42);add('cone',team,[0,1.45,0],[.18,.4,.18]);}
   if(type==='spearman'||type==='pikeman'||type==='cavalry'||type==='heavyCavalry'){add('cylinder','#9e8258',[.34,b+1.1,0],[.045,2.1,.045],[0,0,0],'weapon');add('cone','#aeb9b9',[.34,b+2.24,0],[.16,.3,.16],[0,0,0],'weapon');}
   else if(type==='crossbowman'){box('#755338',.34,b+.82,.2,.12,.14,.6,'weapon');box('#aeb9b9',.34,b+.87,.4,.62,.05,.08,'weapon');box(team,0,b+1.35,0,.38,.14,.35);}
   else if(type==='archer'){add('bow','#947249',[.35,b+.85,.12],[.6,.9,.6],[0,Math.PI/2,0],'weapon');}
   else if(type==='villager'){box('#896c45',.33,b+.52,.06,.06,.8,.06,'arm');box('#aeb9b9',.34,b+.92,.06,.34,.08,.09,'arm');}
   else{box('#aeb9b9',.33,b+.85,.1,.06,.65,.04,'weapon');box(team,-.32,b+.73,.15,.09,.47,.36);}
  }
  const compiled=this.compile(parts);this.cache.set(key,compiled);return compiled;
 }
 updateLighting(daylight:number):void{const windows=this.materials.get('#7e9f9e');if(windows){windows.emissive.setHex(0xeab66e);windows.emissiveIntensity=(1-daylight)*.5;}}
 dispose():void{for(const g of Object.values(this.geometries))g.dispose();for(const m of this.materials.values())m.dispose();for(const g of this.merged.values())g.dispose();this.merged.clear();this.surfaces.dispose();this.cache.clear();this.materials.clear();}
}
