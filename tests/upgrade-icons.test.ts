import test from 'node:test';
import assert from 'node:assert/strict';
import {KANTO} from '../src/data/kanto.ts';
import {getAttackProfile} from '../src/data/attacks.ts';
import {ITEMS,getItemDefinition} from '../src/data/items.ts';
import {upgradeIcon,upgradeIconName} from '../src/ui/upgradeIcons.ts';
import type {UpgradeChoice} from '../src/game/types.ts';

test('all eight attack patterns use matching icons across the full species catalogue',()=>{
 const patterns=new Set<string>();
 for(const species of KANTO){
  const choice:UpgradeChoice={id:`attack-${species.id}`,kind:'attack',title:species.moveName,description:'Rank +1',rarity:'common',sourceSpeciesId:species.id};
  patterns.add(upgradeIconName(choice));assert.equal(upgradeIconName(choice),getAttackProfile(species.id).kind);
  assert.match(upgradeIcon(choice),/aria-hidden="true"/);
 }
 assert.equal(patterns.size,8);
});

test('item icons distinguish recovery, chain and protection while every catalogue entry renders',()=>{
 const icon=(id:string)=>{const item=getItemDefinition(id)!;return upgradeIconName({id,kind:'item',title:item.title,description:item.description,rarity:item.rarity});};
 assert.equal(icon('shell-bell'),'heal');assert.equal(icon('storm-coil'),'chain');assert.equal(icon('metal-coat'),'shield');assert.equal(icon('scope-lens'),'lens');
 const unique=new Set(ITEMS.map(upgradeIconName));assert.ok(unique.size>=10);
 for(const choice of ITEMS){const svg=upgradeIcon(choice);assert.match(svg,/^<svg/);assert.doesNotMatch(svg,/undefined|<script/);}
});
