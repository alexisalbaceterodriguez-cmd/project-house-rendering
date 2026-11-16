import { afterEach,describe,expect,it,vi } from 'vitest';
import { blankProject } from '../data/defaultProject';
import { isProject } from '../lib/validation';
import { applyAppearance } from '../lib/designVariants';
import { defaultStudio,objectCamera,physicalProperties,studioSubject } from '../lib/studioRender';
import { captureImage,registerCapture } from '../lib/sceneCapture';
import type { CustomMaterial,Furniture } from '../types';
import { useEditor } from '../store';

const item:Furniture={id:'sofa',name:'Sofá de referencia',kind:'sofa',x:3,y:4,w:2.6,d:1,h:.9,rotation:90,color:'#788871',modelElevation:.2,modelOffsetX:1};
const material:CustomMaterial={id:'custom:fabric',name:'Lino',category:'Tejido',color:'#788871',finish:'fabric',roughness:.9,metalness:0,normalStrength:1,scale:.5,source:'Propio',license:'Creación propia'};
afterEach(()=>vi.unstubAllGlobals());

describe('Estudio portable compatible con JSON v1',()=>{
  it('valida límites de luz y acabados, manteniendo proyectos antiguos',()=>{
    const project=blankProject();expect(isProject(project)).toBe(true);
    project.furniture=[item];project.materials=[material];
    project.render={lighting:'studio',quality:'high',exposure:1,studio:{...defaultStudio,subjectId:item.id}};
    expect(isProject(JSON.parse(JSON.stringify(project)))).toBe(true);
    for(const patch of [{key:NaN},{rim:9},{fill:-1},{azimuth:181},{warmth:'bad'},{background:'red'},{subjectId:42}]){
      expect(isProject({...project,render:{...project.render,studio:{...defaultStudio,...patch}}})).toBe(false);
    }
    expect(isProject({...project,materials:[{...material,finish:'invalid'}]})).toBe(false);
  });
  it('aislar y ajustar luces mantiene geometría y permite deshacer/rehacer',()=>{
    const project=blankProject();project.furniture=[item];useEditor.getState().load(project);
    useEditor.getState().change(p=>{p.render={lighting:'studio',quality:'high',exposure:1,camera:objectCamera(item),studio:{...defaultStudio,subjectId:item.id}};});
    expect(studioSubject(useEditor.getState().project)?.id).toBe(item.id);
    expect(useEditor.getState().project.walls).toEqual(project.walls);
    useEditor.getState().undo();expect(useEditor.getState().project.render).toEqual(project.render);
    useEditor.getState().redo();expect(studioSubject(useEditor.getState().project)?.id).toBe(item.id);
  });
  it('A/B fija estudio y cámara; objeto eliminado vuelve a escena completa',()=>{
    const base=blankProject();base.furniture=[item];base.render={lighting:'studio',quality:'high',exposure:1,camera:objectCamera(item),studio:{...defaultStudio,subjectId:item.id}};
    const other=structuredClone(base);other.render!.studio!.key=8;other.materials=[material];
    const result=applyAppearance(base,other);expect(result.render).toEqual(base.render);expect(result.materials).toEqual([material]);
    result.furniture=[];expect(studioSubject(result)).toBeUndefined();
    expect(isProject(result)).toBe(true); // A stale subject must not make the project unsaveable.
    expect(objectCamera(item).target).toEqual([3,.605,5]);
  });
  it('separa vidrio, barniz y tejido y simplifica extensiones en Rápida',()=>{
    expect(physicalProperties({...material,finish:'glass'},true)).toMatchObject({transmission:.96,transparent:false,depthWrite:true});
    expect(physicalProperties({...material,finish:'glass'},false)).toMatchObject({transmission:0,transparent:true,opacity:.35});
    expect(physicalProperties({...material,finish:'varnish'},true)).toMatchObject({clearcoat:1,sheen:0,transmission:0});
    expect(physicalProperties(material,true)).toMatchObject({sheen:.65,sheenRoughness:.9,clearcoat:0,transmission:0});
    expect(physicalProperties({...material,finish:'glass'},true)).toMatchObject({thickness:.01,ior:1.5});
    expect(physicalProperties({...material,finish:'varnish'},true)).toMatchObject({clearcoatRoughness:.28});
    expect(physicalProperties(material,false)).toMatchObject({sheen:0,clearcoat:0,transmission:0});
  });
});

describe('Captura 4K y exclusión de exportaciones simultáneas',()=>{
  it('admite UHD, rechaza tamaños excesivos y libera el bloqueo tras fallar',async()=>{
    const canvas={} as HTMLCanvasElement;vi.stubGlobal('document',{querySelector:()=>canvas});
    let reject!:(error:Error)=>void;
    const handler=vi.fn(()=>new Promise<Blob>((_,fail)=>{reject=fail;}));
    const unregister=registerCapture(canvas,handler);
    try{
      await expect(captureImage(3840,2161)).rejects.toThrow('8,3 millones');
      const first=captureImage(3840,2160);await Promise.resolve();await Promise.resolve();
      await expect(captureImage(1280,720)).rejects.toThrow('Ya hay una imagen');
      const failed=expect(first).rejects.toThrow('GPU');reject(new Error('GPU'));await failed;
      handler.mockResolvedValueOnce(new Blob(['png']));await expect(captureImage(1280,720)).resolves.toBeInstanceOf(Blob);
      expect(handler).toHaveBeenCalledWith(3840,2160);
    }finally{unregister();}
  });
});
