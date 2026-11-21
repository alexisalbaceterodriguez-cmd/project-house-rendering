import * as THREE from 'three';
import { useEditor } from '../store';
import { captureImage, getSceneSource } from './sceneCapture';
import { surfaceTexturesReady } from './surfaceTextures';
import { assemblePackage, type PackageCamera, type PackageOptions, type RenderPackage } from './renderPackage';

const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const exportable=(object:THREE.Object3D)=>{
  if(object.userData.editorOverlay||object.userData.renderExclude)return false;
  if((object as THREE.Light).isLight||object instanceof THREE.Line||object instanceof THREE.Points||object instanceof THREE.Sprite)return false;
  if(object instanceof THREE.Mesh){
    const materials=Array.isArray(object.material)?object.material:[object.material];
    // glTF cannot carry custom shaders (contact shadows, helpers): skip rather than export them grey.
    if(materials.some(m=>(m as THREE.ShaderMaterial).isShaderMaterial))return false;
  }
  return true;
};

/** Camera of the 3D viewer as the package records it (position, orbit target, vertical FOV). */
export function currentCamera(camera:THREE.PerspectiveCamera):PackageCamera{
  const live=useEditor.getState().liveCamera;
  const position=camera.position.toArray() as [number,number,number];
  const target=live&&new THREE.Vector3(...live.position).distanceTo(camera.position)<1e-3?live.target:camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(camera.position).toArray() as [number,number,number];
  return {position,target,fovY:camera.fov};
}

/**
 * Export the live scene as a self-contained GLB. Walls are shown at full height
 * (no cut-away) and editor helpers, lights and custom shaders are left out; the
 * editor state is restored afterwards.
 */
export async function exportSceneGLB():Promise<ArrayBuffer>{
  const editor=useEditor.getState();
  const previous={cutaway:editor.cutaway,walls:editor.wallsVisible,selection:editor.selection};
  editor.setCutaway(false);editor.setWallsVisible(true);editor.setSelection(null);
  const hidden:THREE.Object3D[]=[];
  try{
    const source=await getSceneSource();
    // Cycles must receive the scanned floor/fabric/wood maps, not the procedural placeholders.
    await surfaceTexturesReady();
    source.invalidate();for(let i=0;i<3;i++)await frame();
    source.scene.traverse(object=>{if(object.visible&&!exportable(object)){object.visible=false;hidden.push(object);}});
    const { GLTFExporter }=await import('three/examples/jsm/exporters/GLTFExporter.js');
    const result=await new GLTFExporter().parseAsync(source.scene,{binary:true,onlyVisible:true,maxTextureSize:4096});
    if(!(result instanceof ArrayBuffer))throw new Error('No se pudo exportar la geometría en GLB.');
    return result;
  }finally{
    hidden.forEach(object=>{object.visible=true;});
    const state=useEditor.getState();
    state.setCutaway(previous.cutaway);state.setWallsVisible(previous.walls);state.setSelection(previous.selection);
  }
}

/** Build the full render package from the 3D viewer: GLB, manifest and the WebGL preview at the same camera. */
export async function createRenderPackage(options:PackageOptions):Promise<RenderPackage>{
  const project=useEditor.getState().project;
  const source=await getSceneSource();
  const camera=currentCamera(source.camera);
  const glb=await exportSceneGLB();
  if(useEditor.getState().project!==project)throw new Error('El proyecto cambió durante la exportación. Vuelve a generar el render.');
  // Same camera and aspect for the WebGL reference image (min 320 × 240 for the capture API).
  const scale=Math.max(1,320/options.width,240/options.height);
  const preview=await captureImage(Math.round(options.width*scale),Math.round(options.height*scale));
  if(useEditor.getState().project!==project)throw new Error('El proyecto cambió durante la exportación. Vuelve a generar el render.');
  return assemblePackage(project,camera,options,glb,preview);
}
