import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Check the complete model before persisting it or replacing a working project. */
export async function validateGLB(blob: Blob): Promise<void> {
  const buffer = await blob.arrayBuffer();
  const header = new DataView(buffer);
  if (buffer.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== buffer.byteLength) {
    throw new Error('El archivo no es un GLB 2.0 válido.');
  }
  if (header.getUint32(16, true) !== 0x4e4f534a || header.getUint32(12, true) > buffer.byteLength - 20) {
    throw new Error('El modelo GLB no contiene un bloque JSON válido.');
  }
  try {
    const document=JSON.parse(new TextDecoder().decode(buffer.slice(20,20+header.getUint32(12,true))));
    if([...document.buffers??[],...document.images??[]].some((resource:{uri?:unknown})=>typeof resource.uri==='string'&&!resource.uri.startsWith('data:'))){
      throw new Error('El GLB depende de archivos externos. Incluye sus texturas y buffers dentro del modelo.');
    }
    await new GLTFLoader().parseAsync(buffer, '');
  } catch(error) {
    if(error instanceof Error&&error.message.startsWith('El GLB depende'))throw error;
    throw new Error('El modelo GLB no se puede leer.');
  }
}
