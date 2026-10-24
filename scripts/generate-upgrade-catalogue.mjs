import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {KANTO,RECRUIT_POOL,getSpecies,starterChoices} from '../src/data/kanto.ts';
import {PROGRESSION,TRAINING_UPGRADES,TRAINING_RARITY_MULTIPLIERS,trainingVariants,trainingDescription} from '../src/data/progression.ts';
import {ITEM_DEFINITIONS} from '../src/data/items.ts';
import {BUILD_STAT_CAPS,BUILD_LIMITS} from '../src/game/systems/builds.ts';
import {SYNERGIES} from '../src/data/synergies.ts';
import {LEARNABLE_MOVES,getLearnedMoveProfile,learnedMovePower,learnableMoves,moveLearnLevel} from '../src/data/moves.ts';
import {getAttackProfile,describeAttackMechanic,describeAttackUpgrade} from '../src/data/attacks.ts';
import {getSpecialProfile,specialAimMode,describeSpecialUpgrade} from '../src/data/specials.ts';
import {evolutionRequirement} from '../src/data/evolutions.ts';
import {ACHIEVEMENTS,GATED_ITEMS,GATED_RECRUITS,STARTING_PARTNERS} from '../src/data/unlocks.ts';
import {DESIGN} from '../src/data/config.ts';
import {movementTraitLabel,getMovementTrait,MOVEMENT_TRAIT_SPECIES} from '../src/data/movementTraits.ts';

const root=new URL('../',import.meta.url);
const sources=['src/data/kanto.ts','src/data/rosterContent.ts','src/data/progression.ts','src/data/items.ts','src/data/synergies.ts','src/data/moves.ts','src/data/learnsets.ts','src/data/specials.ts','src/data/attacks.ts','src/data/evolutions.ts','src/data/unlocks.ts','src/data/config.ts','src/game/systems/progression.ts','src/game/systems/builds.ts','src/game/Simulation.ts','src/game/combat/damage.ts','src/game/combat/cadence.ts','src/game/combat/critical.ts','src/game/combat/projectiles.ts','src/game/types.ts','src/game/combat/patterns.ts','src/game/combat/specials.ts'];
const fingerprint=createHash('sha256');
sources.push('src/data/movementTraits.ts','src/game/systems/movement.ts');
for(const file of sources){fingerprint.update(file);fingerprint.update(await readFile(new URL(file,root)));}
const hash=fingerprint.digest('hex');
const n=value=>Number.isFinite(value)?String(Number(value.toFixed(3))):value===Infinity?'No upper cap':String(value);
const pct=value=>`${n(value*100)}%`;
const cell=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n','<br>');
const table=(headers,rows)=>[headers,headers.map(()=> '---'),...rows].map(row=>`| ${row.map(cell).join(' | ')} |`).join('\n');
const byName=id=>getSpecies(id).name;
const rat=Object.keys(TRAINING_RARITY_MULTIPLIERS);
const activeItems=ITEM_DEFINITIONS.filter(item=>item.offerable!==false);
const retiredItems=ITEM_DEFINITIONS.filter(item=>item.offerable===false);
const edges=KANTO.flatMap(species=>species.evolvesTo.map(target=>({source:species.id,target})));
const ranks=[1,2,3,4,5,10,20,50,100];
const out=[];
const add=(...parts)=>out.push(...parts);
const heading=(title,level=2)=>add(`${'#'.repeat(level)} ${title}`);
const raw=value=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Number.isFinite(item)?Number(item.toFixed(6)):item);
const mods=values=>(values||[]).map(mod=>`${mod.stat}: ${mod.amount>=0?'+':''}${n(mod.amount)}${mod.evolution?` (${mod.evolution})`:''}${mod.healthBelow!==undefined?` (leader below ${pct(mod.healthBelow)} HP)`:''}${mod.scale?` × ${mod.scale} size`:''}`).join('; ')||'None';
const rule=effect=>`${effect.event}${effect.every?`, every ${effect.every}`:''}${effect.chance!==undefined?`, ${pct(effect.chance)} chance`:''}${effect.cooldown?`, ${effect.cooldown}s cooldown`:''}${effect.counter?`, ${effect.counter} counter`:''}${effect.element?`, ${effect.element} hits`:''}${effect.targetStatus?`, target ${effect.targetStatus}`:''}; ${raw(effect.action)}${effect.maxDepth!==undefined?`; maxDepth=${effect.maxDepth}`:''}`;
const unlockFor=(type,id)=>ACHIEVEMENTS.filter(a=>(a.reward[type]||[]).includes(id)).map(a=>`${a.title}: ${a.description}`).join('; ');

