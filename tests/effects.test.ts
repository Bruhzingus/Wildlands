import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,VertexBuffer,type InstancedMesh} from '@babylonjs/core';
import {Effects} from '../src/game/render/Effects.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {COMBAT_VISUALS,DESIGN} from '../src/data/config.ts';
import type {Projectile} from '../src/game/types.ts';
import {createEnemy} from '../src/game/systems/spawning.ts';
import {prepareEnemyMove} from '../src/game/combat/enemies.ts';

const shot=(uid:number,shape:Projectile['silhouette']='needle'):Projectile=>({uid,x:2,z:3,prevX:1,prevZ:3,vx:10,vz:0,ttl:1,damage:8,size:.4,kind:'bolt',type:'water',penetration:0,hit:new Set(),friendly:true,sourceId:1,poisonChance:0,silhouette:shape});
const setup=(reducedMotion=false)=>{
 const engine=new NullEngine(),scene=new Scene(engine),state=new Simulation(25,12).state;
 const effects=new Effects(scene,{height:()=>0},reducedMotion);state.enemies=[];state.projectiles=[];state.drops=[];
 return {engine,scene,state,effects,dispose:()=>{effects.dispose();scene.dispose();engine.dispose();}};
};

test('enemy tells show committed melee coverage, compact launch cues and a bomb countdown throughout its flight',()=>{
 const t=setup();try{
  const sim=new Simulation(7,1),melee=createEnemy(t.state,sim.rng,19,'normal',2,0),ranged=createEnemy(t.state,sim.rng,25,'normal',8,0),bomber=createEnemy(t.state,sim.rng,102,'normal',10,0);
  t.state.enemies=[melee,ranged,bomber];
  for(const enemy of t.state.enemies)enemy.windup=prepareEnemyMove(enemy,{x:0,z:0});
  t.effects.update(t.state,0);
  const cone=t.scene.getMeshByName(`combat-windup-${melee.uid}`)!;
  const positions=cone.getVerticesData(VertexBuffer.PositionKind)!;
  assert.ok(positions.filter((_,i)=>i%3===2).every(z=>z>=0),'melee warning stays in the committed forward cone');
  assert.equal(cone.rotation.y,-Math.PI/2);
  assert.equal(t.scene.getMeshByName(`combat-windup-aim-${ranged.uid}`),null,'no full-range aim line');
  assert.ok(t.scene.getMeshByName(`combat-charge-${ranged.uid}`)?.isEnabled());
  assert.equal(t.scene.getMeshByName(`combat-windup-${ranged.uid}`)!.scaling.x,2.3);
  const landing=t.scene.getMeshByName(`combat-windup-${bomber.uid}`)!;
  assert.equal(landing.position.x,0);assert.equal(landing.position.z,0);assert.equal(landing.scaling.x,3.4);
  bomber.windup=undefined;
  t.state.projectiles=[{...shot(400,'lob'),friendly:false,kind:'lob',x:5,z:0,ttl:1,duration:2,blastX:0,blastZ:0,radius:3.4}];
  t.effects.update(t.state,0);
  assert.equal(t.scene.getMeshByName(`combat-windup-${bomber.uid}`)?.isEnabled()??false,false);
  const persistent=t.scene.getMeshByName('combat-bomb-landing-400')!,bomb=t.scene.getMeshByName('combat-projectile-400')!;
  assert.equal(persistent.position.x,0);assert.equal(persistent.scaling.x,3.4);assert.ok(bomb.position.y>3);
  const before=bomb.position.asArray();t.effects.update(t.state,0);assert.deepEqual(bomb.position.asArray(),before);
  t.state.projectiles=[];t.effects.update(t.state,0);assert.equal(persistent.isEnabled(),false);
 }finally{t.dispose();}
});

