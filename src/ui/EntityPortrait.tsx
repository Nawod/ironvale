import {useState} from 'react';
import {commandPortrait} from '../render/portraits';
import {entityImage} from '../render/art';
import type {Entity,FactionId} from '../sim/types';

export function EntityPortrait({type,owner=0,age=1,wallTier,faction,className='',eager=false}:{type:Entity['type'];owner?:number;age?:number;wallTier?:3;faction?:FactionId;className?:string;eager?:boolean}){
 const source=commandPortrait(type,owner,age,wallTier,faction),[failed,setFailed]=useState<string>();
 return <img className={`entity-portrait ${className}`} src={source&&source!==failed?source:entityImage(type,owner)} width={192} height={192} alt="" loading={eager?'eager':'lazy'} decoding="async" onError={()=>setFailed(source)}/>;
}
