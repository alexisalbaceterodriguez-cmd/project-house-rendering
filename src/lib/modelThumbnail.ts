import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Render a single local GLB on demand. No model or renderer survives this call. */
export async function renderModelThumbnail(blob: Blob): Promise<string> {
  const gltf = await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f4f3ef');
  const model = gltf.scene;
  scene.add(model);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error('El modelo no contiene geometría visible.');
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite)) throw new Error('Dimensiones inválidas.');
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const radius = Math.max(size.length() / 2, 0.01);
  const camera = new THREE.OrthographicCamera(-radius * 1.35, radius * 1.35, radius * 1.35, -radius * 1.35, 0.01, radius * 20 + 10);
  camera.position.set(radius * 2, radius * 1.5, radius * 2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b4ae, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(radius * 2, radius * 4, radius * 3);
  scene.add(key);
  let renderer: THREE.WebGLRenderer | undefined;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(256, 256, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/jpeg', 0.8);
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
