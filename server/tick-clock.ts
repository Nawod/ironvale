// Advance fixed simulation steps from elapsed time, rather than timer callback counts.
// Limit each callback so queued commands and shutdown requests remain responsive.
export class TickClock {
 private next:number;
 constructor(start:number,private interval=50){this.next=start+interval;}
 due(now:number):number{const count=Math.max(0,Math.min(5,Math.floor((now-this.next)/this.interval)+1));this.next+=count*this.interval;return count;}
 delay(now:number):number{return Math.max(1,this.next-now);}
}
