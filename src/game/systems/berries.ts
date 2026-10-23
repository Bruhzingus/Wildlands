import {BERRIES,BERRY_CHANGE_SECONDS,BERRY_ORDER,BERRY_PLAYER_CLEARANCE,type BerryId} from '../../data/berries.ts';
import {RNG} from '../../utils/random.ts';
import type {WorldProp} from '../../data/world.ts';
import type {BerryTree,Vec2} from '../types.ts';

function variant(rng:RNG,previous?:BerryId):BerryId {
 const choices=BERRY_ORDER.filter(id=>id!==previous),total=choices.reduce((sum,id)=>sum+BERRIES[id].weight,0);
 let roll=rng.next()*total;
 for(const id of choices){roll-=BERRIES[id].weight;if(roll<0)return id;}
 return choices[choices.length-1];
}
function fruit(tree:BerryTree,rng:RNG,elapsed:number){
 const count=rng.next()<.62?1:rng.next()<.72?2:3;
 tree.berries=Array.from({length:count},(_,index)=>{
  const angle=(index+.35)*Math.PI*2/count+rng.between(-.35,.35),radius=rng.between(1.65,2.4);
  return {x:tree.x+Math.sin(angle)*radius,z:tree.z+Math.cos(angle)*radius,collected:false,droppedAt:elapsed};
 });
}
/** Choose existing, collidable trees so fruit can never appear over a trail or site. */
export function createBerryTrees(props:readonly WorldProp[],seed:number,examined?:Set<WorldProp>):BerryTree[]{
 const rng=new RNG(seed^0x23a164fc),candidates=props.filter(prop=>prop.kind==='tree'&&!prop.landmark);
 for(let index=candidates.length-1;index>0;index--){const swap=rng.int(0,index);[candidates[index],candidates[swap]]=[candidates[swap],candidates[index]];}
 const trees:BerryTree[]=[];
 for(const prop of candidates){
  if(trees.length>=16)break;
  // Placement may move later candidates. Retaining this entire examined prefix
  // (including spacing rejects) preserves harvest IDs, fruit and RNG exactly.
  examined?.add(prop);
  if(trees.some(tree=>Math.hypot(tree.x-prop.x,tree.z-prop.z)<17))continue;
  const tree:BerryTree={uid:700+trees.length,x:prop.x,z:prop.z,scale:prop.scale,berry:variant(rng),berries:[],nextChangeAt:BERRY_CHANGE_SECONDS,cycle:0};
  fruit(tree,rng,0);trees.push(tree);
 }
 return trees;
}
/** A due tree waits while observed. Its old fruit clears when the variant changes. */
export function updateBerryTrees(trees:BerryTree[],elapsed:number,player:Vec2,rng:RNG){
 for(const tree of trees){
  if(elapsed<tree.nextChangeAt||Math.hypot(tree.x-player.x,tree.z-player.z)<BERRY_PLAYER_CLEARANCE)continue;
  tree.berry=variant(rng,tree.berry);tree.cycle++;tree.nextChangeAt=elapsed+BERRY_CHANGE_SECONDS;
  fruit(tree,rng,elapsed);
 }
}
