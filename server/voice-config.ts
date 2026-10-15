export interface VoiceIceServer {urls:string|string[];username?:string;credential?:string}
export function voiceIceServers(value:unknown):VoiceIceServer[]{
 if(value===undefined)return[{urls:'stun:stun.cloudflare.com:3478'}];
 if(!Array.isArray(value)||value.length>8)throw new Error('Invalid voice ICE server configuration.');
 return value.map(server=>{
  if(!server||typeof server!=='object')throw new Error('Invalid voice ICE server configuration.');
  const urls=typeof server.urls==='string'?[server.urls]:server.urls;
  if(!Array.isArray(urls)||!urls.length||urls.length>8||urls.some(url=>typeof url!=='string'||url.length>2048||! /^(stun|stuns|turn|turns):[^\s/@]+$/i.test(url)))throw new Error('Voice ICE servers must use STUN or TURN URLs.');
  if(server.username!==undefined&&(typeof server.username!=='string'||server.username.length>512)||server.credential!==undefined&&(typeof server.credential!=='string'||server.credential.length>2048))throw new Error('Invalid voice ICE credentials.');
  return{urls:typeof server.urls==='string'?server.urls:[...urls],...(server.username!==undefined?{username:server.username}:{}),...(server.credential!==undefined?{credential:server.credential}:{})};
 });
}
