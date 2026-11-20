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
- Diferencias conocidas: los sombreadores personalizados de WebGL que no se hornean no se trasladan. El visor ilumina la escena completa con el HDR de estudio local como entorno (reflejos de metal plausibles); Cycles usa cielo y sol del preset, así que los reflejos no coinciden píxel a píxel.

## Presets

| Preset | Luz | Cámara |
|---|---|---|
| `afternoon` | Cielo Nishita + sol 18°, 4700 K, portales en ventanas, window pull 1,5 EV | AgX Medium High Contrast |
| `day` | Cielo Nishita + sol 48°, 5600 K, portales en ventanas, window pull 1,5 EV | AgX |
| `night` | Sin sol; lámparas del proyecto a 2700 K y relleno tenue por estancia; balance de blancos 3800 K | AgX |
| `studio` | HDRI `public/environment/studio.hdr` del editor, sin techo | AgX |

**Recintos sin ventana** (`lighting.litRooms`, lista de `{id, power}` en W; cada `id` debe existir en `rooms`): con los presets de día el editor enciende la luz de techo de los recintos que no tienen ventana propia (baños, distribuidor) con 4 W/m² a 5000 K, para que no salgan negros. De noche todos los recintos llevan el relleno tenue de siempre (1,5 W/m², 3200 K).

**Superficies finas translúcidas:** los materiales `atelier:leaf` (hojas) y `atelier:lampshade` (pantallas) se combinan en Blender con un BSDF Translucent de su mismo color base, sin tocar la geometría. La hoja añade transmisión al 60 % del color base sobre su reflexión (las hojas verdes reflejan y transmiten en proporción parecida y baja); la pantalla reparte un 40 % de su reflexión hacia transmisión, de modo que una tela blanca no supera 1. En el primer planteamiento (mezcla del 30 % también en hojas) el follaje salía un 14 % más oscuro con luz lateral; con la transmisión añadida el verde medio del follaje sube un 29 % frente a la versión sin translucidez (misma cámara y escena). `result.json` informa `materials.translucent`.

**Window pull** (`lighting.windowPull`, 0–4 EV; por defecto 1,5 en `afternoon`/`day` y 0 en el resto): como la mezcla de exposición de un fotógrafo de interiores, el cielo se oscurece solo en los caminos que lo *ven* (cámara, a través del vidrio o en reflejos especulares) y conserva su intensidad en los rebotes difusos y rayos de sombra, de modo que la luz que entra en la sala no cambia. `result.json` incluye `image.zones` (proporción de ventana, recorte en ventana e interior y luminancias medias) cuando hay pase de ID de objeto.

Calidades: `draft` 64, `standard` 256, `high` 1024 muestras con denoiser OpenImageDenoise. Opción de corregir verticales (lens shift).

**Pases** (`passes.exr`, OpenEXR multicapa float 32): profundidad, normales, ID de objeto, ID de material y albedo. Los datos técnicos nunca se guardan en el PNG de 8 bits.

## Demos: piso nórdico

`demo/` contiene la escena, los resultados y las imágenes Cycles y WebGL de cada encuadre (misma cámara):

| Preset | Imagen | Render | Total | Luminancia media | Recortado |
|---|---|---|---|---|---|
| Tarde (piezas, distribuidor iluminado, hojas y pantalla translúcidas) | `nordic-living-afternoon-cycles.jpg` vs `-webgl.jpg` | 13,68 s | 15,53 s | 0,541 | 0 % (antes 11,3 % sin window pull) |
| Tarde, dormitorio principal | `nordic-bedroom-afternoon-cycles.jpg` vs `-webgl.jpg` | 14,48 s | 16,24 s | 0,493 | 0 % |
| Tarde, baño 1 (sin ventana, luz de techo) | `nordic-bathroom-afternoon-cycles.jpg` vs `-webgl.jpg` | 21,26 s | 22,99 s | 0,637 | 0 % |
| Tarde, cocina-comedor (ventana sobre el fregadero) | `nordic-kitchen-afternoon-cycles.jpg` vs `-webgl.jpg` | 15,86 s | 17,78 s | 0,306 | 0 % |
| Noche | `nordic-living-night-cycles.jpg` | 15,73 s | 17,24 s | 0,556 | 0 % |

