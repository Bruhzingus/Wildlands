import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO,getSpecies,RECRUIT_POOL} from '../src/data/kanto.ts';
import {Simulation} from '../src/game/Simulation.ts';
import {applyChoice,canRecruit,eligibleEvolutions,makeChoices} from '../src/game/systems/progression.ts';
import {RNG} from '../src/utils/random.ts';
import {typeMultiplier} from '../src/data/config.ts';
import {DESIGN} from '../src/data/config.ts';
import {createEnvironment,ObstacleField} from '../src/game/systems/environment.ts';
import {createEnemy,spawnRandomEnemy} from '../src/game/systems/spawning.ts';
import {PROGRESSION} from '../src/data/progression.ts';
const idle={mx:0,mz:0,jump:false,dodge:false,special:false,interact:false};
test('all 151 distinct Kanto species load; first-stage recruit gate',()=>{
 assert.equal(KANTO.length,151);assert.equal(new Set(KANTO.map(p=>p.id)).size,151);
 assert.equal(getSpecies(1).evolvesTo[0],2);assert.equal(getSpecies(2).evolvesTo[0],3);
 assert.deepEqual(getSpecies(133).evolvesTo,[134,135,136]);
 assert.ok(RECRUIT_POOL.every(s=>s.stage===1));
 assert.ok(!RECRUIT_POOL.some(s=>[144,145,146,150,151].includes(s.id)));
});
test('recruitment waits multiple minutes AND level gate',()=>{
 const sim=new Simulation(1,123),s=sim.state;
 s.stats.level=10;s.stats.elapsed=164;assert.equal(canRecruit(s),false);
 s.stats.elapsed=166;assert.equal(canRecruit(s),true);
 const opts=makeChoices(s,new RNG(4));assert.equal(opts.length,3);
 assert.ok(opts.every(o=>o.kind==='recruit'));
 const result=applyChoice(s,opts[0]);assert.match(result.event,/joined/);assert.equal(s.party.length,2);
 assert.equal(getSpecies(s.party[1].speciesId).stage,1);
 s.stats.elapsed=200;assert.equal(canRecruit(s),false);
 s.stats.elapsed=421;s.stats.level=9;assert.equal(canRecruit(s),true);
});
test('typical run recruitment pacing: max 4 at fifteen minutes',()=>{
 const sim=new Simulation(4,300),s=sim.state;s.stats.level=99;
 for(const minute of [3,7,12]){s.stats.elapsed=minute*60;const c=makeChoices(s,sim.rng)[0];assert.equal(c.kind,'recruit');applyChoice(s,c);}
 assert.equal(s.party.length,4);s.stats.elapsed=900;assert.equal(canRecruit(s),false);
 s.stats.elapsed=965;assert.equal(canRecruit(s),true);
});
test('evolution appears only after maturity, correct species link',()=>{
 const sim=new Simulation(4,77),s=sim.state,member=s.party[0];s.stats.level=99;
 member.level=PROGRESSION.evolution.firstLevel-1;s.stats.elapsed=PROGRESSION.evolution.maturitySeconds;
 assert.deepEqual(eligibleEvolutions(s),[],'Squad progress cannot replace this Pokémon\'s level requirement');
 member.level=PROGRESSION.evolution.firstLevel;s.stats.elapsed=PROGRESSION.evolution.maturitySeconds-.01;
 assert.deepEqual(eligibleEvolutions(s),[]);
 s.stats.elapsed=PROGRESSION.evolution.maturitySeconds;
 assert.deepEqual(eligibleEvolutions(s),[1]);
 const chosen={id:'evolve-1',kind:'evolve' as const,title:'Evolve',description:'',rarity:'epic' as const,speciesId:1};
 applyChoice(s,chosen);assert.equal(s.party[0].speciesId,5);assert.equal(s.stats.evolutions,1);
});
test('paused choice does not advance clock or enemy AI',()=>{
 const sim=new Simulation(1,81),s=sim.state;
 s.phase='choice';s.upgradeChoices=[];const before=s.stats.elapsed;
 sim.update(.033,idle);assert.equal(s.stats.elapsed,before);
});
test('damage types use simplified strengths; legendary boss spawns on schedule',()=>{
 assert.ok(typeMultiplier('water',['fire'])>1);
 assert.ok(typeMultiplier('electric',['ground'])<1);
 const sim=new Simulation(1,83);sim.state.stats.elapsed=899.99;
 sim.update(.03,idle);assert.ok(sim.state.bossSpawned);assert.ok(sim.state.enemies.some(e=>e.isBoss&&e.speciesId===150));
});
test('movement deterministic and bound to play area',()=>{
 const sim=new Simulation(1,111);sim.update(.03,{...idle,mx:1});assert.ok(sim.state.player.x>0);
 sim.state.player.x=115*1.25;sim.update(.03,{...idle,mx:1});assert.ok(sim.state.player.x<=113*1.25);
});
test('win can continue endless, preserving upgrades and squad',()=>{
 const sim=new Simulation(25,18),s=sim.state;s.result='victory';s.phase='result';s.items.push('echo-bell');
 sim.continueEndless();assert.equal(s.phase,'playing');assert.equal(s.endless,true);assert.ok(s.items.includes('echo-bell'));
});
test('followers can permanently faint and keep recruitment count intact',()=>{
 const sim=new Simulation(7,918),s=sim.state;s.stats.level=8;s.stats.elapsed=190;
 const offer=makeChoices(s,sim.rng)[0];applyChoice(s,offer);
 assert.equal(s.party.length,2);const follow=s.party[1];follow.hp=1;follow.x=1;follow.z=0;
 // Isolate incoming damage from the party killing a weak opening enemy first.
 for(const member of s.party)member.cooldown=1000;
 const foe=s.enemies[0];s.enemies=[foe];foe.uid=100;foe.speciesId=19;foe.x=follow.x;foe.z=follow.z;foe.attackCooldown=0;foe.speed=0;
 sim.update(.03,idle);
 for(let i=0;i<6;i++)sim.update(.04,idle);
 assert.equal(s.party.length,1);assert.equal(s.stats.faints,1);assert.equal(s.recruitCount,1);
 assert.equal(canRecruit(s),false);
});
test('an inefficient moving orbit still levels and recruits with tapered personal progression',()=>{
 const sim=new Simulation(1,15),s=sim.state,levelTimes:number[]=[];let firstRecruitAt:number|undefined;
 while(s.stats.elapsed<600&&s.phase!=='result'){
  if(s.phase==='choice'){
   levelTimes.push(s.stats.elapsed);
   const choice=s.upgradeChoices.find(x=>x.kind==='recruit')||s.upgradeChoices.find(x=>x.kind==='learn')||s.upgradeChoices.find(x=>x.kind==='attack')||s.upgradeChoices[0];
   if(choice.kind==='recruit')firstRecruitAt??=s.stats.elapsed;
   assert.ok(sim.choose(choice.id));
  }
  s.player.hp=Math.max(100,s.player.hp);
  sim.update(.033,{...idle,mx:Math.cos(s.stats.elapsed*.08),mz:Math.sin(s.stats.elapsed*.08)});
 }
 assert.ok(s.party[0].level>=DESIGN.recruitUnlockLevels[0],`Expected the moving starter to progress, got level ${s.party[0].level}`);
 assert.ok(s.party.length>=2,'Expected this inefficient orbit to reach its first recruit within ten minutes');
 assert.ok(firstRecruitAt!>=DESIGN.recruitUnlockSeconds[0]&&firstRecruitAt!<=600);
 assert.ok(levelTimes.length>=2,'The route earns its first milestone and scheduled recruit');
 assert.ok(levelTimes.length<s.stats.level-1+s.stats.recruits,'Ordinary levels do not open upgrade menus');
 assert.ok(s.party[1].level>=1,'Recruits progress independently after joining');
});
test('Eevee offers explicit branching evolutions when eligible',()=>{
 const sim=new Simulation(133,222),s=sim.state;s.stats.level=13;s.stats.elapsed=300;s.recruitCount=1;
 s.party[0].level=PROGRESSION.evolution.firstLevel;
 let found=false;
 for(let seed=1;seed<=40;seed++){
  const opts=makeChoices(s,new RNG(seed));
  if(opts.filter(x=>x.kind==='evolve').length===3){
   assert.deepEqual(opts.filter(x=>x.kind==='evolve').map(x=>x.targetId).sort((a,b)=>a!-b!),[134,135,136]);
   found=true;break;
  }
 }
 assert.ok(found,'Expected a level-up offer containing all Eevee branches');
});
test('movement accelerates, brakes and preserves diagonal speed',()=>{
 const cardinal=new Simulation(1,100),diagonal=new Simulation(1,100);
 cardinal.state.enemies=[];diagonal.state.enemies=[];
 cardinal.update(.03,{...idle,mx:1});diagonal.update(.03,{...idle,mx:1,mz:1});
 assert.ok(cardinal.state.player.x>0&&cardinal.state.player.x<DESIGN.playerSpeed*.03);
 assert.ok(Math.abs(Math.hypot(diagonal.state.player.x,diagonal.state.player.z)-cardinal.state.player.x)<1e-8);
 for(let i=0;i<12;i++)cardinal.update(.03,{...idle,mx:1});
 const moving=cardinal.state.player.x;cardinal.update(.03,idle);assert.ok(cardinal.state.player.x>moving);
 for(let i=0;i<10;i++)cardinal.update(.03,idle);
 const stopped=cardinal.state.player.x;cardinal.update(.03,idle);assert.equal(cardinal.state.player.x,stopped);
});
test('holding jump, dodge and special does not repeat actions',()=>{
 const sim=new Simulation(1,100);let specials=0,dodges=0;
 sim.onEvent=event=>{if(event.kind==='special')specials++;if(event.kind==='dash')dodges++;};
 for(let frame=0;frame<600;frame++){sim.state.enemies=[];sim.update(.03,{...idle,jump:true,dodge:true,special:true});}
 assert.equal(sim.state.player.y,0);assert.equal(dodges,1);assert.equal(specials,1);
 sim.update(.03,idle);sim.update(.03,{...idle,jump:true,dodge:true,special:true});
 assert.ok(sim.state.player.y>0);assert.equal(dodges,2);assert.equal(specials,2);
});
test('a dodge retains its initial direction when movement reverses',()=>{
 const sim=new Simulation(1,10);sim.state.enemies=[];
 sim.update(.03,{...idle,mx:1,dodge:true});const start=sim.state.player.x;
 sim.update(.03,{...idle,mx:-1});assert.ok(sim.state.player.x>start);assert.equal(sim.state.player.facing,Math.PI/2);assert.ok(sim.state.player.iframes>0);
});
test('environment geometry is seeded, avoids spawn and leaves landmarks clear',()=>{
 const sim=new Simulation(1,301),layout=createEnvironment(sim.state.seed,sim.state.pois);
 assert.deepEqual(createEnvironment(sim.state.seed,sim.state.pois),layout);
 assert.notDeepEqual(createEnvironment(302,sim.state.pois),layout);
 assert.ok(layout.obstacles.length>200);
 for(const obstacle of layout.obstacles){assert.ok(Math.hypot(obstacle.x,obstacle.z)>=17);assert.ok(sim.state.pois.every(p=>Math.hypot(p.x-obstacle.x,p.z-obstacle.z)>=5));}
});
test('cheap colliders stop fast movement and allow sliding around rocks and rotated ruins',()=>{
 const circles=new ObstacleField([{kind:'circle',x:0,z:0,radius:1}]);
 const stopped=circles.move({x:-4,z:0},8,0);assert.ok(stopped.x<=-1-DESIGN.playerRadius);
 const slide=circles.move({x:-2,z:.6},3,2);assert.ok(slide.z>.6);assert.ok(Math.hypot(slide.x,slide.z)>=1+DESIGN.playerRadius);
 const boxes=new ObstacleField([{kind:'box',x:0,z:0,halfWidth:2,halfDepth:1,rotation:Math.PI/4}]);
 const blocked=boxes.move({x:-6,z:0},12,0);assert.ok(Math.abs(blocked.z)>.2,'Rotated wall must deflect the swept movement');
 let step={x:-6,z:0};for(let i=0;i<120;i++){step=boxes.move(step,.1,0);const lx=(step.x-step.z)/Math.SQRT2,lz=(step.x+step.z)/Math.SQRT2;assert.ok(Math.hypot(Math.max(0,Math.abs(lx)-2),Math.max(0,Math.abs(lz)-1))>=DESIGN.playerRadius-1e-6);}
 const embedded=boxes.move({x:0,z:0},0,0);assert.ok(Math.hypot(embedded.x,embedded.z)>=1+DESIGN.playerRadius);
});
test('the player collides with the same seeded rocks rendered by the world',()=>{
 const sim=new Simulation(1,100),rock=createEnvironment(sim.state.seed,sim.state.pois).obstacles.find(o=>o.kind==='circle'&&o.radius>.8)!;
 assert.equal(rock.kind,'circle');if(rock.kind!=='circle')return;
 sim.state.player.x=rock.x-rock.radius-DESIGN.playerRadius-.1;sim.state.player.z=rock.z;
 for(let frame=0;frame<25;frame++){sim.state.enemies=[];sim.update(.03,{...idle,mx:1});}
 assert.ok(Math.hypot(sim.state.player.x-rock.x,sim.state.player.z-rock.z)>=rock.radius+DESIGN.playerRadius);
});
test('paused, choice and result phases freeze the entire simulation',()=>{
 const sim=new Simulation(7,13);
 sim.state.projectiles.push({uid:sim.state.idCounter++,x:2,z:0,prevX:2,prevZ:0,vx:10,vz:0,ttl:2,damage:5,size:.3,kind:'bolt',type:'water',penetration:0,hit:new Set(),friendly:true,sourceId:1,poisonChance:0});
 for(const phase of ['paused','choice','result'] as const){sim.state.phase=phase;const before=structuredClone(sim.state);sim.update(.04,{...idle,mx:1,jump:true,dodge:true,special:true});assert.deepEqual(sim.state,before);}
});
test('opening a cache freezes enemies and projectiles immediately in that update',()=>{
 const sim=new Simulation(7,113),s=sim.state;const cache=s.pois.find(p=>p.kind==='cache')!;
 s.player.x=cache.x;s.player.z=cache.z;const enemy=s.enemies[0],x=enemy.x,z=enemy.z;
 sim.update(.03,{...idle,interact:true});assert.equal(s.phase,'choice');assert.equal(enemy.x,x);assert.equal(enemy.z,z);assert.ok(cache.used);
});
test('lethal enemy strike or poison ends the run before attacks and healing can revive the leader',()=>{
 const contact=new Simulation(1,13),s=contact.state,e=s.enemies[0];s.enemies=[e];s.party[0].cooldown=100;s.player.hp=1;e.speciesId=19;e.x=0;e.z=0;e.speed=0;e.damage=100;e.attackCooldown=0;
 contact.update(.03,idle);assert.equal(s.result,null,'The windup gives time to react');
 for(let i=0;i<6;i++)contact.update(.04,idle);
 assert.equal(s.result,'defeat');assert.equal(s.player.hp,0);
 const poison=new Simulation(1,14);poison.state.player.hp=.01;poison.state.player.poisonTime=1;let specials=0;poison.onEvent=e=>{if(e.kind==='special')specials++;};
 poison.update(.03,{...idle,special:true});assert.equal(poison.state.result,'defeat');assert.equal(specials,0);
});
test('projectiles hit actors crossed between frames, including their final partial lifetime',()=>{
 const sim=new Simulation(1,5),s=sim.state;
 const enemy=createEnemy(s,sim.rng,10,'normal',3,0);enemy.hp=1000;enemy.speed=0;s.enemies=[enemy];s.party[0].cooldown=100;
 s.projectiles.push({uid:s.idCounter++,x:0,z:0,prevX:0,prevZ:0,vx:1000,vz:0,ttl:.005,damage:12,size:.2,kind:'bolt',type:'normal',penetration:0,hit:new Set(),friendly:true,sourceId:1,poisonChance:0});
 sim.update(.03,idle);assert.equal(enemy.hp,988);assert.equal(s.projectiles.length,0);
 s.player.iframes=0;s.enemies=[];
 s.projectiles.push({uid:s.idCounter++,x:-10,z:0,prevX:-10,prevZ:0,vx:1000,vz:0,ttl:1,damage:12,size:.2,kind:'bolt',type:'normal',penetration:0,hit:new Set(),friendly:false,sourceId:enemy.uid,poisonChance:0});
 const hp=s.player.hp;sim.update(.03,idle);assert.equal(s.player.hp,hp-12);assert.equal(s.projectiles.length,0);
});
test('boss and level-up on the same frame resume correctly and endless stays in playing phase',()=>{
 const sim=new Simulation(1,91),s=sim.state;s.enemies=[];s.stats.elapsed=DESIGN.bossAtSeconds-.01;sim.debugLevel();
 sim.update(.03,idle);assert.equal(s.bossSpawned,true);assert.equal(s.phase,'choice');
 sim.choose(s.upgradeChoices[0].id);assert.equal(s.phase,'boss');
 s.stats.bossKilled=true;s.result='victory';s.phase='result';const squad=structuredClone(s.party);sim.continueEndless();
 assert.deepEqual(s.party,squad);sim.pause();sim.pause();assert.equal(s.phase,'playing');
});
test('invalid or stale upgrade choices cannot bypass progression gates',()=>{
 const sim=new Simulation(1,11),s=sim.state;
 const recruit={id:'recruit-7',kind:'recruit' as const,title:'Recruit',description:'',rarity:'rare' as const,speciesId:7};
 applyChoice(s,recruit);assert.equal(s.party.length,1);
 const evolve={id:'evolve-1-3',kind:'evolve' as const,title:'Evolve',description:'',rarity:'epic' as const,speciesId:1,targetId:3};
 s.stats.elapsed=300;s.stats.level=10;s.party[0].level=PROGRESSION.evolution.firstLevel;applyChoice(s,evolve);assert.equal(s.party[0].speciesId,1);
 const item={id:'echo-bell',kind:'item' as const,title:'Echo Bell',description:'',rarity:'epic' as const};applyChoice(s,item);applyChoice(s,item);assert.deepEqual(s.items,['echo-bell']);
 const before=structuredClone(s);sim.choose('made-up-choice');assert.deepEqual(s,before);
});
test('invalid frame durations do not corrupt clocks or positions',()=>{
 const sim=new Simulation(1,41),before=structuredClone(sim.state);
 for(const dt of [0,-1,NaN,Infinity])sim.update(dt,{...idle,mx:1});assert.deepEqual(sim.state,before);
});
test('defeating the actual boss offers endless without spawning another boss',()=>{
 const sim=new Simulation(25,19),s=sim.state,boss=createEnemy(s,sim.rng,150,'legendary',2,0,true,true);
 boss.hp=1;s.enemies=[boss];s.bossSpawned=true;s.phase='boss';s.items=['echo-bell'];
 sim.update(.03,{...idle,special:true});assert.equal(s.result,'victory');assert.equal(s.stats.bossKilled,true);
 const hp=s.player.hp,items=[...s.items],party=s.party.map(member=>member.uid);
 sim.continueEndless();assert.equal(s.phase,'playing');assert.equal(s.player.hp,hp);assert.deepEqual(s.items,items);assert.deepEqual(s.party.map(member=>member.uid),party);
 sim.update(.03,idle);assert.equal(s.result,null);
 if(s.phase==='choice')sim.choose(s.upgradeChoices[0].id);
 assert.equal(s.phase,'playing');assert.ok(s.items.includes('echo-bell'));assert.ok(!s.enemies.some(enemy=>enemy.isBoss));
});
test('enemy spawns reserve a boss slot and elite landmarks respect the hard budget',()=>{
 const sim=new Simulation(1,38),s=sim.state;s.enemies=[];
 for(let i=0;i<DESIGN.maxEnemies-1;i++){const enemy=spawnRandomEnemy(s,sim.rng);assert.ok(enemy);s.enemies.push(enemy!);}
 assert.equal(spawnRandomEnemy(s,sim.rng),null);
 const elite=s.pois.find(p=>p.kind==='elite')!;s.player.x=elite.x;s.player.z=elite.z;sim.update(.03,{...idle,interact:true});assert.equal(elite.used,false);assert.ok(s.enemies.length<DESIGN.maxEnemies);
 s.stats.elapsed=DESIGN.bossAtSeconds;sim.update(.03,idle);assert.equal(s.enemies.length,DESIGN.maxEnemies);assert.equal(s.enemies.filter(e=>e.isBoss).length,1);assert.equal(spawnRandomEnemy(s,sim.rng),null);
});
