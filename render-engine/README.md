# Motor de render Atelier (Blender + Cycles)

Servicio local e independiente que recibe un **paquete de render** exportado por el editor y lo renderiza con Blender/Cycles en modo headless. El editor sigue siendo la única fuente de geometría: el motor no inventa ni modifica dimensiones, muros, huecos ni posiciones de muebles.

Estado: **Implementado (MVP local)** — exportación, API, cola, worker Blender, presets de luz/cámara, galería en el editor y pases EXR verificados con Blender 4.5.16 LTS. No es todavía un servicio de producción ni acredita fidelidad fotográfica final.

## Puesta en marcha

Requisitos: Python 3.11+ (solo librería estándar) y Blender 4.5 LTS.

```powershell
cd render-engine
python scripts/install_blender.py      # descarga Blender 4.5.16 LTS de download.blender.org y verifica su SHA-256
python -m atelier_engine               # escucha en http://127.0.0.1:8765
```

En el editor: **Estudio → Imagen y cámara → Render fotorrealista con Cycles → Generar render Cycles**. Si el motor no está en marcha, el panel lo indica y permite **Descargar paquete de render** para renderizarlo después.

Pruebas (no necesitan Blender salvo la de humo, que se omite si no está instalado):

```powershell
python -m unittest discover -s tests -t .
```

### Variables de entorno

| Variable | Defecto | Uso |
|---|---|---|
| `ATELIER_BLENDER` | `.blender/blender-*/blender[.exe]` | Ejecutable de Blender |
| `ATELIER_HOST` / `ATELIER_PORT` | `127.0.0.1` / `8765` | Dirección de escucha. No exponer a internet |
| `ATELIER_DATA_DIR` | `render-engine/data` | Trabajos, paquetes y salidas |
| `ATELIER_DEVICE` | `AUTO` | `AUTO` (OptiX → CUDA → HIP → Metal → oneAPI → CPU), `CPU`, `OPTIX`, `CUDA`… |
| `ATELIER_MAX_QUEUE` | `8` | Trabajos en cola antes de responder 429 |
| `ATELIER_JOB_TIMEOUT` | `1800` | Segundos máximos por render |
| `ATELIER_KEEP_JOBS` | `60` | Trabajos terminados que se conservan; los más antiguos se borran |
| `ATELIER_ALLOWED_ORIGINS` | GitHub Pages del proyecto | Orígenes CORS adicionales (lista separada por comas); `localhost`/`127.0.0.1` siempre se admiten |

