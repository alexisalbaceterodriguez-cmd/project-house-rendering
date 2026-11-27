/** Versioned catalogue metadata. Parametric entries are original Atelier 60 geometry, not commercial GLB assets. */
export const PRODUCT_CATALOG_VERSION = 1;
export type ProductSource = {
  id: string;
  kind: string;
  category: string;
  manufacturer: string;
  reference: string;
  sourceUrl?: string;
  license: string;
  attribution: string;
  representation: 'parametric' | 'glb';
  modelUrl?: string;
};
export const productSources: ProductSource[] = [
  ['sofa','Salón'],['table','Salón'],['chair','Salón'],['rug','Salón'],['bookshelf','Salón'],['armchair','Salón'],['sideboard','Salón'],['coffee-table','Salón'],['tv-unit','Salón'],['tv','Salón'],['side-table','Salón'],['bench','Dormitorio'],['coat-rack','Decoración'],['dresser','Dormitorio'],['shoe-cabinet','Decoración'],['wall-shelf','Decoración'],['radiator','Decoración'],['crib','Dormitorio'],['bar-stool','Cocina'],['washer','Baño'],['dryer','Baño'],['extending-table','Salón'],['desk-hutch','Dormitorio'],['bunk-bed','Dormitorio'],['laundry-basket','Baño'],['floating-nightstand','Dormitorio'],['corner-sofa','Salón'],['corner-sofa-left','Salón'],['pouf','Salón'],['console-table','Decoración'],['curtain','Decoración'],['sheer-curtain','Decoración'],['table-lamp','Decoración'],['vase','Decoración'],['books','Decoración'],['fruit-bowl','Decoración'],['candles','Decoración'],['photo-frame','Decoración'],['table-plant','Decoración'],['table-clock','Decoración'],['decor-bowl','Decoración'],['shelf-basket','Decoración'],
  ['bed','Dormitorio'],['single-bed','Dormitorio'],['storage-bed','Dormitorio'],['wardrobe','Dormitorio'],['desk','Dormitorio'],['nightstand','Dormitorio'],
  ['kitchen','Cocina'],['island','Cocina'],['fridge','Cocina'],
  ['sink','Baño'],['toilet','Baño'],['shower','Baño'],['bathtub','Baño'],['towel-rail','Baño'],['bath-tray','Baño'],['soap-dispenser','Baño'],['toothbrush-cup','Baño'],['towel-stack','Baño'],['desk-lamp','Dormitorio'],['laptop','Dormitorio'],['desk-organizer','Dormitorio'],['wastebasket','Dormitorio'],['blanket-basket','Dormitorio'],['clothes-rail','Dormitorio'],['floor-vase','Decoración'],['arc-lamp','Decoración'],['leaning-art','Decoración'],['blanket-ladder','Dormitorio'],['folding-screen','Dormitorio'],['wall-coat-rack','Decoración'],['bar-cart','Salón'],['office-chair','Dormitorio'],['floor-mirror','Dormitorio'],['record-console','Salón'],['decor-tray','Decoración'],['floor-cushion','Salón'],['nesting-tables','Salón'],['microwave','Cocina'],['toaster','Cocina'],['stand-mixer','Cocina'],['wine-rack','Cocina'],['kitchen-trolley','Cocina'],['ironing-board','Baño'],['drying-rack','Baño'],['freestanding-bathtub','Baño'],['pedestal-sink','Baño'],['bidet','Baño'],['mirror-cabinet','Baño'],['toilet-shelf','Baño'],['bath-stool','Baño'],['toilet-roll-stand','Baño'],['filing-cabinet','Dormitorio'],['mobile-pedestal','Dormitorio'],['whiteboard-easel','Dormitorio'],['printer','Dormitorio'],['desktop-monitor','Dormitorio'],['desk-globe','Decoración'],['file-boxes','Dormitorio'],['upright-piano','Salón'],['guitar-stand','Salón'],['floor-speaker','Salón'],['beanbag','Salón'],['magazine-rack','Salón'],['toy-box','Dormitorio'],['play-tent','Dormitorio'],['kids-table','Dormitorio'],['table-setting','Cocina'],['wine-set','Cocina'],['coffee-machine','Cocina'],['dish-rack','Cocina'],['herb-pots','Cocina'],['bath-mat','Baño'],['cutting-board','Cocina'],['kettle','Cocina'],['utensil-jar','Cocina'],['umbrella-stand','Decoración'],['doormat','Decoración'],['throw-pillow','Decoración'],['folded-blanket','Decoración'],
  ['plant','Decoración'],['lamp','Decoración'],['pendant','Decoración'],['mirror','Decoración'],['artwork','Decoración'],
].map(([kind,category])=>({
  id:`atelier60:parametric:${kind}`,
  kind,
  category,
  manufacturer:'Atelier 60',
  reference:`A60-${kind.toUpperCase()}`,
  license:'Modelo paramétrico original de la aplicación',
  attribution:'Atelier 60',
  representation:'parametric' as const,
}));
export const findProductSource = (kind:string) => productSources.find(product=>product.kind===kind);