add('# UPGRADE_CATALOGUE','Complete current upgrade catalogue for owner review. **This describes implemented behavior, including N3 stacking, real attack cadence and critical tiers; remaining F3/provenance and saturation work is tracked in [IMPROVEMENT_DOC.md](IMPROVEMENT_DOC.md#f3--uncapped-percentage-growth-and-multiple-crits-per-hit).**',
 'Regenerate with `node --experimental-strip-types scripts/generate-upgrade-catalogue.mjs`. Generated from local source, without network access. If you annotate this file, retain your annotated copy before regenerating.',
 'In the game, choose **Browse all upgrades** from the title or pause menu for a scrollable version of these groups, with search, filters, sorting, rarity colours and expandable progression details.',
 `Source fingerprint (SHA-256): \`${hash}\`. Counts: **${TRAINING_UPGRADES.length} training families / ${TRAINING_UPGRADES.reduce((sum,upgrade)=>sum+trainingVariants(upgrade).length,0)} rarity variants; ${activeItems.length} offerable relics; ${retiredItems.length} retired relics; ${KANTO.length} signature moves; ${LEARNABLE_MOVES.length} learned moves; ${edges.length} evolution choices; ${RECRUIT_POOL.length} recruitable species; ${SYNERGIES.length} synergies.**`,
 'Start with the training and relic tables. They contain the discrete upgrades most useful to mark **keep / change / remove**. Later sections enumerate every species move, learning pool and evolution. Infinite ranks are represented by exact rules and sampled ranks; an infinite list of rows would be misleading.',
 '**Rarity and rank are separate.** Training has authored Common/Uncommon/Rare/Epic/Legendary curves where available. Most relic families have a base and Legendary variant; authored families can instead expose their listed rarity curve. Variants share a family and unlock. Move training has an unlimited numerical rank but a restricted offer rarity. Evolution is Epic; recruitment and learning are Rare. Q improvements accompany leader signature training, rather than a separate Q-upgrade card. Synergies are automatic composition bonuses, not cards.');

heading('1. All training upgrades at every rarity');
add('Each selection advances that training family by one rank. Rarity changes the exact bonus shown in the table, not how many training ranks are recorded. Milestone stat bonuses and ranks belong only to the Pok?mon that leveled up. Relics and shrine training affect the whole squad. Personal HP Up preserves that Pok?mon?s HP fraction; shared HP Up preserves every member?s HP fraction. Leader movement, stamina and Q training only appear on leader milestones.');
const trainingEffect=upgrade=>({power:'Additive personal damage, including learned moves.',haste:'Additive personal attack speed. Actual intervals continue shrinking; damage per hit is unchanged.',speed:'Leader movement speed; personal stamina recharge reductions are 4/9/13/17% and multiply remaining time.',health:'Personal base-max-HP bonus. Personal and shared bonuses multiply; preserves HP fraction.',stamina:'Epic: +1 dodge charge. Legendary: +3. No lower rarities.',special:'Q cooldown divided by 1 + total special recharge bonus.','wise-glasses':'Adds only to damaging Q casts; unavailable for a non-damaging Q.',crit:'Critical chance in percentage points. Each full 100% guarantees another critical tier.',radius:'Additive personal reach/area-radius bonus.',deflection:'Adds 3/4/8/13 percentage points by rarity, capped at 50%. Stops appearing at the cap.'}[upgrade.id]);
add('Personal milestone training is 15% weaker than squad rewards, rounded to whole percentage points or charges. Values below apply to the Pokemon earning the milestone.');
add(table(['Upgrade / ID','Common','Uncommon','Rare','Epic','Legendary','Current stacking / scope'],TRAINING_UPGRADES.map(upgrade=>[`${upgrade.title} (${upgrade.id})`,...rat.map(rarity=>trainingDescription(upgrade,rarity,true)||'Not available'),trainingEffect(upgrade)])));
heading('Squad reward training',3);
add(table(['Upgrade / ID','Common','Uncommon','Rare','Epic','Legendary'],TRAINING_UPGRADES.map(upgrade=>[`${upgrade.title} (${upgrade.id})`,...rat.map(rarity=>trainingDescription(upgrade,rarity)||'Not available')])));
add('Every species starts with 0.5 to 3 defense, inversely scaled to its base attack power: clamp(3.5 - power / 12, 0.5, 3), rounded to two decimals. Defensive relics/synergies increase this threshold by a percentage. Iron Defense training is removed from new rewards; legacy armor and reduction bonuses still increase defense. Deflection caps at 50% and blocks damage and on-hit poison. Team Battery requires at least 3 living members and adds one dodge charge per two current living members, rounded down; its Legendary version adds one per living member. Charges recover one at a time.');
heading('Repeated training: every rank follows these rules',3);
add('For additive training families, total bonus is the sum of the exact per-rarity values in the corresponding personal or squad table. Personal Agility recharge time multiplies by 0.96 / 0.91 / 0.87 / 0.83 per copy; squad rewards use 0.95 / 0.90 / 0.85 / 0.80. Endure adds 1 / 3 maximum stamina at Epic / Legendary. Equal training ranks can have different power. Current effective output may be limited or transformed later; see the cap audit.',
 'HP Up uses `(1 + new total HP bonus) / (1 + previous total HP bonus)` on each purchase, preserving current health fraction.',
 table(['Family','1 Common','2 Common','3 Common','5 Common','10 Common','20 Common','50 Common','100 Common'],TRAINING_UPGRADES.map(upgrade=>{const common=trainingVariants(upgrade,true).find(variant=>variant.rarity==='common');return [upgrade.title,...[1,2,3,5,10,20,50,100].map(count=>!common?'Not available':upgrade.id==='deflection'?`${pct(Math.min(.5,common.amount*count))} chance`:`+${pct(common.amount*count)} raw`)];})));
