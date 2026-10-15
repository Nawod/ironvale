import type {Entity} from '../sim/types';
import {BUILDINGS,COLORS} from '../sim/definitions';
const images=new Map<string,string>();
function polygon(c:CanvasRenderingContext2D,points:number[][],fill:string,stroke?:string):void{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke();}}
function line(c:CanvasRenderingContext2D,x:number,y:number,x2:number,y2:number,color:string,width=2):void{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string):void{c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function box(c:CanvasRenderingContext2D,x:number,y:number,w:number,d:number,h:number,left='#c4b99b',right='#a3987f',top='#ded3b4'):void{
 polygon(c,[[x,y-h],[x+w,y+w*.5-h],[x+w-d,y+(w+d)*.5-h],[x-d,y+d*.5-h]],top,'#695d47');
 polygon(c,[[x-d,y+d*.5-h],[x+w-d,y+(w+d)*.5-h],[x+w-d,y+(w+d)*.5],[x-d,y+d*.5]],left,'#695d47');
 polygon(c,[[x+w-d,y+(w+d)*.5-h],[x+w,y+w*.5-h],[x+w,y+w*.5],[x+w-d,y+(w+d)*.5]],right,'#695d47');
}
function roof(c:CanvasRenderingContext2D,x:number,y:number,w:number,d:number,h:number,color='#8c5039'):void{
 polygon(c,[[x-5,y+2],[x+w*.5,y-h],[x+w+5,y+w*.5+2],[x+w-d+3,y+(w+d)*.5+2]],color,'#593d2b');
 polygon(c,[[x-5,y+2],[x+w*.5,y-h],[x+w*.5-d,y+d*.5-h],[x-d-5,y+d*.5+2]],'#ad6a46','#593d2b');
 for(let i=1;i<5;i++)line(c,x-2+i*w/5,y+i*w/10,x+w*.5-d+i*w/10,y+d*.5-h+i*w/10,'#c28555',.8);
}
function flag(c:CanvasRenderingContext2D,x:number,y:number,color:string):void{line(c,x,y,x,y-44,'#5a4931',2);polygon(c,[[x,y-43],[x+27,y-39],[x+23,y-26],[x,y-29]],color,'#eadcb9');}
function pine(c:CanvasRenderingContext2D,x:number,y:number,scale=1):void{
 c.save();c.translate(x,y);c.scale(scale,scale);ellipse(c,0,4,24,10,'#263e2a55');line(c,0,0,0,-51,'#6b5235',7);
 polygon(c,[[-26,-18],[0,-65],[27,-18]],'#35563b');polygon(c,[[-22,-34],[0,-79],[22,-34]],'#446945');polygon(c,[[-16,-53],[0,-90],[17,-53]],'#527b4e');line(c,0,-85,-5,-62,'#668955',1);c.restore();
}
function person(c:CanvasRenderingContext2D,x:number,y:number,color:string,type:string):void{
 ellipse(c,x,y+3,10,4,'#24352760');line(c,x-4,y-11,x-6,y,'#4a3e30',4);line(c,x+4,y-11,x+6,y,'#4a3e30',4);
 polygon(c,[[x-7,y-34],[x+7,y-34],[x+8,y-11],[x-8,y-11]],color,'#443a2c');line(c,x,y-33,x,y-13,'#d4c5a3',2);
 line(c,x-8,y-28,x-12,y-15,'#c5a47d',4);line(c,x+8,y-28,x+13,y-18,'#c5a47d',4);
 ellipse(c,x,y-41,6,7,'#dfbd91');ellipse(c,x,y-47,7,3,type==='villager'?'#aa9562':'#a8b2ac');
 if(type==='villager'){line(c,x+13,y-18,x+20,y-38,'#755131',3);polygon(c,[[x+15,y-35],[x+26,y-40],[x+27,y-32],[x+20,y-30]],'#89938b');}
 else if(type==='crossbowman'){line(c,x+8,y-23,x+20,y-34,'#a9814d',5);line(c,x+7,y-35,x+28,y-26,'#d4ddd3',3);}
 else if(type==='archer'){c.strokeStyle='#a9814d';c.lineWidth=3;c.beginPath();c.arc(x+13,y-24,15,-1.4,1.4);c.stroke();line(c,x+15,y-39,x+15,y-10,'#ddcfac',1);}
 else{line(c,x+13,y-18,x+15,y-((type==='spearman'||type==='pikeman')?67:43),'#8d7656',2);polygon(c,[[x+12,y-((type==='spearman'||type==='pikeman')?67:43)],[x+16,y-((type==='spearman'||type==='pikeman')?74:52)],[x+19,y-((type==='spearman'||type==='pikeman')?66:43)]],'#d4ddd3');polygon(c,[[x-17,y-28],[x-5,y-28],[x-6,y-14],[x-11,y-9],[x-17,y-16]],color,'#dfc996');}
}
export function paintEntity(type:Entity['type'],owner=0):HTMLCanvasElement{
 const b=BUILDINGS[type as keyof typeof BUILDINGS],isBuilding=!!b,canvas=document.createElement('canvas');canvas.width=isBuilding?320:type==='wood'?100:140;canvas.height=isBuilding?280:type==='wood'?150:120;
 const c=canvas.getContext('2d')!,team=COLORS[Math.max(0,owner)]??COLORS[0];
 c.translate(canvas.width/2,isBuilding?canvas.height-65:canvas.height-18);
 if(isBuilding){
  const n=b.size,w=n*27,d=n*27;
  ellipse(c,0,12,w*1.15,d*.6,'#23332244');
  polygon(c,[[-w,0],[0,-d*.5],[w,0],[0,d*.5]],type==='farm'?'#806343':'#b0a37d','#746b4e');
  if(type==='farm'){
   for(let i=0;i<8;i++){const x=-w+10+i*(w*2-20)/8;line(c,x,-Math.min(x+w,w-x)*.45,x+w*.75,Math.min(w-x,w*.6)*.3,'#594b32',4);for(let j=0;j<5;j++){const px=x+j*9,py=j*4;if(Math.abs(px)<w-10){line(c,px,py,px-2,py-11,'#aab86a',2);ellipse(c,px-2,py-11,2,4,'#c9c073');}}}
   for(const[x,y]of [[-w,0],[w,0],[0,-d*.5],[0,d*.5]])line(c,x,y,x,y-12,'#6a573c',3);
  }else if(['wall','palisade','gate'].includes(type)){
   if(type==='palisade'){for(let i=-18;i<20;i+=7){box(c,i,0,7,8,38,'#9a7951','#71583b','#b79769');polygon(c,[[i-3,-34],[i+1,-44],[i+5,-34]],'#af8c60');}}
   else if(type==='wall'){box(c,-6,-7,40,22,49);for(let i=-5;i<31;i+=12)box(c,i,-8,7,22,57);}
   else{box(c,-27,-9,14,22,70);box(c,26,17,14,22,70);box(c,-13,-2,39,9,65);polygon(c,[[-20,-25],[15,-9],[15,18],[-20,1]],'#71573b','#c2b291');line(c,-5,-18,-5,8,'#40392a',3);flag(c,-23,-65,team);}
  }else if(['tower','fortress','capital','outpost'].includes(type)){
   if(type==='capital'||type==='outpost'){
    box(c,-9,-12,85,60,48);roof(c,-12,-62,89,65,38);box(c,-48,-6,32,32,82);roof(c,-50,-89,36,35,25,'#576d77');
    polygon(c,[[-48,-43],[-25,-32],[-25,5],[-48,-6]],'#5d4c34','#c6b99a');line(c,-38,-39,-38,-4,'#2a2c24',2);
    polygon(c,[[11,-14],[30,-4],[30,10],[11,0]],team,'#5e6153');flag(c,31,-98,team);
   }else{
    const h=type==='tower'?95:110;box(c,-18,-12,type==='tower'?50:110,type==='tower'?42:92,h);
    for(let i=0;i<4;i++){box(c,-18+i*(type==='tower'?13:28),-12+i*(type==='tower'?6.5:14),8,10,h+11);}
    for(let i=0;i<4;i++)line(c,-42+i*3,20-i*23,25,48-i*23,'#897f68',1);
    polygon(c,[[-20,-15],[-6,-8],[-6,19],[-20,12]],'#514c3b');flag(c,5,-h+2,team);
    if(type==='fortress'){box(c,47,17,35,35,130);roof(c,44,-113,41,41,22,'#566d7d');}
   }
  }else{
   const h=type==='house'?34:45;box(c,-15,-10,w*.95,d*.75,h,'#d6c6a2','#af9f81','#e2d0ac');
   roof(c,-18,-h-10,w*.98,d*.78,32,type==='smithy'?'#536568':type==='stable'?'#766846':'#89563c');
   for(let i=0;i<3;i++)line(c,-35+i*22,5+i*11,-35+i*22,5+i*11-h,'#6a5037',3);
   polygon(c,[[-27,-15],[-13,-8],[-13,5],[-27,-2]],'#66533a');polygon(c,[[15,-16],[28,-10],[28,1],[15,-5]],team,'#6a6b54');
   if(type==='house'){line(c,-5,-20,-5,-1,'#705639',3);box(c,14,-41,12,12,40,'#817d68','#6a6859');}
   if(type==='barracks'||type==='range'){flag(c,-28,-70,team);line(c,44,14,44,-22,'#664a2e',4);ellipse(c,44,-14,10,14,'#aa8b53');ellipse(c,44,-14,4,6,team);}
   if(type==='storage'||type==='market'){for(let i=0;i<3;i++){ellipse(c,30+i*16,20+i*5,9,5,'#9b7744');c.fillStyle='#8e6b3d';c.fillRect(21+i*16,7+i*5,18,13);ellipse(c,30+i*16,7+i*5,9,5,'#c0a26c');}if(type==='market')polygon(c,[[-58,-11],[-19,-26],[16,-8],[-23,7]],team,'#e2caa2');}
   if(type==='smithy'){box(c,27,6,20,20,23,'#6e7270','#4c5351');ellipse(c,14,18,9,5,'#d5a75b');line(c,45,-29,45,-65,'#787869',12);ellipse(c,45,-75,10,7,'#b8b4a34a');}
   if(type==='workshop'){line(c,-45,18,20,48,'#5b4932',8);for(let i=0;i<3;i++)ellipse(c,-35+i*25,27+i*9,10,12,'#584a35');}
   if(type==='stable'){line(c,-42,12,-1,33,'#6f5538',3);for(let i=0;i<4;i++)line(c,-40+i*13,12+i*6,-40+i*13,0+i*6,'#6f5538',3);}
  }
 }else if(type==='wood'){pine(c,-12,-2,.9);pine(c,17,3,1.05);}
 else if(type==='gold'||type==='stone'){
  ellipse(c,0,3,34,11,'#233b2a44');for(const[x,y,w]of [[-20,0,21],[5,5,25],[21,-5,16],[-3,-10,18]]){polygon(c,[[x-w,y],[x-w*.4,y-w],[x+w*.5,y-w*.8],[x+w,y],[x,y+w*.4]],type==='gold'?'#aaa071':'#8a9388','#546255');polygon(c,[[x-w*.4,y-w],[x+w*.5,y-w*.8],[x,y-w*.3]],type==='gold'?'#d2bd74':'#b2b9a9');}
 }else if(type==='berries'){
  ellipse(c,0,3,32,9,'#233b2a44');for(let i=0;i<5;i++)ellipse(c,(i-2)*12,-14-(i%2)*9,18,18,i%2?'#587a3e':'#355c35');for(let i=0;i<15;i++)ellipse(c,Math.sin(i*2.4)*28,-11-(i%4)*7,3.3,3.5,i%3?'#b63d51':'#d96a62');
 }else if(type==='cow'||type==='alpaca'||type==='fox'){
  const fox=type==='fox',alpaca=type==='alpaca',color=fox?'#bb794b':alpaca?'#d6c7a7':'#a89a7d';ellipse(c,0,3,30,7,'#233b2a44');ellipse(c,-3,-21,24,fox?9:14,color);for(const x of [-20,12])line(c,x,-17,x-1,0,'#6e5a43',fox?3:5);line(c,14,-24,17,alpaca?-55:-34,color,fox?6:10);ellipse(c,22,alpaca?-54:-33,fox?10:12,fox?5:8,color);for(const x of [17,24])line(c,x,alpaca?-59:-40,x-2,alpaca?-69:-48,color,3);if(fox){line(c,-23,-22,-36,-29,color,9);line(c,-36,-29,-42,-23,'#ddd0b1',7);}
 }else if(type==='deer'){
  ellipse(c,0,2,20,5,'#31452955');ellipse(c,-3,-18,16,8,'#9b784f');for(const x of [-14,9])line(c,x,-13,x-2,0,'#765b3c',3);line(c,9,-20,14,-39,'#af8c5b',6);ellipse(c,18,-39,8,4,'#ae8957');line(c,16,-43,13,-54,'#725337',2);line(c,14,-48,8,-52,'#725337',2);line(c,18,-44,23,-54,'#725337',2);
 }else if(type==='cavalry'||type==='heavyCavalry'||type==='scout'){
  ellipse(c,0,2,23,7,'#263a2e55');ellipse(c,-1,-22,23,10,type==='scout'?'#ae9a79':'#77644f');for(const x of [-16,14]){line(c,x,-17,x-4,0,'#675340',5);line(c,x+3,-17,x+7,-1,'#675340',4);}line(c,15,-23,20,-40,'#806b53',9);ellipse(c,27,-41,11,5,'#998466');polygon(c,[[22,-43],[19,-51],[26,-45]],'#5c4c3d');polygon(c,[[-12,-26],[12,-26],[10,-10],[-13,-13]],team);person(c,-4,-30,team,type==='scout'?'swordsman':'spearman');
 }else if(type==='ram'||type==='trebuchet'){
  ellipse(c,0,3,39,10,'#263a2e55');box(c,-19,-8,65,25,19,'#8b6f43','#665236','#ac8c57');for(const x of [-27,8,33])ellipse(c,x,6,8,10,'#584c35');
  if(type==='ram'){line(c,-28,-23,38,-5,'#b09c6c',10);polygon(c,[[-25,-38],[22,-32],[48,-10],[-1,-16]],team,'#5d4d30');}
  else{line(c,-18,-7,0,-63,'#b49761',7);line(c,25,9,0,-63,'#93723f',7);line(c,-27,-52,42,-81,'#b9a371',7);line(c,40,-79,45,-44,'#ded0a6',1);ellipse(c,45,-42,8,6,'#706d5b');}
 }else if(type==='zombie'){person(c,0,0,'#46503d',type);ellipse(c,0,-41,6,7,'#91a779');line(c,-8,-28,-22,-35,'#91a779',4);line(c,8,-28,22,-35,'#91a779',4);ellipse(c,-2,-43,1,1,'#e4df91');ellipse(c,2,-43,1,1,'#e4df91');}else person(c,0,0,team,type);
 return canvas;
}
export function entityImage(type:Entity['type'],owner=0):string{const key=`${type}:${owner}`;if(!images.has(key))images.set(key,paintEntity(type,owner).toDataURL());return images.get(key)!;}
