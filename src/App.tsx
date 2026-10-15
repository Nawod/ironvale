import {useCallback,useEffect,useMemo,useRef,useState} from 'react';

import {ArrowUp,Castle,ChevronDown,ChevronRight,Flag,HelpCircle,Home,Leaf,Map,Move,Pause,Play,Shield,Swords,TreePine,Users,Wheat,Mountain,Coins,Save,Volume2,X,RotateCcw,Hammer,Target,Search,Settings,Hand,ArrowRightLeft,Footprints,Trash2,Skull} from 'lucide-react';

import {BattlefieldView,type ViewHandle} from './ui/BattlefieldView';

import {Minimap} from './ui/Minimap';
import {VoicePanel} from './ui/VoicePanel';
import {WorkerTasks} from './ui/WorkerTasks';

import {entityImage} from './render/art';

import {createGame,spawn} from './sim/world';

import {snapshot as makeSnapshot,updateVisibility} from './sim/visibility';

import {AGE_NAMES,BUILDINGS,UNITS,COLORS,wallUpgrade} from './sim/definitions';

import type {BuildingType,Command,Difficulty,Entity,Position,Resource,Snapshot,MatchConfig} from './sim/types';

import {readSave,writeSave} from './storage';

import {Soundscape} from './audio';

import {LocalSession,type Session} from './net/session';

import {OnlineSession,type OnlineState} from './net/online';

import {OnlineLobby} from './ui/OnlineLobby';

import {allied,hostile} from './sim/teams';

import {environmentAt,timeLabel} from './sim/environment';

const RESOURCE_ICONS={food:Wheat,wood:TreePine,stone:Mountain,gold:Coins};

const DIFFICULTY_DESCRIPTIONS:Record<Difficulty,string>={easy:'More time to settle. Slower decisions and larger armies before an attack.',normal:'A steady challenge. Rivals develop their settlements and press their advantage.',hard:'Faster decisions and sustained pressure. Keep your economy and defenses ready.'};

const WILDERNESS_NAMES:Record<string,string>={wood:'Woodland',deer:'Wild deer',cow:'Grazing cattle',alpaca:'Alpacas',fox:'Wild foxes',boar:'Wild boar',sheep:'Grazing sheep',rabbit:'Wild rabbits',berries:'Berry bushes',food:'Wild food',stone:'Stone deposit',gold:'Gold deposit'};

const tutorialSteps=[{title:'A home for your people',text:'Select your town center and recruit a villager. New workers are the foundation of your empire.',test:(s:Snapshot)=>s.population>7},{title:'From the land',text:'Select villagers, choose Gather, then tap trees, animals, berry bushes, or a deposit. They carry each load back to storage.',test:(s:Snapshot)=>s.entities.some(e=>e.owner===s.playerId&&e.order.kind==='gather')},{title:'Make room to grow',text:'Select a villager, choose House, and place it on clear land. Housing increases your population capacity.',test:(s:Snapshot)=>s.entities.some(e=>e.owner===s.playerId&&e.type==='house'&&e.progress===1)},{title:'Put down roots',text:'Build a storehouse, a farm, and a barracks. Farms provide food and are replanted for wood.',test:(s:Snapshot)=>['storage','farm','barracks'].every(t=>s.entities.some(e=>e.owner===s.playerId&&e.type===t&&e.progress===1))},{title:'Beyond the settlement',text:'Save 400 food and 150 gold. Select your town center and advance to Town to unlock archers, cavalry, and stone defenses.',test:(s:Snapshot)=>s.players[s.playerId].age>=2},{title:'Claim the realm',text:'Scout your enemies. Train an army, break their capital, then hold soldiers near its ruins for 30 seconds. Defeat every rival to win.',test:(s:Snapshot)=>s.winner===s.playerId}];

function costText(cost:Partial<Record<Resource,number>>):string{return Object.entries(cost).map(([r,n])=>`${n} ${r}`).join(' · ');}

function buildingName(e:Entity):string{return e.type==='wall'&&e.wallTier===3?'Reinforced stone wall':BUILDINGS[e.type as BuildingType].name;}

function ResourceCost({cost}:{cost:Partial<Record<Resource,number>>}){return <span className="cost">{Object.entries(cost).map(([r,n])=>{const Icon=RESOURCE_ICONS[r as Resource];return <span key={r} title={r}><Icon size={14}/><span className="sr-only">{r} </span>{n}</span>;})}</span>;}

function Emblem(){return <svg viewBox="0 0 56 64" className="emblem" aria-hidden="true"><path d="M5 7L28 2l23 5v30c0 13-23 25-23 25S5 50 5 37Z" fill="#2e463a" stroke="#c5af77" strokeWidth="2"/><path d="M15 39V24h7v-8h12v8h7v15H15Zm7 0v-9h12v9M18 19v-5m20 5v-5" fill="none" stroke="#e9dab1" strokeWidth="3"/><path d="m17 47 11 6 11-6" fill="none" stroke="#c5af77" strokeWidth="1.5"/></svg>;}