test('warning edges conform to slopes and their clock advances only with authoritative windup time',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),state=new Simulation(25,4).state,ground=(x:number,z:number)=>Math.sin(x*.4)*.7+z*.12;
 const effects=new Effects(scene,{height:ground});
 try{
  state.enemies=[createEnemy(state,new Simulation(7,1).rng,100,'normal',3,5)];state.projectiles=[];state.drops=[];
  const enemy=state.enemies[0];enemy.windup=prepareEnemyMove(enemy,state.player);enemy.windup.remaining=enemy.windup.duration*.75;
  effects.update(state,0);const mesh=scene.getMeshByName(`combat-windup-${enemy.uid}`)!;
  const early=Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!);
  mesh.computeWorldMatrix(true);
  for(let i=0;i<early.length;i+=3){
   const x=early[i]*mesh.scaling.x,z=early[i+2]*mesh.scaling.z,c=Math.cos(mesh.rotation.y),s=Math.sin(mesh.rotation.y);
   const expected=ground(mesh.position.x+x*c+z*s,mesh.position.z-x*s+z*c);
   const clearance=early[i+1]+mesh.position.y-expected;
   assert.ok(clearance>=.069&&clearance<=.107,'every part of the warning is above sampled terrain');
  }
  effects.update(state,0);assert.deepEqual(Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!),early);
  enemy.windup.remaining=enemy.windup.duration*.1;effects.update(state,0);
  assert.equal(mesh.metadata.progress,.9);assert.equal(mesh.scaling.x,enemy.windup.radius);
  assert.notDeepEqual(Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!),early);
  state.enemies=[];effects.update(state,0);assert.equal(mesh.isEnabled(),false);
 }finally{effects.dispose();scene.dispose();engine.dispose();}
});

test('hostile shots retain elemental silhouettes without decorative rings while launch cues stay compact',()=>{
 const t=setup();try{
  t.state.projectiles=[
   {...shot(501),friendly:false,type:'poison'},
   {...shot(502),friendly:false,type:'grass'},
   {...shot(503),friendly:false,type:'electric'},
   {...shot(504,'lob'),friendly:false,kind:'lob',moveName:'Egg Bomb',duration:2,ttl:1,radius:3.4},
  ];
  t.effects.update(t.state,0);
  for(const [i,shape] of ['dart','leaf','spark','egg'].entries()){
   const mesh=t.scene.getMeshByName(`combat-projectile-${501+i}`)! as InstancedMesh;
   assert.ok(mesh.sourceMesh.name.includes(`${shape}/`));
   assert.equal(t.scene.getMeshByName(`combat-hostile-rim-${501+i}`),null);
  }
  t.effects.onEvent({kind:'attack',shape:'psychic-cross',x:0,z:0,toX:20,toZ:0,radius:.15});
  assert.equal(t.scene.getMeshByName('combat-attack-psychic-cross'),null);
  assert.ok(t.scene.getMeshByName('combat-attack-release'));
  t.state.projectiles=[];t.effects.update(t.state,1);
  assert.equal(t.effects.inspect().projectiles,0);
 }finally{t.dispose();}
});

test('bomb landing clocks include preparation and do not restart at release',()=>{
 const t=setup();try{
  const sim=new Simulation(7,1),bomber=createEnemy(t.state,sim.rng,102,'normal',10,0);
  bomber.windup=prepareEnemyMove(bomber,{x:0,z:0});bomber.windup.remaining=0;
  t.state.enemies=[bomber];t.effects.update(t.state,0);
  const before=t.scene.getMeshByName(`combat-windup-${bomber.uid}`)!.metadata.progress,flight=10/5.8,total=flight+bomber.windup.duration;
  bomber.windup=undefined;
  t.state.projectiles=[{...shot(800,'lob'),friendly:false,kind:'lob',ttl:flight,duration:flight,warningDuration:total,blastX:0,blastZ:0,radius:3.4}];
  t.effects.update(t.state,0);
  const after=t.scene.getMeshByName('combat-bomb-landing-800')!.metadata.progress;
  assert.equal(after,before);assert.ok(after>0&&after<.5);
  t.state.projectiles[0].ttl=.01;t.effects.update(t.state,0);
  assert.ok(t.scene.getMeshByName('combat-bomb-landing-800')!.metadata.progress>.99);
 }finally{t.dispose();}
});

test('crowded successive enemy waves keep warning geometry, charge colors and disposal bounded',()=>{
 const t=setup();try{
  const sim=new Simulation(7,1);
  for(let wave=0;wave<12;wave++){
   t.state.enemies=Array.from({length:16},(_,i)=>{
    const e=createEnemy(t.state,sim.rng,i%2?25:113,'normal',i%4*3,Math.floor(i/4)*3);
    e.windup=prepareEnemyMove(e,{x:0,z:0});e.windup.remaining=e.windup.duration*.5;return e;
   });
   t.state.projectiles=Array.from({length:16},(_,i)=>({...shot(1000+wave*16+i,'lob'),friendly:false,kind:'lob',duration:2,ttl:1,blastX:i,blastZ:0,radius:3.4}));
   t.effects.update(t.state,0);
   assert.equal(t.effects.inspect().windups,32);assert.ok(t.effects.inspect().allocated<=COMBAT_VISUALS.maxPoolInstances);
   if(wave>1)assert.equal(t.effects.inspect().allocated,64,'48 warning parts + 16 shots, reused');
   const a=t.scene.getMeshByName(`combat-charge-${t.state.enemies[0].uid}`)! as InstancedMesh;
   const b=t.scene.getMeshByName(`combat-charge-${t.state.enemies[1].uid}`)! as InstancedMesh;
   assert.notDeepEqual(a.instancedBuffers.instanceColor,b.instancedBuffers.instanceColor,'different types keep independent colors');
  }
  t.effects.dispose();assert.equal(t.scene.meshes.length,0);
 }finally{t.dispose();}
});