add('Percentage stat increases add against the base stat: `100 * (1 + 0.05 + 0.10) = 115`. Upgrade cards show current and resulting percentages, including existing relic bonuses. Base rarity weights are Common 55 / Uncommon 10 / Rare 35 / Epic 9.5 / Legendary 0.5 before luck, eligibility and missing-bucket renormalization. Training families and relic families do not appear twice in one offer with different rarities. Move, evolution and recruit rarity policies differ from this general training weighting.');

heading('2. Every offerable relic: base and Legendary availability');
add('Relics are repeatable. Each stackable copy adds its stated bonuses, including combinations of rarity variants in the same family. Iron Ball also stacks: positive damage adds per copy and each slowdown multiplies remaining attack rate. Triggered damage, healing, recharge and drawbacks scale with the copy count; repeated status relics combine their proc chances as 1 - (1 - chance)^copies. A family appears only once per offer, to preserve variety. Standard base/Legendary pairs share their base unlock and Legendary versions double positive bonuses and triggered strength; authored rarity curves state their exact values. Offers exclude mechanics with no benefit to the current build or challenge.');
add(table(['Relic / ID','Common','Uncommon','Rare','Epic','Legendary','Unlock / compatibility'],activeItems.map(item=>[`${item.title} (${item.id})`,...['common','uncommon','rare','epic','legendary'].map(rarity=>item.rarity===rarity?item.description:'Not available'),GATED_ITEMS.includes(item.baseId??item.id)?unlockFor('items',item.baseId??item.id)||'Gated': 'Base pool; current-build eligibility applies'])));
heading('Exact relic modifiers and effect rules',3);
add('This technical reference makes hidden cooldowns, counters and scaling reviewable. Percent modifiers use fractions (0.25 = +25%); flat modifiers use their native units. A healing action with `maxHpFraction` uses each recipient’s own max HP. `damageScale` describes the event interpreter input; target/type scaling and recursion rules also apply.');
add(table(['Relic','Owner / stacking','Modifiers','Triggered rules'],activeItems.map(item=>[item.title,`${item.ownership}; ${item.stacking==='unique'?'unique':'repeatable'}`,mods(item.modifiers),(item.effects||[]).map(rule).join('<br>')||'None'])));
heading('Retired definitions: retained in code, excluded from all new relic offers',3);
add('These are often mistaken for active rewards when reading old documentation. They have no new-offer rarity variants. Do not recommend removing a current offer on the assumption that these still appear.');
add(table(['Retired relic / ID','Authored rarity','Legacy effect'],retiredItems.map(item=>[`${item.title} (${item.id})`,item.rarity,item.description])));

