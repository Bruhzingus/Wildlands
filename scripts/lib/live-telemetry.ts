/** Optional Vite-development console tool. Never imported by the application/build. */
import type {Simulation,EventListener,MoveInput} from '../../src/game/Simulation.ts';
import {RunMetricRecorder,normalizeExperiment} from './run-metrics.ts';

interface PlaytestHost {sim:Simulation|null;ui:{onStart:(id:number)=>void}}
export interface PlaytestNotes {clarity?:string;comfort?:string;difficulty?:string;buildIntent?:string;other?:string}

/** Arm at the title screen, then use the actual UI/input. No bot inputs or health writes. */
export function armPlaytest(host:PlaytestHost){
 if(!host?.ui||typeof host.ui.onStart!=='function')throw Error('Pass the Vite development window.__WILDLANDS__ game');
 if(host.sim)throw Error('Return to the title screen before arming a complete playtest');
 const originalStart=host.ui.onStart;
 let sim:Simulation|null=null,recorder:RunMetricRecorder|null=null,finished=false;
 let originalUpdate:Simulation['update']|null=null,originalChoose:Simulation['choose']|null=null,originalEvent:EventListener|null=null;
 let wrappedUpdate:Simulation['update']|null=null,wrappedChoose:Simulation['choose']|null=null,wrappedEvent:EventListener|null=null;
 const restore=()=>{
  if(host.ui.onStart===wrappedStart)host.ui.onStart=originalStart;
  if(sim){
   if(sim.update===wrappedUpdate&&originalUpdate)sim.update=originalUpdate;
   if(sim.choose===wrappedChoose&&originalChoose)sim.choose=originalChoose;
   if(sim.onEvent===wrappedEvent&&originalEvent)sim.onEvent=originalEvent;
  }
 };
 const wrappedStart=(id:number)=>{
  originalStart(id);sim=host.sim;
  if(!sim)throw Error('The selected starter did not create a simulation');
  host.ui.onStart=originalStart;
  const state=sim.state;
  if(state.stats.elapsed>.001)throw Error('Recording must attach before the first simulation tick');
  recorder=new RunMetricRecorder(normalizeExperiment({seed:state.seed,starter:id,seconds:7200}),state);
  originalUpdate=sim.update;originalChoose=sim.choose;originalEvent=sim.onEvent;
  wrappedEvent=event=>{recorder!.event(event);originalEvent!.call(sim,event);};
  wrappedChoose=function(choiceId:string){
   recorder!.offered(state);const choice=state.upgradeChoices.find(choice=>choice.id===choiceId);
   const accepted=originalChoose!.call(sim,choiceId);if(choice)recorder!.selected(state,choice,accepted);return accepted;
  };
  wrappedUpdate=function(dt:number,input:MoveInput){
   const before=state.stats.elapsed,active=state.phase==='playing'||state.phase==='boss';
   if(active&&Number.isFinite(dt)&&dt>0)recorder!.beforeStep(state,Math.min(.04,dt));
   originalUpdate!.call(sim,dt,input);
   if(state.stats.elapsed!==before){recorder!.sample(state);recorder!.offered(state);}
  };
  sim.onEvent=wrappedEvent;sim.choose=wrappedChoose;sim.update=wrappedUpdate;
 };
 host.ui.onStart=wrappedStart;
 return {
  status:()=>finished?'finished':sim?'recording':'armed',
  cancel:()=>{restore();finished=true;},
  finish:(notes:PlaytestNotes={})=>{
   if(finished)throw Error('This recording has already finished or was canceled');
   if(!sim||!recorder)throw Error('Choose a starter through the actual title screen first');
   recorder.offered(sim.state);const metrics=recorder.finish(sim.state);restore();finished=true;
   return {schemaVersion:1,kind:'local-human-playtest',methodology:'Real UI and input; no scripted movement, choice selection, health maintenance, renderer changes or network. Notes are human observations.',
    notes:{...notes},metrics:{...metrics,config:{seed:sim.state.seed,starter:metrics.config.starter,seconds:metrics.elapsed,behavior:'human',build:'human-choice',maintainHealth:false,continueEndless:sim.state.endless,step:'game-loop',
     pools:'actual-save',itemUnlocks:sim.state.itemUnlocks??'legacy-full',recruitUnlocks:sim.state.recruitUnlocks??'legacy-full'}}};
  },
 };
}

export function downloadPlaytest(report:unknown,filename='wildlands-playtest.json'){
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'})),anchor=document.createElement('a');
 try{anchor.href=url;anchor.download=filename;anchor.click();}finally{URL.revokeObjectURL(url);}
}