export default function App(){

 const [screen,setScreen]=useState<'menu'|'game'>('menu'),[s,setSnapshot]=useState<Snapshot>(),[opponents,setOpponents]=useState<MatchConfig['opponents']>(1),[difficulty,setDifficulty]=useState<Difficulty>('normal'),[tutorial,setTutorial]=useState(false),[zombies,setZombies]=useState(false),[removeConfirmation,setRemoveConfirmation]=useState<number>(),[seed,setSeed]=useState('Ironvale'),[selection,setSelection]=useState<number[]>([]),[mode,setMode]=useState(''),[placement,setPlacement]=useState<BuildingType>(),[toast,setToast]=useState(''),[settings,setSettings]=useState(false),[help,setHelp]=useState(false),[tutorialIndex,setTutorialIndex]=useState(0),[collapsed,setCollapsed]=useState(false),[saves,setSaves]=useState<{manual?:string;auto?:string}>({}),[music,setMusic]=useState(.3),[effects,setEffects]=useState(.65),[tradeSell,setTradeSell]=useState<Resource>('wood'),[tradeBuy,setTradeBuy]=useState<Resource>('gold');

 const [interfaceSize,setInterfaceSize]=useState<'readable'|'large'>(()=>{try{return localStorage.getItem('ironvale-interface-size')==='large'?'large':'readable';}catch{return'readable';}});

 useEffect(()=>{try{localStorage.setItem('ironvale-interface-size',interfaceSize);}catch{/* The current preference still works when browser storage is unavailable. */}},[interfaceSize]);

 useEffect(()=>setRemoveConfirmation(undefined),[selection]);
 const pid=s?.playerId??0;

 const environment=s?environmentAt(s.tick,s.config.seed):undefined;

 const [onlineState,setOnlineState]=useState<OnlineState>({status:'idle'}),[onlineOpen,setOnlineOpen]=useState(false),[isOnline,setIsOnline]=useState(false),[gameMenu,setGameMenu]=useState(false);

 const localSession=useRef<LocalSession|undefined>(undefined),onlineSession=useRef<OnlineSession|undefined>(undefined),onlineActive=useRef(false);

 const worker=useRef<Session|undefined>(undefined),view=useRef<ViewHandle|undefined>(undefined),audio=useRef<Soundscape|undefined>(undefined),groups=useRef<Record<string,number[]>>({}),latest=useRef({s,selection,mode,placement,gameMenu}),pending=useRef<Command|undefined>(undefined),lastEvent=useRef(0),toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);latest.current={s,selection,mode,placement,gameMenu};

 const notify=useCallback((text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5000);},[]);

 const refreshSaves=useCallback(async()=>{try{const [manual,auto]=await Promise.all([readSave('manual'),readSave('auto')]);setSaves({manual:manual?.date,auto:auto?.date});}catch{/* Show storage failures only when a save action is requested. */}},[]);

 const pauseMatch=useCallback((paused:boolean)=>{if(onlineActive.current)setGameMenu(paused);else worker.current?.postMessage({type:'pause',paused});},[]);

 const leaveOnline=()=>{onlineSession.current?.leave();onlineActive.current=false;setIsOnline(false);setGameMenu(false);worker.current=localSession.current;setScreen('menu');};

 useEffect(()=>{audio.current=new Soundscape();const w=new LocalSession(),network=new OnlineSession();localSession.current=w;onlineSession.current=network;worker.current=w;

  const receive=async(e:{data:any})=>{const m=e.data;if(m.type==='snapshot'){setSnapshot(m.snapshot);for(const ev of m.snapshot.events){if(ev.id>lastEvent.current){if(ev.kind==='attack'||ev.kind==='capture')audio.current?.play(ev.kind);if(ev.kind==='complete')audio.current?.play('complete');lastEvent.current=Math.max(lastEvent.current,ev.id);}}}

   else if(m.type==='commandResult'){if(m.error)notify(m.error);else{audio.current?.play('order');if(pending.current?.type!=='build'||!['wall','palisade'].includes(pending.current.building)){setPlacement(undefined);setMode('');}}}

   else if(m.type==='save'){try{await writeSave(m.slot,m.text);if(m.slot==='manual')notify('Match saved in this browser.');void refreshSaves();}catch(error){notify(error instanceof Error?error.message:'The match could not be saved.');}}

   else if(m.type==='error')notify(m.error);

  };w.onmessage=e=>{if(!onlineActive.current)void receive(e);};network.onmessage=e=>{if(onlineActive.current||e.data.type==='error')void receive(e);};network.onUpdate=setOnlineState;network.onStart=()=>{w.postMessage({type:'pause',paused:true});onlineActive.current=true;setIsOnline(true);worker.current=network;setSnapshot(undefined);setSelection([]);setMode('');setPlacement(undefined);setGameMenu(false);setSettings(false);setTutorial(false);setOnlineOpen(false);setScreen('game');lastEvent.current=0;};network.restore();if(new URLSearchParams(location.search).has('room'))setOnlineOpen(true);void refreshSaves();

  const unlockSound=()=>{void audio.current?.unlock();};document.addEventListener('pointerdown',unlockSound,{capture:true});document.addEventListener('pointerup',unlockSound,{capture:true});document.addEventListener('keydown',unlockSound,{capture:true});

  const hidden=()=>{if(document.hidden&&!onlineActive.current)w.postMessage({type:'pause',paused:true});};document.addEventListener('visibilitychange',hidden);

  return()=>{document.removeEventListener('pointerdown',unlockSound,{capture:true});document.removeEventListener('pointerup',unlockSound,{capture:true});document.removeEventListener('keydown',unlockSound,{capture:true});w.terminate();network.terminate();audio.current?.destroy();document.removeEventListener('visibilitychange',hidden);if(toastTimer.current)clearTimeout(toastTimer.current);};

 },[notify,refreshSaves]);

 const issue=useCallback((c:Omit<Command,'player'>|any)=>{const full={...c,player:latest.current.s?.playerId??0} as Command;pending.current=full;worker.current?.postMessage({type:'command',command:full});audio.current?.unlock();},[]);

 const select=useCallback((ids:number[],append=false)=>{setSelection(previous=>append?[...new Set([...previous,...ids])]:ids);setPlacement(undefined);setMode('');audio.current?.play('click');},[]);

 const center=useCallback((p:Position)=>view.current?.center(p),[]);

 const action=useCallback((point:Position,target?:Entity)=>{const current=latest.current;if(!current.s)return;const units=current.selection.map(id=>current.s!.entities.find(e=>e.id===id)).filter((e):e is Entity=>!!e&&e.owner===pid&&e.kind==='unit');

  if(current.mode==='relocate'){const building=current.s.entities.find(e=>e.id===current.selection[0]);if(building)issue({type:'moveBuilding',building:building.id,point:{x:Math.floor(point.x),y:Math.floor(point.y)}});return;}

  if(current.placement){issue({type:'build',building:current.placement,point,workers:units.filter(e=>e.type==='villager').map(e=>e.id)});return;}

  if(!units.length){notify('Select villagers or soldiers to issue orders.');return;}

  let kind=current.mode;

  if(!kind){kind=target?.owner===pid&&target.kind==='building'&&target.progress<1?'build':target?.owner===pid&&target.kind==='building'&&target.hp>0&&target.hp<target.maxHp?'repair':target?.kind==='resource'||target?.type==='farm'&&target.owner===pid?'gather':target&&hostile(current.s,pid,target.owner)&&target.hp>0?'attack':'move';}

  if(['gather','repair','build','attack','garrison'].includes(kind)&&!target){notify('Choose a target on the battlefield.');return;}

  if(kind==='attack'&&target&&allied(current.s,pid,target.owner)){notify('Choose an enemy unit or building.');return;}

  issue({type:'order',ids:units.map(e=>e.id),order:{kind,target:['gather','repair','build','attack','garrison'].includes(kind)?target?.id:undefined,point:['move','attackMove','patrol'].includes(kind)?point:undefined}});

 },[issue,notify,pid]);

 useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(screen!=='game'||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;

  const current=latest.current;if(e.key==='Escape'){if(current.mode||current.placement){setMode('');setPlacement(undefined);}else pauseMatch(onlineActive.current?!current.gameMenu:!current.s?.paused);}

  if(e.code==='Space'){e.preventDefault();pauseMatch(onlineActive.current?!current.gameMenu:!current.s?.paused);}

  if(e.code==='KeyH'){const cap=current.s?.entities.find(v=>v.id===current.s?.players[current.s.playerId].capital);if(cap){select([cap.id]);center(cap);}}

  if(e.code==='KeyA')setMode('attackMove');if(e.code==='KeyM')setMode('move');if(e.code==='KeyP')setMode('patrol');if(e.code==='KeyS')issue({type:'order',ids:current.selection,order:{kind:'idle'}});

  if(/^[1-9]$/.test(e.key)){if(e.ctrlKey){e.preventDefault();groups.current[e.key]=current.selection;}else select(groups.current[e.key]??[]);}

 };window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[screen,center,issue,select,pauseMatch]);

 useEffect(()=>{if(tutorial&&s&&tutorialIndex<tutorialSteps.length-1&&tutorialSteps[tutorialIndex].test(s))setTutorialIndex(i=>i+1);},[s,tutorial,tutorialIndex]);

 const preview=useMemo(()=>{const g=createGame({opponents:1,difficulty:'normal',seed:918});for(const[type,x,y]of [['house',23,23],['house',15,24],['storage',23,16],['barracks',14,14],['farm',25,26],['farm',28,29],['tower',12,21],['stable',20,27],['wall',12,18],['wall',12,19],['wall',12,20]]as [BuildingType,number,number][])spawn(g,'building',type,0,{x,y});for(let j=0;j<8;j++)spawn(g,'unit','spearman',0,{x:28+j*.5,y:22+j*.3});updateVisibility(g);return makeSnapshot(g);},[]);

 const start=()=>{onlineActive.current=false;setIsOnline(false);setGameMenu(false);worker.current=localSession.current;audio.current?.unlock();let hash=2166136261;for(const ch of seed)hash=Math.imul(hash^ch.charCodeAt(0),16777619);setSelection([]);setMode('');setPlacement(undefined);lastEvent.current=0;setTutorialIndex(0);worker.current?.postMessage({type:'start',config:{opponents,difficulty,seed:hash>>>0,tutorial,zombies}});setScreen('game');};

 const load=async(slot:'manual'|'auto')=>{audio.current?.unlock();try{const saved=await readSave(slot);if(!saved){notify('There is no saved match in this slot.');return;}onlineActive.current=false;setIsOnline(false);worker.current=localSession.current;worker.current?.postMessage({type:'load',text:saved.text});setSelection([]);setMode('');setPlacement(undefined);setScreen('game');setTutorial(false);notify('Match loaded. Resume when you are ready.');}catch(error){notify(error instanceof Error?error.message:'The match could not be loaded.');}};

 const selected=s?.entities.filter(e=>selection.includes(e.id))??[],primary=selected[0],own=selected.filter(e=>e.owner===pid),units=own.filter(e=>e.kind==='unit'),workers=units.filter(e=>e.type==='villager'),soldiers=units.filter(e=>e.type!=='villager');
 const nextWall=primary?wallUpgrade(primary):undefined;

 const selectCapital=()=>{const cap=s?.entities.find(e=>e.id===s.players[pid].capital);if(cap){select([cap.id]);center(cap);}};

 const selectIdle=()=>{const ids=s?.entities.filter(e=>e.owner===pid&&e.type==='villager'&&e.order.kind==='idle').map(e=>e.id)??[];select(ids);const w=s?.entities.find(e=>e.id===ids[0]);if(w)center(w);if(!ids.length)notify('Every villager has a task.');};

 const hooks={select,action,cancel:()=>{setMode('');setPlacement(undefined);},error:notify};

 const helpContent=<><h2>Your first empire</h2><p>Recruit villagers at the town center. Send them to trees, animals, berry bushes, and deposits. They carry resources home before you can spend them.</p><p>Select villagers to build houses, farms, storage, and barracks. Select a completed military building to train troops. Build the required buildings and advance at your capital.</p><p>Scout through the fog, break an enemy capital, then occupy its ruins with soldiers for 30 seconds. Rival troops contest occupation. The last empire standing wins.</p><p>One world day takes 24 minutes of match time. Dawn, daylight, dusk, and night follow the shared world clock. Rain slightly slows movement. The match timer counts how long you have played.</p><dl><dt>Desktop</dt><dd>Drag to select · Right-click to order · Middle mouse drag or arrows to pan · Ctrl + mouse drag to rotate · Wheel to zoom · Q / E or camera buttons to rotate · Diamond button to reset view · H for home · A for attack-move · S to stop · Space to pause · Ctrl+1–9 to save groups; 1–9 to select.</dd><dt>Touch</dt><dd>Tap to select · Drag to pan · Hold then drag to select a group · Two fingers: pinch to zoom, twist to rotate · Use camera buttons to rotate/reset · Choose a command, then tap its target · Use Select all army or Idle villagers for groups.</dd><dt>Building management</dt><dd>Select an owned building to move it onto clear, scouted land or remove it permanently without a refund. Town centers stay fixed. Finish its queue and empty its garrison first. Clear nearby enemies and wait 10 seconds after damage.</dd><dt>Zombie mode</dt><dd>Enable it before starting a solo or online match. Zombies attack every city from 18:00 to 06:00, ignore teams, and retreat to the forest at dawn. The normal conquest objective still applies.</dd><dt>Defenses</dt><dd>Wooden walls are available from town hall level 1. Select a wall to upgrade it to stone at level 2, then reinforced stone at level 3. Upgrades cost resources and preserve damage. Gates admit your troops. Select soldiers, choose Garrison, and tap a tower or fortress.</dd></dl></>;

 return <main className={screen==='menu'?'app menu-screen':'app game-screen'} data-interface-size={interfaceSize}>

  {screen==='menu'?<>

   <BattlefieldView snapshot={preview} hooks={hooks} interactive={false}/><div className="menu-shade"/>

   <header className="menu-identity"><div className="brand"><Emblem/><span>Ironvale</span></div><span>Build a people. Claim a realm.</span></header>

   <section className="menu-panel" aria-label="Campaign setup"><h1>An empire<br/>of your own.</h1><p className="intro">Raise a city from the wilderness.<br/>Stand your ground. Claim the realm.</p>

    <div className="main-actions"><button className="begin" aria-label="Begin your reign" onClick={start}><span>Begin your reign<small>Single-player conquest</small></span><ChevronRight size={22}/></button><button className="online-entry" aria-label="Play with Freinds" onClick={()=>setOnlineOpen(true)}><Users size={22}/><span>Play with friends<small>Online conquest · 2–8 players</small></span><ChevronRight size={20}/></button></div>

    <div className="match-options"><div className="option-label"><Swords size={16}/><span>Your opposition</span><select aria-label="Computer rivals" className="rival-count" value={opponents} onChange={e=>setOpponents(+e.target.value as MatchConfig['opponents'])}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} {n===1?'rival':'rivals'}</option>)}</select></div><div className="segmented"><button className={opponents===1?'active':''} onClick={()=>setOpponents(1)}>One rival<span>A duel of empires</span></button><button className={opponents===3?'active':''} onClick={()=>setOpponents(3)}>Three rivals<span>Every empire for itself</span></button></div>

     <div className="setup-row"><label>Difficulty<select aria-label="Difficulty" aria-describedby="difficulty-description" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label><label>Map seed<input value={seed} onChange={e=>setSeed(e.target.value)} maxLength={40} aria-label="Map seed"/></label></div>

     <p className="difficulty-description" id="difficulty-description">{DIFFICULTY_DESCRIPTIONS[difficulty]}</p><p className="fair-play"><Shield size={18}/><span>Same resources, costs, and training times as you. Difficulty changes reaction and attack pressure.</span></p>

     <button className={'tutorial-toggle '+(zombies?'enabled':'')} aria-label="Zombie mode" aria-pressed={zombies} onClick={()=>setZombies(!zombies)}><span className="checkbox">{zombies?'✓':''}</span><span>Zombie mode<small>Night raids on every city · retreat at dawn</small></span></button>

     <button className={'tutorial-toggle '+(tutorial?'enabled':'')} aria-pressed={tutorial} onClick={()=>setTutorial(!tutorial)}><span className="checkbox">{tutorial?'✓':''}</span><span>Learn as you play<small>A guided first settlement</small></span></button>

    </div>

    {(saves.manual||saves.auto)&&<div className="continue-row">{saves.manual&&<button onClick={()=>void load('manual')}><Save size={14}/>Load saved match</button>}{saves.auto&&<button onClick={()=>void load('auto')}>Load autosave</button>}</div>}

    <div className="menu-footer"><button onClick={()=>setHelp(true)}><HelpCircle size={18}/>How to play</button><button onClick={()=>setSettings(true)}><Settings size={18}/>Settings</button></div>

   </section><div className="scene-caption"><span className="small-rule"/><p>From a settlement<br/>to a sovereign realm.</p><small>Gather. Build. Defend. Conquer.</small></div>

  </>:s?<>

   <BattlefieldView snapshot={s} selection={selection} placement={placement} movingBuilding={mode==='relocate'?selection[0]:undefined} mode={mode} hooks={hooks} viewRef={view}/>

   <header className="hud"><button className="hud-brand" onClick={selectCapital} aria-label="Town center"><Emblem/><span>Ironvale</span></button><div className="resources">{Object.entries(s.players[pid].resources).map(([r,n])=>{const Icon=RESOURCE_ICONS[r as Resource];return <div className={'resource '+r} key={r} title={r}><Icon size={20}/><span>{Math.floor(n)}</span><small>{r}</small></div>;})}<div className="resource population" data-testid="population"><Users size={20}/><span>{s.population} / {s.capacity}</span><small>population</small></div></div><div className="hud-tools">{!isOnline&&<button title="Save match" aria-label="Save match" onClick={()=>worker.current?.postMessage({type:'save'})}><Save size={19}/></button>}<button aria-label="Settings" onClick={()=>{setSettings(true);pauseMatch(true);}}><Settings size={19}/></button><button aria-label="Pause match" onClick={()=>pauseMatch(true)}><Pause size={19}/></button></div></header>

   <div className="realm-strip"><span><Castle size={14}/>{AGE_NAMES[s.players[pid].age]}</span><div className="rivals" data-testid="empire-count"><span>{s.players.filter(p=>p.alive).length} empires</span>{s.players.map(p=><i key={p.id} title={`${p.name}${p.team!==undefined?` / Team ${p.team+1}`:''}${p.alive?'':' / conquered'}`} className={!p.alive?'fallen':''} style={{background:COLORS[p.id%COLORS.length]}}/>)}</div>{isOnline&&<span className="online-game-tag">Online  |  {s.players[pid].name}{s.players[pid].team!==undefined?`  |  Team ${s.players[pid].team!+1}`:''}</span>}<span className="world-weather" data-testid="world-weather" title="One world day takes 24 minutes. Rain slightly slows movement. Open Help for world clock details.">{environment&&`Day ${environment.day}  |  ${timeLabel(environment)}  |  ${environment.weather}`}</span>{s.config.zombies&&<span className="zombie-phase" data-testid="zombie-phase" title="Zombies raid every city between 18:00 and 06:00, then return to the forest."><Skull size={15}/>{environment&&(environment.hour>=18||environment.hour<6)?'Night raid':'Zombies in forest'}</span>}<span className="clock" title="Elapsed match time">{Math.floor(s.tick/1200)}:{String(Math.floor(s.tick/20)%60).padStart(2,'0')}</span></div>

   {tutorial&&!s.paused&&<aside className="tutorial"><div><span className="tutorial-step">{tutorialIndex+1}/{tutorialSteps.length}</span><strong>{tutorialSteps[tutorialIndex].title}</strong><button aria-label="Close tutorial" onClick={()=>setTutorial(false)}><X size={15}/></button></div><p>{tutorialSteps[tutorialIndex].text}</p><button className="text-button" onClick={()=>setTutorialIndex(i=>Math.min(i+1,tutorialSteps.length-1))}>Next tip<ChevronRight size={13}/></button></aside>}

   <div className="quick-tools"><button aria-label="Idle villagers" title="Select idle villagers" onClick={selectIdle}><Users size={18}/><span>{s.entities.filter(e=>e.owner===pid&&e.type==='villager'&&e.order.kind==='idle').length}</span></button><button aria-label="Select all army" title="Select your army" onClick={()=>select(s.entities.filter(e=>e.owner===pid&&e.kind==='unit'&&e.type!=='villager').map(e=>e.id))}><Swords size={18}/><span>All</span></button><button aria-label="Help" onClick={()=>setHelp(true)}><HelpCircle size={18}/></button></div>

   {isOnline&&onlineState.room&&onlineSession.current&&<VoicePanel voice={onlineSession.current.voice} room={onlineState.room} floating/>}
   <div className="event-feed">{s.events.filter(e=>e.kind==='attack'||e.kind==='capture').slice(-2).map(e=><button key={e.id} onClick={()=>e.x!==undefined&&center({x:e.x,y:e.y!})}><Flag size={13}/>{e.text}</button>)}</div>

   {(mode||placement)&&<div className="order-banner"><Hand size={15}/>{mode==='relocate'?'Move building onto clear, scouted land':placement?`Place ${BUILDINGS[placement].name} on clear land`:`Choose where to ${mode==='attackMove'?'attack-move':mode}`}<button onClick={()=>{setMode('');setPlacement(undefined);}}>Cancel<X size={14}/></button></div>}

   <section className={'command-deck '+(collapsed?'collapsed':'')}><Minimap snapshot={s} center={center}/><div className="selection-panel">

    {primary?<><img src={entityImage(primary.type,primary.owner)} alt=""/><div><small>{primary.type==='zombie'?'The undead':primary.owner>=0?s.players[primary.owner].name:'The wilderness'}</small><h2>{selected.length>1?`${selected.length} units`:primary.kind==='building'?buildingName(primary):primary.kind==='unit'?UNITS[primary.type as keyof typeof UNITS].name:WILDERNESS_NAMES[primary.type]??primary.type[0].toUpperCase()+primary.type.slice(1)}</h2><p>{selected.length>1?`${workers.length} villagers · ${soldiers.length} soldiers`:primary.kind==='resource'?`${Math.ceil(primary.amount)} remaining`:primary.kind==='unit'?`${Math.ceil(primary.hp)} / ${primary.maxHp} health · ${primary.order.kind==='idle'?'Ready':primary.order.kind==='attackMove'?'Advancing':primary.order.kind==='gather'?'Gathering':primary.order.kind==='build'?'Building':primary.order.kind==='repair'?'Repairing':'On task'}`:primary.hp<=0?'Capital fallen':primary.progress<1?`Building ${Math.floor(primary.progress*100)}%`:`${Math.ceil(primary.hp)} / ${primary.maxHp} health`}</p>{primary.ghost&&<small>Last seen location</small>}</div></>:<div className="empty-selection"><Search size={22}/><h2>Your orders, commander.</h2><p>Select a building or unit to begin.</p></div>}

    <button className="collapse-button" aria-label={collapsed?'Expand commands':'Collapse commands'} onClick={()=>setCollapsed(!collapsed)}><ChevronDown size={18}/></button>

   </div><div className="actions-panel">

    {primary?.kind==='building'&&primary.owner===pid&&primary.progress===1&&primary.hp>0?<>

     <div className="action-heading">{BUILDINGS[primary.type as BuildingType].trains?.length?'Recruitment':'City management'}<span>{primary.queue.length?`${primary.queue.length} queued`:'Ready'}</span></div>

     <div className="action-buttons">{BUILDINGS[primary.type as BuildingType].trains?.map(u=><button key={u} className="asset-button" aria-label={`Recruit ${UNITS[u].name}`} title={`${UNITS[u].name}: ${costText(UNITS[u].cost)} · ${UNITS[u].seconds}s training`} disabled={s.players[pid].age<UNITS[u].age} onClick={()=>issue({type:'recruit',building:primary.id,unit:u})}><img src={entityImage(u,pid)} alt=""/><span>{UNITS[u].name}<ResourceCost cost={UNITS[u].cost}/><small className="duration">{UNITS[u].seconds}s training</small></span></button>)}

      {primary.id===s.players[pid].capital&&s.players[pid].age<3&&<button className="research-button" onClick={()=>issue({type:'research',building:primary.id,research:'age'})}><ArrowUp size={22}/><span>Advance to {AGE_NAMES[s.players[pid].age+1]}<small>{s.players[pid].age===1?'400 food · 150 gold':'700 food · 350 gold · 150 stone'}</small></span></button>}

      {primary.type==='smithy'&&(['weapons','armor']as const).map(r=><button key={r} onClick={()=>issue({type:'research',building:primary.id,research:r})}>{r==='weapons'?<Swords size={21}/>:<Shield size={21}/>}<span>Upgrade {r}<small>Level {s.players[pid][r]+1} · {100*(s.players[pid][r]+1)} food, {80*(s.players[pid][r]+1)} gold</small></span></button>)}

      {nextWall&&<button className="asset-button wall-upgrade" aria-label={`Upgrade to ${nextWall.name}`} disabled={s.players[pid].age<nextWall.age||primary.queue.length>0||Object.entries(nextWall.cost).some(([resource,amount])=>s.players[pid].resources[resource as Resource]<amount!)} onClick={()=>issue({type:'upgradeWall',building:primary.id})}><Shield size={24}/><span>Upgrade to {nextWall.name}<ResourceCost cost={nextWall.cost}/><small className="duration">{nextWall.seconds}s upgrade</small></span></button>}

      {nextWall&&s.players[pid].age<nextWall.age&&<p className="wall-guidance">Requires town hall level {nextWall.age}</p>}
      {primary.type==='wall'&&primary.wallTier===3&&<p className="wall-guidance">Maximum wall strength</p>}

      {!!primary.garrison.length&&<button onClick={()=>issue({type:'ungarrison',building:primary.id})}><Users size={20}/>Release garrison ({primary.garrison.length})</button>}

      {primary.type==='farm'&&<button onClick={()=>{select(s.entities.filter(e=>e.owner===pid&&e.type==='villager'&&e.order.kind==='idle').slice(0,1).map(e=>e.id));setMode('gather');}}><Wheat size={20}/>Assign a farmer</button>}

     </div>{primary.type==='market'&&<div className="trade"><select aria-label="Sell resource" value={tradeSell} onChange={e=>setTradeSell(e.target.value as Resource)}>{Object.keys(RESOURCE_ICONS).map(r=><option key={r}>{r}</option>)}</select><ArrowRightLeft size={16}/><select aria-label="Buy resource" value={tradeBuy} onChange={e=>setTradeBuy(e.target.value as Resource)}>{Object.keys(RESOURCE_ICONS).map(r=><option key={r}>{r}</option>)}</select><button onClick={()=>issue({type:'trade',sell:tradeSell,buy:tradeBuy})}>Exchange 100 for 65</button></div>}

     <div className="queue">{primary.queue.map((q,i)=><div key={i}><span>{q.kind==='unit'?`Training ${UNITS[q.unit!].name}`:q.kind==='age'?'Advancing empire':q.kind==='wall'?`Upgrading to ${nextWall?.name??'wall'}`:`Researching ${q.kind}`}</span><progress aria-label={q.kind==='unit'?`Training ${UNITS[q.unit!].name}`:q.kind==='wall'?'Wall upgrade progress':'Research progress'} max={q.total} value={q.total-q.remaining}/><small>{Math.ceil(q.remaining)}s left</small></div>)}</div>

    </>:units.length?<><div className="action-heading">{workers.length?'Villager tasks':'Army commands'}<span>{units.length} selected</span></div>{!!workers.length&&<WorkerTasks workers={workers} snapshot={s}/>}<div className="order-buttons">{[{key:'move',label:'Move',Icon:Move},{key:'attackMove',label:'Attack-move',Icon:Swords},{key:'patrol',label:'Patrol',Icon:Footprints},{key:'idle',label:'Stop',Icon:Hand},...(workers.length?[{key:'gather',label:'Gather',Icon:Leaf},{key:'repair',label:'Repair',Icon:Hammer}]:[{key:'garrison',label:'Garrison',Icon:Castle}])].map(({key,label,Icon})=><button key={key} className={mode===key?'active':''} onClick={()=>{setPlacement(undefined);if(key==='idle')issue({type:'order',ids:units.map(e=>e.id),order:{kind:'idle'}});else setMode(key);}}><Icon size={17}/>{label}</button>)}{!!soldiers.length&&<select aria-label="Army stance" value={soldiers[0].stance} onChange={e=>issue({type:'stance',ids:soldiers.map(v=>v.id),stance:e.target.value})}><option value="aggressive">Aggressive</option><option value="defensive">Defensive</option><option value="hold">Hold position</option></select>}</div>

     {!!workers.length&&<div className="building-buttons">{Object.entries(BUILDINGS).filter(([t])=>!['capital','outpost'].includes(t)).map(([t,d])=><button key={t} className={'asset-button '+(placement===t?'active':'')} disabled={s.players[pid].age<d.age} title={`${d.name}: ${costText(d.cost)} · ${d.seconds}s construction${s.players[pid].age<d.age?' — unlocks in '+AGE_NAMES[d.age]:''}`} aria-label={`Build ${d.name}`} onClick={()=>{setMode('');setPlacement(t as BuildingType);}}><img src={entityImage(t as BuildingType,pid)} alt=""/><span>{d.name}<ResourceCost cost={d.cost}/><small className="duration">{d.seconds}s construction</small></span></button>)}{s.entities.find(e=>e.id===s.players[pid].capital)?.hp===0&&<button onClick={()=>issue({type:'rebuild',workers:workers.map(e=>e.id)})}><Hammer size={18}/>Rebuild capital</button>}</div>}

    </>:<div className="command-hint"><Map size={24}/><p>Explore the land. Shape its future.</p><small>Resources become an empire through your people.</small></div>}

    {primary?.kind==='building'&&primary.owner===pid&&primary.hp>0&&<div className="building-management">{primary.type==='capital'?<p>Town centers stay fixed to protect the conquest objective.</p>:<><div className="management-buttons"><button aria-label="Move building" disabled={primary.progress!==1||!!primary.queue.length||!!primary.garrison.length} onClick={()=>{setRemoveConfirmation(undefined);setMode('relocate');setPlacement(primary.type as BuildingType);}}><Move size={18}/>Move building</button><button aria-label="Remove building" disabled={!!primary.queue.length||!!primary.garrison.length} onClick={()=>setRemoveConfirmation(primary.id)}><Trash2 size={18}/>Remove building</button></div>{removeConfirmation===primary.id?<div className="remove-confirmation" role="group" aria-label="Confirm building removal"><p>Remove {buildingName(primary)} permanently? Resources are not refunded.</p><button aria-label="Confirm removal" onClick={()=>{issue({type:'removeBuilding',building:primary.id});setRemoveConfirmation(undefined);}}>Confirm removal</button><button onClick={()=>setRemoveConfirmation(undefined)}>Keep building</button></div>:<p>Empty the queue and garrison first. Buildings must be clear of enemies and safe from attacks for 10 seconds. Moving preserves damage and upgrades.</p>}</>}</div>}

   </div></section>

   {((s.paused||gameMenu)&&!settings||!s.players[pid].alive||s.winner!==null)&&<div className="modal-backdrop"><section className="modal pause-modal"><Emblem/><h2>{s.winner!==null&&allied(s,s.winner,pid)?'The realm is yours.':!s.players[pid].alive?'Your empire has fallen.':isOnline?'War council':'The realm can wait'}</h2><p>{s.winner!==null&&allied(s,s.winner,pid)?s.players[pid].team!==undefined?'Your team has conquered every opposing empire.':'Every rival has been conquered. Ironvale flies your banner.':!s.players[pid].alive?'Your capital was occupied. Begin again and forge a stronger empire.':isOnline?'The online match keeps running.':'Your people will be here when you return.'}</p>{s.players[pid].alive&&s.winner===null&&<button className="begin" aria-label="Resume match" onClick={()=>pauseMatch(false)}><Play size={18}/>Resume match</button>}<div className="modal-actions"><button onClick={()=>setSettings(true)}><Settings size={16}/>Settings</button>{!isOnline&&<button onClick={()=>worker.current?.postMessage({type:'save'})}><Save size={16}/>Save match</button>}{!isOnline&&<button onClick={start}><RotateCcw size={16}/>New match</button>}<button onClick={()=>{if(isOnline)leaveOnline();else{pauseMatch(true);setScreen('menu');void refreshSaves();}}}><Home size={16}/>{isOnline?'Leave match':'Main menu'}</button></div></section></div>}

  </>:<div className="loading">Preparing your realm…</div>}

  {isOnline&&(onlineState.status==='reconnecting'||onlineState.error&&!onlineState.room)&&<div className="network-banner" role="status">Connection lost. Reconnecting to your empire |  The match keeps running.</div>}

  {onlineOpen&&<OnlineLobby client={onlineSession.current} state={onlineState} onClose={()=>setOnlineOpen(false)}/>}

  {settings&&<div className="modal-backdrop"><section className="modal"><button className="close" aria-label="Close settings" onClick={()=>setSettings(false)}><X size={20}/></button><h2>Your preferences</h2><label className="interface-setting">Interface text size<select aria-label="Interface text size" value={interfaceSize} onChange={e=>setInterfaceSize(e.target.value as 'readable'|'large')}><option value="readable">Comfortable</option><option value="large">Larger text</option></select></label><p className="setting-description">Changes labels and controls. The battlefield camera stays at your chosen zoom.</p><button onClick={()=>void audio.current?.play('complete')}>Test sound</button><label className="slider"><Volume2 size={18}/>Music<input type="range" min="0" max="1" step=".05" value={music} onChange={e=>{const v=+e.target.value;setMusic(v);audio.current?.setMusic(v);}}/></label><label className="slider">Sound effects<input type="range" min="0" max="1" step=".05" value={effects} onChange={e=>{const v=+e.target.value;setEffects(v);if(audio.current)audio.current.effects=v;}}/></label><p>{isOnline?'The online match keeps running while you use this menu. The server saves your match.':'Matches pause when you leave this tab. Saves stay in this browser on this device.'}</p><button className="begin" onClick={()=>{setSettings(false);if(screen==='game')pauseMatch(false);}}>{screen==='game'?'Return to your empire':'Return to the main menu'}</button></section></div>}

  {help&&<div className="modal-backdrop"><section className="modal help-modal"><button className="close" aria-label="Close help" onClick={()=>setHelp(false)}><X size={20}/></button>{helpContent}</section></div>}

  {toast&&<div className="toast" role="status">{toast}</div>}

 </main>;

}

