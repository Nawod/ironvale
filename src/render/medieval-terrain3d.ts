import {DataTexture,RGBAFormat,RepeatWrapping,LinearFilter,NearestFilter,SRGBColorSpace,MeshStandardMaterial,Texture} from 'three';
import type {Snapshot} from '../sim/types';
import {landscapeStylePixels,type LandscapeFields} from './landscape-surface';

/** Fine detail repeats independently of the small, fog-safe world control map. */
export class MedievalTerrain {
 readonly material:MeshStandardMaterial;
 private grain:DataTexture;
 private fog:DataTexture;
 private surface:DataTexture;
 private uniforms:{medievalGrain:{value:Texture};medievalFog:{value:Texture};medievalSurface:{value:Texture};medievalSize:{value:number}};
 constructor(control:DataTexture,size:number){
  const n=256,data=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const noise=((Math.imul(x+17,374761393)^Math.imul(y+31,668265263))>>>0)%256/255;
   const blades=Math.sin(x*.42+Math.sin(y*.073)*3)*Math.cos(y*.25+x*.14),value=Math.round(100+noise*65+blades*22),i=(y*n+x)*4;
   data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  this.grain=new DataTexture(data,n,n,RGBAFormat);this.grain.wrapS=this.grain.wrapT=RepeatWrapping;this.grain.magFilter=this.grain.minFilter=LinearFilter;this.grain.needsUpdate=true;
  this.fog=new DataTexture(new Uint8Array(size*size*4),size,size,RGBAFormat);this.fog.magFilter=this.fog.minFilter=NearestFilter;this.fog.needsUpdate=true;
  this.surface=new DataTexture(new Uint8Array(size*size*64),size*4,size*4,RGBAFormat);this.surface.magFilter=this.surface.minFilter=LinearFilter;this.surface.needsUpdate=true;
  this.uniforms={medievalGrain:{value:this.grain},medievalFog:{value:this.fog},medievalSurface:{value:this.surface},medievalSize:{value:size}};
  this.material=new MeshStandardMaterial({map:control,roughness:.96});
  this.material.name='Medieval layered ground';
  this.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.uniforms);
   shader.fragmentShader=shader.fragmentShader.replace('void main() {','uniform sampler2D medievalGrain;\nuniform sampler2D medievalFog;\nuniform sampler2D medievalSurface;\nuniform float medievalSize;\nvoid main() {');
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 groundUv = vMapUv * medievalSize;
    float landKnown = step(0.01, texture2D(medievalFog, vMapUv).r);
    vec3 groundPhoto = texture2D(medievalGrain, groundUv * 0.52).rgb;
    float grainFine = texture2D(medievalGrain, groundUv * 2.3).g;
    float groundLuma = dot(groundPhoto, vec3(0.3,0.5,0.2));
    float groundRelief = mix(0.82, 1.24, clamp(groundLuma * 1.65, 0.0, 1.0)) + (grainFine - 0.5) * 0.1;
    float paving = smoothstep(0.54, 0.9, texture2D(medievalSurface, vMapUv).r) * landKnown;
    vec2 cobbleUv = groundUv * vec2(3.2, 3.7);
    cobbleUv.x += mod(floor(cobbleUv.y), 2.0) * 0.5;
    vec2 cobbleCell = fract(cobbleUv);
    float cobbleEdge = min(min(cobbleCell.x, 1.0-cobbleCell.x), min(cobbleCell.y, 1.0-cobbleCell.y));
    float cobbleJoint = smoothstep(0.025, 0.095, cobbleEdge);
    float cobbleShade = 0.91 + 0.13 * sin(dot(floor(cobbleUv), vec2(23.17, 41.93)));
    float cobbleRelief = mix(0.58, 1.13, cobbleJoint) * cobbleShade + (grainFine - 0.5) * 0.08;
    diffuseColor.rgb *= mix(1.0, mix(groundRelief, cobbleRelief, paving), landKnown);
   `);
  };
  this.material.customProgramCacheKey=()=> 'ironvale-medieval-ground-v2';
 }
 updateFog(s:Pick<Snapshot,'size'|'fog'>):void{
  const bytes=this.fog.image.data as Uint8Array;
  for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){const i=((s.size-1-y)*s.size+x)*4;bytes[i]=s.fog[y*s.size+x]?255:0;bytes[i+3]=255;}
  this.fog.needsUpdate=true;
 }
 updateSurface(s:Pick<Snapshot,'size'|'fog'>,fields:LandscapeFields):void{landscapeStylePixels(s,fields,this.surface.image.data as Uint8Array);this.surface.needsUpdate=true;}
 setGroundTexture(texture:Texture):void{
  texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=4;texture.colorSpace=SRGBColorSpace;this.uniforms.medievalGrain.value=texture;
 }
 dispose():void{this.material.dispose();this.grain.dispose();this.fog.dispose();this.surface.dispose();}
}
