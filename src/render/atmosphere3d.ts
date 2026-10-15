import {Scene,DataTexture,RGBAFormat,LinearFilter,Sprite,SpriteMaterial,FogExp2,BufferGeometry,Float32BufferAttribute,LineBasicMaterial,LineSegments,Color,PlaneGeometry,MeshBasicMaterial,InstancedMesh,Object3D,DynamicDrawUsage} from 'three';
import type {Environment} from '../sim/environment';
import type {Position} from '../sim/types';
function cloudTexture():DataTexture{
 const size=192,bytes=new Uint8Array(size*size*4),lobes=[[-.56,.06,.38],[-.26,.22,.46],[.04,.29,.49],[.48,.06,.4],[-.24,-.18,.41],[.29,-.15,.4],[.62,-.16,.28]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*2-1,v=y/size*2-1;let density=0;for(const[cx,cy,r]of lobes){const d=Math.hypot(u-cx,v-cy)/r;density=Math.max(density,Math.max(0,1-d*d));}const noise=.84+.08*Math.sin(x*.21)*Math.cos(y*.17)+.08*Math.sin((x+y)*.41),i=(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=255;bytes[i+3]=Math.min(255,density*density*noise*255);}
 const texture=new DataTexture(bytes,size,size,RGBAFormat);texture.magFilter=texture.minFilter=LinearFilter;texture.needsUpdate=true;return texture;
}
/** Bounded atmospheric layers; all motion follows the match clock. */
export class Atmosphere{
 private texture=cloudTexture();private clouds:Sprite[]=[];private geometry=new BufferGeometry();private rainMaterial=new LineBasicMaterial({color:0xc4d7e1,transparent:true,opacity:.25,depthWrite:false});private rain:LineSegments;private positions:Float32Array;private fog=new FogExp2(0xb4bba9,.0015);private sky=new Color();private mistColor=new Color(0x929e9c);private shadowGeometry=new PlaneGeometry(1,1);private shadowMaterial=new MeshBasicMaterial({color:0x17221d,map:this.texture,transparent:true,opacity:.05,depthWrite:false});private shadows:InstancedMesh;private transform=new Object3D();
 constructor(private scene:Scene,private mobile:boolean){
  scene.fog=this.fog;
  for(let i=0;i<(mobile?9:16);i++){const sprite=new Sprite(new SpriteMaterial({map:this.texture,transparent:true,depthWrite:false,opacity:.2,fog:false}));sprite.name='sky-cloud';sprite.scale.set(10+i%4*2,4+i%3,1);sprite.renderOrder=2;scene.add(sprite);this.clouds.push(sprite);}
  this.shadows=new InstancedMesh(this.shadowGeometry,this.shadowMaterial,this.clouds.length);this.shadows.name='cloud-shadow';this.shadows.instanceMatrix.setUsage(DynamicDrawUsage);this.shadows.frustumCulled=false;scene.add(this.shadows);
  this.positions=new Float32Array((mobile?120:340)*6);this.geometry.setAttribute('position',new Float32BufferAttribute(this.positions,3));this.rain=new LineSegments(this.geometry,this.rainMaterial);this.rain.name='weather-rain';this.rain.frustumCulled=false;scene.add(this.rain);
 }
 update(env:Environment,focus:Position,tick:number,yaw=Math.PI/4):void{
  const time=tick/20,light=.28+env.daylight*.72;this.sky.setRGB(.14+.35*light,.19+.36*light,.25+.34*light);this.sky.lerp(this.mistColor,env.mist*.4);this.fog.color.copy(this.sky);this.fog.density=.0012+env.mist*.0025;this.scene.background=this.sky;
  const windX=Math.cos(env.windAngle),windY=Math.sin(env.windAngle);
  for(const [i,cloud]of this.clouds.entries()){
   const drift=time*(.035+env.wind*.1),x=((i*19.37+drift*windX)%68+68)%68-34,z=((i*29.13+drift*windY)%54+54)%54-27,height=12+i%3*2;
   // Keep the cloud layer over the viewed world at RTS elevation; clouds remain well above actors.
   cloud.position.set(focus.x+x+Math.sin(yaw)*height*1.3,height,focus.y+z+Math.cos(yaw)*height*1.3);cloud.material.opacity=(.2+env.cloud*.3)*(this.mobile?.85:1);cloud.material.color.setRGB(light*(1-env.rain*.18),light*(1-env.rain*.15),light);
   this.transform.position.set(focus.x+x,.028,focus.y+z);this.transform.rotation.set(-Math.PI/2,0,env.windAngle);this.transform.scale.set(cloud.scale.x*.8,cloud.scale.y*1.3,1);this.transform.updateMatrix();this.shadows.setMatrixAt(i,this.transform.matrix);
  }
  this.shadowMaterial.opacity=(.045+env.cloud*.045)*env.daylight;this.shadows.visible=env.daylight>.03;this.shadows.instanceMatrix.needsUpdate=true;
  this.rain.visible=env.rain>.015;if(!this.rain.visible)return;
  this.geometry.setDrawRange(0,Math.floor(this.positions.length/6*env.rain)*2);this.rainMaterial.opacity=.15+env.rain*.18;
  const positions=this.geometry.getAttribute('position');
  for(let i=0;i<this.positions.length/6;i++){const x=focus.x+(i*17.71%42)-21,y=18-((time*(9+env.wind*5)+i*3.71)%18),z=focus.y+(i*23.37%42)-21;positions.setXYZ(i*2,x,y,z);positions.setXYZ(i*2+1,x-windX*env.wind*.28,y+.65,z-windY*env.wind*.28);}
  positions.needsUpdate=true;
 }
 dispose():void{for(const cloud of this.clouds){this.scene.remove(cloud);cloud.material.dispose();}this.scene.remove(this.shadows,this.rain);this.shadows.dispose();this.shadowGeometry.dispose();this.shadowMaterial.dispose();this.rainMaterial.dispose();this.geometry.dispose();this.texture.dispose();if(this.scene.fog===this.fog)this.scene.fog=null;}
}
