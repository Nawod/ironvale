import {BoxGeometry,SphereGeometry,CylinderGeometry,ConeGeometry,DodecahedronGeometry,TorusGeometry,BufferGeometry,Float32BufferAttribute,MeshStandardMaterial} from 'three';
import type {Entity} from '../sim/types';
import {BUILDINGS,COLORS} from '../sim/definitions';
export interface ModelPart {geometry:BufferGeometry;material:MeshStandardMaterial;position:[number,number,number];scale:[number,number,number];rotation:[number,number,number];motion?:'legL'|'legR'|'arm'|'weapon'|'flag'|'gate'}
export class ModelLibrary {
 private cache=new Map<string,ModelPart[]>();private materials=new Map<string,MeshStandardMaterial>();
 private geometries={box:new BoxGeometry(1,1,1),sphere:new SphereGeometry(.5,8,6),cylinder:new CylinderGeometry(.5,.5,1,8),cone:new ConeGeometry(.5,1,7),rock:new DodecahedronGeometry(.5,0),bow:new TorusGeometry(.5,.055,4,10,Math.PI),roof:this.roof()};
 private roof():BufferGeometry{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5],3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);g.computeVertexNormals();return g;}
 private material(color:string):MeshStandardMaterial{let m=this.materials.get(color);if(!m){m=new MeshStandardMaterial({color,roughness:1,metalness:color==='#aeb9b9'?.35:0,flatShading:true});this.materials.set(color,m);}return m;}
 get(type:Entity['type'],owner:number):ModelPart[]{const key=`${type}:${owner}`;const cached=this.cache.get(key);if(cached)return cached;const parts:ModelPart[]=[],team=COLORS[Math.max(0,owner)]??COLORS[0];
  const add=(shape:keyof typeof this.geometries,color:string,p:[number,number,number],s:[number,number,number],r:[number,number,number]=[0,0,0],motion?:ModelPart['motion'])=>parts.push({geometry:this.geometries[shape],material:this.material(color),position:p,scale:s,rotation:r,motion});
  const box=(color:string,x:number,y:number,z:number,w:number,h:number,d:number,motion?:ModelPart['motion'])=>add('box',color,[x,y,z],[w,h,d],[0,0,0],motion);
  const post=(x:number,z:number,h:number,color='#705139')=>add('cylinder',color,[x,h/2,z],[.1,h,.1]);
  const flag=(h:number,x=0,z=0)=>{post(x,z,h,'#d2be83');box(team,x+.22,h-.22,z,.44,.3,.025,'flag');};
  const person=(base=0,armored=false)=>{
   box(armored?'#5e6c70':team,0,base+.73,0,.38,.48,.26);box(team,0,base+.86,.146,.3,.22,.018);
   add('sphere','#dab78a',[0,base+1.13,0],[.32,.34,.31]);
   for(const side of [-1,1]){box('#5a4939',side*.105,base+.25,0,.13,.5,.15,side<0?'legL':'legR');box('#383c32',side*.105,base+.045,.04,.15,.09,.24);box('#dab78a',side*.245,base+.69,0,.105,.42,.12,'arm');}
   if(armored){add('sphere','#aeb9b9',[0,base+1.22,0],[.36,.24,.35]);box('#d2b565',0,base+.51,.15,.37,.07,.025);}else add('cylinder','#a18a58',[0,base+1.3,0],[.49,.04,.49]);
  };
  if(type==='wood'){post(0,0,1.5);add('cone','#2e5740',[0,1.35,0],[1.2,1.5,1.2]);add('cone','#3d6b43',[0,2.05,0],[.95,1.4,.95]);add('cone','#557c47',[0,2.65,0],[.65,1.1,.65]);}
  else if(type==='stone'||type==='gold'){for(let i=0;i<4;i++)add('rock',type==='gold'?(i%2?'#c8a84e':'#9b8a55'):'#89958c',[(i%2-.5)*.5,.24+(i===3?.15:0),(Math.floor(i/2)-.5)*.5],[.75,.55,.7],[0,i*.9,.15]);}
  else if(type==='deer'){box('#997654',0,.65,0,.72,.36,.3);for(const x of [-.25,.25])for(const z of [-.1,.1])box('#6f5039',x,.29,z,.07,.6,.07);add('cylinder','#a78158',[.35,.85,0],[.13,.5,.16],[0,0,-.5]);add('sphere','#b18c65',[.46,1.11,0],[.32,.24,.2]);for(const z of [-.08,.08]){add('cylinder','#634c35',[.4,1.4,z],[.035,.55,.035],[0,0,.3]);add('cylinder','#634c35',[.31,1.51,z],[.03,.24,.03],[0,0,-.7]);}}
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
  }else{const mounted=type==='scout'||type==='cavalry';if(mounted){box('#93744f',0,.75,0,.43,.48,1.15);for(const x of [-.15,.15])for(const z of [-.4,.4])box('#594635',x,.32,z,.12,.7,.13,z<0?'legL':'legR');box('#9e8058',0,1.03,.44,.2,.58,.23);add('sphere','#9e8058',[0,1.35,.55],[.27,.32,.5]);box(team,0,.97,0,.48,.08,.5);}person(mounted?.78:0,type!=='villager');const b=mounted?.78:0;
   if(type==='spearman'||type==='cavalry'){add('cylinder','#9e8258',[.34,b+1.1,0],[.045,2.1,.045],[0,0,0],'weapon');add('cone','#aeb9b9',[.34,b+2.24,0],[.16,.3,.16],[0,0,0],'weapon');}
   else if(type==='archer'){add('bow','#947249',[.35,b+.85,.12],[.6,.9,.6],[0,Math.PI/2,0],'weapon');}
   else if(type==='villager'){box('#896c45',.33,b+.52,.06,.06,.8,.06,'arm');box('#aeb9b9',.34,b+.92,.06,.34,.08,.09,'arm');}
   else{box('#aeb9b9',.33,b+.85,.1,.06,.65,.04,'weapon');box(team,-.32,b+.73,.15,.09,.47,.36);}
  }
  this.cache.set(key,parts);return parts;
 }
 dispose():void{for(const g of Object.values(this.geometries))g.dispose();for(const m of this.materials.values())m.dispose();this.cache.clear();this.materials.clear();}
}