heading('3. Move cards: all rarity and rank rules');
add(table(['Card kind','Common','Rare','Epic','Rank / eligibility'],[
 ['Signature training','Current rank 1–3, +1 rank → new rank 2–4','Current rank 4+, or a single-stage +2-rank choice','Not offered','Unlimited rank; trains the selected owner. Leader Q also improves.'],
 ['Learned-move training','Resulting rank below 4, normal +1 gain','Resulting rank 4+, or a single-stage +2-rank choice','Not offered','Unlimited rank; independent cooldown/rank for each move.'],
 ['Learn a new move','Not offered','All new-move cards','Not offered','Starts rank 1; requires a free learned slot and species/level eligibility.'],
 ['Evolution','Not offered','Not offered','All evolution cards','Explicit species branch; before personal level 45; +25% max HP, +25% permanent damage, +1 to every known move.'],
 ['Recruitment','Not offered','All recruitment choices','Not offered','First-stage eligible species; time and aggregate level gate; no duplicate represented line.'],
 ]));
add('Personal milestone choices occur at levels 3, 5, 10, 15, …, 100. Extra learned slots open at levels 10, 20 and 30 (four total moves including signature). The new-move branch is attempted on 30% of eligible milestones with room and valid candidates; learning/evolution stop at personal level 45. Single-stage species without evolutions gain +2 move ranks per training selection from personal level 5; others gain +1. Ordinary levels give +2% base HP/power without pausing.');
heading('Exact infinite-rank growth',3);
add('Let `r` be move rank, `L` personal Pokémon level, `P` the applicable squad/personal damage bonus, and `H` attack-speed bonus. Before crits, matchup, special patterns and other event modifiers:',
 '- Signature core power: `(species.power + 9) × (1 + 0.02×(L−1)) × (1 + 0.20×(r−1)) × (1+P)`, then the effective attack profile damage scale. Archetype `growth.damage` is not used by `memberDamage`; do not treat it as an additional per-rank bonus.',
 '- Signature interval: `profile.cooldown / ((1+H) * (1+0.08*(r-1)))`, with no minimum interval or haste-to-damage conversion. Elapsed casts are preserved; extreme rates group their hit counts into bounded simulation packets.',
 '- Learned core power: `move.power * (1+0.20*(r-1)) * (1+0.02*(L-1)) * (1+P)`, then profile scale. Interval: `baseCooldown / ((1+0.08*(r-1)) * (1+H))`, with no minimum interval or extra damage from haste.',
 '- Learned range and radius: `base × (1+0.06×(r−1))`. Extra projectile steps use `floor((r−1)/projectilesEvery)`; chain steps use `floor((r−1)/chainsEvery)`. Signature extra steps use `floor((r−1)/projectilesEvery)` and `floor(r/chainsEvery)` on top of the authored profile/milestones. These are profile counts before execution limits; a zero growth interval means no automatic steps.',
 '- Signature healing instead uses base leader/follower amounts `5+1.5r` and `3+0.8r`, with current recovery and casting rules. Damage multipliers do not automatically describe healing output.',
 table(['Rank','Power × before profile','Casting-speed ×','Learned reach/radius ×'],ranks.map(rank=>[rank,n(1+PROGRESSION.moves.damagePerRank*(rank-1)),n(1+PROGRESSION.moves.speedPerRank*(rank-1)),n(1+PROGRESSION.moves.rangePerRank*(rank-1))])));

heading('4. Every Pokémon signature move and authored tier milestone');
add('All 151 species are enumerated, including evolutions and species that cannot be recruited. Columns describe the actual rank-1 profile and training transitions; later milestone descriptions give all authored behavior tiers. Numeric rank never ends at the last milestone. “P / pierce / C” means projectile count / pierce count / chain targets before execution caps. Reach and radius are world units before squad modifiers.');
add(table(['# Pokémon','Signature / handling','Rank-1 core / profile','Rank 1→2','Rank 3→4','Rank 4→5','All authored milestones / growth'],KANTO.map(species=>{
 const p=getAttackProfile(species.id,1),g=p.growth;
 return [`${species.id} ${species.name}`,`${species.moveName}; ${p.kind}${p.pattern?` / ${p.pattern}`:''}. ${describeAttackMechanic(species.id)}`,`Core ${species.power+9} × scale ${n(p.damageScale)}; ${n(p.cooldown)}s; reach ${n(p.range)}; radius ${n(p.radius)}; P/pierce/C ${p.projectiles}/${p.pierce}/${p.chains}`,describeAttackUpgrade(species.id,1,2),describeAttackUpgrade(species.id,3,4),describeAttackUpgrade(species.id,4,5),`${(p.milestones||[]).map(m=>`R${m.rank}: ${m.description}; values ${raw(m)}`).join('<br>')||'No authored behavior milestones.'}<br>Per-rank growth: reach +${n(g.range)}, radius +${n(g.radius)}; ${g.projectilesEvery?`extra projectile step every ${g.projectilesEvery} ranks`:'no automatic projectile steps'}; ${g.chainsEvery?`extra chain step every ${g.chainsEvery} ranks`:'no automatic chain steps'} (profile formula applies).`];
})));

