import {startServer} from '../dist-server/index.mjs';
const server=await startServer({port:5178,host:'127.0.0.1',dataDir:false,countdownMs:250});
console.log('Ironvale browser-test server ready');
process.once('SIGTERM',()=>{void server.close().then(()=>process.exit(0));});
process.once('SIGINT',()=>{void server.close().then(()=>process.exit(0));});
