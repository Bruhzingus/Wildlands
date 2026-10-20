import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio,AUDIO_LIMITS} from '../src/game/audio.ts';
import {soundIdentity,musicNotes} from '../src/data/audio.ts';
import {Simulation,type GameEvent} from '../src/game/Simulation.ts';

class FakeParam{
 value=0;
 setValueAtTime(value:number,_time:number){this.value=value;}
 linearRampToValueAtTime(value:number,_time:number){this.value=value;}
 exponentialRampToValueAtTime(value:number,_time:number){this.value=value;}
}
class FakeNode{
 connections=0;
 connect(_node:unknown){this.connections++;}
 disconnect(){this.connections=0;}
}
class FakeGain extends FakeNode{gain=new FakeParam();}
class FakeOscillator extends FakeNode{
 frequency=new FakeParam();type='sine';onended:(()=>void)|null=null;startAt=Infinity;stopAt=Infinity;ended=false;context:FakeContext;
 constructor(context:FakeContext){super();this.context=context;}
 start(when:number){this.startAt=when;}
 stop(when=this.context.currentTime){this.stopAt=when;}
}
class FakeCompressor extends FakeNode{
 threshold=new FakeParam();knee=new FakeParam();ratio=new FakeParam();attack=new FakeParam();release=new FakeParam();
}
class FakeContext{
 state='running';currentTime=0;destination={};nodes:FakeNode[]=[];resumeCount=0;closeCount=0;rejectResume=false;
 createGain(){const node=new FakeGain();this.nodes.push(node);return node;}
 createDynamicsCompressor(){const node=new FakeCompressor();this.nodes.push(node);return node;}
 createOscillator(){const node=new FakeOscillator(this);this.nodes.push(node);return node;}
 async resume(){this.resumeCount++;if(this.rejectResume)throw new Error('Blocked device');this.state='running';}
 async close(){this.closeCount++;this.state='closed';}
 advance(seconds:number){
  this.currentTime+=seconds;
  for(const node of this.nodes)if(node instanceof FakeOscillator&&!node.ended&&node.stopAt<=this.currentTime){node.ended=true;node.onended?.();}
 }
}
function fixture(settings={soundVolume:.18,musicVolume:.07}){
 const context=new FakeContext();let created=0;
 const audio=new GameAudio(settings,()=>{created++;return context as unknown as AudioContext;});
 return {audio,context,created:()=>created};
}

test('audio allocates only inside an explicit unlock gesture and reuses one graph',()=>{
 const {audio,context,created}=fixture();
 audio.setActive(true);audio.onEvent({kind:'attack'});audio.cue('upgrade');audio.update(60);
 assert.equal(created(),0);assert.equal(audio.inspect().state,'locked');assert.equal(context.nodes.length,0);
 audio.unlock();audio.unlock();assert.equal(created(),1);assert.equal(context.nodes.length,3);
 assert.equal(audio.inspect().soundGain,.18);assert.equal(audio.inspect().musicGain,.07);
 audio.onEvent({kind:'attack'});assert.equal(audio.inspect().voices,1);
 context.advance(.2);assert.equal(audio.inspect().voices,0);assert.equal(audio.inspect().completedVoices,1);
 assert.equal(context.nodes.filter(node=>node.connections>0).length,3);
 audio.dispose();assert.equal(context.closeCount,1);assert.equal(context.nodes.filter(node=>node.connections>0).length,0);
});