## API

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/health` | Versión de motor y Blender detectado |
| `POST` | `/renders` | Cuerpo `application/zip` (paquete). `201` trabajo nuevo, `200` reutilizado (`reused: true`), `413/415/422/429` con `{"error":{"code","message"}}` |
| `GET` | `/renders` | Trabajos recientes |
| `GET` | `/renders/{id}` | Estado (`queued`, `running`, `succeeded`, `failed`, `canceled`), progreso (`stage`, `sample`, `fraction`), resultado o error estructurado |
| `GET` | `/renders/{id}/outputs` | Lista de salidas |
| `GET` | `/renders/{id}/outputs/{name}` | Descarga de una salida de la lista blanca (`beauty.png`, `passes.exr`, `result.json`, `scene.json`, `preview.png`) |
| `POST` | `/renders/{id}/cancel` | Cancela un trabajo en cola o en curso |

**Idempotencia:** un trabajo se reutiliza si coincide la cabecera `Idempotency-Key` o el SHA-256 del paquete, **y** la revisión del motor (`engineRevision`, hash del script Blender y del contrato), **y** su estado es `queued`, `running` o `succeeded`. Un trabajo fallido o cancelado, o uno renderizado con otra versión del script, se vuelve a renderizar.

**Errores estructurados:** `invalid_package`, `invalid_manifest`, `invalid_geometry`, `unsupported_version`, `unsupported_media_type`, `queue_full`, `engine_unavailable` (Blender no instalado), `import_failed`, `empty_scene`, `missing_asset`, `render_failed`, `timeout`, `canceled` y `worker_interrupted` (trabajo en curso cuando el servicio se reinició). El registro completo (`render.log`) queda en disco y no se sirve por HTTP.

## Paquete de render

ZIP sin compresión generado en el navegador (`src/lib/renderPackage.ts`, `src/lib/renderExport.ts`):

- `scene.json` — manifiesto canónico versionado (`format: "atelier-render-package"`, `schemaVersion: 1`, unidades `m`, eje `Y` arriba). Incluye proyecto, recintos con polígonos, objetos con **IDs estables** del editor, materiales y licencias, cámara (posición, objetivo, FOV vertical), iluminación, ajustes de render y hash del GLB.
- `scene.glb` — geometría exportada desde la misma escena Three.js del visor. Cada nodo lleva `extras.atelierId` / `atelierType` y los materiales conservan nombre y parámetros PBR. Los GLB de la biblioteca IndexedDB ya están cargados en la escena, por lo que se empaquetan sin acceso a rutas locales.
- `preview.png` — captura WebGL con la misma cámara y proporción, para comparar.

Coordenadas: plano (x, y) → Three.js (x, 0, y) → Blender (x, −z, y).

### Correspondencia PBR → Principled BSDF

El importador glTF de Blender asigna color base, metalicidad, rugosidad, normal, emisión, transmisión, IOR, clearcoat y sheen. Ajustes adicionales del motor:

- Vidrio de ventanas: Principled con transmisión 1, IOR 1,5 y rugosidad 0 (el material WebGL es una aproximación translúcida).
- Pantallas de lámpara: emisión cálida solo con el preset Noche.
- Patrones del visor horneados (`src/lib/surfaceTextures.ts`): suelos sin material de biblioteca, tejidos de sofá y cama, vetas de encimeras y trama de alfombra viajan en el GLB como color sRGB (JPEG) + normal + rugosidad, con escala real en metros por `KHR_texture_transform`; el importador los conecta mediante nodos Mapping. Son texturas sintéticas deterministas, no escaneadas.
- Diferencias conocidas: los sombreadores personalizados de WebGL que no se hornean no se trasladan.

## Presets

| Preset | Luz | Cámara |
|---|---|---|
| `afternoon` | Cielo Nishita + sol 18°, 4700 K, portales en ventanas | AgX Medium High Contrast |
| `day` | Cielo Nishita + sol 48°, 5600 K, portales en ventanas | AgX |
| `night` | Sin sol; lámparas del proyecto a 2700 K y relleno tenue por estancia; balance de blancos 3800 K | AgX |
| `studio` | HDRI `public/environment/studio.hdr` del editor, sin techo | AgX |

Calidades: `draft` 64, `standard` 256, `high` 1024 muestras con denoiser OpenImageDenoise. Opción de corregir verticales (lens shift).

**Pases** (`passes.exr`, OpenEXR multicapa float 32): profundidad, normales, ID de objeto, ID de material y albedo. Los datos técnicos nunca se guardan en el PNG de 8 bits.

## Demo: salón nórdico

`demo/` contiene la escena, los resultados y las imágenes del mismo encuadre:

| Preset | Imagen | Render | Total | Luminancia media | Recortado |
|---|---|---|---|---|---|
| Tarde | `nordic-living-afternoon-cycles.jpg` vs `-webgl.jpg` | 9,74 s | 10,64 s | 0,545 | 11,3 % (ventana) |
| Noche | `nordic-living-night-cycles.jpg` | 11,22 s | 12,09 s | 0,511 | 0 % |

1280 × 720, 256 muestras, OptiX en RTX 5070 Laptop, Blender 4.5.16 LTS. La mesa de centro, la lámpara y el giro del sofá de la demo se añadieron en tiempo de ejecución; no forman parte del proyecto por defecto.

## Seguridad

- Escucha solo en `127.0.0.1`; CORS restringido y cabecera Private Network Access para los orígenes permitidos.
- Paquetes tratados como no confiables: límites de tamaño, de relación de compresión y de miembros; solo tres nombres de archivo admitidos; GLB validado antes de encolar. El cliente nunca proporciona rutas.
- Blender se ejecuta con `--factory-startup --disable-autoexec` (sin scripts incrustados en .blend ni complementos del usuario), en un proceso aparte con tiempo límite.
- Las salidas se sirven por lista blanca; no hay claves API ni servicios externos.

## Límites actuales

- Mobiliario con la geometría simplificada del editor; texturas de suelo y textiles sintéticas (la trama textil apenas se distingue a distancia de salón).
- La ventana de la tarde se recorta (sin exposición automática por zonas).
- Sin IA (R8/R9) ni animación (R10). Sin autenticación: uso local de un solo usuario.
