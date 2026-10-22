export const BERRY_CHANGE_SECONDS=180;
export const BERRY_PLAYER_CLEARANCE=12;
export const BERRY_BUFF_SECONDS=20;
export type BerryId='oran'|'leppa'|'sitrus'|'pinap'|'silver-pinap';
export const BERRIES:Readonly<Record<BerryId,{name:string;rarity:string;weight:number;color:string;description:string}>>={
 oran:{name:'Oran Berry',rarity:'Common',weight:52,color:'#4b9bd3',description:'Restore 10 HP over 20 seconds.'},
 leppa:{name:'Leppa Berry',rarity:'Uncommon',weight:26,color:'#d78362',description:'-20% special cooldown for 20 seconds.'},
 sitrus:{name:'Sitrus Berry',rarity:'Scarce',weight:14,color:'#edc352',description:'Restore 25% maximum HP over 20 seconds.'},
 pinap:{name:'Pinap Berry',rarity:'Rare',weight:6,color:'#eac64b',description:'+50% XP for 20 seconds.'},
 'silver-pinap':{name:'Silver Pinap Berry',rarity:'Very rare',weight:2,color:'#d5dee6',description:'+50% XP for 20 seconds and 25 XP now.'},
};
export const BERRY_ORDER:readonly BerryId[]=['oran','leppa','sitrus','pinap','silver-pinap'];
