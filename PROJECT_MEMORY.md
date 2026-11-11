# Memoria del proyecto | House Rendering / Atelier 60

> **RETENCIÓN DE MODELOS 2026-11-11:** `eca76de01e6de3eadf68da82225301fce0aa12ef` amplía PR #7: no se pueden retirar GLB usados por principal/respaldo de localStorage, versiones, A/B o historial cancelable/redo. Archivo y metadatos se borran atómicamente; guardados ilegibles bloquean limpieza. 72 unitarias, build y 27 E2E pasan en local; CI del mismo SHA `43020782024`, completed/success. Evidencia exacta en `PROJECT_STATUS.md`. ROADMAP actualizado con bases implementadas y ampliaciones reales. Siguiente unidad F0: cierre de conexiones en `onversionchange`, aperturas bloqueadas de IndexedDB y E2E con dos pestañas. PR #7 sigue sin integrar en main.

> **ENTREGA DE PRODUCTO 2026-11-11:** rama `codex/product-release` añade grafo/migración, cancelación/grupos/referencia, modelos autorizados, texturas, módulos, versiones, cámaras/HDRI/paseo/A-B, presupuesto manual y plano de presentación imprimible. JSON deduplica modelos compartidos, conserva proyectos v1 y revierte importaciones parciales. Render rápido bajo demanda y alta calidad diferenciados; errores de GLB aislados. 60 unitarias, compilación estricta y 23 E2E pasan en local; commit de código `29cf67d75d4f782956094bbc0449a349522eb7ed`, CI `43016376602` completed/success y PR #7 lista para revisión. No integrado en main. Estado exacto en `PROJECT_STATUS.md`, aceptación en `PRODUCT_ACCEPTANCE.md`, derechos en `ASSET_LICENSES.md`. No cerrar todas las fases ni atribuir runs antiguos al nuevo código.

> **AUDITORÍA LOCAL 2026-11-11 (vigente):** base `dc882baaf2e2e9fe7b4881f2259660f5a0a760c1`; CI [43005276652](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43005276652) y Pages `43005462273` correctos. Windows local: instalación, 42 unitarias, build y 13 E2E pasan con las correcciones de esta auditoría. Se valida contenido GLB en ambas importaciones para evitar pantalla en blanco y se corrigen acciones recortadas del inspector. Cambios locales sin commit/push: CI citada cubre solo la base. F0/F1/F2 abiertas; F3A tiene biblioteca local y acabados por superficie, sin catálogo comercial/texturas completas. Detalle y pendientes: [LOCAL_AUDIT.md](LOCAL_AUDIT.md). Siguiente unidad: aislar errores por modelo y probar corrupción de GLB ya guardados en IndexedDB.

