import {Scene,Mesh,PlaneGeometry,ShaderMaterial,DataTexture,RGBAFormat,NearestFilter,BoxGeometry,MeshStandardMaterial,InstancedMesh,Object3D,Color,SRGBColorSpace,LinearFilter} from 'three';
import type {Snapshot} from '../sim/types';
import {TERRAIN} from '../sim/terrain';

type RiverMap=Pick<Snapshot,'size'|'terrain'|'fog'>;

/** The GPU mask contains no shape information at all for unexplored tiles. */
export function riverSurfaceMask(s:RiverMap,data:Uint8Array=new Uint8Array(s.size*s.size*4)):Uint8Array{
 for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
  const i=y*s.size+x,d=((s.size-1-y)*s.size+x)*4,known=s.fog[i]>0,t=s.terrain[i];
  data[d]=known&&(t===TERRAIN.water||t===TERRAIN.ford)?255:0;
  data[d+1]=known&&t===TERRAIN.ford?255:0;
  data[d+2]=known?Math.round((s.fog[i]===2?1:.4157)*255):0;data[d+3]=255;
 }
 return data;
}

/** One cheap water pass and three shared bridge batches; no reflection cameras. */
export class Riverlands {
 private mask?:DataTexture;private stone?:DataTexture;private water?:Mesh<PlaneGeometry,ShaderMaterial>;
 private deck?:InstancedMesh;private rails?:InstancedMesh;private piers?:InstancedMesh;
 private size=0;private bridgeCount=0;private transform=new Object3D();
 private uniforms={riverMask:{value:null as DataTexture|null},riverSize:{value:1},riverTime:{value:0},riverLight:{value:1},riverRain:{value:0}};
 constructor(private scene:Scene){}
 update(s:RiverMap):void{
  const count=s.terrain.reduce((n,t)=>n+(t===TERRAIN.bridge?1:0),0);
  if(s.size!==this.size||count>this.bridgeCount)this.create(s.size,count);
  riverSurfaceMask(s,this.mask!.image.data as Uint8Array);this.mask!.needsUpdate=true;
  this.water!.visible=s.terrain.some((t,i)=>s.fog[i]>0&&(t===TERRAIN.water||t===TERRAIN.ford));
  let decks=0,rails=0,piers=0;
  const known=(x:number,y:number)=>x>=0&&y>=0&&x<s.size&&y<s.size&&s.fog[y*s.size+x]>0;
  const at=(x:number,y:number)=>s.terrain[y*s.size+x];
  const color=new Color();
  const add=(mesh:InstancedMesh,index:number,x:number,y:number,z:number,sx:number,sy:number,sz:number,dim:number)=>{
   this.transform.position.set(x,y,z);this.transform.rotation.set(0,0,0);this.transform.scale.set(sx,sy,sz);this.transform.updateMatrix();mesh.setMatrixAt(index,this.transform.matrix);color.setScalar(dim);mesh.setColorAt(index,color);
  };
  for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
   const i=y*s.size+x;if(s.terrain[i]!==TERRAIN.bridge||!s.fog[i])continue;
   const dim=s.fog[i]===2?1:.42;
   add(this.deck!,decks++,x+.5,-.05,y+.5,1,.15,1,dim);
   for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){
    // Only edges against known water receive rails. Shore entrances stay open.
    if(!known(x+dx,y+dy)||at(x+dx,y+dy)!==TERRAIN.water)continue;
    add(this.rails!,rails++,x+.5+dx*.46,.22,y+.5+dy*.46,dx?.09:1,.16,dy?.09:1,dim);
    add(this.piers!,piers++,x+.5+dx*.46,.05,y+.5+dy*.46,.14,.5,.14,dim);
   }
  }
  for(const [mesh,n]of [[this.deck,decks],[this.rails,rails],[this.piers,piers]] as const){mesh!.count=n;mesh!.instanceMatrix.needsUpdate=true;if(mesh!.instanceColor)mesh!.instanceColor.needsUpdate=true;}
 }
 animate(tick:number,daylight:number,rain:number):void{
  this.uniforms.riverTime.value=tick/20;this.uniforms.riverLight.value=.24+daylight*.76;this.uniforms.riverRain.value=rain;
 }
 private create(size:number,bridges:number):void{
  this.clear();this.size=size;this.bridgeCount=bridges;
  this.mask=new DataTexture(new Uint8Array(size*size*4),size,size,RGBAFormat);this.mask.magFilter=this.mask.minFilter=NearestFilter;this.mask.needsUpdate=true;
  this.uniforms.riverMask.value=this.mask;this.uniforms.riverSize.value=size;
  const material=new ShaderMaterial({uniforms:this.uniforms,vertexShader:`
   varying vec2 riverUv;
   void main(){riverUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,fragmentShader:`
   uniform sampler2D riverMask;uniform float riverSize;uniform float riverTime;uniform float riverLight;uniform float riverRain;
   varying vec2 riverUv;
   float riverShape(vec2 uv){
    vec2 p=uv*riverSize-.5,base=floor(p),f=fract(p);
    float a=texture2D(riverMask,(base+vec2(.5,.5))/riverSize).r;
    float b=texture2D(riverMask,(base+vec2(1.5,.5))/riverSize).r;
    float c=texture2D(riverMask,(base+vec2(.5,1.5))/riverSize).r;
    float d=texture2D(riverMask,(base+vec2(1.5,1.5))/riverSize).r;
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
   }
   void main(){
    vec4 mask=texture2D(riverMask,riverUv);if(mask.b<0.01)discard;
    float shape=riverShape(riverUv);if(shape<.5)discard;
    vec2 p=riverUv*riverSize;
    float wave=sin(p.x*4.0+p.y*1.5+riverTime*.7+sin(p.y*4.0-riverTime*1.2)*.45);
    float wave2=sin(p.y*8.1-p.x*1.4-riverTime*2.1);
    float wide=sin(p.y*1.7+p.x*0.9+riverTime*0.45);
    float ripple=pow(max(0.0,sin((p.x+p.y)*12.0+riverTime*5.0)),18.0)*riverRain;
    vec3 deep=mix(vec3(0.035,0.17,0.21),vec3(0.06,0.27,0.29),wide*0.5+0.5);
    vec3 shallow=vec3(0.19,0.3,0.25);
    vec3 c=mix(deep,shallow,mask.g*.62)+(wave*.007+ripple*.018);
    c=mix(vec3(.28,.29,.19),c,smoothstep(.5,.85,shape));
    float glint=pow(max(0.0,wave*.5+wave2*.5),14.0)*.05;
    c+=vec3(.54,.75,.77)*glint;
    gl_FragColor=vec4(c*riverLight*mask.b,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `});
  material.name='River flow and weather ripples';this.water=new Mesh(new PlaneGeometry(size,size),material);this.water.name='River water';this.water.rotation.x=-Math.PI/2;this.water.position.set(size/2,-.012,size/2);this.scene.add(this.water);
  const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,mortar=y%16===0||(x+(Math.floor(y/16)%2)*8)%16===0,noise=((Math.imul(x+7,73856093)^Math.imul(y+13,19349663))>>>0)%17-8;for(let c=0;c<3;c++)pixels[i+c]=(mortar?[96,94,81]:[157,149,129])[c]+noise;pixels[i+3]=255;}
  this.stone=new DataTexture(pixels,64,64,RGBAFormat);this.stone.colorSpace=SRGBColorSpace;this.stone.magFilter=this.stone.minFilter=LinearFilter;this.stone.needsUpdate=true;
  const batch=(name:string,color:number,capacity:number)=>{
   const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshStandardMaterial({color,roughness:.9}),Math.max(1,capacity));mesh.name=name;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.count=0;this.scene.add(mesh);return mesh;
  };
  this.deck=batch('River bridge decks',0x9e947b,bridges);this.rails=batch('River bridge rails',0x9c927e,bridges*4);this.piers=batch('River bridge piers',0x726c5d,bridges*4);
  (this.deck.material as MeshStandardMaterial).map=this.stone;(this.deck.material as MeshStandardMaterial).color.setHex(0xffffff);
 }
 private clear():void{
  if(this.water){this.scene.remove(this.water);this.water.geometry.dispose();this.water.material.dispose();this.water=undefined;}
  this.mask?.dispose();this.mask=undefined;this.stone?.dispose();this.stone=undefined;
  for(const mesh of [this.deck,this.rails,this.piers])if(mesh){this.scene.remove(mesh);mesh.geometry.dispose();(mesh.material as MeshStandardMaterial).dispose();mesh.dispose();}
  this.deck=this.rails=this.piers=undefined;
 }
 dispose():void{this.clear();this.size=0;this.bridgeCount=0;}
}