heading('5. Every learnable move, baseline and rank samples');
add('The power value below precedes profile damageScale, level, squad, crits and type/status interactions. Minimum learn level is move metadata; actual free-slot gates (levels 10/20/30) still apply. Only species in the per-species eligibility table can receive a move. Identical names may describe a signature, learned move, Q or relic with different behavior.');
add(table(['Move / ID / element','Kind / min level / behavior','R1: power; interval; reach/radius; P/C','R5: same fields','R10: same fields','Profile / status'],LEARNABLE_MOVES.map(move=>[`${move.name} (${move.id}); ${move.element}`,`${move.profile.kind}; LV ${moveLearnLevel(move.id)}. ${move.description}`,...[1,5,10].map(rank=>{const p=getLearnedMoveProfile(move.id,rank);return `${n(learnedMovePower(move.id,rank))}; ${n(p.cooldown)}s; ${n(p.range)}/${n(p.radius)}; ${p.projectiles}/${p.chains}`;}),`damageScale ${n(move.profile.damageScale)}; pierce ${move.profile.pierce}; status ${raw(move.profile.status)}; growth ${raw(move.profile.growth)}`])));
heading('Complete per-species learned-move eligibility',3);
add('This is the available move catalogue for that form, before personal-level filtering, known-move removal and free-slot checks; the form’s own signature name is excluded by code.');
add(table(['# Pokémon','All eligible learned moves'],KANTO.map(species=>[`${species.id} ${species.name}`,learnableMoves(species.id).map(move=>`${move.name} [LV ${moveLearnLevel(move.id)}]`).join('; ')||'None'])));

heading('6. Every Q special family and rank scaling');
const specialGroups=new Map();
for(const species of KANTO){const special=getSpecialProfile(species.id);const key=`${special.kind}:${special.name}`;const group=specialGroups.get(key)||{special,ids:[]};group.ids.push(species.id);specialGroups.set(key,group);}
add('Q is improved implicitly by training the current leader’s signature rank. It has no independent Common/Rare/Epic card. Families are grouped by kind and name; evolution and rank can change values, so each representative is named. Swapping a form can therefore change the profile even when the special family stays the same.');
add('All damaging Q casts begin from `(32 + 2×(r−1)) × (1+0.02×(L−1)) × (1+P) × (1+W)`, where `P` is squad damage and `W` is Wise Glasses damage, then apply the profile/family damageScale and pattern timing. Therefore a rank can improve Q damage even when no extra pulse/projectile/width milestone occurs. Recharge is `profile.cooldown / (1+specialHaste)`; the current base is 16s. Q radius/range use the radius modifier and duration uses the duration modifier. Team Sanctuary heals `20 + 3r` squad HP rather than using the damage formula.');
add(table(['Special / kind / aim','Species','Representative R1 values','R1→2','R4→5','R9→10'],[...specialGroups.values()].map(({special,ids})=>[`${special.name}; ${special.kind}; ${specialAimMode(special.kind)}`,ids.map(byName).join(', '),`${byName(ids[0])}: ${raw(special)}`,describeSpecialUpgrade(ids[0],1,2),describeSpecialUpgrade(ids[0],4,5),describeSpecialUpgrade(ids[0],9,10)])));
heading('Complete Q rank formula by kind',3);
add('Use `r−1` as q below; the base profile is the representative in the table. All kinds also gain the existing evolution damage-scale factor `1+0.12×(stage−1)`. The current function finally caps projectiles at 12 and pulses at 16. These count limits are separate from the owner’s uncapped-percentage requirement.',
 table(['Kinds','Current rank-dependent changes'],[
 ['garden','duration +0.5×floor(q/2); pulses +floor(q/2); radius +0.8×floor(q/4)'],
 ['flamethrower','range +0.45q; angle +0.14×floor(q/3); pulses +2×floor(q/3)'],
 ['surf / whirlwind','radius +0.45×floor(q/2); range +0.7q; knockback +floor(q/4)'],
 ['thunder','pulses +floor(q/2); range +0.5q'],
 ['quickstep','projectiles +floor(q/2); range +floor(q/3)'],
 ['web / payday / volley','projectiles +2×floor(q/3)'],
 ['foxfire','projectiles +floor(q/2); duration +floor(q/3)'],
 ['fissure','pulses +floor(q/3); range +0.6q'],
 ['sleep','duration +floor(q/3); pulses +floor(q/3); radius +0.4×floor(q/2)'],
 ['charge','duration +0.5×floor(q/3); pulses +floor(q/3); radius +0.4×floor(q/3)'],
 ['teleport / lance','radius +0.25×floor(q/2); range +0.6q'],
 ['flurry','pulses +floor(q/3); range +0.4×floor(q/2)'],
 ['curse','radius +0.5×floor(q/2); damageScale multiplied by 1+0.07q'],
 ['mend','No profile rank changes in getSpecialProfile; the upgrade description advertises +3 squad healing per gained rank; cast healing is resolved separately.'],
 ]));

