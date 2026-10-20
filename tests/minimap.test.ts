import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutMapMarkers,projectMapPoint,MAP_SIZE,type MapMarker} from '../src/ui/minimap.ts';

test('square minimap shows playable corners and keeps north and heading axes consistent',()=>{
 const center=projectMapPoint({x:0,z:0}),north=projectMapPoint({x:0,z:100}),east=projectMapPoint({x:100,z:0});
 assert.ok(north.y<center.y);assert.ok(east.x>center.x);
 for(const x of [-113,113])for(const z of [-113,113]){
  const p=projectMapPoint({x,z});assert.ok(p.x>5&&p.x<MAP_SIZE-5&&p.y>5&&p.y<MAP_SIZE-5);
 }
});

test('overlapping discoveries separate from the player and boss with bounded connector offsets',()=>{
 const markers:MapMarker[]=[{id:'player',kind:'player',x:0,z:0,radius:6,priority:3},{id:'boss',kind:'boss',x:0,z:0,radius:6,priority:2},
  ...Array.from({length:12},(_,i)=>({id:`poi-${i}`,kind:'cache' as const,x:0,z:0,radius:3,priority:1}))];
 const placed=layoutMapMarkers(markers);assert.ok(placed.some(p=>p.id==='player'));assert.ok(placed.some(p=>p.id==='boss'));assert.ok(placed.length>2);
 assert.deepEqual(placed,layoutMapMarkers(markers),'layout must be deterministic');
 for(const [index,p] of placed.entries()){
  assert.ok(Math.hypot(p.mapX-p.anchorX,p.mapY-p.anchorY)<=14);
  for(const other of placed.slice(index+1))assert.ok(Math.hypot(other.mapX-p.mapX,other.mapY-p.mapY)>=p.radius+other.radius+2);
 }
});