test('projectile visuals are recycled across many volleys instead of accumulating meshes',()=>{
 const t=setup();try{
  for(let wave=0;wave<80;wave++){
   t.state.projectiles=Array.from({length:12},(_,i)=>shot(100+wave*12+i));t.effects.update(t.state,.02);
   assert.equal(t.effects.inspect().projectiles,12);
   t.state.projectiles=[];t.effects.update(t.state,.02);
  }
  assert.equal(t.effects.inspect().allocated,12);assert.equal(t.effects.inspect().pooled,12);
  assert.equal(t.scene.meshes.length,13,'One prototype plus twelve reused instances');
 }finally{t.dispose();}
});

test('hard-hit windups and bounded attack effects freeze behind paused menus',()=>{
 const t=setup();try{
  const enemy=new Simulation(25,2).state.enemies[0];
  enemy.isBoss=true;enemy.windup={kind:'volley',remaining:.6,duration:.8,x:0,z:0,facing:0,radius:4};t.state.enemies=[enemy];
  for(let i=0;i<200;i++)t.effects.onEvent({kind:'attack',x:0,z:0,color:'#ff9748',amount:3});
  t.effects.update(t.state,.02);assert.equal(t.effects.inspect().effects,COMBAT_VISUALS.maxEffects);assert.equal(t.effects.inspect().windups,1);
  const before=t.scene.meshes.filter(m=>m.isVisible&&m.isEnabled()).map(m=>({name:m.name,scale:m.scaling.asArray(),position:m.position.asArray()}));
  for(let i=0;i<8;i++)t.effects.update(t.state,0);
  assert.deepEqual(t.scene.meshes.filter(m=>m.isVisible&&m.isEnabled()).map(m=>({name:m.name,scale:m.scaling.asArray(),position:m.position.asArray()})),before);
  enemy.windup=undefined;t.effects.update(t.state,.04);assert.equal(t.effects.inspect().windups,0);
  assert.ok(t.effects.inspect().allocated<=COMBAT_VISUALS.maxPoolInstances);
 }finally{t.dispose();}
});

test('combat rendering caps survive crowded volleys and every instance is released on disposal',()=>{
 const t=setup();try{
  // Babylon keeps its lazily-created default material for the scene lifetime.
  void t.scene.defaultMaterial;const baselineMaterials=[...t.scene.materials];
  t.state.projectiles=Array.from({length:DESIGN.maxProjectiles+20},(_,i)=>shot(100+i,(['orb','needle','beam','lob'] as const)[i%4]));
  t.state.drops=Array.from({length:DESIGN.maxActiveDrops+20},(_,i)=>({uid:1000+i,x:i,z:0,value:3,age:0,kind:'xp' as const}));
  t.effects.update(t.state,.02);
  assert.equal(t.effects.inspect().projectiles,DESIGN.maxProjectiles);assert.equal(t.effects.inspect().drops,DESIGN.maxActiveDrops);
  const silhouettes=new Set(t.scene.meshes.filter(m=>m.name.startsWith('combat-source-')).map(m=>m.name.split('/')[0]));assert.equal(silhouettes.size,4);
  t.effects.dispose();assert.equal(t.scene.meshes.length,0);assert.deepEqual(t.scene.materials,baselineMaterials);
 }finally{t.dispose();}
});

