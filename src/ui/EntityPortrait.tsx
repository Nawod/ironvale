import {useState} from 'react';
import {commandPortrait} from '../render/portraits';
import {entityImage} from '../render/art';
import type {Entity} from '../sim/types';

export function EntityPortrait({type,owner=0,age=1,wallTier,className='',eager=false}:{type:Entity['type'];owner?:number;age?:number;wallTier?:3;className?:string;eager?:boolean}){
 const source=commandPortrait(type,owner,age,wallTier),[failed,setFailed]=useState<string>();
 return <img className={`entity-portrait ${className}`} src={source&&source!==failed?source:entityImage(type,owner)} width={192} height={192} alt="" loading={eager?'eager':'lazy'} decoding="async" onError={()=>setFailed(source)}/>;
}
