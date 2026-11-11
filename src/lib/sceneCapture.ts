type Capture=(width:number,height:number)=>Promise<Blob>;
const captures=new Map<HTMLCanvasElement,Capture>();
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
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240||width>3840||height>3840||width*height>8_000_000)throw new Error('La captura admite hasta 3840 px y 8 millones de píxeles.');
  return capture(width,height);
}