test('combat bursts are rate limited globally rather than per target and respect voice priority',()=>{
 const {audio,context}=fixture();audio.unlock();audio.setActive(true);
 for(let i=0;i<500;i++){
  audio.onEvent({kind:'attack',sourceId:i});
  audio.onEvent({kind:'hit',targetId:i,amount:10,damageTo:'enemy'});
 }
 assert.equal(audio.inspect().cues.attack,1);assert.equal(audio.inspect().cues.impact,1);
 assert.equal(audio.inspect().voices,2);assert.equal(audio.inspect().deniedCues,998);
 for(const kind of ['crit','hurt','special','level','interact','boss','upgrade','recruit','evolve','victory','defeat','faint','ready'] as const){
  audio.cue(kind);assert.ok(audio.inspect().voices<=AUDIO_LIMITS.maxVoices);
 }
 assert.ok(audio.inspect().cues.special);assert.ok(audio.inspect().cues.boss);
 assert.ok(audio.inspect().stoppedVoices>0,'higher priority cues replace the least important voices');
 context.advance(4);assert.equal(audio.inspect().voices,0);audio.dispose();
});

test('pause cancels current and future notes and never queues gameplay events or ambient catch-up',()=>{
 const {audio,context}=fixture();audio.unlock();audio.setActive(true);audio.cue('special');
 for(let i=0;i<7;i++)audio.update(.1);
 assert.equal(audio.inspect().ambientNotes,3);assert.ok(audio.inspect().voices>=3);
 audio.setActive(false);assert.equal(audio.inspect().voices,0);
 for(let i=0;i<100;i++){audio.onEvent({kind:'attack'});audio.update(60);}
 context.advance(100);assert.equal(audio.inspect().voices,0);assert.equal(audio.inspect().cues.attack,undefined);
 audio.setActive(true);audio.update(600);assert.equal(audio.inspect().ambientNotes,3,'tab-regain dt must not play a burst or an immediate note');
 for(let i=0;i<13;i++)audio.update(.1);
 assert.equal(audio.inspect().ambientNotes,4);assert.equal(audio.inspect().musicVoices,1);
 assert.equal(audio.inspect().cues.special,1,'resume never replays an intro or a special');audio.dispose();
});

test('one explicit menu cue can finish while repeated paused frames stay silent',()=>{
 const {audio,context}=fixture();audio.unlock();audio.setActive(true);audio.setActive(false);audio.cue('recruit');
 assert.equal(audio.inspect().voices,3);
 for(let i=0;i<30;i++){audio.setActive(false);audio.update(.1);audio.onEvent({kind:'evolve'});}
 assert.equal(audio.inspect().cues.recruit,1);assert.equal(audio.inspect().cues.evolve,undefined);assert.equal(audio.inspect().voices,3);
 context.advance(1);assert.equal(audio.inspect().voices,0);audio.dispose();
});

test('blur silences an already paused menu cue and semantic faint events produce a bounded warning',()=>{
 const {audio,context}=fixture();audio.unlock();audio.cue('level');assert.equal(audio.inspect().voices,3);
 audio.silence();assert.equal(audio.inspect().voices,0);context.advance(1);assert.equal(audio.inspect().voices,0);
 audio.setActive(true);audio.onEvent({kind:'faint',sourceId:2,amount:7});audio.onEvent({kind:'faint',sourceId:3,amount:1});
 assert.equal(audio.inspect().cues.faint,1);assert.equal(audio.inspect().voices,2);audio.dispose();
});

test('volume changes mute active buses immediately, clamp values and retain other settings',()=>{
 const {audio}=fixture();audio.unlock();audio.setActive(true);audio.cue('special');
 for(let i=0;i<7;i++)audio.update(.1);
 audio.setSettings({soundVolume:0});assert.equal(audio.inspect().soundVoices,0);assert.equal(audio.inspect().musicVoices,3);assert.equal(audio.inspect().musicVolume,.07);
 audio.cue('upgrade');assert.equal(audio.inspect().soundVoices,0);
 audio.setSettings({musicVolume:0});assert.equal(audio.inspect().voices,0);
 audio.setSettings({soundVolume:2,musicVolume:-1});assert.equal(audio.inspect().soundGain,1);assert.equal(audio.inspect().musicGain,0);
 audio.setSettings({soundVolume:NaN,musicVolume:Infinity});assert.equal(audio.inspect().soundVolume,1);assert.equal(audio.inspect().musicVolume,0);audio.dispose();
});

