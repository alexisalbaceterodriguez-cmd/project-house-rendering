import { describe, expect, it } from 'vitest';
import { demoProject } from '../data/defaultProject';
import { assemblePackage, buildManifest, crc32, mainWindow, packageKey, pointInPolygon, sha256Hex, storedZip, type PackageCamera } from '../lib/renderPackage';

const camera:PackageCamera={position:[3.4,1.5,4.8],target:[1.6,1.1,1.2],fovY:55};
const geometry={sha256:'a'.repeat(64),bytes:10};

function unzip(bytes:Uint8Array){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const end=bytes.length-22;expect(view.getUint32(end,true)).toBe(0x06054b50);
  const count=view.getUint16(end+10,true);let at=view.getUint32(end+16,true);const files:Record<string,Uint8Array>={};
  for(let i=0;i<count;i++){
    expect(view.getUint32(at,true)).toBe(0x02014b50);
    const size=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),local=view.getUint32(at+42,true),crc=view.getUint32(at+16,true);
    const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+nameLength));
    const localName=view.getUint16(local+26,true),start=local+30+localName;
    files[name]=bytes.subarray(start,start+size);expect(crc32(files[name])).toBe(crc);
    at+=46+nameLength;
  }
  return files;
}

describe('render package', () => {
  it('computes standard CRC-32 and SHA-256', async () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('writes a stored zip that round-trips', () => {
    const zip=storedZip([{name:'scene.json',data:new TextEncoder().encode('{"a":1}')},{name:'scene.glb',data:new Uint8Array([1,2,3,4])}]);
    const files=unzip(zip);
    expect(Object.keys(files)).toEqual(['scene.json','scene.glb']);
    expect(new TextDecoder().decode(files['scene.json'])).toBe('{"a":1}');
    expect([...files['scene.glb']]).toEqual([1,2,3,4]);
  });

  it('finds the outward normal of the living-room window', () => {
    expect(pointInPolygon({x:1,y:1},[{x:0,y:0},{x:4,y:0},{x:4,y:6},{x:0,y:6}])).toBe(true);
    const window=mainWindow(demoProject,{x:1.6,y:1.2});
    expect(window?.id).toBe('living-window');
    // Wall "n" runs along y = 0; the exterior is y < 0.
    expect(window?.outward.y).toBeCloseTo(-1);
  });

  it('builds a manifest that keeps project geometry, ids and licences', () => {
    const manifest=buildManifest(demoProject,camera,{preset:'afternoon',quality:'standard',width:1280,height:720,passes:['depth','object_id']},geometry,'hash','2026-11-20T00:00:00Z');
    expect(manifest.format).toBe('atelier-render-package');
    expect(manifest.project).toMatchObject({id:'atelier-60-demo',wallHeight:2.55,width:10,depth:6});
    expect(manifest.rooms.find(r=>r.id==='living')?.polygon).toEqual([[0,0],[4,0],[4,6],[0,6]]);
    expect(manifest.objects.filter(o=>o.type==='furniture')).toHaveLength(demoProject.furniture.length);
    expect(manifest.render).toMatchObject({samples:256,passes:['beauty','depth','object_id']});
    const sun=manifest.lighting.sun.direction;
    expect(Math.hypot(...sun)).toBeCloseTo(1,3);
    // Afternoon sun: low (≈18°) and outside the north window (towards -z in three space).
    expect(Math.asin(sun[1])*180/Math.PI).toBeCloseTo(18,1);
    expect(sun[2]).toBeLessThan(-.5);
    // Daylight presets ask the engine to pull the window view 1.5 EV (night/studio leave it to the default 0).
    expect(manifest.lighting).toMatchObject({windowPull:1.5});
  });

  it('switches presets without touching the geometry', () => {
    const night=buildManifest(demoProject,camera,{preset:'night',quality:'draft',width:960,height:540},geometry,'hash');
    expect(night.lighting).toMatchObject({sun:{strength:0},roomLights:true});
    const studio=buildManifest(demoProject,camera,{preset:'studio',quality:'high',width:960,height:540},geometry,'hash');
    expect(studio.lighting).toMatchObject({hdri:'studio',ceiling:'off'});
    expect(studio.render.samples).toBe(1024);
    expect(studio.rooms).toEqual(night.rooms);
  });

  it('assembles the package with a matching GLB hash and stable idempotency key', async () => {
    const glb=new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0]).buffer;
    const preview=new Blob([new Uint8Array([0x89,0x50,0x4e,0x47])]);
    const pkg=await assemblePackage(demoProject,camera,{preset:'day',quality:'draft',width:960,height:540},glb,preview);
    const files=unzip(new Uint8Array(await pkg.zip.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['scene.json','scene.glb','preview.png']);
    const manifest=JSON.parse(new TextDecoder().decode(files['scene.json']));
    expect(manifest.geometry.sha256).toBe(await sha256Hex(files['scene.glb']));
    expect(await packageKey({...pkg.manifest,createdAt:'other'})).toBe(pkg.idempotencyKey);
  });
});
