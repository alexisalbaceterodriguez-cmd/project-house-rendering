# Project House Rendering | Atelier 60

Editor web de viviendas con plano 2D y visualizador 3D sincronizados, construido con **React + TypeScript + Zustand + Three.js / React Three Fiber**.

**[Abrir la aplicación](https://alexisalbaceterodriguez-cmd.github.io/project-house-rendering/)** · [Plan de fases](./ROADMAP.md) · [Memoria de continuidad](./PROJECT_MEMORY.md)

> Prototipo de interiorismo conceptual. Las superficies se calculan a partir de los ejes de los tabiques, **no** son superficies útiles certificadas ni validan licencias, habitabilidad, normativa o construcción.

## Funciones

- Crear una **planta en blanco** o cargar el ejemplo nórdico de 60 m², 3 dormitorios y 2 baños.
- Cambiar **ancho, fondo y altura** de la vivienda. Elegir entre escalar toda la distribución o conservar las coordenadas interiores.
- Dibujar tabiques con clic en los extremos; mover un tabique seleccionado arrastrando su trazo, o arrastrar sus **asas circulares** para editar cada extremo.
- Editar coordenadas y espesor de los tabiques desde el inspector. Las paredes exteriores se ajustan desde el panel de dimensiones.
- Detectar recintos cerrados en el grafo de paredes, con T y cruces. Actualizar geometría y superficie de las habitaciones del plano 2D y la escena 3D.
- Colocar puertas y ventanas, editar sus dimensiones y detectar ciertos problemas geométricos.
- Insertar muebles paramétricos, cambiar tamaño, posición, color, materiales, suelos y estilo general.
- Importar modelos `.glb` de hasta 12 MB. Se guardan en **IndexedDB**, en vez de inflar el historial o `localStorage`.
- Guardar el diseño en el navegador y exportar/importar un **JSON portable** que incluye los GLB.
- Deshacer/rehacer, exportar captura PNG de la vista 3D y plano SVG.

## Uso

En un equipo con Node.js 22.12+ y npm:

```bash
npm install
npm run dev
```

Abre la dirección local mostrada por Vite, normalmente `http://localhost:5173`.

Para verificar y compilar:

```bash
npm run test
npm run build
```

Para ver la compilación localmente, ejecuta `npm run preview`.

## Editar medidas y muros

1. Haz clic en **Dimensiones** para abrir el panel de ancho y fondo. Escribe las medidas, selecciona **Escalar** o **Mantener** y confirma.
2. Selecciona **Tabique** y haz clic en dos puntos para dibujar uno nuevo. Es posible partir de paredes existentes.
3. En la herramienta **Seleccionar**, haz clic en el trazo de una pared interior y arrástralo; arrastra las asas verdes para cambiar cada extremo.
4. Las habitaciones se calculan automáticamente cuando los muros cierran un polígono. Puedes cambiar el nombre, tipo y suelo seleccionando la estancia.
5. Si una operación crea un hueco abierto en el perímetro, la estancia deja de contabilizarse como recinto cerrado. La geometría sigue siendo editable.
6. Exporta regularmente el JSON. No dependas exclusivamente del guardado local para una reforma real.

## Organización

```text
src/
  App.tsx                      Interfaz y propiedades (pendiente de modularizar)
  components/Plan2D.tsx        Editor SVG y arrastre de muebles/paredes
  components/Scene3D.tsx       Renderizado de muros, suelos poligonales y GLB
  data/                        Plantillas, mobiliario y acabados
  lib/topology.ts              Grafo de tabiques, recintos, áreas y transformaciones
  lib/validation.ts            Validación estructural del proyecto importado
  lib/assets.ts                Persistencia de modelos GLB en IndexedDB
  lib/geometry.ts              Primitivas geométricas y huecos de pared
  store.ts                     Estado e historial con Zustand
  __tests__/                   Tests de geometría y validación
.github/workflows/             Tests, compilación y despliegue de GitHub Pages
ROADMAP.md                     Fases, pendientes y criterios de aceptación
standalone.html                Prototipo antiguo autónomo, no actualizado
```

## Límites conocidos

- El motor obtiene recintos por caras de segmentos, no tiene un grafo de vértices compartidos editable a nivel CAD. Los casos complejos de muros colineales, anillos o huecos interiores requieren más validación.
- El cálculo no descuenta espesores de paredes ni garantiza anchuras de paso mínimas.
- El arrastre de paredes exteriores se bloquea intencionadamente; se modifican desde **Dimensiones**.
- Los GLB guardados en IndexedDB solo existen en el navegador actual. El JSON exportado es el método para transportarlos entre equipos.
- No hay renderizados PBR fotorrealistas, catálogos comerciales, BIM, DXF ni importación de planos de obra.
- El prototipo independiente `standalone.html` es una versión anterior que no incluye el nuevo motor geométrico.

## Calidad y publicación

GitHub Actions ejecuta tests con Vitest y compila Vite al actualizar `main`. GitHub Pages se publica automáticamente tras superar los pasos del workflow de despliegue. El repositorio usa `npm install` hasta que se incorpore y verifique un lockfile.

Licencia: pendiente de definir. No se redistribuyen modelos comerciales externos.
