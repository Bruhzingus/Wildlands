import {Mesh,MeshBuilder,Scene,StandardMaterial,TransformNode} from '@babylonjs/core';
import {siteAvailable} from '../../data/maps.ts';
import type {POI} from '../types.ts';
import type {DressingSite} from '../systems/landmarkDressing.ts';
import {terrainOrientation} from './terrainOrientation.ts';

/** Individually owned POI roots, shared stone/plant geometries. These objects
 * never enter picking, collision or interaction registries. */
export class LandmarkDressing {
 private roots=new Map<number,TransformNode>();private sources:Mesh[]=[];private visible=true;
 private sites:readonly DressingSite[];
 constructor(scene:Scene,sites:readonly DressingSite[],stone:StandardMaterial,ground:(x:number,z:number)=>number){
  this.sites=sites;
  const rock=(scene.getMeshByName('low-poly rock') as Mesh).clone('dressing stone source',null,true)!;rock.isVisible=false;rock.material=stone;this.sources.push(rock);
  const paver=MeshBuilder.CreateCylinder('dressing paver source',{height:1,diameter:2,tessellation:6},scene);paver.isVisible=false;paver.material=stone;this.sources.push(paver);
  const plantSource=scene.getMeshByName('ground-detail-flower')??scene.getMeshByName('ground-detail-mushroom')??scene.getMeshByName('ground-detail-chip')??scene.getMeshByName('ground-detail-tuft');
  const plant=(plantSource as Mesh|undefined)?.clone('dressing plant source',{doNotCloneChildren:true,cloneThinInstances:false});
  if(plant){plant.isVisible=false;plant.setEnabled(true);plant.unfreezeWorldMatrix();plant.refreshBoundingInfo();this.sources.push(plant);}
  for(const site of sites){
   const root=new TransformNode(`dressing-${site.kind}-${site.uid}`,scene);root.position.set(site.x,ground(site.x,site.z),site.z);root.metadata={landmarkDressing:true,uid:site.uid};this.roots.set(site.uid,root);
   for(const [index,part] of site.parts.entries()){
    const source=part.kind==='plant'?plant:part.kind==='paver'?paver:rock;if(!source)continue;
    const mesh=source.createInstance(`dressing-${site.uid}-${part.kind}-${index}`);mesh.parent=root;
    const offset=part.kind==='paver'?part.sy*.4:part.kind==='plant'?0:part.sy*.95;
    mesh.position.set(part.x-site.x,ground(part.x,part.z)-root.position.y+offset,part.z-site.z);mesh.scaling.set(part.sx,part.sy,part.sz);mesh.rotation.y=part.rotation;
    if(part.kind==='paver'||part.kind==='plant')mesh.rotationQuaternion=terrainOrientation(part.x,part.z,part.rotation,ground);
    mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;mesh.metadata={landmarkDressing:true,uid:site.uid};
   }
  }
 }
 setVisible(visible:boolean){this.visible=visible;}
 update(pois:readonly POI[],elapsed:number){
  for(const site of this.sites){const poi=site.kind==='grove'?undefined:pois.find(p=>p.uid===site.uid);
   const available=site.kind==='grove'||!!poi&&siteAvailable(poi,elapsed)&&(poi.kind==='cache'?(poi.price!==undefined||!poi.used):(!poi.used||poi.respawnAt!==undefined||!!poi.challenge));
   this.roots.get(site.uid)?.setEnabled(this.visible&&available);
  }
 }
 dispose(){for(const root of this.roots.values())root.dispose();this.roots.clear();for(const mesh of this.sources)mesh.dispose();this.sources=[];}
}
