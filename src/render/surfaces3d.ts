import {DataTexture,RGBAFormat,RepeatWrapping,SRGBColorSpace,LinearMipmapLinearFilter,LinearFilter} from 'three';
export type Surface='wood'|'stone'|'plaster'|'roof'|'cloth'|'metal'|'leaf'|'earth'|'rock';
/** Original seamless material relief; shared by every matching mesh, generated once. */
export class SurfaceLibrary{
 private textures=new Map<Surface,{map:DataTexture;bump:DataTexture}>();
 get(kind:Surface):{map:DataTexture;bump:DataTexture}{
  const cached=this.textures.get(kind);if(cached)return cached;
  const n=128,data=new Uint8Array(n*n*4),bump=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const noise=((Math.imul(x+17,374761393)^Math.imul(y+31,668265263))>>>0)%256/255;
   let value=.86+noise*.14,relief=value;
   if(kind==='wood'){value=.69+.16*Math.sin(x*.42+Math.sin(y*.098)*1.7)+noise*.11;relief=value;}
   if(kind==='stone'){const row=Math.floor(y/32),sx=(x+(row%2)*32)%64,seam=y%32<2||sx<2;value=seam?.52:.78+noise*.17+Math.sin(row*13+Math.floor((x+row%2*32)/64)*7)*.055;relief=seam?.16:value;}
   if(kind==='roof'){const row=Math.floor(y/16),seam=y%16<2||(x+row%2*8)%16<1;value=seam?.52:.78+Math.sin(y%16/16*Math.PI)*.15+noise*.07;relief=seam?.15:value;}
   if(kind==='cloth'){value=.87+(x%2)*.04+(y%2)*.035+noise*.05;relief=value;}
   if(kind==='metal'){value=.9+noise*.08;relief=.8+noise*.12;}
   if(kind==='plaster'){value=.82+noise*.16;relief=value;}
   if(kind==='leaf'){value=.65+noise*.25+Math.sin(x*.29+y*.18)*.07+Math.cos(x*.11-y*.37)*.03;relief=value;}
   if(kind==='rock'){value=.76+noise*.16+Math.sin(x*.073+y*.11)*.065+Math.cos(x*.19-y*.037)*.025;relief=value;}
   if(kind==='earth'){value=.72+noise*.23;relief=value;}
   const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=Math.round(value*255);data[i+3]=255;bump[i]=bump[i+1]=bump[i+2]=Math.round(relief*255);bump[i+3]=255;
  }
  const map=new DataTexture(data,n,n,RGBAFormat),height=new DataTexture(bump,n,n,RGBAFormat);map.colorSpace=SRGBColorSpace;
  for(const texture of [map,height]){texture.wrapS=texture.wrapT=RepeatWrapping;texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;}
  const value={map,bump:height};this.textures.set(kind,value);return value;
 }
 dispose():void{for(const t of this.textures.values()){t.map.dispose();t.bump.dispose();}this.textures.clear();}
}
