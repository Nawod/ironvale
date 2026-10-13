export interface Session {
 onmessage:((event:{data:any})=>void)|null;
 postMessage:(message:any)=>void;
 terminate:()=>void;
}
export class LocalSession implements Session {
 onmessage:Session['onmessage']=null;private worker:Worker;
 constructor(){this.worker=new Worker(new URL('../worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=e=>this.onmessage?.(e);}
 postMessage(message:any){this.worker.postMessage(message);}
 terminate(){this.worker.terminate();}
}