test('resetting ten runs reuses graph ownership and full disposal prevents later allocation',()=>{
 const {audio,context,created}=fixture();audio.unlock();
 for(let run=0;run<10;run++){
  audio.setActive(true);audio.cue('level');assert.equal(audio.inspect().voices,3);audio.reset();
  assert.equal(audio.inspect().voices,0);assert.equal(audio.inspect().nodes,3);assert.deepEqual(audio.inspect().cues,{});
  assert.equal(context.nodes.filter(node=>node.connections>0).length,3);
 }
 assert.equal(created(),1);audio.dispose();audio.dispose();audio.unlock();audio.setActive(true);audio.cue('level');audio.update(30);
 assert.equal(created(),1);assert.equal(context.closeCount,1);assert.equal(audio.inspect().state,'disposed');assert.equal(audio.inspect().nodes,0);assert.equal(audio.inspect().voices,0);
});

test('unavailable devices and rejected autoplay resume remain optional and can retry on a new gesture',async()=>{
 let creates=0;const unavailable=new GameAudio({},()=>{creates++;throw new Error('No audio device');});
 assert.doesNotThrow(()=>unavailable.unlock());unavailable.unlock();assert.equal(creates,1);assert.equal(unavailable.inspect().state,'unavailable');unavailable.dispose();
 const {audio,context}=fixture();context.state='suspended';context.rejectResume=true;
 audio.unlock();audio.unlock();assert.equal(context.resumeCount,1);audio.cue('upgrade');assert.equal(audio.inspect().voices,0);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(audio.inspect().resumePending,false);assert.equal(audio.inspect().errors,1);
 context.rejectResume=false;audio.unlock();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(context.resumeCount,2);audio.cue('upgrade');assert.equal(audio.inspect().voices,2);audio.dispose();
});

test('all 151 species have stable distinct soft identities without growing polyphony',()=>{
 const identities=new Set<string>();
 for(let id=1;id<=151;id++){
  const identity=soundIdentity(id);identities.add(JSON.stringify(identity));
  assert.deepEqual(soundIdentity(id),identity);assert.ok(['sine','triangle'].includes(identity.wave));
  const {audio,context}=fixture();audio.unlock();audio.cue('attack',id);
  assert.equal(audio.inspect().voices,1);
  const oscillator=context.nodes.find(node=>node instanceof FakeOscillator) as FakeOscillator;
  assert.ok(oscillator.frequency.value>50&&oscillator.frequency.value<1800);
  assert.ok(oscillator.stopAt<.2);audio.dispose();
 }
 assert.equal(identities.size,151);
 assert.notEqual(soundIdentity(4).wave,soundIdentity(7).wave);
 assert.notEqual(soundIdentity(7).pitch,soundIdentity(25).pitch);
});

test('successful movement emits once; cooldown, airborne, held and paused input stay quiet',()=>{
 const sim=new Simulation(7,52),events:GameEvent[]=[];
 sim.state.enemies=[];sim.onEvent=event=>events.push(event);
 const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
 sim.update(.02,{...idle,jump:true,dodge:true});
 for(let i=0;i<5;i++)sim.update(.02,{...idle,jump:true,dodge:true});
 sim.update(.02,idle);sim.update(.02,{...idle,jump:true,dodge:true});
 sim.pause();sim.update(.02,{...idle,jump:true,dodge:true});
 for(const kind of ['jump','dash']){
  const actions=events.filter(event=>event.kind===kind);
  assert.equal(actions.length,1);assert.equal(actions[0].speciesId,7);assert.equal(actions[0].sourceId,1);
 }
 assert.equal(events.filter(event=>event.kind==='attack').length,0);
});