1280 × 720, 256 muestras, OptiX en RTX 5070 Laptop, Blender 4.5.16 LTS. La mesa de centro, la lámpara y el giro del sofá de la demo se añadieron en tiempo de ejecución; no forman parte del proyecto por defecto. Desde el 20/11 el proyecto por defecto incluye dos mesillas junto a la cama doble y una estantería en el muro oeste del salón, y las cuatro vistas de tarde (Cycles y WebGL) se regeneraron con ellas; la vista nocturna del salón es anterior. Desde el 20/11 el sofá, la cama, la mesa, la silla y el armario tienen aristas redondeadas dentro de sus medidas exteriores (`src/lib/boxGeometry.ts`); el GLB lleva la misma malla que el visor. El mobiliario se compone de piezas paramétricas (`src/lib/furnitureParts.ts`): zócalo, brazos, respaldo y cojines de asiento y respaldo separados con holgura de 1 cm y tapa abombada; cabecero, canapé, colchón, almohadas y edredón dentro de la huella del plano. También armario (puertas con holgura, tiradores y zócalo), mesa, isla, silla, cocina lineal (muebles bajos, encimera recortada alrededor de una cubeta de acero bajo encimera con desagüe, placa de inducción con cuatro zonas marcadas y grifo torneado con caño sobre la cubeta; la huella del plano mide 0,9 m de alto, así que los muebles altos son objetos aparte), módulos de cocina y baño paramétricos (`moduleParts`: bajo, fregadero, placa con cajones, horno con cristal y mandos, columna, mueble alto colgado a 1,45 m y mueble de lavabo, con tiradores de barra o gola/frente con uñero; el ejemplo cuelga dos muebles altos sobre la placa), campana extractora de chimenea colgada a 1,60 m, butaca tapizada con patas cónicas, aparador con puertas y cajones, mesa de centro con balda, mueble de TV bajo con hueco y cajones, televisor de pared (pantalla `gloss`), lámpara colgante hasta el techo (luz nocturna dentro de la campana), espejo (luna `mirror`, trazada por Cycles; el visor usa un reflector plano que no entra en el GLB) y lámina enmarcada con un patrón abstracto paramétrico, banco tapizado, mesa auxiliar redonda torneada, perchero de pie, bañera de obra con desagüe y rebosadero, cama con zócalo y cajones laterales, cómoda de cajones, zapatero de abatibles, estante flotante con libros y jarrón, radiador toallero con toalla y radiador de columnas, lavadora y secadora con puerta redonda y ojo de buey (torneados orientados al frente), cuna de barrotes, taburete alto con aro reposapiés, mesa extensible, escritorio con estante, litera, cesto de ropa, mesilla suspendida, sofá rinconera, puf, consola de recibidor, cortinas de pliegues, lámpara de mesa apoyada sobre el mueble que tiene debajo (con luz nocturna dentro de la pantalla), escritorio con cajonera, mesilla de noche, estantería con libros, frigorífico, inodoro, mueble de lavabo suspendido con lavabo de sobre encimera, ducha con mampara y rociador, lámpara de pie y maceta; las piezas torneadas (taza, lavabo, grifería, pantalla, maceta) son sólidos de revolución (`latheGeometry`) y la planta tiene follaje generado de forma determinista a partir del id del objeto (`src/lib/plantGeometry.ts`), siempre dentro de la huella y la altura del plano. El frente de cada pieza mira a +z con giro 0; el proyecto de ejemplo gira los muebles apoyados en muros y=fondo o x=0 para que miren a la sala, pero los proyectos guardados conservan sus giros. Todas las cifras incluyen ya la luz de techo del distribuidor y la translucidez (el render pasó de unos 9–11 s a 14–21 s). El 20/11 se corrigieron dos fallos del plano de ejemplo que comprueba `src/__tests__/demo-project.test.ts` (ninguna puerta con muebles a menos de 45 cm y ningún mueble solapado salvo sillas bajo mesa): la puerta de entrada quedaba tapada por la cocina lineal y pasó al muro oeste del salón (y 4,1–4,9), y la cama doble invadía 12 cm el armario y se desplazó a x 8,7, con nueva cámara del dormitorio. El ejemplo gana cuatro sillas de comedor y una ventana de 1 × 1 m sobre el fregadero (alféizar 1,10 m), sin la cual la cocina, a 5 m de la única ventana del salón, quedaba en penumbra (luminancia media 0,19). En el salón asoman ahora las sillas en el borde izquierdo. Las vistas `-webgl.jpg` de tarde se regeneraron tras dar entorno HDR al visor: antes los metales (tiradores, grifo, cubeta) salían casi negros. La planta del ejemplo se movió junto a la ventana (x 3,6, y 0,45) porque tras girar el sofá quedaba solapada 12 cm con él; queda fuera de este encuadre. Siguen siendo volúmenes paramétricos: no hay costuras, arrugas ni caída de tela simuladas, y la translucidez es un BSDF de superficie fina, no dispersión subsuperficial medida.

## Seguridad

- Escucha solo en `127.0.0.1`; CORS restringido y cabecera Private Network Access para los orígenes permitidos.
- Paquetes tratados como no confiables: límites de tamaño, de relación de compresión y de miembros; solo tres nombres de archivo admitidos; GLB validado antes de encolar. El cliente nunca proporciona rutas.
- Blender se ejecuta con `--factory-startup --disable-autoexec` (sin scripts incrustados en .blend ni complementos del usuario), en un proceso aparte con tiempo límite.
- Las salidas se sirven por lista blanca; no hay claves API ni servicios externos.

## Límites actuales

- Mobiliario con la geometría simplificada del editor; texturas de suelo y textiles sintéticas (la trama textil apenas se distingue a distancia de salón).
- El window pull es una mezcla de exposición fija por preset, no una exposición automática por zonas; el exterior es un cielo procedimental sin paisaje.
- Sin IA (R8/R9) ni animación (R10). Sin autenticación: uso local de un solo usuario.
