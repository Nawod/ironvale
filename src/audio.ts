export class Soundscape {
 private ctx?:AudioContext;private musicGain?:GainNode;private timer?:ReturnType<typeof setInterval>;private index=0;music=.15;effects=.35;
 unlock():void{if(!this.ctx){this.ctx=new AudioContext();this.musicGain=this.ctx.createGain();this.musicGain.gain.value=this.music;this.musicGain.connect(this.ctx.destination);this.timer=setInterval(()=>this.phrase(),1600);}void this.ctx.resume();}
 private tone(hz:number,duration:number,volume:number,type:OscillatorType='triangle',music=false):void{if(!this.ctx||this.ctx.state!=='running')return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;o.type=type;o.frequency.value=hz;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(music?this.musicGain!:this.ctx.destination);o.start(t);o.stop(t+duration+.02);}
 private phrase():void{const notes=[146.83,0,220,196,0,164.81,0,130.81];const hz=notes[this.index++%notes.length];if(hz)this.tone(hz,1.4,.2,'triangle',true);}
 play(kind:'click'|'order'|'complete'|'attack'|'capture'):void{const hz={click:390,order:260,complete:523,attack:110,capture:660}[kind];this.tone(hz,kind==='attack'?.35:.15,this.effects*.15,kind==='attack'?'sawtooth':'triangle');}
 setMusic(value:number):void{this.music=value;if(this.musicGain)this.musicGain.gain.value=value;}
 destroy():void{if(this.timer)clearInterval(this.timer);void this.ctx?.close();}
}
