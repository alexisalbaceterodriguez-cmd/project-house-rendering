export type PbrMaterial = { id:string; name:string; category:string; asset:string; scale:number; roughness:number; metalness:number; source:string; license:string };
export const materialCatalog:PbrMaterial[]=[
  {id:'wood',name:'Madera natural',category:'Madera',asset:'wood_floor_deck',scale:2,roughness:.85,metalness:0,source:'https://polyhaven.com/a/wood_floor_deck',license:'CC0-1.0'},
  {id:'tile',name:'Porcelánico claro',category:'Cerámica',asset:'floor_tiles_02',scale:2,roughness:.6,metalness:0,source:'https://polyhaven.com/a/floor_tiles_02',license:'CC0-1.0'},
  {id:'fabric',name:'Tejido natural',category:'Textil',asset:'fabric_pattern_07',scale:1,roughness:1,metalness:0,source:'https://polyhaven.com/a/fabric_pattern_07',license:'CC0-1.0'},
  {id:'plaster',name:'Enlucido blanco',category:'Pintura',asset:'white_plaster_rough_01',scale:2,roughness:.95,metalness:0,source:'https://polyhaven.com/a/white_plaster_rough_01',license:'CC0-1.0'},
];
export const materialUrl=(material:PbrMaterial,map:'color'|'normal'|'roughness')=>`${import.meta.env.BASE_URL}materials/${material.asset}-${map}.jpg`;
