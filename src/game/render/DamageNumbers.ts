import {Matrix,Vector3,type Scene} from '@babylonjs/core';
import {DAMAGE_NUMBERS,PARTY_DAMAGE_COLORS} from '../../data/damageNumbers.ts';
import type {GameEvent} from '../Simulation.ts';
import type {RunState} from '../types.ts';
import './damageNumbers.css';

interface NumberLabel {
 node:HTMLSpanElement;sourceId:number;targetId:number;slot:number;crit:boolean;
 effectiveness?:'super'|'resisted';amount:number;x:number;z:number;height:number;age:number;visible:boolean;
}

/** Cosmetic only: bounded labels, short accumulation windows and screen-space spacing. */
export class DamageNumbers {
 private root=document.createElement('div');
 private labels:NumberLabel[]=[];
 private free:HTMLSpanElement[]=[];
 constructor(private scene:Scene,private ground:(x:number,z:number)=>number,private headroom:(id:number)=>number=()=>1){
  this.root.className='damage-numbers';this.root.setAttribute('aria-hidden','true');
  document.querySelector('#game-root')!.append(this.root);
 }
 onEvent(event:GameEvent,state:RunState){
  const amount=event.amount;
  if(event.kind!=='hit'||event.damageTo!=='enemy'||amount===undefined||!Number.isFinite(amount)||amount<=0||event.targetId===undefined)return;
  const slot=state.party.findIndex(member=>member.uid===event.sourceId);
  if(slot<0||event.x===undefined||event.z===undefined)return;
  if((event.x-state.player.x)**2+(event.z-state.player.z)**2>DAMAGE_NUMBERS.range**2)return;
  const crit=event.shape==='crit';
  const existing=this.labels.find(label=>label.sourceId===event.sourceId&&label.targetId===event.targetId&&label.crit===crit&&label.effectiveness===event.effectiveness&&label.age<DAMAGE_NUMBERS.mergeSeconds);
  if(existing){existing.amount+=amount;this.text(existing);return;}
  if(this.labels.length>=DAMAGE_NUMBERS.maxLabels||this.labels.filter(label=>label.sourceId===event.sourceId).length>=DAMAGE_NUMBERS.perMember)return;
  const enemy=state.enemies.find(enemy=>enemy.uid===event.targetId);
  const node=this.free.pop()??document.createElement('span');
  node.className=`damage-number${crit?' is-crit':''}${event.effectiveness?` is-${event.effectiveness}`:''}`;
  if(event.effectiveness)node.dataset.effectiveness=event.effectiveness;else delete node.dataset.effectiveness;
  node.style.setProperty('--damage-color',PARTY_DAMAGE_COLORS[slot%PARTY_DAMAGE_COLORS.length]);
  const label:NumberLabel={node,sourceId:event.sourceId!,targetId:event.targetId,slot,crit,effectiveness:event.effectiveness,amount,x:event.x,z:event.z,
   height:enemy?1.65*enemy.size*this.headroom(enemy.speciesId)+.8:2.8,age:0,visible:false};
  this.text(label);this.labels.push(label);this.root.append(node);
 }
 private text(label:NumberLabel){
  const amount=label.amount;
  const value=amount>=1e6?`${(amount/1e6).toFixed(1)}m`:amount>=1000?`${(amount/1000).toFixed(1)}k`:String(Math.max(1,Math.round(amount)));
  label.node.textContent=`${value}${label.crit?'!':''}`;
 }
 update(dt:number,reducedMotion=false){
  const camera=this.scene.activeCamera;if(!camera)return;
  const rect=this.scene.getEngine().getRenderingCanvas()!.getBoundingClientRect();
  const viewport=camera.viewport.toGlobal(rect.width,rect.height);
  const occupied:{x:number;y:number;width:number;height:number}[]=[];
  for(let i=this.labels.length-1;i>=0;i--){
   const label=this.labels[i];label.age+=Math.max(0,dt);
   if(label.age>=DAMAGE_NUMBERS.seconds){label.node.remove();this.free.push(label.node);this.labels.splice(i,1);}
  }
  for(const label of this.labels){
   const point=Vector3.Project(new Vector3(label.x,this.ground(label.x,label.z)+label.height,label.z),Matrix.IdentityReadOnly,this.scene.getTransformMatrix(),viewport);
   const width=label.node.offsetWidth,height=label.node.offsetHeight,progress=label.age/DAMAGE_NUMBERS.seconds;
   const x=point.x,y=point.y-(reducedMotion?0:progress*16);
   let placedY=y;
   const collides=(candidate:number)=>occupied.some(other=>Math.abs(x-other.x)<(width+other.width)/2+6&&Math.abs(candidate-other.y)<(height+other.height)/2+4);
   for(let attempt=0;attempt<4&&collides(placedY);attempt++)placedY-=height+4;
   label.visible=point.z>0&&point.z<1&&x>width/2+8&&x<rect.width-width/2-8&&placedY>90&&placedY<rect.height-160&&!collides(placedY);
   label.node.style.visibility=label.visible?'visible':'hidden';
   if(!label.visible)continue;
   occupied.push({x,y:placedY,width,height});
   label.node.style.left=`${x+rect.left}px`;label.node.style.top=`${placedY+rect.top}px`;
   label.node.style.opacity=String(Math.min(.9,(1-progress)/.3));
  }
 }
 inspect(){return this.labels.map(({node:_,...label})=>({...label}));}
 dispose(){this.labels=[];this.free=[];this.root.remove();}
}
