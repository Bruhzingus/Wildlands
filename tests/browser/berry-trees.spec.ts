import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function start(page:Page){
 await page.routeWebSocket('**',socket=>socket.close());
 await page.goto('/?dev=1');
 await page.locator('[data-starter="7"]').click();
 await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('renderCanvas');
 await expect.poll(()=>page.evaluate(()=>(window as any).__WILDLANDS__.scene.isReady())).toBe(true);
}

test('berry trees read as a two-canopy fruit tree at the gameplay camera distance',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await start(page);
 await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,tree=g.sim.state.berryTrees[0],s=g.sim.state;
  s.enemies=[];s.terrainFeatures=[];s.player.x=tree.x;s.player.z=tree.z+8;
  g.camera.radius=23;g.camera.target.set(tree.x,g.world.height(tree.x,tree.z)+1.7,tree.z);
 });
 const view=await page.evaluate(()=>{
  const g=(window as any).__WILDLANDS__,tree=g.sim.state.berryTrees[0],scene=g.scene;
  const lower=scene.getMeshByName(`berry-tree-${tree.uid}-lower`),upper=scene.getMeshByName(`berry-tree-${tree.uid}-upper`),trunk=scene.getMeshByName(`berry-tree-${tree.uid}-trunk`);
  const fruit=Array.from({length:5},(_,index)=>scene.getMeshByName(`berry-tree-${tree.uid}-fruit-${index}`));
  const generic=scene.meshes.filter((mesh:any)=>mesh.name.startsWith('crown-')&&Math.abs(mesh.position.x-tree.x)<.001&&Math.abs(mesh.position.z-tree.z)<.001).length;
  return {berry:tree.berry,lower:lower?.isEnabled(),upper:upper?.isEnabled(),trunk:trunk?.isEnabled(),palette:[(trunk as any)?.material?.name,(lower as any)?.material?.name,(upper as any)?.material?.name],positions:[trunk,lower,upper].map(mesh=>({x:mesh?.position.x,z:mesh?.position.z})),fruit:fruit.map(mesh=>({enabled:mesh?.isEnabled(),material:(mesh as any)?.material?.name})),generic};
 });
 expect(view.lower).toBe(true);expect(view.upper).toBe(true);expect(view.trunk).toBe(true);
 expect(view.positions.every(position=>position.x===view.positions[0].x&&position.z===view.positions[0].z)).toBe(true);
 expect(view.palette).toEqual([`${view.berry} berry tree bark`,`${view.berry} berry tree lower canopy`,`${view.berry} berry tree upper canopy`]);
 expect(view.fruit).toHaveLength(5);expect(view.fruit.every(fruit=>fruit.enabled&&fruit.material?.endsWith(' berry'))).toBe(true);
 expect(view.generic).toBe(0);
 await mkdir('artifacts/browser',{recursive:true});await page.screenshot({path:'artifacts/browser/berry-tree-camera.png'});
 expect(errors).toEqual([]);
});
