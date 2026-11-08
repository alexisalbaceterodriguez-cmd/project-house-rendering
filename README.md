# Project House Rendering | Atelier 60

Editor web 2D + 3D para diseñar viviendas, distribución y acabados. Este repositorio contiene el código fuente de la aplicación **Atelier 60**.

Aplicación web editable para diseñar distribuciones y visualizar viviendas en 2D y 3D. El proyecto de demostración es un **rectángulo de 10 × 6 metros (60 m²)**, con tres dormitorios, dos baños, cocina abierta y estilo nórdico. Es una **propuesta conceptual**, no un plano técnico ni una obra ejecutable. Las dimensiones 15 × 12 m serían 180 m², no 60 m².

## Inicio rápido

Requisitos: Node.js **20.19+ o 22.12+** y npm.

```bash
npm install
npm run dev
```

Abre la URL local que muestre Vite (normalmente http://localhost:5173).

Para producción:

```bash
npm run build
npm run preview
```

## Funciones incluidas

- **Editor SVG 2D:** arrastrar muebles, seleccionar muros y estancias, dibujar muros y rectángulos, añadir puertas y ventanas en muros.
- **Escena 3D en WebGL:** cámara orbital y cenital, sombras, vista de corte de muros, huecos reales de puertas y ventanas, mobiliario paramétrico.
- **Catálogo de objetos:** sofá, mesas, sillas, camas, armarios, cocina lineal, isla, electrodomésticos, sanitarios, plantas e iluminación.
- **Modelos GLB locales:** importación de ficheros autónomos hasta 6 MB, colocación y escalado conceptual. Para guardar el diseño con modelos, exporta su JSON (incluye sus datos incrustados).
- **Personalización:** cinco materiales de pavimento y un acabado adicional, paletas nórdica, japandi, mediterránea e industrial, colores y tamaños individuales.
- **Historial:** deshacer y rehacer hasta 40 pasos. Guardado local automático, importación y exportación JSON, PNG desde la escena y SVG del plano.
- **Sin backend ni cuenta:** todos los datos quedan en el navegador. No se envían diseños a servidores.

## Uso rápido

1. Usa **Plano 2D** o **Mixto** para editar la distribución. Haz clic en un mueble y arrástralo.
2. Con **Tabique**, selecciona dos puntos. Con **Puerta** o **Ventana**, haz clic sobre una línea de muro.
3. Usa **Estancia** para añadir una habitación rectangular. Edita acabados por estancia en el panel de propiedades.
4. En **Objetos**, añade muebles y cambia sus dimensiones, posición, giro y color.
5. Pulsa **Imagen** para guardar un PNG de la escena; **Exportar** guarda un JSON recuperable desde **Abrir**.

## Arquitectura

```
src/
  App.tsx                 Interfaz, propiedades, catálogo y importación/exportación
  components/
    Plan2D.tsx            Planta SVG editable con eventos de puntero
    Scene3D.tsx           Geometría paramétrica Three.js + R3F
  data/
    catalog.ts            Modelos y catálogo de acabados
    defaultProject.ts     Demostración 10 × 6 m
  lib/geometry.ts         Proyecciones, segmentos de muro y huecos
  store.ts                Estado Zustand, historial y validación
  types.ts                Esquema del proyecto
  __tests__/              Pruebas de geometría y proyecto
```

## Límites conocidos (importantes)

1. **No es CAD/BIM.** Las superficies de estancia son rectangulares y no se calculan por intersección de tabiques. Editar una habitación no desplaza automáticamente los muros.
2. **No hay cálculo estructural, de normativa, instalaciones ni colisiones**. La precisión es conceptual; debe verificarse antes de una reforma.
3. El motor 3D es **en tiempo real**, no un trazador de rayos fotorrealista. Usa geometrías simplificadas en el catálogo; para ver modelos comerciales reales se necesitan archivos GLB con sus licencias.
4. Los modelos GLB se guardan como datos incrustados en el JSON. El almacenamiento automático de navegador puede agotarse con modelos grandes: exporta JSON con frecuencia.
5. Los suelos se simulan con colores y líneas; no se incorporan texturas PBR comerciales por defecto.
6. Las habitaciones del ejemplo son deliberadamente compactas: en 60 m² con 3 dormitorios y 2 baños hay compromisos significativos de ergonomía. Comprueba dimensiones mínimas aplicables con un profesional.

## Próxima fase sugerida

- Editor de vértices y paredes con cotas acotadas y snap inteligente.
- Cálculo automático de polígonos de habitación, conectividad y detección de colisiones.
- Biblioteca de modelos GLB con gestión de activos y licencias, IndexedDB para assets grandes.
- Texturas PBR con HDRI, modo paseo, luces configurables y renderizado offline de alta calidad.
- Exportaciones DXF/IFC/GLTF si se requiere interoperabilidad técnica.

## Calidad y automatización

```bash
npm run test
npm run build
npm run test:e2e  # instala primero Chromium: npx playwright install --with-deps chromium
```

GitHub Actions ejecuta pruebas unitarias, compilación y pruebas E2E de navegador Chromium en cada push y pull request mediante `.github/workflows/ci.yml`. El runner es `ubuntu-24.04` para ser compatible con Playwright 1.56.1. El despliegue en GitHub Pages está preparado en `.github/workflows/pages.yml`, pero se ejecuta **manualmente** para evitar errores hasta que Pages esté activado. Para publicar: entra en `Settings → Pages`, selecciona **GitHub Actions** como origen de despliegue y, después, ejecuta `Actions → Deploy to GitHub Pages → Run workflow`. No requiere tokens adicionales.

La instalación con `npm ci`, las 37 pruebas unitarias, la compilación de producción y el primer E2E Chromium fueron verificados en [GitHub Actions, ejecución 42467419830](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42467419830). Esta verificación cubre operaciones básicas, no todas las posibilidades ni una revisión manual de diseño.

## Estructura del repositorio

La aplicación React/Vite vive en la **raíz del repositorio**. `standalone.html` es un prototipo legacy autónomo que funciona sin npm; no es la versión avanzada.


Tecnologías: React 19, TypeScript, Vite 7, Zustand 5, Three.js, React Three Fiber 9, Drei 10.

## Licencia

Código de demostración creado para la planificación personal de interiores. Los modelos externos que se importen siguen sus respectivas licencias.

## Versión inmediata sin npm

`standalone.html` contiene un **prototipo anterior independiente**, ejecutable con doble clic en Chrome/Edge. Su 3D es ilustrativo y no usa WebGL, GLB ni los componentes React de esta versión. Sirve para experimentar mientras se instalan las dependencias de la aplicación completa. Los archivos JSON de ambas versiones no son intercambiables.