test('psychic waves follow terrain, pause exactly and reuse their bounded geometry',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),state=new Simulation(25,12).state;
 const ground=(x:number,z:number)=>Math.sin(x*.2)+z*.07,effects=new Effects(scene,{height:ground});state.enemies=[];state.projectiles=[];state.drops=[];
 try{
  for(let wave=0;wave<40;wave++){
   state.psychicRings=[{uid:900+wave,sourceId:2,x:3,z:5,radius:12,previousRadius:11,maxRadius:29,speed:7,width:1.1,damage:20,hit:new Set()}];
   effects.update(state,.02);assert.equal(effects.inspect().psychicRings,1);
   const mesh=scene.getMeshByName(`psychic-ring-${900+wave}`)!;
   const positions=mesh.getVerticesData(VertexBuffer.PositionKind)!;
   for(let i=0;i<positions.length;i+=3)assert.ok(Math.abs(positions[i+1]-ground(positions[i],positions[i+2])-.16)<.00001,'wave must stay above every terrain sample');
   const before=Array.from(positions);effects.update(state,0);assert.deepEqual(Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!),before);
   state.psychicRings=[];effects.update(state,.02);
  }
  assert.equal(effects.inspect().allocated,1);assert.equal(effects.inspect().pooled,1);assert.equal(scene.meshes.length,1);
  effects.dispose();assert.equal(scene.meshes.length,0);
 }finally{effects.dispose();scene.dispose();engine.dispose();}
});

test('slashes use a forward crescent, follow the attacker and sweep once with independent fading',()=>{
 const t=setup();try{
  t.state.party[0].facing=Math.PI/2;t.effects.update(t.state,0);
  const attack={kind:'attack' as const,x:0,z:0,color:'#ff9748',radius:3,shape:'slash',sourceId:1,duration:.4};
  t.effects.onEvent(attack);
  const slash=t.scene.getMeshByName('combat-attack')! as InstancedMesh;
  const positions=slash.getVerticesData(VertexBuffer.PositionKind)!;
  for(let i=0;i<positions.length;i+=3){assert.equal(positions[i+1],0);assert.ok(positions[i+2]>.6,'The arc must stay in front, without a rear half-ring');}
  assert.ok(positions.some((value,index)=>index%3===0&&value<-.5));
  assert.ok(positions.some((value,index)=>index%3===0&&value>.5));
  assert.equal(slash.rotation.y,Math.PI/2-.5);
  assert.equal(slash.instancedBuffers.instanceColor.a,.8);
  t.effects.update(t.state,.1);
  assert.ok(slash.rotation.y>Math.PI/2-.5&&slash.rotation.y<Math.PI/2+.5);
  assert.ok(slash.position.x>0);assert.ok(Math.abs(slash.position.z)<1e-10);
  assert.ok(slash.instancedBuffers.instanceColor.a>0&&slash.instancedBuffers.instanceColor.a<.8);
  const frozen={position:slash.position.asArray(),rotation:slash.rotation.asArray(),scale:slash.scaling.asArray(),alpha:slash.instancedBuffers.instanceColor.a};
  for(let i=0;i<8;i++)t.effects.update(t.state,0);
  assert.deepEqual({position:slash.position.asArray(),rotation:slash.rotation.asArray(),scale:slash.scaling.asArray(),alpha:slash.instancedBuffers.instanceColor.a},frozen);
  const enemy=new Simulation(25,2).state.enemies[0];enemy.facing=Math.PI;t.state.enemies=[enemy];
  t.effects.onEvent({...attack,sourceId:enemy.uid});
  const other=t.scene.meshes.filter(mesh=>mesh.name==='combat-attack')[1] as InstancedMesh;
  assert.equal(other.rotation.y,Math.PI-.5);assert.equal(other.instancedBuffers.instanceColor.a,.8);
  assert.equal(slash.instancedBuffers.instanceColor.a,frozen.alpha,'A new slash must not reset an older slash opacity');
  t.effects.update(t.state,.5);assert.equal(t.effects.inspect().effects,0);assert.equal(t.effects.inspect().pooled,2);
 }finally{t.dispose();}
});

test('reduced-motion slashes stay directional at rest and recycle their geometry and opacity',()=>{
 const t=setup(true);try{
  t.state.party[0].facing=-Math.PI/2;t.effects.update(t.state,0);
  for(let swing=0;swing<40;swing++){
   t.effects.onEvent({kind:'attack',x:2,z:3,radius:2,shape:'slash',sourceId:1,duration:.4});
   const slash=t.scene.getMeshByName('combat-attack')! as InstancedMesh;
   assert.equal(slash.rotation.y,-Math.PI/2);assert.equal(slash.instancedBuffers.instanceColor.a,.8);
   const pose={position:slash.position.asArray(),rotation:slash.rotation.asArray(),scale:slash.scaling.asArray()};
   t.effects.update(t.state,.1);
   assert.deepEqual({position:slash.position.asArray(),rotation:slash.rotation.asArray(),scale:slash.scaling.asArray()},pose);
   assert.ok(slash.instancedBuffers.instanceColor.a<.8);
   t.effects.update(t.state,.4);assert.equal(t.effects.inspect().effects,0);
  }
  assert.equal(t.effects.inspect().allocated,1);assert.equal(t.effects.inspect().pooled,1);assert.equal(t.scene.meshes.length,2);
 }finally{t.dispose();}
});