test('projectile casts carry species and visual repeats do not replay their sound',()=>{
 const sim=new Simulation(7,52),{audio}=fixture();audio.unlock();audio.setActive(true);
 const target=sim.state.enemies[0];target.x=4;target.z=0;target.hp=target.maxHp=10000;sim.state.enemies=[target];sim.state.party[0].cooldown=0;
 const events:GameEvent[]=[];sim.onEvent=event=>{events.push(event);audio.onEvent(event,sim.state);};
 sim.update(.02,{mx:0,mz:0,jump:false,dodge:false,special:false,interact:false});
 assert.ok(events.some(event=>event.kind==='cast'&&event.speciesId===7));assert.equal(audio.inspect().cues.attack,1);
 audio.onEvent({kind:'attack',sourceId:1},sim.state);audio.onEvent({kind:'chain',sourceId:1},sim.state);
 assert.equal(audio.inspect().cues.attack,1);audio.dispose();
});

test('crowd deaths share an impact budget, distant combat is silent and movement stays audible',()=>{
 const {audio,context}=fixture(),sim=new Simulation(25,52);audio.unlock();audio.setActive(true);
 for(let i=0;i<151;i++)audio.onEvent({kind:'kill',speciesId:i+1});
 assert.equal(audio.inspect().cues.kill,1);
 audio.onEvent({kind:'hit',amount:10,damageTo:'enemy'});
 assert.equal(audio.inspect().cues.impact,undefined);
 audio.onEvent({kind:'jump',sourceId:1,speciesId:25},sim.state);
 audio.onEvent({kind:'dash',sourceId:1,speciesId:25},sim.state);
 assert.equal(audio.inspect().cues.jump,1);assert.equal(audio.inspect().cues.dash,1);
 context.advance(1);
 audio.onEvent({kind:'attack',x:100,z:100},sim.state);
 assert.equal(audio.inspect().cues.attack,undefined);
  audio.onEvent({kind:'boss',x:100,z:100},sim.state);assert.equal(audio.inspect().cues.boss,1,'global warnings remain audible');
 audio.onEvent({kind:'faint',speciesId:7},sim.state);assert.equal(audio.inspect().cues.faint,1);audio.dispose();
});

test('a lethal hit leaves room for the enemy defeat cue rather than masking it',()=>{
 const {audio}=fixture(),sim=new Simulation(7,52);audio.unlock();audio.setActive(true);
 const enemy=sim.state.enemies[0];enemy.hp=0;enemy.x=3;enemy.z=0;
 audio.onEvent({kind:'hit',amount:10,damageTo:'enemy',sourceId:1,targetId:enemy.uid,x:3,z:0},sim.state);
 audio.onEvent({kind:'kill',sourceId:1,targetId:enemy.uid,speciesId:enemy.speciesId},sim.state);
 assert.equal(audio.inspect().cues.impact,undefined);assert.equal(audio.inspect().cues.kill,1);audio.dispose();
});

test('music continues underneath sustained combat with bounded voices and complete cleanup',()=>{
 const {audio,context}=fixture();audio.unlock();audio.setActive(true);
 let heardMusic=false;
 for(let frame=0;frame<2400;frame++){
  context.advance(.05);audio.update(.05);
  for(let enemy=0;enemy<20;enemy++){
   audio.onEvent({kind:'cast',speciesId:enemy+1});
   audio.onEvent({kind:'hit',amount:1,damageTo:'enemy'});
   audio.onEvent({kind:'kill',speciesId:enemy+1});
  }
  if(frame%200===0)audio.cue('special',25);
  const report=audio.inspect();heardMusic||=report.musicVoices>0;
  assert.ok(report.voices<=12);assert.ok(report.soundVoices<=8);assert.ok(report.musicVoices<=4);
 }
 assert.ok(heardMusic);assert.ok(audio.inspect().ambientNotes>80);assert.equal(audio.inspect().errors,0);
 audio.silence();assert.equal(audio.inspect().voices,0);assert.equal(context.nodes.filter(node=>node.connections>0).length,3);
 audio.dispose();
 assert.ok(musicNotes(1).length===0,'rests are intentional');
 assert.notDeepEqual(musicNotes(28),musicNotes(60),'alternate phrase ending');
});
