import { surfaceTexturesReady } from './surfaceTextures';
type Capture=(width:number,height:number)=>Promise<Blob>;
const captures=new Map<HTMLCanvasElement,Capture>();
let capturing=false;
export const registerCapture=(canvas:HTMLCanvasElement,handler:Capture)=>{
  captures.set(canvas,handler);
  return()=>{if(captures.get(canvas)===handler)captures.delete(canvas);};
};
export async function captureCanvas():Promise<HTMLCanvasElement>{
  const deadline=performance.now()+5000;
  do{
    const canvas=document.querySelector('.scene-wrap canvas') as HTMLCanvasElement|null;
    if(canvas&&captures.has(canvas))return canvas;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }while(performance.now()<deadline);
  throw new Error('Abre primero la vista 3D y espera a que termine de cargar.');
}
export async function captureImage(width:number,height:number):Promise<Blob>{
  const canvas=await captureCanvas();
  const capture=captures.get(canvas);
  if(!capture)throw new Error('Abre primero la vista 3D y espera a que termine de cargar.');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240||width>3840||height>3840||width*height>8_294_400)throw new Error('La captura admite hasta 3840 px y 8,3 millones de píxeles.');
  if(capturing)throw new Error('Ya hay una imagen en preparación. Espera a que termine.');
  capturing=true;
  // Scanned surface maps load after the scene mounts; capture with the final images, never the stand-ins.
  try{await surfaceTexturesReady();return await capture(width,height);}finally{capturing=false;}
}

// Live three.js scene of the 3D viewer, used to export the render package (GLB).
export type SceneSource={scene:import('three').Scene;camera:import('three').PerspectiveCamera;invalidate:()=>void};
const sources=new Map<HTMLCanvasElement,SceneSource>();
export const registerSceneSource=(canvas:HTMLCanvasElement,source:SceneSource)=>{
  sources.set(canvas,source);
  return()=>{if(sources.get(canvas)===source)sources.delete(canvas);};
};
export async function getSceneSource():Promise<SceneSource>{
  const canvas=await captureCanvas();
  const source=sources.get(canvas);
  if(!source)throw new Error('Abre primero la vista 3D y espera a que termine de cargar.');
  return source;
}
