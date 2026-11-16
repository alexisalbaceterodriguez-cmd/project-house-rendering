import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()], base: './', build: { target: 'es2022' },
  // The workshop is loaded on demand. Prebundle its addons before the first edit
  // so dependency discovery cannot reload the page midway through GLB creation.
  optimizeDeps: { include: ['three/examples/jsm/exporters/GLTFExporter.js', 'three/examples/jsm/geometries/RoundedBoxGeometry.js'] },
});
