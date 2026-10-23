import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MAP_DEFINITIONS,siteAvailable,worldProfile} from '../src/data/maps.ts';
import {shrineForPOI} from '../src/data/shrines.ts';
import {WORLD} from '../src/data/world.ts';
import {biomeAt,createPOIs} from '../src/game/systems/environment.ts';

test('four additional permanent shrines leave established site identities, stock and timed discoveries intact',()=>{
 const originalSites={
  wildlands:'28687ac4730cc20e8a35698c8ff85119576670540ff8593490a672c173f8b7c4',
  'pinewood-route':'8402406437c4e50369243349082f6648685f3fd56eb25ccf8b3d49a0765ecea7',
  'ruins-route':'ca4ff448482615c4ec9d80ce9e9f4dae2795ea5c9b7c19eff4c24e81f843b409',
  'volcanic-ridge':'d94068456fbf65b53e2cada3035c9172eb038b295da91549ebadb77a8a4ef44b',
 };
 for(const map of Object.values(MAP_DEFINITIONS)){
  const pois=createPOIs(map.seed??4,map.id);
  assert.equal(createHash('sha256').update(JSON.stringify(pois.slice(0,21))).digest('hex'),originalSites[map.id]);
  assert.deepEqual(pois.filter(poi=>poi.availableAt!==undefined).map(poi=>[poi.uid,poi.availableAt]),[[38,180],[39,420],[40,660]]);
 }
});

test('extra shrines occupy all four regions on dry separated approaches and expose the existing guardian variants',()=>{
 for(const map of Object.values(MAP_DEFINITIONS))for(let sample=0;sample<64;sample++){
  const seed=sample*7919,profile=worldProfile(seed,map.id),pois=createPOIs(seed,map.id),extra=pois.slice(21);
  assert.deepEqual(pois,createPOIs(seed,map.id));
  assert.equal(pois.filter(poi=>siteAvailable(poi,0)).length,22);
  assert.deepEqual(extra.map(poi=>poi.uid),[41,42,43,44]);
  assert.deepEqual(extra.map(poi=>biomeAt(poi.x,poi.z,profile)),['meadow','woodland','ruins','lake']);
  assert.equal(new Set(pois.filter(poi=>poi.kind==='shrine').map(poi=>shrineForPOI(poi).speciesId)).size,6);
  for(const shrine of extra){
   assert.equal(shrine.kind,'shrine');assert.equal(shrine.challengeKind,'guardian');
   assert.ok(siteAvailable(shrine,0));assert.equal(shrine.price,undefined);assert.equal(shrine.used,false);
   assert.ok(shrine.shrineTier===1||shrine.shrineTier===2);
   assert.ok(Math.hypot(shrine.x-profile.lake.x,shrine.z-profile.lake.z)>=profile.lake.shoreRadius+3*WORLD.scale);
   assert.ok(pois.every(other=>other===shrine||Math.hypot(shrine.x-other.x,shrine.z-other.z)>=WORLD.poiSpacing));
  }
 }
});
