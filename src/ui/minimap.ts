import {DESIGN} from '../data/config.ts';
import type {Vec2} from '../game/types.ts';

export const MAP_SIZE=166,MAP_INSET=10;
export interface MapMarker extends Vec2 {id:string;kind:'player'|'boss'|'cache'|'shrine'|'elite'|'healing'|'landmark';radius:number;priority:number;label?:string;price?:number;}
export interface PlacedMarker extends MapMarker {mapX:number;mapY:number;anchorX:number;anchorY:number;}

/** North is +Z. Square projection keeps the playable map's corners visible. */
export function projectMapPoint(point:Vec2):{x:number;y:number}{
 const scale=(MAP_SIZE/2-MAP_INSET)/DESIGN.mapRadius,clamp=(n:number)=>Math.max(MAP_INSET,Math.min(MAP_SIZE-MAP_INSET,n));
 return {x:clamp(MAP_SIZE/2+point.x*scale),y:clamp(MAP_SIZE/2-point.z*scale)};
}

/** Small connector offsets separate symbols; crowded optional marks are omitted. */
export function layoutMapMarkers(markers:readonly MapMarker[]):PlacedMarker[]{
 const placed:PlacedMarker[]=[],offsets=[[0,0],[8,0],[-8,0],[0,8],[0,-8],[8,8],[-8,8],[8,-8],[-8,-8],[14,0],[-14,0],[0,14],[0,-14]];
 const sorted=[...markers].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
 for(const marker of sorted){
  const anchor=projectMapPoint(marker);
  for(const [dx,dy] of offsets){
   const mapX=anchor.x+dx,mapY=anchor.y+dy;
   if(mapX-marker.radius<4||mapX+marker.radius>MAP_SIZE-4||mapY-marker.radius<4||mapY+marker.radius>MAP_SIZE-4)continue;
   if(placed.some(other=>Math.hypot(other.mapX-mapX,other.mapY-mapY)<other.radius+marker.radius+2))continue;
   placed.push({...marker,mapX,mapY,anchorX:anchor.x,anchorY:anchor.y});break;
  }
 }
 return placed;
}
