/** Decimal seeds can be copied from a match and replayed without rehashing. */
export function freshSeed():string{return String(crypto.getRandomValues(new Uint32Array(1))[0]);}
export function prepareMatchSeed(value:string,chosen:boolean):{seed:number;nextSeed:string}{
 const text=value.trim()||freshSeed();
 let seed:number;
 if(/^\d+$/.test(text)&&Number(text)<=0xffffffff)seed=Number(text);
 else{seed=2166136261;for(const ch of text)seed=Math.imul(seed^ch.charCodeAt(0),16777619);seed>>>=0;}
 return{seed,nextSeed:chosen&&value.trim()?value:freshSeed()};
}
