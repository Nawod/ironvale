import {it,expect} from 'vitest';
import {startServer} from '../server/index';
it('serves bounded voice ICE configuration without caching credentials',async()=>{
 const server=await startServer({port:0,dataDir:false,iceServers:[{urls:'turn:relay.example:3478',username:'short-lived-user',credential:'short-lived-token'}]});
 try{const response=await fetch(`http://127.0.0.1:${server.port}/voice-config`);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toEqual({iceServers:[{urls:'turn:relay.example:3478',username:'short-lived-user',credential:'short-lived-token'}]});}finally{await server.close();}
});
it('rejects non-ICE URLs and malformed relay configuration at startup',async()=>{
 await expect(startServer({port:0,dataDir:false,iceServers:[{urls:'https://invalid.example'}]})).rejects.toThrow(/voice|ICE/i);
});