test('area rings lie horizontally and keep a thin height as their range increases',()=>{
 const t=setup();try{
  t.effects.onEvent({kind:'attack',x:0,z:0,radius:8,shape:'aura'});
  const ring=t.scene.getMeshByName('combat-attack')!;
  assert.equal(ring.rotation.x,0);assert.equal(ring.rotation.z,0);
  assert.equal(ring.scaling.x,8);assert.equal(ring.scaling.z,8);assert.equal(ring.scaling.y,1);
  const positions=ring.getVerticesData(VertexBuffer.PositionKind)!;
  const height=positions.filter((_,index)=>index%3===1);
  assert.ok(Math.max(...height)-Math.min(...height)<.05);
 }finally{t.dispose();}
});

test('named shots use recognizable geometry, pause their decorative motion and recycle all accents',()=>{
 const t=setup();try{
  const moves=[['Swift','normal','star'],['Surf','water','wave'],['Ember','fire','flame'],['Razor Leaf','grass','leaf'],['Bubble','water','bubble'],['Ice Beam','ice','crystal'],['Gust','flying','gust'],['Pay Day','normal','coin']] as const;
  for(let volley=0;volley<30;volley++){
   t.state.projectiles=moves.map(([moveName,type],i)=>({...shot(100+volley*10+i),moveName,type}));
   t.effects.update(t.state,.04);
   for(const [i,[,,shape]] of moves.entries()){
    const mesh=t.scene.getMeshByName(`combat-projectile-${100+volley*10+i}`) as InstancedMesh;
    assert.ok(mesh.sourceMesh.name.includes(`${shape}/`));
    assert.ok(t.scene.getMeshByName(`combat-projectile-accent-${100+volley*10+i}`)?.isEnabled());
    assert.ok(mesh.getVerticesData(VertexBuffer.PositionKind)!.every(Number.isFinite));
   }
   const pose=()=>t.scene.meshes.filter(m=>m.isEnabled()).map(m=>[m.position.asArray(),m.rotation.asArray(),m.scaling.asArray()]);
   const before=pose();t.effects.update(t.state,0);assert.deepEqual(pose(),before);
   t.state.projectiles=[];t.effects.update(t.state,.04);
  }
  assert.equal(t.effects.inspect().allocated,moves.length*2);assert.equal(t.effects.inspect().pooled,moves.length*2);
 }finally{t.dispose();}
});

test('Surf crest and foam travel together for the full damaging lifetime, including reduced motion',()=>{
 const t=setup(true);try{
  t.effects.onEvent({kind:'special',shape:'wave',label:'Surf',x:0,z:0,toX:0,toZ:12,radius:3.5,duration:1.2,color:'#72b8eb'});
  const wave=t.scene.getMeshByName('combat-special-wave')!,foam=t.scene.getMeshByName('combat-special-foam')!;
  const positions=wave.getVerticesData(VertexBuffer.PositionKind)!;
  assert.ok(Math.max(...positions.filter((_,i)=>i%3===1))>1,'raised crest');
  assert.ok(Math.min(...positions.filter((_,i)=>i%3===2))<-.8,'wake behind crest');
  t.effects.update(t.state,.6);assert.equal(wave.position.z,6);assert.deepEqual(foam.position.asArray(),wave.position.asArray());
  assert.equal(wave.scaling.x,3.5);t.effects.update(t.state,0);assert.equal(wave.position.z,6);
  t.effects.update(t.state,.61);assert.equal(wave.isEnabled(),false);assert.equal(foam.isEnabled(),false);
 }finally{t.dispose();}
});

test('reduced motion keeps star orientation fixed while real projectile positions still update',()=>{
 const t=setup(true);try{
  t.state.projectiles=[{...shot(900),moveName:'Swift',type:'normal'}];t.effects.update(t.state,0);
  const star=t.scene.getMeshByName('combat-projectile-900')!,rotation=star.rotation.asArray();
  t.state.projectiles[0].x+=3;t.effects.update(t.state,.2);
  assert.deepEqual(star.rotation.asArray(),rotation);assert.equal(star.position.x,5);
 }finally{t.dispose();}
});