> **ROADMAP AMPLIADO 2026-11-08:** se ha aprobado incorporar catálogo universal de productos reales, licencias/fabricantes/referencias, importación y optimización de GLB, biblioteca de materiales PBR por superficie/submalla, gestión de activos local y futura CDN, cámaras/iluminación y versiones de renders comparables. Fuente operativa: [ROADMAP.md](ROADMAP.md), issue [#6](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/6) (F3A), [#4](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/4) (F3B) y [#5](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/5) (F4/F5). Son tareas pendientes, no funcionalidades implementadas. Prioridad: estabilizar F0, luego F1/F2 y después F3A.

> **ACTUALIZACIÓN OPERATIVA 2026-11-08 (vigente):** leer primero [AUTOMATION_RUNBOOK.md](AUTOMATION_RUNBOOK.md), [AGENTS.md](AGENTS.md) y [PROJECT_STATUS.md](PROJECT_STATUS.md). `package-lock.json` y `npm ci` están verificados; Playwright 1.56.1 ya corre en CI con `ubuntu-24.04`. El primer recorrido E2E (creación, dimensiones, muros, deshacer/rehacer, exportar/importar JSON y autoguardado) pasó en [run 42467419830](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42467419830); se corrigió un fallo de validación HTML en redimensionado (`f449e59`). Siguiente F0: IndexedDB/GLB, recuperación, cuotas y migraciones. El contenido histórico de este documento puede estar obsoleto; cotejar siempre main y Actions.

> **Contexto y decisiones históricas (contrastarlas con main).** Leer este documento antes de cambiar código. Actualizarlo tras cada entrega. Complementar siempre con el estado REAL de `main`, las pruebas y los workflows. No dar por realizada una tarea solo porque figura en el plan.

**Última auditoría:** 2026-11-07 (Europe/Madrid). **Rama:** `main`. **Última entrega validada:** `bb7e488bbcd60735110d35e789d70f95871b2f85` (15 tests y build CI correctos; Pages desplegado). **Estado:** F0/F1/F2 con incrementos funcionales, pendientes estabilización y E2E. El resumen histórico de secciones posteriores describe el MVP anterior.

## 0. Incremento más reciente: dimensiones y paredes (2026-11-07)

**Base GitHub:** `bb7e488`. **CI Test and build:** success ([ejecución](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42420478499)). **GitHub Pages:** success ([ejecución](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42420478579)). Pruebas en navegador manual: **no realizadas**.

- **F0 parcial:** validación estructural profunda de JSON (`src/lib/validation.ts`), GLB guardados en IndexedDB con export/import JSON portable (`src/lib/assets.ts`) y 9 tests nuevos (15 totales). Falta lockfile, E2E, cuotas/recuperación de modelos y pruebas visuales.
- **F1 parcial:** `src/lib/topology.ts` extrae las caras cerradas de paredes, cruces y T, genera polígonos de estancia, recalcula superficies desde ejes de tabiques, mantiene metadatos por solapamiento y actualiza suelos de 2D/3D. No hay aún nodos compartidos persistentes ni áreas útiles ajustadas por espesor. Topología degenerada y colisiones complejas pendientes.
- **F2 parcial:** botón **Dimensiones** con escala proporcional o conservación de posiciones, botón **Nuevo** para planta en blanco, asas de extremos y arrastre de paredes interiores, longitud visible, edición numérica y avisos geométricos. Las paredes exteriores se redimensionan desde el inspector; no se arrastran. Histórico de arrastre con checkpoint de una operación.
- **Compatibilidad:** `Project.version=1` y `standalone.html` antiguo. Migración especial del diseño demo anterior con hueco abierto entre salón y distribuidor. JSON de proyectos previos debe probarse más extensamente.
- **Siguiente acción recomendada:** abordar [F0 E2E y lockfile](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/1) y [F1 nodos compartidos y geometría compleja](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/2); después [F2 precisión de interacción](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/3), [F3 cocina/baño](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/4) y [F4-F5 renders/versiones](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/5).

## 1. Identidad y objetivo

- **Repositorio:** https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering
- **Nombre de la aplicación:** Atelier 60 (nombre de trabajo; el editor NO debe limitarse a 60 m²).
- **Meta:** construir una aplicación web de diseño residencial manejada directamente por el usuario, sin depender de generar imágenes aisladas en cada conversación. Dibujar y remodelar una vivienda desde cero, ajustar dimensiones y paredes, crear estancias, puertas y ventanas, colocar objetos y muebles, personalizar materiales, recorrer el diseño en 3D y terminar pudiendo generar renders de calidad fotorrealista.
- **Principio esencial:** modelo arquitectónico común del que derivan TODAS las vistas 2D y 3D; editar algo en el plano debe afectar inmediatamente al 3D, y las exportaciones deben preservar la misma geometría.
- **Criterios de UX:** visual, intuitivo, medidas métricas reales, controles numéricos y gráficos, acción reversible y explícita; mantener coherencia espacial, escalas, huecos, distribución y objetos entre versiones.
- **Alcance:** herramienta conceptual de diseño e interiorismo. NO reemplaza un plano técnico CAD/BIM, cálculo estructural ni revisión de normativa.

### Ejemplo inicial (NO requisito de todos los proyectos)

Vivienda rectangular de **60 m² = 10 × 6 m**, 3 dormitorios, 2 baños, cocina abierta y estética nórdica. En `src/data/defaultProject.ts` la altura es **2,55 m**. Todas las posiciones de puertas, ventanas y elementos del ejemplo son hipótesis de diseño, no mediciones obtenidas de un inmueble real. La antigua combinación 15 × 12 m supone **180 m²**, no 60 m². La app debe permitir crear viviendas de otros tamaños y configuraciones.

## 2. Stack, repositorio y archivos

- **Frontend:** React 19, TypeScript, Vite 7; estado Zustand 5; plano SVG en React; Three.js 0.180, React Three Fiber 9 y Drei 10; iconos Lucide.
- **Sin backend por ahora:** datos en `localStorage`; intercambio de proyectos JSON v1; importación de modelos GLB con datos embebidos en JSON; render WebGL en cliente.
- `src/types.ts`: tipos `Project`, `Room`, `Wall`, `Opening`, `Furniture`, `Selection`, `Tool`.
- `src/data/defaultProject.ts`: plantilla conceptual de 60 m².
- `src/components/Plan2D.tsx`: edición SVG, snap de 10 cm, selección, dibujo de muros y estancias, manipulación de muebles.
- `src/components/Scene3D.tsx`: escena Three.js paramétrica, suelos, muros, huecos, mobiliario, cámaras.
- `src/lib/geometry.ts`: geometría utilitaria (`wallLength`, `wallProjection`, `wallParts`, `snap`, etc.).
- `src/store.ts`: Zustand, undo/redo, persistencia, validador inicial de JSON.
- `src/App.tsx`: inspector de propiedades, configuración de dimensiones, herramientas, import/export y shell UI.
- `src/__tests__/geometry.test.ts`: tests actuales de geometría y plantilla.
- `.github/workflows/ci.yml`: pruebas y build en pushes a `main` y PR.
- `.github/workflows/pages.yml`: deploy GitHub Pages por ejecución manual (`workflow_dispatch`).
- `standalone.html`: prototipo antiguo autónomo e INCOMPATIBLE con el editor React moderno (no mezclar sus formatos de proyecto).

### Cómo iniciar y verificar

Requiere Node.js 20.19+ o 22.12+ y npm. Ejecutar `npm install`, `npm run dev`, `npm run test`, `npm run build`. La aplicación React reside en la raíz del repositorio. No hay lockfile npm en el commit auditado; conviene incorporarlo para builds reproducibles.

## 3. Estado histórico del MVP antes de la nueva entrega (2026-11-07)

### Implementado en código

- Editor con vistas **2D**, **3D** y **mixta**; escena 3D con cámara orbital, cenital/isométrica, sombras, paredes completas/cortadas y vacíos de puertas/ventanas.
- Dibujar segmentos de muro indicando dos puntos; seleccionar muros; editar numéricamente **Inicio X/Y, Final X/Y y grosor**; eliminar muros (elimina también sus huecos).
- Cambiar numéricamente **ancho y largo** generales (en el inspector cuando no hay selección, rangos UI de 4 a 40 m) y altura de muros (UI 2 a 4 m). El cambio de huella **escala proporcionalmente coordenadas y rectángulos de habitaciones**, además de coordenadas de muebles; los tamaños de los muebles NO se escalan.
- Crear habitaciones rectangulares y sus cuatro lados, editar rectángulos por campos numéricos, nombres, tipos y pavimentos; sin vinculación geométrica automática de habitaciones a muros.
- Añadir puertas y ventanas sobre segmentos, seleccionar, modificar anchura/altura/antepecho/posición relativa y eliminar.
- Catálogo de muebles paramétricos; seleccionar, mover arrastrando en 2D, cambiar posición, dimensiones, giro y color, duplicar/eliminar; importar GLB autónomos de hasta 6 MB.
- Estilos/paletas y pavimentos; historial de **hasta 40 pasos**; autosave navegador; importar/exportar proyectos JSON; exportar PNG de 3D y SVG del plano.
- CI: últimas ejecuciones consultadas de **Test and build** para `91e1b17` y `caf39c4` con conclusión **success**. GitHub Pages tuvo un fallo automático inicial en `caf39c4`, y una ejecución **manual posterior** en `91e1b17` concluyó **success**; comprobar URL pública real al retomar, sin inferir accesibilidad desde el workflow.

### No implementado / calidad pendiente

- **No hay manejadores visuales para arrastrar vértices, estirar un tabique o moverlo completo**. La edición geométrica de muros hoy es mediante números; el arrastre actual es para muebles.
- **No hay topología compartida** de vértices ni un grafo de cerramientos. Cada muro almacena puntos `a` y `b` independientes. Mover un extremo no sincroniza automáticamente el muro adyacente.
- Las habitaciones son rectángulos independientes de los muros: cambiar un muro no recalcula una estancia; modificar la habitación no modifica los tabiques; son posibles solapes o huecos. No hay extracción de polígonos ni áreas netas fiables.
- El cambio de dimensiones generales usa escalado proporcional, sin elección de anclaje, adaptación localizada ni detección de conflictos. Puertas/ventanas tienen offset relativo pero anchura absoluta: las geometrías degeneradas o solapadas no se validan globalmente.
- `isProject` valida superficialmente el formato; faltan validaciones profundas, migraciones de esquema y pruebas de importaciones corruptas.
- Sin reglas sólidas de colisiones, mobiliario fuera de límites, longitudes mínimas de muro, huecos solapados, circulaciones, accesibilidad, instalaciones o normativa.
- Visualización 3D **en tiempo real**, NO fotorrealista; sin biblioteca PBR/HDRI ni render ray-traced de alta calidad. No hay gestión avanzada de texturas/licencias.
- Sin tests end-to-end/visuales, ni suite extensa de edición en geometrías complejas; persistencia de GLB grandes puede agotar `localStorage`.
- No hay incidencias ni PR registrados en GitHub al revisar el repositorio el 2026-11-07; este archivo es el backlog operativo provisional.

## 4. Hoja de ruta por fases (orden acordado)

Los estados son **PENDIENTE**, **EN CURSO** y **HECHO**, y se actualizan al verificar código y pruebas. Las fases se pueden solapar de forma controlada; no declarar cerrada una fase por haber implementado únicamente parte de ella.

### F0. Estabilidad y fundamento | EN CURSO

- [x] MVP de React/TS/Vite/R3F/Zustand publicado en `main`.
- [x] Pruebas unitarias iniciales y pipeline CI con último resultado verde.
- [x] Workflow manual de GitHub Pages con ejecución más reciente correcta.
- [ ] Añadir lockfile para instalar de forma determinista; documentar y comprobar URL real de despliegue.
- [ ] Mejorar tests geométricos y validación JSON; cubrir historial y persistencia.
- [ ] Definir invariantes métricas, esquema versionado y estrategia de migración; evitar pérdidas de proyectos previos.

### F1. Geometría arquitectónica consistente | EN CURSO

- [x] Crear motor de operaciones geométricas puro y testeable separado de la UI.
- [ ] Unificar o asociar vértices coincidentes (nodos/conectividad); mover una unión compartida sin desconectar paredes vecinas.
- [ ] Operaciones robustas de crear, dividir, unir, acortar, alargar, desplazar y borrar muros; detectar cruces y segmentos degenerados.
- [x] Representar los recintos cerrados como polígonos derivados de muros; todavía faltan geometrías complejas y superficie útil.
- [ ] Validar longitud, paralelismo/ortogonalidad cuando proceda, recintos cerrados, grosor y huecos; preservación o reasignación de puertas/ventanas al editar.
- [ ] Tests de invariantes y pruebas de ida/vuelta del mismo diseño entre 2D, 3D y JSON.

### F2. Editor preciso de dimensiones y paredes | EN CURSO

- [x] Configuración numérica básica de ancho, largo y altura y extremos de muros (ya existe, pero es limitada).
- [x] Arrastrar extremos y segmentos de muros en 2D; asas y longitud visible, con ajuste de rejilla básico. Mejorar alineación y acotación temporal.
- [x] Crear plano en blanco y redimensionar con escalado proporcional o conservación de posiciones. Falta anclaje por lado.
- [ ] Edición numérica de cotas y longitudes/ángulos y controles de grosor; mostrar medidas de muros y superficies netas.
- [x] Gestión de arrastres de muros y muebles con un checkpoint inicial y cambios sin multiplicar pasos de historial.
- [ ] Mantener puertas/ventanas sobre su muro y proteger límites mínimos mientras se arrastra.
- [ ] Selección/edición intuitiva con ratón y táctil (si el dispositivo lo soporta), zoom/pan y atajos fiables.

### F3. Interiorismo y catálogo | PENDIENTE (bases simples ya presentes)

- [ ] Mejor biblioteca de objetos con categorías, búsqueda y dimensiones reales, transformaciones/rotación precisas.
- [ ] Activos GLB reutilizables y gestión de licencia/origen; mover assets grandes a IndexedDB en lugar de JSON/localStorage como única vía.
- [ ] Materiales y texturas PBR para paredes, suelos, cocinas y baños; variantes de acabados sin alterar geometría.
- [ ] Colisiones conceptuales, ajustes/encajes y comprobaciones de espacio libre; configuraciones de cocina y mobiliario por estancia.

### F4. Visualización y render fotorrealista | PENDIENTE

- [ ] Iluminación interior/exterior, HDRI, sombras coherentes, texturas PBR y cámaras configurables.
- [ ] Modo paseo en primera persona, vistas guardadas y recorridos.
- [ ] Capturas de alta resolución y, si es viable, pipeline de render offline/ray tracing o servicio dedicado; especificar coste/limitaciones.
- [ ] Comparación de propuestas manteniendo idéntica geometría y ángulo de cámara cuando se cambien solo acabados.

### F5. Gestión de proyectos, rendimiento e interoperabilidad | PENDIENTE

- [ ] Crear/duplicar/guardar varios proyectos, plantillas por tipo de vivienda, copia/restauración y versiones compatibles.
- [ ] Exportaciones avanzadas (GLTF, DXF/IFC solo tras revisar viabilidad), planos acotados y paquetes descargables.
- [ ] Optimizar escenas grandes, tests E2E/visuales, accesibilidad, errores y experiencia móvil.
- [ ] Analizar backend/cuentas/compartir únicamente cuando exista una necesidad concreta; el MVP actual es local-first.

## 5. Próximo bloque de trabajo definido: F1A + F2A

**Objetivo de la próxima intervención:** obtener edición visual real de paredes y dimensiones sin romper el proyecto demo, la persistencia o las vistas 3D. NO repetir el MVP ni dedicarse todavía al render fotorrealista.

**Secuencia recomendada:**

1. Inspeccionar `main`, README, `src/types.ts`, `geometry.ts`, `store.ts`, `Plan2D.tsx`, `Scene3D.tsx` y PR/CI recientes. Confirmar si ya se avanzó desde este documento.
2. Escribir tests de geometría para arrastrar un extremo, mover un muro, propagar unión compartida, conservar huecos y cancelar/rehacer arrastres; decidir una estrategia retrocompatible para enlazar vértices.
3. Extraer mutaciones a operaciones de dominio (`moveWallEndpoint`, `translateWall`, `resizeFootprint` o equivalentes) y validar antes de confirmar.
4. Añadir manejadores/puntos de control SVG y previsualización al arrastrar; no mover muebles cuando se arrastran muros, ni crear muros fantasma.
5. Recalcular/actualizar la representación 3D en tiempo real a partir de los mismos datos. No declarar resueltas estancias poligonales hasta implementar su geometría.
6. Mejorar UI de dimensiones externas (cotas y restricción del contorno), y cubrir con tests los casos límite: muro exterior, tabique corto, puerta cerca de un extremo, dos muros unidos, undo/redo y exportar/importar JSON.
7. Ejecutar `npm run test` y `npm run build`; comprobar CI. Actualizar este documento al finalizar con el commit SHA, casillas y próxima tarea específica.

**Criterios de aceptación del primer incremento:** el usuario selecciona un tabique en 2D, desplaza al menos un extremo mediante arrastre, observa una cota actualizada y el cambio simultáneo en 3D; el estado exportado e importado conserva el resultado; undo/redo restaura una operación completa. Si todavía no se implementó acoplamiento de paredes, documentar expresamente esa limitación y NO marcar F1 completada.

## 6. Decisiones, riesgos y restricciones

- **Local-first** mientras no se requiera compartir proyectos; no introducir un backend por comodidad.
- Preferir geometría en **metros**, unidades coherentes; transformar solo la visualización a píxeles; evitar errores de escalado/snap.
- Mantener el contrato actual `Project.version = 1` mientras los cambios sean compatibles. Para incompatibilidades, diseñar **migración explícita** y tests, nunca invalidar silenciosamente los JSON anteriores.
- Paredes, huecos, suelos y muebles deben derivar del mismo estado. No crear implementaciones divergentes de geometría en 2D y 3D.
- Conservar la plantilla 10 × 6 m como **ejemplo**, nunca fijar límites funcionales a 60 m².
- No asumir exactitud de un plano de ejemplo ni prometer cumplimiento normativo/estructural sin datos y revisión profesional.
- Tratar el render realista como una **fase posterior** a la geometría fiable; una imagen bonita de una planta incoherente sigue siendo una planta incoherente.
- Por ahora el repositorio es **público**. No subir datos privados de viviendas, credenciales ni assets sin licencia.

## 7. Protocolo de continuidad OBLIGATORIO para nuevas conversaciones

1. Abrir `AGENTS.md`, este `PROJECT_MEMORY.md` y `README.md` en GitHub. Usar `main` y revisar las últimas confirmaciones, issues/PR y resultados de Actions.
2. Contrastar **estado documentado vs código actual** antes de decidir tareas. Si el código avanzó, corregir primero la memoria.
3. Tomar la **primera tarea incompleta de la fase prioritaria**, comenzar por F1A/F2A salvo que haya regresión crítica.
4. Antes de implementar, definir cambios de modelo, compatibilidad JSON, pruebas y criterios de aceptación. Trabajar en incrementos verificables; informar de limitaciones reales.
5. Tras cada intervención que cambie código, pruebas, despliegue o decisiones: **actualizar `PROJECT_MEMORY.md` en el mismo conjunto de trabajo**. Registrar fecha, commit, fase, qué está hecho y qué falta, CI, riesgos y el siguiente paso exacto.
6. Si no hay permisos GitHub, entregar cambio/patch en conversación e indicar explícitamente que el repositorio NO ha sido modificado. No dar por sincronizada la memoria de ChatGPT con GitHub.
7. La memoria conversacional es una ayuda para localizar el repositorio; **GitHub es la fuente canónica del estado**. Nunca suponer que una conversación nueva dispone automáticamente del último código sin consultar el repo.

### Bitácora / handoff

| Fecha | Base | Resultado y verificación | Próximo paso |
|---|---|---|---|
| 2026-11-07 | `bb7e488` | F0/F1/F2 base entregada: topología de recintos, editor gráfico de tabiques, redimensionado, modelos en IndexedDB; 15 tests y compilación CI verdes, Pages desplegado. | F0 E2E y lockfile; F1 nodos compartidos. |\n| 2026-11-07 | `91e1b17` | Auditoría del MVP: React 2D/3D, edición numérica de dimensiones y muros, GLB/JSON, CI verde, Pages manual con ejecución verde. No se ha implementado arrastre de paredes ni recintos topológicos. | F1A: operaciones geométricas/vertices conectados y tests; F2A: handles de arrastre SVG y edición de perímetro. |

**Regla de actualización:** mantener esta tabla con entradas recientes y actualizar `Última auditoría`, commit, estados y siguiente acción. La versión más reciente de `main` prevalece sobre estas observaciones fechadas.
