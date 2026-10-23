import type {WorldProp} from '../../data/world.ts';

/** Bake soft canopy/contact shade into existing ground colors. A small spatial
 * grid keeps terrain construction local; no shadow maps, extra meshes or work
 * during combat. The direction matches the fixed presentation sun. */
export function createTerrainShade(props:readonly WorldProp[]){
 const cells=new Map<string,{x:number;z:number;length:number;width:number;strength:number}[]>(),cellSize=10;
 for(const prop of props){
  if(prop.kind!=='tree'&&prop.kind!=='rock'&&prop.kind!=='ruin')continue;
  const tree=prop.kind==='tree',length=(tree?3.8:2)*prop.scale,width=(tree?2.7:1.7)*prop.scale;
  const shade={x:prop.x-(tree?1.4:.4)*prop.scale,z:prop.z+(tree?1.1:.3)*prop.scale,length,width,strength:tree?.22:.18};
  const radius=Math.max(length,width);
  for(let x=Math.floor((shade.x-radius)/cellSize);x<=Math.floor((shade.x+radius)/cellSize);x++)for(let z=Math.floor((shade.z-radius)/cellSize);z<=Math.floor((shade.z+radius)/cellSize);z++){
   const key=`${x}/${z}`,cell=cells.get(key)??[];cell.push(shade);cells.set(key,cell);
  }
 }
 return (x:number,z:number)=>{
  let darkness=0;
  for(const shade of cells.get(`${Math.floor(x/cellSize)}/${Math.floor(z/cellSize)}`)??[]){
   const dx=x-shade.x,dz=z-shade.z,distance=((-dx*.78+dz*.625)/shade.length)**2+((dx*.625+dz*.78)/shade.width)**2;
   if(distance<1)darkness+=shade.strength*(1-distance)**2;
  }
  return 1-Math.min(.3,darkness);
 };
}