heading('7. Every evolution upgrade');
add('All evolution cards are Epic. Each grants +25% max HP, +25% permanent attack damage and +1 rank to all known moves, preserving level/XP and HP fraction. Branches are explicit. A learned move matching the target’s signature can merge into signature training at the higher existing rank plus one, freeing the learned slot. Evolution does not itself grant an unrelated free learned move.');
add(table(['From','To / new signature','Exact gate','Leader movement'],edges.map(edge=>[byName(edge.source),`${byName(edge.target)} / ${getSpecies(edge.target).moveName}`,evolutionRequirement(edge.source,edge.target),`${movementTraitLabel(edge.source)} → ${movementTraitLabel(edge.target)}`])));
add('Movement traits apply to the controlled leader. They are innate species properties, not separate upgrade cards. Early runners receive larger speed bonuses than their stronger evolutions; evolution previews show these changes. Flight has a finite airtime/recharge and does not prevent ranged damage.');
add(table(['Species','Movement technique','Actual behavior'],MOVEMENT_TRAIT_SPECIES.map(id=>[byName(id),movementTraitLabel(id),getMovementTrait(id).description])));

heading('8. Every recruitment upgrade and all starter unlocks');
add('Recruitment cards are Rare. A species must be an eligible first-stage form, unlocked where required, and not already represented by a living member of its evolution line. A faint does not reset the run’s recruitment tally.');
add(table(['Recruit number','Earliest time','Minimum aggregate earned squad level','Total party if nobody fainted'],DESIGN.recruitUnlockSeconds.map((seconds,index)=>[index+1,`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,DESIGN.recruitUnlockLevels[index],index+2])));
add(table(['Recruitable Pokémon','Availability','Signature','Evolution options'],RECRUIT_POOL.map(species=>[species.name,GATED_RECRUITS.includes(species.id)?unlockFor('recruits',species.id)||'Achievement-gated':'Base recruit pool',species.moveName,species.evolvesTo.map(byName).join(', ')||'Single-stage mastery'])));
heading('All start-of-run partner options',3);
add(table(['Starter','Unlock requirement'],starterChoices().map(id=>[byName(id),STARTING_PARTNERS.includes(id)?'Available on fresh save':unlockFor('starters',id)||'Not mapped to a current achievement'])));

heading('9. Every automatic team synergy');
add('These have no rarity cards or training ranks. Living party composition activates them; required contributions must come from distinct members. The conditional bonus disappears if the required composition is lost.');
add(table(['Synergy / ID','Exact effect','Requirement data','Additional-match scaling'],SYNERGIES.map(s=>[`${s.title} (${s.id})`,s.description,`Minimum party ${s.minimumParty}; ${raw(s.requirements)}`,mods(s.extraMatchModifiers)])));

heading('10. Current caps and mismatches to review before rebalancing');
add('N3 removed modifier and proc ceilings that made percentage upgrades stop helping, and implemented critical tiers. The table below documents current numeric limits. Physical boundaries and finite execution/visual budgets are distinct from a percentage-stat maximum.');
add(table(['Build stat','Current upper modifier cap'],Object.entries(BUILD_STAT_CAPS).map(([stat,cap])=>[stat,n(cap)])));
heading('Additional effect-interpreter limits',3);
add(table(['Effect rule / resource limit','Current value'],Object.entries(BUILD_LIMITS).map(([name,value])=>[name,n(value)])));
add('- **Critical chance:** base 5%; Focus Energy adds 4/8/12/16 percentage points. Each full 100% guarantees a critical tier; the fraction rolls one more. Damage uses criticalMultiplier^tier. Raw chance is uncapped and no overflow is converted into a different stat.',
 '- **Defense:** Defensive relics and legacy buffs increase the base threshold of each member by a percentage; attacks deal max(0, incoming damage - defense). Iron Defense training is retired. Deflection adds 3/5/9/15 percentage points per selection and caps at 50%.',
 '- **Percentage growth:** XP, catch-up XP, percent regeneration, projectile speed and status duration have no upper modifier cap. Triggered damage/radius/status limits no longer truncate earned percentage scaling.',
 '- **Execution budgets:** each move emits at most 32 representative cast packets per simulation step; packets retain their logical hit count. Friendly matching projectile streams coalesce at the visual pool limit. Flat projectile/pierce/chain target limits remain shape-specific, and incompatible or exhausted flat-count relics are excluded from offers.',
 '- **Proc execution:** stack strength is aggregated per rule. No proc-damage, radius, status-duration, echo-scale or flat-resource ceiling truncates it. Recursion remains blocked and rule traversal is bounded by the finite registry. At extreme grouped rates, representative casts share a critical roll; this changes variance, not expected critical throughput.',
 '- **Global resource budgets are separate:** entity/projectile/effect limits protect the renderer and scheduler. Existing actor/projectile/effect pools remain finite. Full saturation without a matching friendly stream remains a limitation for the wider F3/performance follow-up.',
 '- **Card/scope wording:** HP Up explicitly applies to the entire party. Charmander’s Q copy says nearest enemy despite the directional aiming policy.',
 '- **Retired options:** Eviolite, Leppa Berry, Everstone, Scope Lens and several familiar flat-stat items are excluded from current offers. Check the retired table before identifying them as unwanted current choices.',
 '- **Infinite ranks:** the sampled rank tables are examples only. The formulas cover any finite valid rank. Move-power/range growth and effect/profile limits must be considered together when judging a late-rank upgrade.',
 '**Review workflow:** tell the agent which named rows you never choose, which effects you want to keep, and whether the problem is weakness, incompatibility, wording or lack of a noticeable effect. The handoff requires an item-by-item disposition and measured replacements; it does not authorize guessing your preferences or removing every low-pick option.');

heading('Sources and regeneration');
add(sources.map(file=>`- [${file}](${file})`).join('\n'));
const document=out.join('\n\n')+'\n';
if(new Set(TRAINING_UPGRADES.map(u=>u.id)).size!==TRAINING_UPGRADES.length||new Set(ITEM_DEFINITIONS.map(u=>u.id)).size!==ITEM_DEFINITIONS.length||new Set(LEARNABLE_MOVES.map(u=>u.id)).size!==LEARNABLE_MOVES.length)throw Error('Duplicate catalogue IDs');
if(KANTO.length!==151||edges.length!==72||TRAINING_UPGRADES.some(upgrade=>upgrade.title==='Iron Defense')||activeItems.some(item=>!item.baseId&&!activeItems.some(variant=>variant.rarity==='legendary'&&(variant.baseId??variant.id)===item.id)))throw Error('Content inventory changed: review generator completeness');
await writeFile(new URL('UPGRADE_CATALOGUE.md',root),document,'utf8');
console.log(JSON.stringify({output:'UPGRADE_CATALOGUE.md',trainingFamilies:TRAINING_UPGRADES.length,trainingRarityVariants:TRAINING_UPGRADES.reduce((sum,upgrade)=>sum+trainingVariants(upgrade).length,0),activeRelics:activeItems.length,retiredRelics:retiredItems.length,signatures:KANTO.length,learnedMoves:LEARNABLE_MOVES.length,evolutions:edges.length,recruits:RECRUIT_POOL.length,synergies:SYNERGIES.length,specialGroups:specialGroups.size,sourceFingerprint:hash}));
