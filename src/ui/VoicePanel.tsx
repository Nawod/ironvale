import {useState,useSyncExternalStore} from 'react';
import {ChevronDown,Headphones,LogOut,Mic,MicOff,Volume2,VolumeX} from 'lucide-react';
import type {VoiceChat} from '../net/voice';
import type {RoomView,VoiceChannel} from '../net/protocol';
import './voice.css';

export function VoicePanel({voice,room,floating=false,expanded:controlledExpanded,onExpandedChange}:{voice:VoiceChat;room:RoomView;floating?:boolean;expanded?:boolean;onExpandedChange?:(expanded:boolean)=>void}){
 const state=useSyncExternalStore(voice.subscribe,voice.getSnapshot),[localExpanded,setLocalExpanded]=useState(!floating),[choice,setChoice]=useState<VoiceChannel>('open');
 const expanded=controlledExpanded??localExpanded,setExpanded=(next:boolean)=>{setLocalExpanded(next);onExpandedChange?.(next);};
 const active=state.status!=='idle',channel=active?state.channel:choice,teams=room.mode==='teams';
 const change=(next:VoiceChannel)=>{setChoice(next);if(active)voice.switchChannel(next);};
 return <section className={'voice-panel '+(floating?'voice-floating':'voice-lobby')} aria-label="Voice chat">
  <button className="voice-heading" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><Headphones size={18}/><strong>Voice chat</strong><span>{active?state.muted?'Mic muted':'Mic on':'Off'}</span><ChevronDown size={16}/></button>
  {expanded&&<div className="voice-body">
   {teams?<label>Talk to<select aria-label="Voice channel" value={channel} disabled={state.status==='joining'} onChange={e=>change(e.target.value as VoiceChannel)}><option value="open">Open · everyone</option><option value="team">Team · teammates only</option></select></label>:<p className="voice-audience">Open channel · everyone in this room</p>}
   <p className="voice-description">{teams&&channel==='team'?'Only teammates using Team can hear you.':'Everyone using Open can hear you.'} Joining or switching starts with your microphone muted.</p>
   <div className="voice-controls">{active?<><button aria-label={state.muted?'Unmute microphone':'Mute microphone'} aria-pressed={!state.muted} disabled={state.status!=='joined'} onClick={()=>voice.toggleMute()}>{state.muted?<MicOff size={18}/>:<Mic size={18}/>} {state.muted?'Unmute':'Mute'}</button><button aria-label={state.deafened?'Unmute incoming voice':'Mute incoming voice'} aria-pressed={state.deafened} onClick={()=>voice.toggleDeafen()}>{state.deafened?<VolumeX size={18}/>:<Volume2 size={18}/>} {state.deafened?'Sound off':'Sound on'}</button><button aria-label="Leave voice chat" onClick={()=>voice.leave()}><LogOut size={18}/>Leave</button></>:<button className="voice-join" aria-label="Join voice chat" onClick={()=>void voice.join(teams?choice:'open')}><Headphones size={18}/>Join voice</button>}</div>
   {state.status==='joining'&&<p role="status">Connecting voice… Allow microphone access if your browser asks.</p>}
   {active&&<p className="voice-count" role="status">{state.peers.filter(p=>p.connection==='connected').length} connected · {state.peers.length} {teams&&channel==='team'?'teammates':'other players'} in this channel</p>}
   {!!state.peers.length&&<ul className="voice-peers">{state.peers.map(peer=><li key={peer.id}><span>{peer.name}</span><small>{peer.muted?'Mic muted':peer.connection==='connected'?'Mic on':peer.connection==='failed'?'Connection failed':'Connecting'}</small></li>)}</ul>}
   {state.playbackBlocked&&<button className="voice-playback" onClick={()=>void voice.retryAudio()}>Enable incoming voice audio</button>}
   {state.error&&<p className="voice-error" role="alert">{state.error}</p>}
  </div>}
 </section>;
}
