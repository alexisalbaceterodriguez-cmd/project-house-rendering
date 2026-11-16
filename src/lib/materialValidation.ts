import type { CustomMaterial } from '../types';

export const MAX_MATERIAL_MAP_LENGTH = 1024 * 1024;
export const MAX_PROJECT_TEXTURE_LENGTH = 4 * 1024 * 1024;
const image = (value:unknown) => typeof value === 'string' && value.length <= MAX_MATERIAL_MAP_LENGTH
  && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
const finite = (value:unknown,min:number,max:number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function validCustomMaterials(value:unknown): value is CustomMaterial[] {
  if (!Array.isArray(value) || value.length > 64) return false;
  const ids = new Set<string>(); let total = 0;
  for (const material of value) {
    if (!material || typeof material !== 'object' || !/^custom:[a-zA-Z0-9-]{1,100}$/.test(material.id)
      || ids.has(material.id) || !['name','category','source','license'].every(key => typeof material[key] === 'string' && material[key].length <= 2000)
      || !material.name.trim() || material.name.length > 180 || !/^#[a-fA-F0-9]{6}$/.test(material.color)
      || !finite(material.scale,.02,20) || !finite(material.roughness,0,1) || !finite(material.metalness,0,1) || !finite(material.normalStrength,0,3)) return false;
    ids.add(material.id);
    if (material.maps !== undefined) {
      if (!material.maps || typeof material.maps !== 'object' || Array.isArray(material.maps)) return false;
      for (const [key,data] of Object.entries(material.maps)) {
        if (!['color','normal','roughness'].includes(key) || !image(data)) return false;
        total += (data as string).length;
      }
    }
  }
  return total <= MAX_PROJECT_TEXTURE_LENGTH;
}
