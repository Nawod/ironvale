import type {Command,MatchConfig} from '../sim/types';
export type SessionMessage=
 | {type:'command';command:Command;requestId?:number}
 | {type:'start';config:MatchConfig}
 | {type:'load';text:string}
 | {type:'pause';paused:boolean}
 | {type:'save'};
export interface Session {
 onmessage:((event:{data:any})=>void)|null;
 postMessage:(message:SessionMessage)=>void;
 terminate:()=>void;
}
export class LocalSession implements Session {
 onmessage:Session['onmessage']=null;private worker:Worker;
 constructor(){this.worker=new Worker(new URL('../worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>this.onmessage?.(e);}
 postMessage(message:SessionMessage){this.worker.postMessage(message);}
 terminate(){this.worker.terminate();}
}
