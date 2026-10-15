import {useSyncExternalStore} from 'react';
import {Headphones,Mic,MicOff} from 'lucide-react';
import type {VoiceChat} from '../net/voice';
import type {RoomView} from '../net/protocol';
import {VoicePanel} from './VoicePanel';

export function VoiceHud({voice,room,open,onOpenChange}:{voice:VoiceChat;room:RoomView;open:boolean;onOpenChange:(open:boolean)=>void}){
 const state=useSyncExternalStore(voice.subscribe,voice.getSnapshot),joined=state.status==='joined';
 return <div className="game-voice" data-open={open}>
  <div className="voice-buttons"><button className="voice-launcher" aria-label="Open voice chat" aria-expanded={open} onClick={()=>onOpenChange(!open)}><Headphones size={19}/></button>{joined&&<button className="voice-quick-mute" data-live={!state.muted} aria-label={state.muted?'Quick unmute microphone':'Quick mute microphone'} aria-pressed={!state.muted} title={state.muted?'Microphone muted':'Microphone transmitting'} onClick={()=>voice.toggleMute()}>{state.muted?<MicOff size={16}/>:<Mic size={16}/>}<span>{state.muted?'Muted':'Mic on'}</span></button>}</div>
  <VoicePanel voice={voice} room={room} floating expanded={open} onExpandedChange={onOpenChange}/>
 </div>;
}
