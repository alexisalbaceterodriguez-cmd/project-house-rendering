export type Point = { x: number; y: number };
export type RoomKind = 'living' | 'bedroom' | 'bathroom' | 'hall';
export type FloorFinish = 'oak' | 'ash' | 'walnut' | 'stone' | 'terrazzo' | 'concrete';
export type Room = { id: string; name: string; kind: RoomKind; x: number; y: number; w: number; d: number; floor: FloorFinish; materialId?: string; vertices?: Point[]; holes?: Point[][] };
export type Wall = { id: string; a: Point; b: Point; thickness: number; outer?: boolean; materialId?: string };
export type Opening = { id: string; wallId: string; kind: 'door' | 'window'; offset: number; width: number; height: number; sill: number };
export type FurnitureKind = 'sofa' | 'bed' | 'single-bed' | 'table' | 'chair' | 'wardrobe' | 'desk' | 'kitchen' | 'island' | 'sink' | 'fridge' | 'toilet' | 'shower' | 'plant' | 'lamp' | 'rug' | 'model';
export type ModelFinish = { color: string; roughness: number; metalness: number; materialName?: string; materialId?: string };
export type Furniture = { id: string; kind: FurnitureKind; name: string; x: number; y: number; w: number; d: number; h: number; rotation: number; color: string; unitPrice?: number; assetId?: string; productId?: string; productSource?: ProductAttribution; materialId?: string; module?: ModuleSettings; modelData?: string; modelUpAxis?: 'Y' | 'Z' | 'X'; modelElevation?: number; modelOffsetX?: number; modelOffsetZ?: number; modelFinish?: ModelFinish; modelFinishes?: ModelFinish[] };
export type Palette = { walls: string; accent: string; wood: string; textile: string; metal: string };
export type CameraView = { position: [number, number, number]; target: [number, number, number] };
export type StudioSettings = { subjectId?:string; key:number; fill:number; rim:number; azimuth:number; warmth:'neutral'|'warm'|'cool'; background:string };
export type RenderSettings = { lighting: 'day' | 'night' | 'studio'; exposure: number; quality: 'draft' | 'high'; camera?: CameraView; walk?: boolean; studio?:StudioSettings };
export type ModuleSettings = { family: 'base' | 'wall' | 'column' | 'sink' | 'hob' | 'oven' | 'vanity'; front: string; worktop: string; handles: 'bar' | 'none' };
export type ProductAttribution = { manufacturer:string; reference:string; source:string; license:string; attribution:string };
export type EditorSettings = { grid:number; magnet:boolean; orthogonal:boolean };
export type PortableResource = { id:string; data:string };
export type CustomMaterial = {
  id:string; name:string; category:string; color:string; scale:number; roughness:number; metalness:number; normalStrength:number;
  finish?:'standard'|'glass'|'varnish'|'fabric';
  // Local content-addressed texture:<sha256> references; portable/legacy v1 JSON embeds data URLs.
  maps?: { color?:string; normal?:string; roughness?:string }; source:string; license:string;
};
export type WallGraph = { revision: 1; nodes: { id: string; x: number; y: number }[]; edges: { wallId: string; from: string; to: string }[] };
export type Project = { version: 1; schemaRevision?: 1; id: string; name: string; width: number; depth: number; wallHeight: number; rooms: Room[]; walls: Wall[]; openings: Opening[]; furniture: Furniture[]; palette: Palette; materials?:CustomMaterial[]; resources?: PortableResource[]; graph?: WallGraph; editor?: EditorSettings; render?: RenderSettings; referenceImage?: { data: string; width: number; height: number; opacity: number } };
export type Selection = { type: 'furniture' | 'wall' | 'room' | 'opening'; id: string } | null;
export type Tool = 'select' | 'wall' | 'door' | 'window' | 'room';
export type Mode = '2d' | '3d' | 'split';
