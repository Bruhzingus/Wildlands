import {Matrix,Mesh,Quaternion,Scene,StandardMaterial,Vector3} from '@babylonjs/core';
import type {MapDefinition} from '../../data/maps.ts';
import type {SurfaceDetail,SurfaceDetailKind} from '../systems/surfaceDetails.ts';
import {RNG} from '../../utils/random.ts';
import {sceneryVariant} from './stoneFormations.ts';
import {createDetailTemplate} from './groundDetailTemplates.ts';
import {terrainOrientation} from './terrainOrientation.ts';

export const GROUND_DETAIL_VARIANTS=3;

/** Opaque vertex-colored templates, shared by thin instances. Cosmetic variety
 * costs at most three batches per class, with one material and no frame work. */
export function buildGroundDetails(scene:Scene,details:readonly SurfaceDetail[],tuning:MapDefinition['surfaceDetails'],material:(name:string,color:string)=>StandardMaterial,ground?:(x:number,z:number)=>number):Mesh[]{
 const result:Mesh[]=[];
 if(!details.length)return result;
 const detailMaterial=material('ground details','#ffffff');detailMaterial.backFaceCulling=false;detailMaterial.twoSidedLighting=true;
 for(const kind of ['tuft','flower','mushroom','stump','chip'] as SurfaceDetailKind[]){
  const pool=details.filter(detail=>detail.kind===kind);if(!pool.length)continue;
  const offset=sceneryVariant(917,pool[0].x,pool[0].z,GROUND_DETAIL_VARIANTS);
  // Cycle the isolated, seeded placement order so even sparse classes receive
  // different silhouettes instead of occasionally hashing to a single shape.
  for(let variant=0;variant<GROUND_DETAIL_VARIANTS;variant++){
   const placements=pool.filter((_,index)=>(index+offset)%GROUND_DETAIL_VARIANTS===variant);if(!placements.length)continue;
   const mesh=createDetailTemplate(scene,kind,variant,tuning);
   mesh.name=variant===0?`ground-detail-${kind}`:`ground-detail-${kind}-${variant}`;mesh.material=detailMaterial;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;mesh.metadata={surfaceDetail:kind,variant,count:placements.length};
   const matrices=new Float32Array(placements.length*16);
   for(const [index,detail] of placements.entries()){
    const rotation=ground?terrainOrientation(detail.x,detail.z,detail.rotation,ground):Quaternion.RotationAxis(Vector3.Up(),detail.rotation);
    const variation=new RNG(sceneryVariant(0x31fa,detail.x,detail.z,0x7fffffff)),width=detail.scale*variation.between(.88,1.14),height=detail.scale*variation.between(.82,1.22);
    Matrix.Compose(new Vector3(width,height,detail.scale),rotation,new Vector3(detail.x,detail.y,detail.z)).copyToArray(matrices,index*16);
   }
   mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceEnablePicking=false;mesh.thinInstanceRefreshBoundingInfo();mesh.freezeWorldMatrix();result.push(mesh);
  }
 }
 return result;
}
