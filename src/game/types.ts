import type {AttackKind,Element} from '../data/kanto.ts';
import type {SpecialKind} from '../data/specials.ts';
export type Variant='normal'|'dark'|'rocket'|'rabid'|'poisoned'|'legendary';
export type RunPhase='title'|'playing'|'choice'|'paused'|'boss'|'result';
export type Result='victory'|'defeat'|null;
export interface Vec2{x:number;z:number}
export interface LearnedMove{moveId:string;rank:number;cooldown:number;}
export interface PartyMember{uid:number;speciesId:number; joinedAt:number; level:number; xp?:number;xpToNext?:number; hp:number;maxHp:number;iframes:number;attackLevel:number; cooldown:number; x:number;z:number;facing:number;animation:'idle'|'walk'|'attack';attackTimer:number;attackDuration?:number;attackKind?:AttackKind;attackSpecial?:SpecialKind;evolvedAt?:number;poisonTime?:number;learnedMoves?:LearnedMove[];evolutionPower?:number;}
export interface EnemyWindup{kind:'volley'|'slam'|'psychicRing'|'summon'|'enemyMove';remaining:number;duration:number;x:number;z:number;facing:number;radius?:number;role?:import('../data/enemyAttacks.ts').EnemyAttackRole;moveName?:string;}
export interface CombatStatus{burn?:number;poison?:number;slow?:number;soak?:number;stun?:number;}
export interface Enemy{uid:number;speciesId:number;variant:Variant; x:number;z:number;hp:number;maxHp:number;speed:number;damage:number;size:number;facing:number;animation:'idle'|'walk'|'attack';attackTimer:number;attackDuration?:number;hitCooldown:number;attackCooldown:number;poisonTime:number;burnTime:number;slowTime:number;soakedTime:number;stunTime:number;elite:boolean; dead:boolean;isBoss:boolean;windup?:EnemyWindup;bossCycle?:number;shrineGuardian?:boolean;landmarkGuardian?:boolean;}
export interface PsychicRing{uid:number;sourceId:number;x:number;z:number;radius:number;previousRadius:number;maxRadius:number;speed:number;width:number;damage:number;hit:Set<number>;}
export interface Projectile{uid:number;x:number;z:number;prevX:number;prevZ:number;vx:number;vz:number;ttl:number;damage:number;size:number;kind:AttackKind;type:Element;penetration:number;hit:Set<number>;friendly:boolean;sourceId:number;targetId?:number;poisonChance:number;silhouette?:'orb'|'needle'|'beam'|'lob';radius?:number;crit?:boolean;status?:CombatStatus;allowProcs?:boolean;blastX?:number;blastZ?:number;moveName?:string;duration?:number;
 /** Total bomb preparation + flight time, so its landing clock never resets at release. */
 warningDuration?:number;
 behavior?:'straight'|'homing'|'ricochet'|'orbit';turnRate?:number;splashRadius?:number;knockback?:number;bounces?:number;bounceRange?:number;
 orbitCenterX?:number;orbitCenterZ?:number;orbitAngle?:number;orbitRadius?:number;orbitSpeed?:number;
}
export interface Drop{uid:number;x:number;z:number;value:number;age:number;kind:'xp'|'heal'|'coin'|'item';itemId?:string;}
export type LootRarity='common'|'rare'|'epic';
export interface POI{uid:number;x:number;z:number;kind:'cache'|'shrine'|'elite'|'healing';used:boolean;price?:number;rarity?:LootRarity;uses?:number;respawnAt?:number;rareTriggered?:boolean;challenge?:{guardianId:number;endsAt:number;tier:number};}
export type RewardSource='level'|'cache'|'squad'|'shop'|'recruit';
export type ChoiceKind='recruit'|'evolve'|'attack'|'learn'|'stat'|'item';
export interface UpgradeChoice{id:string;kind:ChoiceKind;title:string;description:string;rarity:'common'|'rare'|'epic';speciesId?:number; stat?:string; amount?:number;targetId?:number;category?:string;rank?:number;maxRank?:number;sourceSpeciesId?:number;moveId?:string;}
export interface Player{x:number;z:number;y:number;vy:number;facing:number;aimFacing?:number;hp:number;maxHp:number;iframes:number;poisonTime:number;dodgeTime:number;dodgeCooldown:number;specialCooldown:number;specialCharge:number;}
export interface RunStats{kills:number;recruits:number;evolutions:number;level:number;xp:number;xpToNext:number;elapsed:number;damageDealt:number;damageTaken:number;faints:number;bossKilled:boolean;highestCombo:number;}
export interface RunState{
 phase:RunPhase;result:Result;seed:number;player:Player;party:PartyMember[];enemies:Enemy[];projectiles:Projectile[];drops:Drop[];pois:POI[];
 stats:RunStats; items:string[]; buffs:Record<string,number>; recruitCount:number;pendingRecruit:boolean;upgradeChoices:UpgradeChoice[];choiceTitle:string;
 /** Current milestone owner and queued milestone rewards. RunStats.level tracks total squad progress. */
 levelUpMemberId?:number;pendingLevelUps?:number[];trainingRanks?:Record<string,number>;
 choiceSource?:RewardSource;pendingSquadRewards?:number;lastSquadRewardAt?:number;coins?:number;chestPurchases?:number;
 bossSpawned:boolean;endless:boolean;endlessStartedAt?:number;lastEnemySpawn:number;eventLog:string[];idCounter:number;lastSpecialAt:number;
 build?:import('./systems/builds.ts').BuildRuntimeState;
 director?:import('./systems/director.ts').DirectorSnapshot;psychicRings?:PsychicRing[];
 activeSpecials?:import('./combat/specials.ts').ActiveSpecial[];
 recruitUnlocks?:readonly number[];itemUnlocks?:readonly string[];
 challenge?:'standard'|'quickened'|'famine';mapId?:'wildlands'|'pinewood-route'|'ruins-route';
}
