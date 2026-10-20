import {getSpecies, type AttackKind,type Element} from '../data/kanto.ts';
import {ATTACK_ANIMATION,DESIGN} from '../data/config.ts';
import {BOSS_RULES} from '../data/director.ts';
import {PROGRESSION,isMilestone,nextMilestone,levelPowerMultiplier} from '../data/progression.ts';
import {ECONOMY,chestCost} from '../data/economy.ts';
import {ENCOUNTER_TABLES} from '../data/encounters.ts';
import {getVariant,variantRewardXP} from '../data/variants.ts';
import {RNG,distance2} from '../utils/random.ts';
import {getAttackProfile,type StatusProc} from '../data/attacks.ts';
import {getSpecialProfile} from '../data/specials.ts';
import {castSpecial,stepSpecials} from './combat/specials.ts';
import {getMoveDefinition,getLearnedMoveProfile,learnedMovePower} from '../data/moves.ts';
import {memberDamage,elementalDamage,applyStatusProcs,tickEnemyStatuses,enemySpeedFactor} from './combat/damage.ts';
import {executePattern,executeChain,type AttackTarget} from './combat/patterns.ts';
import {nearestEnemy,enemiesInRadius} from './combat/targeting.ts';
import {addProjectile,stepProjectiles} from './combat/projectiles.ts';
import {getEnemyAttackProfile,getEliteAreaMove} from '../data/enemyAttacks.ts';
import {canStartEnemyMove,enemyMovementIntent,prepareEnemyMove,enemyMoveTell,resolveEnemyMove} from './combat/enemies.ts';
import {getBuildModifiers,dispatchBuildEvent,type BuildEvent,type BuildAction} from './systems/builds.ts';
import {applyChoice,availableItemChoices,canRecruit,makeChoices,weightedUpgradeChoices,xpThreshold} from './systems/progression.ts';
import {averagePartyLevel,enemyProgressionScale,createEnemy,createGuardian,enemySpawnPosition,spawnRandomEnemy} from './systems/spawning.ts';
import {updateDirector,recordDirectorSpawn,movingRingIntersects} from './systems/director.ts';
import {createEnvironment,createPOIs,rareEventFor,ObstacleField} from './systems/environment.ts';
import type {Drop,Enemy,LearnedMove,PartyMember,POI,RewardSource,RunState,UpgradeChoice,Variant} from './types.ts';
export interface MoveInput {mx:number;mz:number;aimX?:number;aimZ?:number;jump:boolean;dodge:boolean;special:boolean;interact:boolean;}
export type GameEvent={kind:'log'|'hit'|'attack'|'cast'|'jump'|'dash'|'special'|'level'|'death'|'faint'|'interact'|'boss'|'win'|'evolve'|'tell'|'chain'|'status'|'kill';x?:number;z?:number;label?:string;color?:string;amount?:number;sourceId?:number;targetId?:number;toX?:number;toZ?:number;duration?:number;radius?:number;endRadius?:number;shape?:string;facing?:number;angle?:number;damageTo?:'enemy'|'player'|'companion';variant?:Variant;speciesId?:number};
export type EventListener=(ev:GameEvent)=>void;
export type RunConfiguration=Pick<RunState,'challenge'|'mapId'|'recruitUnlocks'|'itemUnlocks'>;
export class Simulation {
 readonly rng:RNG;readonly state:RunState; onEvent:EventListener=()=>{};
 private readonly lootRng:RNG;
 private spawnAccum=0;private readonly statusOwners=new Map<number,number>();
 private readonly obstacles:ObstacleField;private velocity={x:0,z:0};private dodgeDirection={x:0,z:1};
 private heldActions={jump:false,dodge:false,special:false,interact:false};
 constructor(starterId:number,seed=Math.floor(Date.now()%2147483647),configuration:RunConfiguration={}){
  this.rng=new RNG(seed);
  this.lootRng=new RNG(seed^0x5f3759df);
  const starter:PartyMember={uid:1,speciesId:starterId,joinedAt:0,level:1,xp:0,xpToNext:xpThreshold(1),hp:165,maxHp:165,iframes:0,attackLevel:1,cooldown:.35,x:0,z:0,facing:0,animation:'idle',attackTimer:0};
  const pois=createPOIs(seed);
  this.obstacles=new ObstacleField(createEnvironment(seed,pois).obstacles);
  this.state={phase:'playing',result:null,seed,player:{x:0,z:0,y:0,vy:0,facing:0,hp:120,maxHp:120,iframes:0,poisonTime:0,dodgeTime:0,dodgeCooldown:0,specialCooldown:0,specialCharge:0},
   party:[starter],enemies:[],projectiles:[],drops:[],pois,stats:{elapsed:0,kills:0,recruits:0,evolutions:0,level:1,xp:0,xpToNext:xpThreshold(1),damageDealt:0,damageTaken:0,faints:0,bossKilled:false,highestCombo:0},
   items:[],buffs:{},recruitCount:0,pendingRecruit:false,upgradeChoices:[],choiceTitle:'',pendingLevelUps:[],pendingSquadRewards:0,lastSquadRewardAt:-999,coins:0,chestPurchases:0,bossSpawned:false,endless:false,lastEnemySpawn:0,eventLog:[],idCounter:40,lastSpecialAt:-999,psychicRings:[],...configuration};
  for(let i=0;i<8;i++){
   const pos=enemySpawnPosition(this.state.player,this.rng);const e=createEnemy(this.state,this.rng,this.rng.pick([10,13,16,19,21,29,43]),'normal',pos.x,pos.z);this.state.enemies.push(e);
  }
  updateDirector(this.state);
 }
 emit(event:GameEvent){this.onEvent(event);if((event.kind==='log'||event.kind==='faint')&&event.label){this.state.eventLog.unshift(event.label);this.state.eventLog.length=Math.min(5,this.state.eventLog.length);}}
 private activePhase(){return this.state.bossSpawned&&!this.state.stats.bossKilled?'boss':'playing';}
 pause(){if(this.state.phase==='playing'||this.state.phase==='boss')this.state.phase='paused';else if(this.state.phase==='paused')this.state.phase=this.activePhase();}
 choose(choiceId:string):boolean{const s=this.state; if(s.phase!=='choice')return false;
  const c=s.upgradeChoices.find(c=>c.id===choiceId);if(!c)return false;
  const result=applyChoice(s,c);
  if(!result.applied){
   const source=s.choiceSource??'level';
   this.emit({kind:'log',label:result.event});s.upgradeChoices=makeChoices(s,this.rng,source);
   if(!s.upgradeChoices.length){delete s.levelUpMemberId;delete s.choiceSource;s.phase=this.activePhase();this.openNextLevelUp();}return false;
  }
  this.emit({kind:c.kind==='evolve'?'evolve':'log',label:result.event});
  if(result.applied&&(c.kind==='recruit'||c.kind==='evolve'))this.buildEvent({kind:c.kind==='recruit'?'onRecruit':'onEvolve',sourceId:result.sourceUid});
  s.upgradeChoices=[];delete s.levelUpMemberId;delete s.choiceSource;s.phase=this.activePhase();
  this.queueLevelUps();this.openNextLevelUp();return true;
 }
 continueEndless(){const s=this.state;if(s.result==='victory'){s.result=null;s.endless=true;s.endlessStartedAt=s.stats.elapsed;s.phase='playing';updateDirector(s);this.emit({kind:'log',label:'Endless mode: the wilds grow stronger!'});}}
 enterChoice(choices:UpgradeChoice[],title?:string,source?:RewardSource){const s=this.state;s.upgradeChoices=choices;s.choiceTitle=title||s.choiceTitle;
  s.choiceSource=source??(choices.every(c=>c.kind==='item')?'cache':choices.every(c=>c.kind==='stat')?'squad':choices.every(c=>c.kind==='recruit')?'recruit':'level');
  s.phase='choice';this.emit({kind:'level'});
 }
 /** Every living member receives full shared XP; personal XP targets one owner. */
 gainXP(amount:number,memberUid?:number){
  if(!Number.isFinite(amount)||amount<=0||this.state.result!==null)return;
  const s=this.state,living=s.party.filter((member,index)=>(index===0?s.player.hp:member.hp)>0);
  const recipients=memberUid===undefined?living:living.filter(member=>member.uid===memberUid);
  if(!recipients.length)return;
  for(const member of recipients){
   if(member.level>=PROGRESSION.leveling.maxLevel)continue;
   const modifiers=getBuildModifiers(s,member);
   const catchup=memberUid===undefined&&member!==s.party[0]&&member.level<s.party[0].level?modifiers.xpCatchup:0;
   member.xp=(member.xp??0)+amount*(1+modifiers.xp)*(1+catchup);
   member.xpToNext=xpThreshold(member.level);
  }
  this.syncLeaderXP();
 }
 private syncLeaderXP(){const s=this.state,leader=s.party[0];s.stats.xp=leader.xp??0;s.stats.xpToNext=leader.xpToNext??xpThreshold(leader.level);}
 private queueLevelUps(){
  const s=this.state,queue=s.pendingLevelUps??=[];
  for(const [index,member] of s.party.entries()){
   member.xp??=0;member.xpToNext=xpThreshold(member.level);
   if((index===0?s.player.hp:member.hp)<=0||member.uid===s.levelUpMemberId||queue.includes(member.uid))continue;
   while(member.level<PROGRESSION.leveling.maxLevel&&member.xp>=member.xpToNext){
    const previous=1+(member.level-1)*PROGRESSION.leveling.healthPerLevel;
    member.xp-=member.xpToNext;member.level++;member.xpToNext=xpThreshold(member.level);s.stats.level++;
    const health=(1+(member.level-1)*PROGRESSION.leveling.healthPerLevel)/previous;
    member.maxHp*=health;member.hp*=health;
    if(index===0){s.player.maxHp*=health;s.player.hp*=health;}
    if(isMilestone(member.level)){queue.push(member.uid);break;}
   }
  }
  this.syncLeaderXP();
 }
 private openNextLevelUp():boolean {
  const s=this.state,queue=s.pendingLevelUps??=[];
  // Scheduled recruitment and squad rewards never consume an earned milestone.
  if(canRecruit(s)){
   const choices=makeChoices(s,this.rng,'recruit');
   if(choices.length){this.enterChoice(choices,undefined,'recruit');return true;}
  }
  while((s.pendingSquadRewards??0)>0){
   s.pendingSquadRewards=(s.pendingSquadRewards??0)-1;
   const choices=makeChoices(s,this.rng,'squad');
   if(choices.length){this.enterChoice(choices,undefined,'squad');return true;}
  }
  while(queue.length){
   const uid=queue.shift()!,member=s.party.find(member=>member.uid===uid);
   if(!member||member.hp<=0)continue;
   s.levelUpMemberId=uid;
   const choices=makeChoices(s,this.rng);
   if(choices.length){this.enterChoice(choices,undefined,'level');return true;}
   delete s.levelUpMemberId;
  }
  return false;
 }
 private isActive(){return this.state.phase==='playing'||this.state.phase==='boss';}
 update(dt:number,input:MoveInput){const s=this.state;if(!this.isActive()||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.04);s.stats.elapsed+=dt;
  const previousPositions=new Map(s.party.map(member=>[member.uid,{x:member.x,z:member.z}]));previousPositions.set(s.party[0].uid,{x:s.player.x,z:s.player.z});
  this.movePlayer(dt,input);
  if(this.finishDefeat()||!this.isActive()||s.result!==null)return;
  const previousDirector=s.director,director=updateDirector(s);
  if(previousDirector&&previousDirector.phaseId!==director.phaseId)this.emit({kind:'log',label:director.title});
  if(director.bossWarning&&!previousDirector?.bossWarning)this.emit({kind:'boss',label:'A psychic presence approaches — Mewtwo awakens at 15:00'});
  this.moveTeam(dt);this.updateEnemies(dt);
  if(s.result!==null)return;
  this.updatePsychicRings(dt,previousPositions);
  if(s.result!==null)return;
  stepSpecials(s,dt,{
   hit:(enemy,damage,element,sourceId,status)=>this.damageEnemy(enemy,damage,element,sourceId,status),
   visual:event=>this.emit(event),heal:amount=>this.healSpecial(amount),
  });
  if(s.result!==null)return;
  this.updateAttacks(dt);this.updateProjectiles(dt);
  if(s.result!==null)return;
  this.updateDrops(dt);this.updateRegeneration(dt);
  this.spawnAccum+=dt;const interval=director.spawnInterval;
  while(this.spawnAccum>interval){this.spawnAccum-=interval;for(let i=0;i<director.batchSize;i++){
   const enemy=spawnRandomEnemy(s,this.rng,{capacity:director.enemyBudget,speciesTier:director.speciesTier,variantWeights:director.variantWeights,statScale:director.endlessScale});
   recordDirectorSpawn(s,!!enemy);if(enemy){s.enemies.push(enemy);s.lastEnemySpawn=s.stats.elapsed;}
  }}
  if(!s.bossSpawned && s.stats.elapsed>=DESIGN.bossAtSeconds){
   s.bossSpawned=true;s.phase='boss';const pos=enemySpawnPosition(s.player,this.rng,30,38);const e=createEnemy(s,this.rng,ENCOUNTER_TABLES.boss[0],'legendary',pos.x,pos.z,true,true);
   const partyScale=enemyProgressionScale(s);
   e.hp=e.maxHp=(BOSS_RULES.baseHp+averagePartyLevel(s)*BOSS_RULES.hpPerLevel)*(1+partyScale.party);e.damage=BOSS_RULES.contactDamage*partyScale.damage;e.speed=BOSS_RULES.speed*(s.challenge==='quickened'?1.2:1);e.bossCycle=0;e.attackCooldown=1.6;s.enemies.push(e);
   updateDirector(s);this.emit({kind:'boss',label:'MEWTWO HAS AWAKENED'});
  }
  if(this.finishDefeat())return;
  this.queueLevelUps();this.openNextLevelUp();
 }
 private movePlayer(dt:number,input:MoveInput){const p=this.state.player,s=this.state;
  if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimZ)&&Math.hypot(input.aimX!,input.aimZ!)>1e-6)p.aimFacing=Math.atan2(input.aimX!,input.aimZ!);
  else delete p.aimFacing;
  const tap={jump:input.jump&&!this.heldActions.jump,dodge:input.dodge&&!this.heldActions.dodge,special:input.special&&!this.heldActions.special,interact:input.interact&&!this.heldActions.interact};
  this.heldActions={jump:input.jump,dodge:input.dodge,special:input.special,interact:input.interact};
  p.iframes=Math.max(0,p.iframes-dt);
  const poisonDamage=Math.min(dt,p.poisonTime)*getVariant('poisoned').contactPoison!.damagePerSecond;p.poisonTime=Math.max(0,p.poisonTime-dt);p.hp-=poisonDamage;s.stats.damageTaken+=poisonDamage;
  p.dodgeCooldown=Math.max(0,p.dodgeCooldown-dt);p.specialCooldown=Math.max(0,p.specialCooldown-dt);
  if(p.hp<=0)return;
  const mx=Number.isFinite(input.mx)?input.mx:0,mz=Number.isFinite(input.mz)?input.mz:0;
  const len=Math.hypot(mx,mz),nx=len?mx/len:0,nz=len?mz/len:0;
  if(tap.dodge&&p.dodgeCooldown===0){
   this.dodgeDirection={x:len?nx:Math.sin(p.facing),z:len?nz:Math.cos(p.facing)};
   p.dodgeTime=DESIGN.dodgeSeconds;p.dodgeCooldown=DESIGN.dodgeCooldown/(1+getBuildModifiers(s).stamina);p.iframes=Math.max(p.iframes,.34);this.emit({kind:'dash',x:p.x,z:p.z,color:'#eef7c0',sourceId:s.party[0].uid,speciesId:s.party[0].speciesId});
  }
  const dodge=p.dodgeTime>0;p.dodgeTime=Math.max(0,p.dodgeTime-dt);
  const speed=DESIGN.playerSpeed*(1+getBuildModifiers(s).speed);
  const targetX=nx*speed*Math.min(1,len),targetZ=nz*speed*Math.min(1,len),deltaX=targetX-this.velocity.x,deltaZ=targetZ-this.velocity.z;
  const delta=Math.hypot(deltaX,deltaZ),factor=delta?Math.min(1,(len?DESIGN.acceleration:DESIGN.deceleration)*dt/delta):1;
  this.velocity.x+=deltaX*factor;this.velocity.z+=deltaZ*factor;
  const vx=dodge?this.dodgeDirection.x*DESIGN.dodgeSpeed:this.velocity.x,vz=dodge?this.dodgeDirection.z*DESIGN.dodgeSpeed:this.velocity.z;
  const next=this.obstacles.move(p,vx*dt,vz*dt);
  this.walking=Math.hypot(next.x-p.x,next.z-p.z)>.001;
  p.x=next.x;p.z=next.z;
  if(dodge)p.facing=Math.atan2(this.dodgeDirection.x,this.dodgeDirection.z);
  else if(len>0)p.facing=Math.atan2(nx,nz);
  if(tap.jump&&p.y===0){p.vy=DESIGN.jumpVelocity;this.emit({kind:'jump',sourceId:s.party[0].uid,speciesId:s.party[0].speciesId});}
  p.vy-=DESIGN.gravity*dt;p.y=Math.max(0,p.y+p.vy*dt);if(p.y===0)p.vy=0;
  if(tap.special&&p.specialCooldown===0){p.specialCooldown=getSpecialProfile(s.party[0].speciesId,s.party[0].attackLevel).cooldown/(1+getBuildModifiers(s).specialHaste);s.lastSpecialAt=s.stats.elapsed;this.specialAttack();}
  if(s.result!==null)return;
  const interaction=s.pois.find(a=>!a.used&&distance2(p,a)<DESIGN.interactionRadius);
  if(tap.interact&&interaction)this.activatePOI(interaction);
 }
 private moveTeam(dt:number){const s=this.state;const count=s.party.length;
  [...s.party].forEach((m,index)=>{
   m.attackTimer=Math.max(0,m.attackTimer-dt);
   if(m.attackTimer===0){delete m.attackKind;delete m.attackSpecial;}
   m.iframes=Math.max(0,m.iframes-dt);
   if(index>0){const poison=m.poisonTime||0;m.hp-=Math.min(dt,poison)*getVariant('poisoned').contactPoison!.damagePerSecond;m.poisonTime=Math.max(0,poison-dt);if(m.hp<=0){this.faintCompanion(m);return;}if(s.challenge!=='famine')m.hp=Math.min(m.maxHp,m.hp+.65*dt);}
   if(index===0){m.hp=m.maxHp*s.player.hp/s.player.maxHp;m.x=s.player.x;m.z=s.player.z;if(m.attackTimer===0)m.facing=s.player.facing;m.animation=m.attackTimer>0?'attack':Math.hypot(s.player.vy,s.player.dodgeTime)>0||this.walking?'walk':'idle';return;}
   const offsetAngle=s.player.facing+Math.PI+(index-1)*2*Math.PI/Math.max(3,count-1);
   const radius=2.15+Math.floor((index-1)/3)*1.65;
   const tx=s.player.x+Math.sin(offsetAngle)*radius,tz=s.player.z+Math.cos(offsetAngle)*radius;
   const d=distance2(m,{x:tx,z:tz});const f=d>12?1:Math.min(1,dt*(d>3?5:3.4));
   const oldx=m.x,oldz=m.z;m.x+=(tx-m.x)*f;m.z+=(tz-m.z)*f;
   m.animation=m.attackTimer>0?'attack':Math.hypot(m.x-oldx,m.z-oldz)>.018?'walk':'idle';if(m.attackTimer===0)m.facing=s.player.facing;
  });
 }
 private walking=false;
 setWalking(v:boolean){this.walking=v;}
 private updateEnemies(dt:number){const s=this.state,p=s.player;
  for(const e of s.enemies){if(e.dead)continue;
   e.hitCooldown=Math.max(0,e.hitCooldown-dt);e.attackCooldown-=dt;e.attackTimer=Math.max(0,e.attackTimer-dt);
   const dot=tickEnemyStatuses(e,dt);
   if(dot>0)this.damageEnemy(e,dot,'normal',this.statusOwners.get(e.uid),{},false,false,false);
   if(e.hp<=0){this.killEnemy(e);if(s.result!==null)return;continue;}
   // One in five enemies hunts a follower, making teammate HP consequential without micromanagement.
   const companion=s.party.length>1&&e.uid%10===0?s.party[1+(e.uid%(s.party.length-1))]:undefined;
   const target=companion||p;
   const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz)||.01;
   if(e.windup){
    if(e.stunTime>0){e.windup=undefined;e.attackCooldown=1;}
    else{
     e.windup.remaining=Math.max(0,e.windup.remaining-dt);e.animation='attack';
     if(e.windup.remaining===0){
      const windup=e.windup;e.windup=undefined;
      if(windup.kind==='enemyMove'){
       resolveEnemyMove(e,windup,s,{
        animate:(enemy,facing,duration)=>this.animateAttack(enemy,facing,duration),
        projectile:projectile=>{addProjectile(s,projectile);},
        hurtPlayer:(damage,poison,sourceId)=>this.hurtPlayer(damage,poison,false,false,sourceId),
        hurtCompanion:(member,damage,poison,sourceId)=>this.hurtCompanion(member,damage,poison,sourceId),
        visual:event=>this.emit(event),suicide:enemy=>{enemy.dead=true;enemy.hp=0;this.statusOwners.delete(enemy.uid);},
       });
      }
      else if(windup.kind==='volley'){this.bossVolley(e,windup.facing);e.attackCooldown=BOSS_RULES.volleyCooldown;e.bossCycle=((e.bossCycle||0)+1)%3;}
      else if(windup.kind==='psychicRing'){
       this.animateAttack(e,windup.facing,ATTACK_ANIMATION.bossSeconds);e.attackCooldown=BOSS_RULES.ringCooldown;e.bossCycle=2;
       const rings=s.psychicRings||(s.psychicRings=[]);
       if(rings.length<BOSS_RULES.maxRings)rings.push({uid:s.idCounter++,sourceId:e.uid,x:windup.x,z:windup.z,radius:1,previousRadius:1,
        maxRadius:BOSS_RULES.ringMaxRadius,speed:BOSS_RULES.ringSpeed,width:BOSS_RULES.ringWidth,damage:BOSS_RULES.ringDamage,hit:new Set()});
       this.emit({kind:'boss',x:windup.x,z:windup.z,label:'Psychic — jump or dodge through',shape:'psychicRing'});
      }else if(windup.kind==='summon'){
       this.animateAttack(e,windup.facing,ATTACK_ANIMATION.bossSeconds);e.attackCooldown=BOSS_RULES.summonCooldown;e.bossCycle=0;
       this.bossSummon(e);
      }else{
       this.animateAttack(e,windup.facing);e.attackCooldown=3.8;e.bossCycle=(e.bossCycle||0)+1;
       const areaMove=getEliteAreaMove(e.speciesId),poison=areaMove.element==='poison'||!!getVariant(e.variant).contactPoison;
       this.emit({kind:'attack',x:windup.x,z:windup.z,amount:3.3,color:areaMove.color,shape:'slam',sourceId:e.uid,label:areaMove.moveName});
       if(distance2(p,windup)<3.3)this.hurtPlayer(e.damage*1.2,poison,false,false,e.uid);
       for(const member of [...s.party].slice(1))if(distance2(member,windup)<3.3)this.hurtCompanion(member,e.damage*.65,poison,e.uid);
      }
     }
     if(s.result!==null)return;continue;
    }
   }
   if(e.stunTime===0&&e.attackCooldown<=0&&(e.isBoss||(e.elite&&d<11&&(e.bossCycle||0)%2===0))){
    const kind=e.isBoss?(['volley','psychicRing','summon'] as const)[e.bossCycle||0]:'slam';
    const duration=kind==='volley'?BOSS_RULES.volleyWindup:kind==='psychicRing'?BOSS_RULES.ringWindup:kind==='summon'?BOSS_RULES.summonWindup:.65,facing=Math.atan2(dx,dz);
    const centered=kind==='psychicRing'||kind==='summon',radius=kind==='volley'?5:kind==='psychicRing'?4:kind==='summon'?6:3.3;
    const moveName=kind==='volley'?'Psystrike':kind==='psychicRing'?'Psychic':kind==='summon'?'Teleport':getEliteAreaMove(e.speciesId).moveName;
    e.windup={kind,remaining:duration,duration,x:centered?e.x:target.x,z:centered?e.z:target.z,facing,radius,moveName};
    this.animateAttack(e,facing,duration);
    this.emit({kind:'tell',x:kind==='volley'?e.x:e.windup.x,z:kind==='volley'?e.z:e.windup.z,toX:target.x,toZ:target.z,
     radius,amount:radius,duration,color:e.isBoss?'#c6a2dc':'#e9a38c',sourceId:e.uid,shape:kind,label:moveName});
    continue;
   }
   if(!e.isBoss){
    const profile=getEnemyAttackProfile(e.speciesId);
    if(canStartEnemyMove(e,target,s,profile)){
     e.windup=prepareEnemyMove(e,target,profile);
     if(e.elite)e.bossCycle=(e.bossCycle||0)+1;
     this.animateAttack(e,e.windup.facing,e.windup.duration);this.emit(enemyMoveTell(e,e.windup,profile));continue;
    }
    if(e.stunTime===0){
     const intent=enemyMovementIntent(e,target,s,profile),movement=e.speed*enemySpeedFactor(e)*dt*intent.speedScale;
     const next=this.obstacles.move(e,intent.x*movement,intent.z*movement);e.x=next.x;e.z=next.z;
     if(e.attackTimer===0)e.facing=Math.atan2(dx,dz);
     e.animation=e.attackTimer>0?'attack':movement>0?'walk':'idle';
    }else e.animation='idle';
    continue;
   }
   if(e.attackTimer===0)e.facing=Math.atan2(dx,dz);
   e.animation=e.stunTime>0?'idle':e.attackTimer>0?'attack':d>e.size+1?'walk':'idle';
   if(e.stunTime===0){
    const movement=e.speed*enemySpeedFactor(e)*dt;
    if(d>e.size+1){e.x+=dx/d*movement;e.z+=dz/d*movement;}
    if(d<e.size+1.4&&e.hitCooldown<=0){
     this.animateAttack(e,Math.atan2(dx,dz));
     if(companion)this.hurtCompanion(companion,e.damage*.42,!!getVariant(e.variant).contactPoison,e.uid);
     else this.hurtPlayer(e.damage,!!getVariant(e.variant).contactPoison,false,false,e.uid);
     e.hitCooldown=1.35/getVariant(e.variant).aggression;
     if(s.result!==null)return;
    }
   }
  }
  s.enemies=s.enemies.filter(e=>!e.dead);
 }
 private attackTarget(member:PartyMember,range:number):AttackTarget|undefined {
  return nearestEnemy(this.state.enemies,member,range);
 }
 private updateAttacks(dt:number){const s=this.state;
  for(const m of s.party){
   this.updateLearnedMoves(m,dt);
   if(s.result!==null)return;
   m.cooldown-=dt;if(m.cooldown>0)continue;
   const profile=getAttackProfile(m.speciesId,m.attackLevel),mod=getBuildModifiers(s,m);
   const target=this.attackTarget(m,profile.range*(1+mod.radius));
   if(!target){m.cooldown=Math.min(.3,dt+.12);continue;}
   const cadence=Math.max(.2,profile.cooldown/(1+mod.haste)/(1+PROGRESSION.moves.speedPerRank*Math.max(0,m.attackLevel-1)));m.cooldown=cadence;
   this.animatePartyAttack(m,profile.kind,Math.atan2(target.x-m.x,target.z-m.z),Math.min(ATTACK_ANIMATION.seconds,cadence*ATTACK_ANIMATION.cadenceFraction));
   this.fireFromMember(m,target);
   if(s.result!==null)return;
  }
 }
 private updateLearnedMoves(member:PartyMember,dt:number){
  const s=this.state,mod=getBuildModifiers(s,member);
  for(const learned of member.learnedMoves||[]){
   learned.cooldown=Math.max(0,learned.cooldown-dt);if(learned.cooldown>0)continue;
   const move=getMoveDefinition(learned.moveId);if(!move)continue;
   const profile=getLearnedMoveProfile(learned.moveId,learned.rank);
   const target=this.attackTarget(member,profile.range*(1+mod.radius));
   if(!target&&profile.kind!=='heal'){learned.cooldown=.15;continue;}
   if(profile.kind==='heal'&&s.player.hp>=s.player.maxHp&&s.party.every(m=>m.hp>=m.maxHp)){learned.cooldown=.3;continue;}
   const cadence=Math.max(.35,profile.cooldown/(1+mod.haste));learned.cooldown=cadence;
   const facing=target?Math.atan2(target.x-member.x,target.z-member.z):member.facing;
   this.animatePartyAttack(member,profile.kind,facing,Math.min(ATTACK_ANIMATION.seconds,cadence*ATTACK_ANIMATION.cadenceFraction));
   this.fireLearnedMove(member,learned,target);
   if(s.result!==null)return;
  }
 }
 private fireLearnedMove(member:PartyMember,learned:LearnedMove,target:AttackTarget|undefined,damageScale=1,depth=0){
  const s=this.state,move=getMoveDefinition(learned.moveId);if(!move||s.result!==null)return;
  const profile=getLearnedMoveProfile(move.id,learned.rank),mod=getBuildModifiers(s,member);
  const actions=depth===0?dispatchBuildEvent({state:s,rng:this.rng},{kind:'onAttack',sourceId:member.uid,targetId:target&&target.uid>=0?target.uid:undefined,element:move.element}):[];
  for(const action of actions){if(s.result!==null)return;if(action.kind!=='echo')this.applyBuildAction(action);}
  if(s.result!==null)return;
  const livingTarget=target&&!target.dead?target:this.attackTarget(member,profile.range*(1+mod.radius));
  if(!livingTarget&&profile.kind!=='heal')return;
  const crit=depth===0&&profile.kind!=='heal'&&this.rng.next()<mod.critChance;
  const damage=learnedMovePower(move.id,learned.rank)*levelPowerMultiplier(member.level)*(1+mod.power)*damageScale*(crit?mod.critDamage:1);
  if(depth===0)this.emit({kind:'cast',sourceId:member.uid,speciesId:member.speciesId});
  executePattern({member:{...member,attackLevel:learned.rank},target:livingTarget||{...member,dead:false},
   enemies:s.enemies,profile,element:move.element,damage,crit,depth,radiusScale:1+mod.radius,
   extraProjectiles:mod.projectiles,extraPierce:mod.pierce,extraChains:mod.chains,projectileSpeedScale:1+mod.projectileSpeed,
   hit:(enemy,amount)=>this.damageEnemy(enemy,amount,move.element,member.uid,profile.status,crit,depth===0),
   projectile:projectile=>{addProjectile(s,{...projectile,moveName:move.name});},
   visual:event=>this.emit({...event,label:move.name}),
   heal:(leader,squad)=>{if(s.challenge==='famine')return;s.player.hp=Math.min(s.player.maxHp,s.player.hp+leader);for(const m of s.party)m.hp=Math.min(m.maxHp,m.hp+squad);}});
  for(const action of actions)if(action.kind==='echo'&&s.result===null)this.fireLearnedMove(member,learned,livingTarget,action.damageScale,action.depth);
 }
 private animatePartyAttack(member:PartyMember,kind:AttackKind,facing:number,duration:number){
  // Independent casts keep their damage/cooldowns, but share the current body
  // motion until recovery finishes. Repeated casts must not pin it at frame zero.
  if(member.attackTimer>0)return;
  member.attackKind=kind;delete member.attackSpecial;
  this.animateAttack(member,facing,duration);
 }
 private animateAttack(actor:PartyMember|Enemy,facing:number,duration:number=ATTACK_ANIMATION.seconds){
  actor.attackTimer=duration;actor.attackDuration=duration;actor.animation='attack';actor.facing=facing;
 }
 private fireFromMember(m:PartyMember,target:AttackTarget,damageScale=1,depth=0){
  const s=this.state;if(s.result!==null||target.dead)return;
  const type=getSpecies(m.speciesId).types[0],profile=getAttackProfile(m.speciesId,m.attackLevel),mod=getBuildModifiers(s,m);
  const actions=depth===0?dispatchBuildEvent({state:s,rng:this.rng},{kind:'onAttack',sourceId:m.uid,targetId:target.uid>=0?target.uid:undefined,element:type}):[];
  for(const action of actions){if(s.result!==null)return;if(action.kind!=='echo')this.applyBuildAction(action);}
  if(s.result!==null||target.dead)return;
  const crit=depth===0&&this.rng.next()<mod.critChance;
  const damage=memberDamage(m,profile.growth.damage,mod.power)*damageScale*(crit?mod.critDamage:1);
  if(depth===0)this.emit({kind:'cast',sourceId:m.uid,speciesId:m.speciesId});
  executePattern({member:m,target,enemies:s.enemies,profile,element:type,damage,crit,depth,
   radiusScale:1+mod.radius,extraProjectiles:mod.projectiles,extraPierce:mod.pierce,extraChains:mod.chains,
   projectileSpeedScale:1+mod.projectileSpeed,
   hit:(enemy,amount)=>this.damageEnemy(enemy,amount,type,m.uid,profile.status,crit,depth===0),
   projectile:projectile=>{addProjectile(s,projectile);},visual:event=>this.emit(event),
   heal:(leader,squad)=>{if(s.challenge==='famine')return;s.player.hp=Math.min(s.player.maxHp,s.player.hp+leader);for(const member of s.party)member.hp=Math.min(member.maxHp,member.hp+squad);}});
  for(const action of actions)if(action.kind==='echo'&&s.result===null)this.applyBuildAction(action);
 }
 private updateProjectiles(dt:number){
  stepProjectiles(this.state,dt,{
   hit:(enemy,projectile)=>this.damageEnemy(enemy,projectile.damage,projectile.type,projectile.sourceId,
    projectile.status||{poison:projectile.poisonChance},projectile.crit||false,projectile.allowProcs!==false),
   hurtPlayer:(damage,poison,projectile)=>this.hurtPlayer(damage,poison,false,false,projectile?.sourceId),
   hurtCompanion:(member,damage,poison,projectile)=>this.hurtCompanion(member,damage,poison,projectile.sourceId),
   explode:projectile=>this.emit({kind:'attack',x:projectile.x,z:projectile.z,amount:projectile.radius,radius:projectile.radius,color:projectile.friendly?'#b6ce8b':'#f3a27a',shape:'burst',sourceId:projectile.sourceId,label:projectile.moveName}),
  });
 }
 private damageEnemy(e:Enemy,amount:number,type:Element,sourceId?:number,status:StatusProc={},crit=false,allowProcs=true,matchup=true,damageIsFinal=false){
  if(e.dead||this.state.result!==null)return;
  const resolved=damageIsFinal?Math.max(0,Number.isFinite(amount)?amount:0):elementalDamage(amount,type,e,matchup);
  const damage=Math.min(e.hp,resolved);
  if(damage<=0)return;e.hp-=damage;this.state.stats.damageDealt+=damage;
  const applied=Object.keys(status).length?applyStatusProcs(e,status,()=>this.rng.next(),1+getBuildModifiers(this.state,sourceId).duration):[];
  if(applied.length){if(sourceId!==undefined)this.statusOwners.set(e.uid,sourceId);this.emit({kind:'status',x:e.x,z:e.z,sourceId,targetId:e.uid,color:'#c5d8a5',shape:applied[0]});}
  if(matchup)this.emit({kind:'hit',x:e.x,z:e.z,sourceId,targetId:e.uid,color:crit?'#ffe599':'#c0d4a4',amount:damage,damageTo:'enemy',shape:crit?'crit':'impact'});
  if(allowProcs){
   if(crit)this.buildEvent({kind:'onCrit',sourceId,targetId:e.uid,damage,element:type});
   this.buildEvent({kind:'onHit',sourceId,targetId:e.uid,damage,element:type});
  }
  if(e.hp<=0)this.killEnemy(e,sourceId,allowProcs||!matchup);
 }
 private killEnemy(e:Enemy,sourceId?:number,allowProcs=true){if(e.dead)return;e.dead=true;this.statusOwners.delete(e.uid);const s=this.state;s.stats.kills++;
  this.emit({kind:'kill',variant:e.variant,speciesId:e.speciesId,targetId:e.uid,sourceId});
  const gain=variantRewardXP(e);
  this.gainXP(gain*.52);
  this.spawnDrop({x:e.x,z:e.z,value:gain*.48,kind:'xp'});
  if(e.elite||this.lootRng.next()<ECONOMY.coinChance)this.spawnDrop({x:e.x,z:e.z,kind:'coin',value:e.elite?ECONOMY.eliteCoins:e.variant==='normal'?ECONOMY.normalCoins:ECONOMY.variantCoins});
  if(this.lootRng.next()<(e.elite?ECONOMY.eliteItemDropChance:ECONOMY.itemDropChance)){
   const groundItems=new Set(s.drops.filter(drop=>drop.kind==='item').map(drop=>drop.itemId));
   const item=weightedUpgradeChoices(availableItemChoices(s).filter(item=>!groundItems.has(item.id)),1,this.lootRng,s.buffs.luck||0)[0];
   if(item)this.spawnDrop({x:e.x,z:e.z,kind:'item',value:1,itemId:item.id});
  }
  if(e.elite&&(e.landmarkGuardian||e.isBoss||s.stats.elapsed-(s.lastSquadRewardAt??-999)>=ECONOMY.eliteRewardInterval)){
   s.pendingSquadRewards=(s.pendingSquadRewards??0)+1;s.lastSquadRewardAt=s.stats.elapsed;
  }
  this.emit({kind:'hit',x:e.x,z:e.z,color:e.isBoss?'#d7b0ff':'#c0efb0'});
  if(e.shrineGuardian){s.buffs.luck=(s.buffs.luck||0)+.04;s.player.specialCooldown=0;this.emit({kind:'interact',x:e.x,z:e.z,label:'Shrine guardian defeated: luck increased, special ready!',color:'#d2b5ff'});}
  if(e.isBoss){s.stats.bossKilled=true;s.result='victory';s.phase='result';s.psychicRings=[];s.projectiles=s.projectiles.filter(projectile=>projectile.friendly);this.emit({kind:'win',label:'Mewtwo defeated!'});}
  if(s.result===null)this.buildEvent({kind:'onDeath',sourceId,targetId:e.uid,depth:allowProcs?0:1});
 }
 private collectItem(itemId:string|undefined){
  if(!itemId)return;const s=this.state;
  const item=availableItemChoices(s).find(item=>item.id===itemId);
  if(item){const result=applyChoice(s,item);if(result.applied)this.emit({kind:'interact',label:result.event});}
  else s.coins=(s.coins??0)+ECONOMY.duplicateItemCoins;
 }
 private spawnDrop(drop:Omit<Drop,'uid'|'age'>){
  const s=this.state;
  if(s.drops.length>=DESIGN.maxActiveDrops){
   if(drop.kind==='xp'){this.gainXP(drop.value);return;}
   if(drop.kind==='coin'){s.coins=(s.coins??0)+drop.value;return;}
   const index=s.drops.findIndex(existing=>existing.kind==='xp');
   if(index<0){if(drop.kind==='item')this.collectItem(drop.itemId);return;}
   this.gainXP(s.drops[index].value);s.drops.splice(index,1);
  }
  s.drops.push({...drop,uid:s.idCounter++,age:0});
 }
 private updateDrops(dt:number){const s=this.state;const p=s.player,radius=DESIGN.pickupRadius+getBuildModifiers(s).magnet;
   for(const d of s.drops){d.age+=dt;const dist=distance2(d,p);
   if(dist<radius*2.2&&dist>.12){d.x+=(p.x-d.x)*Math.min(.85,dt*(4+6/(dist+.3)));d.z+=(p.z-d.z)*Math.min(.85,dt*(4+6/(dist+.3)));}
   if(dist<radius*.65){d.age=999;
    if(d.kind==='xp')this.gainXP(d.value);
    else if(d.kind==='coin')s.coins=(s.coins??0)+d.value;
    else if(d.kind==='item')this.collectItem(d.itemId);
    else if(s.challenge!=='famine')p.hp=Math.min(p.maxHp,p.hp+d.value);
   }
  }
  s.drops=s.drops.filter(d=>d.age<(d.kind==='item'?120:45));
 }
 private updateRegeneration(dt:number){
  const s=this.state,mod=getBuildModifiers(s);
  if(s.challenge==='famine')return;
  if(s.player.hp>0)s.player.hp=Math.min(s.player.maxHp,s.player.hp+(mod.regeneration+s.player.maxHp*mod.regenerationPercent)*dt);
  for(const member of s.party){const recovery=getBuildModifiers(s,member);if(member.hp>0)member.hp=Math.min(member.maxHp,member.hp+(recovery.partyRegeneration+member.maxHp*recovery.partyRegenerationPercent)*dt);}
 }
 private buildEvent(event:BuildEvent){
  for(const action of dispatchBuildEvent({state:this.state,rng:this.rng},event)){
   if(this.state.result!==null)return;this.applyBuildAction(action);
  }
 }
 /** Declarative effects share one bounded action interpreter, independent of item IDs. */
 private applyBuildAction(action:BuildAction){
  const s=this.state,member=s.party.find(member=>member.uid===action.sourceId),target=s.enemies.find(enemy=>enemy.uid===action.targetId);
  const origin=target||member||s.player;
  switch(action.kind){
   case 'echo':{
    if(!member)return;
    const next=target&&!target.dead?target:this.attackTarget(member,getAttackProfile(member.speciesId,member.attackLevel).range*(1+getBuildModifiers(s,member).radius));
    if(next)this.fireFromMember(member,next,action.damageScale,action.depth);return;
   }
   case 'chain':{
    const first=target&&!target.dead&&target.hp>0?target:nearestEnemy(s.enemies,origin,action.range);
    if(first)executeChain(s.enemies,first,action.damage,action.jumps,action.range,action.element,action.sourceId,
     (enemy,damage)=>this.damageEnemy(enemy,damage,action.element,action.sourceId,{},false,false,true,action.damageIsFinal),event=>this.emit(event),origin);
    return;
   }
   case 'area':{
    for(const enemy of enemiesInRadius(s.enemies,origin,action.radius))this.damageEnemy(enemy,action.damage,action.element,action.sourceId,{},false,false,true,action.damageIsFinal);
    this.emit({kind:'attack',x:origin.x,z:origin.z,amount:action.radius,sourceId:action.sourceId,color:'#d7c69a',shape:'burst'});return;
   }
   case 'heal':{
    if(s.challenge==='famine')return;
    if(s.player.hp>0)s.player.hp=Math.min(s.player.maxHp,s.player.hp+action.amount+s.player.maxHp*(action.maxHpFraction??0));
    if(action.target==='squad')for(const member of s.party)if(member.hp>0)member.hp=Math.min(member.maxHp,member.hp+action.amount+member.maxHp*(action.maxHpFraction??0));return;
   }
   case 'selfDamage':this.hurtPlayer(action.amount,false,true,true);return;
   case 'status':{
    if(!target||target.dead)return;
    const timers={stun:'stunTime',slow:'slowTime',poison:'poisonTime',burn:'burnTime',soaked:'soakedTime'} as const;
    const timer=timers[action.status];target[timer]=Math.max(target[timer],action.duration);this.statusOwners.set(target.uid,action.sourceId);
    this.emit({kind:'status',x:target.x,z:target.z,sourceId:action.sourceId,targetId:target.uid,color:'#c5d8a5',shape:action.status});return;
   }
   case 'xp':this.gainXP(action.amount);return;
   case 'specialCharge':s.player.specialCooldown=Math.max(0,s.player.specialCooldown-action.amount);return;
  }
 }
 private hurtCompanion(member:PartyMember,amount:number,poison=false,sourceId?:number){
  if(member.iframes>0)return;
  member.iframes=1.35;
  const mod=getBuildModifiers(this.state,member),damage=Math.max(1,(amount-mod.armor)*(1-mod.damageReduction));member.hp-=damage;
  if(poison)member.poisonTime=Math.max(member.poisonTime||0,getVariant('poisoned').contactPoison!.seconds);
  this.emit({kind:'hit',x:member.x,z:member.z,color:'#ff8c83',amount:damage,sourceId,targetId:member.uid,damageTo:'companion'});
  if(member.hp>0)return;this.faintCompanion(member);
 }
 private faintCompanion(member:PartyMember){
  const index=this.state.party.indexOf(member);if(index<1)return;
  this.state.party.splice(index,1);this.state.stats.faints++;
  this.emit({kind:'faint',sourceId:member.uid,speciesId:member.speciesId,amount:member.speciesId,label:`${getSpecies(member.speciesId).name} fainted and left your party!`});
 }
 private hurtPlayer(amount:number,poison:boolean,bypassInvuln=false,ignoreArmor=false,sourceId?:number){const p=this.state.player;
  if(p.iframes>0&&!bypassInvuln)return;
  const mod=getBuildModifiers(this.state),damage=ignoreArmor?Math.max(0,amount):Math.max(1,(amount-mod.armor)*(1-mod.damageReduction));p.hp-=damage;this.state.stats.damageTaken+=damage;
  if(!bypassInvuln)p.iframes=.67;
  this.emit({kind:'hit',x:p.x,z:p.z,color:poison?'#96f66e':'#ff756f',amount:damage,sourceId,targetId:this.state.party[0].uid,damageTo:'player'});
  if(poison)p.poisonTime=Math.max(p.poisonTime,getVariant('poisoned').contactPoison!.seconds);
  this.finishDefeat();
 }
 private finishDefeat(){const s=this.state;if(s.result==='defeat')return true;if(s.player.hp>0||s.result!==null)return false;
  s.player.hp=0;s.result='defeat';s.phase='result';this.emit({kind:'death',speciesId:s.party[0].speciesId});return true;
 }
 private specialAttack(){const s=this.state,member=s.party[0],element=getSpecies(member.speciesId).types[0],mod=getBuildModifiers(s,member);
  const profile=getSpecialProfile(member.speciesId,member.attackLevel);
  member.attackSpecial=profile.kind;delete member.attackKind;
  this.animateAttack(member,member.facing,ATTACK_ANIMATION.specialSeconds);
  this.buildEvent({kind:'onSpecial',sourceId:member.uid,element});
  if(s.result!==null)return;
  castSpecial({state:s,member,profile,element,
   damage:(32+(member.attackLevel-1)*2)*levelPowerMultiplier(member.level)*(1+mod.power),radiusScale:1+mod.radius,durationScale:1+mod.duration,extraProjectiles:mod.projectiles,
   move:(dx,dz)=>this.obstacles.move(s.player,dx,dz),
   hit:(enemy,damage,type,sourceId,status)=>this.damageEnemy(enemy,damage,type,sourceId,status),
   visual:event=>this.emit(event),heal:amount=>this.healSpecial(amount),
  });
 }
 private healSpecial(amount:number){const s=this.state;if(s.challenge==='famine'||s.result!==null)return;
  s.player.hp=Math.min(s.player.maxHp,s.player.hp+amount);
  for(const member of s.party)member.hp=Math.min(member.maxHp,member.hp+amount);
 }
 private bossVolley(e:Enemy,facing:number){const angle=Math.PI/2-facing;
  this.animateAttack(e,facing,ATTACK_ANIMATION.bossSeconds);
  for(let i=-3;i<=3;i++){const a=angle+i*.18;addProjectile(this.state,{x:e.x,z:e.z,vx:Math.cos(a)*BOSS_RULES.volleySpeed,vz:Math.sin(a)*BOSS_RULES.volleySpeed,ttl:4,damage:BOSS_RULES.volleyDamage,size:.55,kind:'bolt',type:'psychic',penetration:0,friendly:false,sourceId:e.uid,poisonChance:0,silhouette:'needle',moveName:'Psystrike'});}
  this.emit({kind:'boss',x:e.x,z:e.z,color:'#d29eff'});
 }
 private bossSummon(boss:Enemy){const s=this.state,budget=Math.min(DESIGN.maxEnemies,s.director?.enemyBudget||DESIGN.maxEnemies);
  for(let i=0;i<BOSS_RULES.summonCount;i++){
   if(s.enemies.filter(enemy=>!enemy.dead).length>=budget){recordDirectorSpawn(s,false);break;}
   const pos=enemySpawnPosition(s.player,this.rng,BOSS_RULES.summonMinDistance,BOSS_RULES.summonMaxDistance);
   const enemy=createEnemy(s,this.rng,this.rng.pick([64,67,93,97]),i%2?'dark':'rocket',pos.x,pos.z);
   // Adds are regular faction enemies; the charge does not introduce bespoke minion attacks.
   s.enemies.push(enemy);recordDirectorSpawn(s,true);
  }
  this.emit({kind:'boss',x:boss.x,z:boss.z,label:'Mewtwo calls reinforcements',shape:'summon'});
 }
 private updatePsychicRings(dt:number,previous:Map<number,{x:number;z:number}>){const s=this.state;
  for(const ring of s.psychicRings||[]){
   ring.previousRadius=ring.radius;ring.radius=Math.min(ring.maxRadius,ring.radius+ring.speed*dt);
   for(const member of [...s.party]){
    if(ring.hit.has(member.uid))continue;
    const leader=member===s.party[0],position=leader?s.player:member,from=previous.get(member.uid)||position;
    if(!movingRingIntersects(from,position,ring,ring.previousRadius,ring.radius,ring.width/2+(leader?DESIGN.playerRadius:.55)))continue;
    ring.hit.add(member.uid);
    if(leader){if(s.player.y<BOSS_RULES.jumpClearance)this.hurtPlayer(ring.damage,false,false,false,ring.sourceId);}
    else this.hurtCompanion(member,ring.damage*.55,false,ring.sourceId);
    if(s.result!==null)return;
   }
  }
  s.psychicRings=(s.psychicRings||[]).filter(ring=>ring.radius<ring.maxRadius);
 }
 private activatePOI(poi:POI){const s=this.state;
  if(poi.used)return;
  if(poi.kind==='cache'){
   const cost=chestCost(s,poi);
   if((s.coins??0)<cost){this.emit({kind:'log',label:`Supply chest costs ${cost} coins. You have ${s.coins??0}.`});return;}
   const source=cost?'shop':'cache',options=makeChoices(s,this.rng,source);
   if(!options.length){delete s.choiceSource;this.emit({kind:'log',label:'All available rewards are already collected or fully trained.'});return;}
   s.coins=(s.coins??0)-cost;if(cost)s.chestPurchases=(s.chestPurchases??0)+1;
   poi.used=true;this.enterChoice(options,cost?`Supply chest — choose your ${cost}-coin purchase`:'Treasure cache — choose an item',source);
  }
  if(poi.kind==='elite'||poi.kind==='shrine'){
   s.enemies=s.enemies.filter(enemy=>!enemy.dead);
   if(s.enemies.length>=DESIGN.maxEnemies-(s.bossSpawned?0:1)){this.emit({kind:'log',label:'Too many enemies nearby. Clear a path first.'});return;}
  }
  poi.used=true;
  if(poi.kind==='cache'){
   // The purchase was validated and opened above; rare exploration hooks still apply.
  }else if(poi.kind==='healing'){
   if(s.challenge==='famine')this.emit({kind:'interact',label:'Dry spring / Famine disables field healing.',x:poi.x,z:poi.z});
   else {s.player.hp=Math.min(s.player.maxHp,s.player.hp+42);for(const member of s.party){member.hp=Math.min(member.maxHp,member.hp+35);}this.emit({kind:'interact',label:'Restored 42 HP!',x:poi.x,z:poi.z,color:'#90ff9c'});}
  }else if(poi.kind==='shrine'){
   const id=this.rng.pick([26,38,59,65,76,94,112,130,143]);
   const guardian=createGuardian(s,this.rng,id,poi.x+4,poi.z+4,true);
   s.enemies.push(guardian);this.emit({kind:'interact',label:`Shrine guardian ${getSpecies(id).name}: defeat it to claim the blessing!`,x:poi.x,z:poi.z,color:'#d2b5ff'});
  }else{
   const id=this.rng.pick([26,38,59,65,76,94,112,130,143]);const e=createGuardian(s,this.rng,id,poi.x+4,poi.z+4);s.enemies.push(e);this.emit({kind:'interact',label:`Elite ${getSpecies(id).name} appeared!`,x:poi.x,z:poi.z,color:'#ffc775'});
  }
  const rare=rareEventFor(s.seed,poi);
  if(rare){
   if(!(rare.kind==='wild-bloom'&&s.challenge==='famine'))this.emit({kind:'log',label:rare.label});
   if(rare.kind==='wild-bloom'){
    if(s.challenge!=='famine'){s.player.hp=Math.min(s.player.maxHp,s.player.hp+25);for(const member of s.party)member.hp=Math.min(member.maxHp,member.hp+25);}
   }else if(rare.kind==='ancient-echo'){s.buffs.luck=(s.buffs.luck||0)+.03;s.player.specialCooldown=0;}
   else for(let i=0;i<2;i++){
    const enemy=spawnRandomEnemy(s,this.rng,{capacity:s.director?.enemyBudget||DESIGN.maxEnemies,variantWeights:{rocket:1},speciesTier:s.director?.speciesTier,allowRare:false});
    recordDirectorSpawn(s,!!enemy);if(enemy)s.enemies.push(enemy);
   }
  }
 }
 /** QA hooks, enabled by ?dev=1 only. */
 debugAdvance(seconds:number){this.state.stats.elapsed=Math.max(0,this.state.stats.elapsed+seconds);}
 debugLevel(){const leader=this.state.party[0],next=nextMilestone(leader.level);if(next===null)return;
  const needed=Array.from({length:next-leader.level},(_,index)=>xpThreshold(leader.level+index)).reduce((sum,xp)=>sum+xp,0);
  this.gainXP(Math.max(0,needed-(leader.xp??0)),leader.uid);
 }
 debugHeal(){this.state.player.hp=this.state.player.maxHp;}
}
