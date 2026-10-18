import type {Command,Difficulty,Snapshot,MatchMode,MapType,MapSize} from '../sim/types';
export interface RoomSettings {capacity:number;fillAI:boolean;difficulty:Difficulty;seed:number;mode?:MatchMode;zombies?:boolean;mapType?:MapType;mapSize?:MapSize}
export interface LobbyPlayer {id:string;name:string;seat:number;ready:boolean;connected:boolean;controller:'human'|'ai';team?:number}
export interface RoomView extends RoomSettings {code:string;kind:'private'|'public';phase:'lobby'|'countdown'|'playing'|'finished';hostId:string;players:LobbyPlayer[];countdownEnds?:number}
export type VoiceChannel='open'|'team';
export interface VoicePeer {id:string;seat:number;name:string;team?:number;channel:VoiceChannel;muted:boolean;session:number}
export type VoiceSignal=
 | {type:'description';description:{type:'offer'|'answer';sdp:string}}
 | {type:'candidate';candidate:{candidate:string;sdpMid?:string|null;sdpMLineIndex?:number|null;usernameFragment?:string|null}};
/** A connection starts with a full map; subsequent packets carry index/value pairs. */
export type SnapshotPacket=Omit<Snapshot,'terrain'|'fog'>&{terrain?:number[];fog?:number[];fogChanges?:number[];elevationChanges?:number[]};
export type ClientMessage =
 | ({type:'create';name:string}&RoomSettings)
 | {type:'join';name:string;code:string}
 | {type:'queue';name:string;count:number;mode?:MatchMode;zombies?:boolean;mapType?:MapType;mapSize?:MapSize}
 | {type:'team';team:number;seat?:number}
 | {type:'ready';ready:boolean}
 | ({type:'settings'}&RoomSettings)
 | {type:'start'|'cancel'|'leave'}
 | {type:'resume';code:string;token:string}
 | {type:'voiceState';channel:VoiceChannel|null;muted:boolean;session:number}
 | {type:'voiceSignal';to:string;session:number;targetSession:number;signal:VoiceSignal}
 | {type:'command';seq:number;command:Command};
export type ServerMessage =
 | {type:'welcome';id:string;protocol:1}
 | {type:'joined';room:RoomView;token:string;playerId:number;lastSeq:number}
 | {type:'room';room:RoomView}
 | {type:'queued';count:number;waiting:number}
 | {type:'started';room:RoomView;playerId:number}
 | {type:'snapshot';snapshot:Snapshot}
 | {type:'commandResult';seq:number;error:string|null}
 | {type:'voicePeers';session:number;peers:VoicePeer[]}
 | {type:'voiceSignal';from:string;session:number;targetSession:number;signal:VoiceSignal}
 | {type:'error'|'closed';error:string}
 | {type:'left'};
export type ServerPacket=Exclude<ServerMessage,{type:'snapshot'}>|{type:'snapshot';snapshot:SnapshotPacket};
