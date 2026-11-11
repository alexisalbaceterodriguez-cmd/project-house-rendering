# Roadmap de Project House Rendering

> Última actualización: 8 de noviembre de 2026. Ampliación de catálogo de productos reales y materiales PBR aprobada. El editor es **conceptual**. No sustituye una medición, proyecto de obra ni verificación normativa.

> **Incremento local 11/11/2026:** rama `codex/product-release` incorpora protección de activos dañados, migración/grafo persistido, cancelación/selección múltiple, rejilla y referencia calibrada, biblioteca de tres modelos autorizados con miniaturas, cuatro materiales texturados, módulos de cocina/baño, HDRI/paseo/cámaras, versiones y comparación A/B. Criterios observables en [PRODUCT_ACCEPTANCE.md](PRODUCT_ACCEPTANCE.md); resultados y CI en [PROJECT_STATUS.md](PROJECT_STATUS.md). Las secciones de planificación posteriores reflejan el alcance completo y no deben interpretarse como ausencia de estas bases. Cotizaciones comerciales automáticas, PDF técnico, colaboración y catálogo comercial extenso siguen pendientes; no se cierran automáticamente todas las fases.

## Estado de entregas

| Fase | Objetivo | Estado | Criterio de salida |
| --- | --- | --- | --- |
| 0. Estabilidad | Validación, GLB en IndexedDB, exportación portable, lockfile, CI y pruebas Playwright | **En curso; CI y E2E básicos operativos** | Faltan casos límite de almacenamiento, pérdidas de activos, cuotas, migraciones y más cobertura |
| 1. Geometría | Caras cerradas desde intersecciones de tabiques, cálculo por polígonos, cambios de envolvente | **Base implementada** | Falta motor robusto de restricciones, comprobación de espacios útiles y casos geométricos degenerados |
| 2. Editor | Redimensionar superficie, mover muros y extremos, medidas, avisos geométricos, plano vacío | **Base implementada** | Falta pan/zoom centrado en cursor, atajos, cotas encadenadas y selección múltiple |
| 3A. Biblioteca universal | Productos y objetos 3D reales, catálogo, variantes y materiales PBR (issue #6) | **Pendiente; importación GLB básica disponible** | Buscar, colocar y reutilizar 3 modelos autorizados, aplicar 4 PBR y guardar sin pérdidas |
| 3B. Interiorismo modular | Cocinas, baños y electrodomésticos basados en el catálogo 3A (issue #4) | **Pendiente** | Cambiar frentes, encimeras y sanitarios manteniendo medidas y ubicación |
| 4. Render | PBR/texturas HDRI, luz física, fotografía de alta calidad, modo paseo | **Pendiente** | Tres renders comparables del mismo encuadre sin alterar la geometría |
| 5. Proyectos | Variantes A/B, presupuestos, exportación PDF, optimización y colaboración | **Pendiente** | Guardar, comparar y restaurar versiones completas |

## Prioridades siguientes

### P0. Proteger datos y garantizar edición

- [x] Validar profundamente el JSON de entrada y limitar tamaños/colecciones.
- [x] Almacenar los GLB en IndexedDB, fuera del historial y de localStorage.
- [x] Exportar proyectos JSON portables incluyendo los GLB.
- [x] Recalcular recintos cerrados a partir de segmentos e intersecciones de muros.
- [x] Redimensionar la envolvente eligiendo escala o conservación de coordenadas.
- [x] Arrastrar tabiques y extremos; mostrar su longitud y avisos geométricos.
- [x] Añadir `package-lock.json` con npm en un entorno conectado y usar `npm ci`.
- [x] Integrar Playwright Chromium en CI: creación, arrastre, guardado, importación JSON y persistencia.
- [ ] Ampliar E2E para recuperación de assets ausentes, errores de cuota, migraciones y compatibilidad de modelos reales.
- [ ] Más validaciones de colisiones entre muebles, pasos libres y aperturas.
- [ ] Gestión de assets huérfanos, cuota y recuperación ante pérdida de IndexedDB.

### P1. Arquitectura del editor

- [ ] Separar el monolito `App.tsx` en módulos de configuración, persistencia y propiedades.
- [ ] Implementar un grafo de vértices compartidos persistentes (actualmente las uniones se detectan geométricamente).
- [ ] Muros no rectos, espesores por cara, acabado por pared y operaciones de corte/ unión.
- [ ] Garantizar etiquetas de habitaciones estables tras unir, dividir y fusionar recintos complejos.
- [ ] Previsualizar colisiones antes de confirmar arrastres.
- [ ] Importación de planos de imagen como referencia, calibrado y trazado.
- [ ] Estancias y dimensiones útiles: descontar espesores y reportar superficie aproximada.

### P2. Interiorismo y realismo

- [ ] Biblioteca general de modelos de fabricantes/productos reales, referencias y licencias, búsqueda, miniaturas y variantes (F3A, issue #6).
- [ ] Materiales PBR con mapas y escala física aplicables por superficie o submalla, manteniendo geometría (F3A, issue #6).
- [ ] Módulos de cocina (bajos, altos, columnas, fregadero, encimeras, electrodomésticos).
- [ ] Composiciones de baño y gestión de revestimientos horizontales y verticales.
- [ ] Catálogo GLB reutilizable con metadatos, miniaturas y licencias válidas.
- [ ] Materiales PBR reales, HDRI, tonemapping y cámaras interiores.
- [ ] Vista rápida frente a captura de alta calidad; presets de iluminación de día y noche.
- [ ] Variantes A/B con instantáneas de cámara y de los parámetros de diseño.


## Ampliación aprobada: objetos existentes, materiales y renders (08/11/2026)

**Objetivo de producto:** que Atelier 60 permita diseñar un piso desde cero e incorporar **objetos reales** (muebles de salón/dormitorio, lámparas, baños, cocinas y electrodomésticos), acabados reales y renders comparables sin depender de generar una imagen aislada para cada cambio. Una fotografía comercial por sí sola no equivale a un modelo 3D; para orbitar el objeto hace falta un archivo 3D válido, creado o cedido con permiso. Se mantienen siempre sincronizados el modelo de arquitectura, las vistas 2D/3D y la exportación.

**Estado actual, no confundir con la meta:** el catálogo incluido es paramétrico, ya se importan GLB autónomos de hasta 12 MB y se guardan en IndexedDB con exportación JSON portable. Existen paletas y acabados de color. **Aún no** existe una biblioteca central de modelos comerciales, ingestión autorizada, materiales PBR por superficie ni sistema de renders fotorrealistas.

### F3A. Biblioteca universal de recursos (issue [#6](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/6))

1. **Catálogo central versionado:** familias de salón, dormitorio, cocina, baño, iluminación, decoración y electrodomésticos; categorías, búsqueda, filtros, miniaturas y datos estructurados. Cada producto tiene ID estable, dimensiones métricas, fabricante, referencia/SKU cuando exista, archivo/modelo, variantes, origen, licencia y atribución.
2. **Importación de productos existentes:** GLB/glTF autorizados de fabricantes/bibliotecas y modelos propios. Validación de formato, materiales, peso, pivote, escala, orientación, mallas y derechos de distribución. Si hay formatos comerciales incompatibles, convertirlos solo con herramientas y licencias apropiadas. **No scraping ni redistribución sin derechos.**
3. **Gestión y optimización de activos:** un asset referenciado puede reutilizarse en muchos proyectos sin duplicar bytes; caché, carga bajo demanda, LOD cuando corresponda y compresión Draco/Meshopt/KTX2 previa comprobación de compatibilidad. Comprobar pérdidas, cuotas, fallos de red y consumo de memoria; documentar presupuestos de peso y rendimiento.
4. **Panel de diseño:** seleccionar o arrastrar un modelo al plano, colocarlo y moverlo a escala en 2D/3D, girar, ajustar tamaños y pivotes, duplicar, deshacer/rehacer y sustituir un objeto por otro de dimensiones compatibles sin alterar la planta.
5. **Materiales PBR:** un catálogo de madera, piedra/mármol, cerámica/porcelánico, pintura, textil y metal, con mapas de baseColor/albedo, normal, rugosidad, metalicidad y AO opcional. Escala de repetición UV en metros; asignación independiente a suelos, paredes, encimeras, baños y partes/submallas seleccionadas de un mueble. Las variantes se aplican por instancia, no globalmente.
6. **Persistencia:** migraciones seguras sobre los proyectos existentes, exportación/importación portable, recuperación ante modelos ausentes y referencias huérfanas. No confiar en que el archivo sigue existiendo en IndexedDB tras cambiar de navegador.
7. **Almacenamiento por etapas:** primero modelos de muestra con licencia y tamaño apropiado incorporados a la aplicación, además de importaciones personales en IndexedDB. Si el catálogo compartido crece, evaluar Cloudflare R2 + CDN, caché y control de versiones. Esto es una **decisión futura condicionada a volumen/coste**, no una dependencia del MVP.

**Aceptación F3A:** buscar y colocar al menos tres modelos 3D de familias diferentes con licencia documentada; mantener medidas correctas, reutilizarlos en dos proyectos, aplicar cuatro materiales PBR a superficies/partes independientes, guardar/recuperar/exportar/importar todo y pasar pruebas unitarias y E2E de selección, materiales y recuperación de assets.

### F3B. Configuradores de cocina y baño (issue [#4](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/4))

Construir muebles bajos/altos, columnas, frentes, encimeras, fregaderos, placas, hornos y electrodomésticos, así como muebles de lavabo, sanitarios, mamparas, duchas y revestimientos, reutilizando el manifiesto del catálogo universal. Variantes de material/color por módulo y, cuando se pueda, por submalla. Tres configuraciones de una misma cocina se deben poder guardar y comparar con muros y cámara inalterados.

### F4. Render y visualización de calidad (issue [#5](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/5))

Conservar la vista interactiva eficiente de Three.js/React Three Fiber y añadir un modo de imagen de mayor calidad: luces físicamente coherentes, HDRI interior/exterior, sombras, tonemapping, texturas PBR calibradas, iluminación día/noche, cámaras guardadas, recorrido en primera persona y exportación PNG a resolución configurable. El equipo/navegador impone límites de GPU; considerar render alternativo solo cuando sea útil y viable, sin prometer trazado de rayos completo en cualquier dispositivo.

### F5. Alternativas y biblioteca de proyectos (issue [#5](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/5))

Guardar/duplicar versiones completas del mismo diseño, incluyendo referencias/licencias de productos, asignaciones de material, iluminación y cámaras. Comparador A/B que conserve geometría, cámara y luces mientras cambia únicamente el material u opción elegida (por ejemplo, roble vs porcelánico y dos tejidos de sofá). Exportar dos imágenes con **encuadre idéntico** y recuperar ambas alternativas. Optimizar activos repetidos y carga diferida.

### Arquitectura común y secuencia

- **Catálogo/manifiesto:** productos + materiales PBR con metadatos y derechos verificables.
- **Gestor de objetos:** referencias de activos, instancia, dimensiones, orientación, pivote y variante seleccionada.
- **Gestor de materiales:** biblioteca, mapas/UV, escala física, asignación por superficie o parte de malla; edición reversible.
- **Motor de escenas:** mismo proyecto arquitectónico para plano SVG, WebGL interactivo y render/exportación.
- **Capa de activos:** ficheros ligeros incluidos con la web + IndexedDB para modelos privados; R2/CDN para la biblioteca compartida cuando se justifique.

**Orden de trabajo:** F0 estabilidad → F1 geometría → F2 precisión/UX → F3A catálogo universal → F3B cocinas/baños → F4 render → F5 versiones/comparación. Se permiten incrementos pequeños independientes y probados antes de completar una fase, pero no declarar las fases terminadas por mera compilación.

**Criterio global observable:** diseñar una vivienda, insertar un sofá comercial autorizado a escala, aplicar suelo de roble y luego porcelánico, modificar únicamente el tejido del sofá, comparar dos renders con cámara idéntica y recuperar ambos proyectos sin pérdida de objetos o licencias.

## Decisiones técnicas

- Mantener React, TypeScript, Zustand y React Three Fiber/Three.js.
- El motor de topología se mantiene puro e independiente del renderizador, probado con Vitest.
- El grafo se infiere de segmentos, incluyendo T y cruces, y produce polígonos de recintos cerrados.
- El cálculo desde ejes de tabiques es aproximado; **no es superficie útil ni verifica cumplimiento de habitabilidad**.
- Las paredes exteriores son un perímetro rectangular por diseño. Se cambian desde "Dimensiones", no arrastrándolas.
- En `scale`, el mobiliario conserva tamaño físico aunque cambian sus coordenadas.
- Los modelos 3D almacenados localmente se exportan embebidos en un JSON portable. La versión autónoma `standalone.html` es heredada y no incorpora las últimas mejoras del editor React.

## Guía de validación manual

1. Crear **Nuevo** y dibujar una pared de lado a lado con herramienta Tabique.
2. Verificar que aparecen dos estancias y que cambian los suelos/etiquetas tanto en planta como en 3D.
3. Seleccionar el tabique, arrastrar su trazo y luego sus asas de extremos. Comprobar la longitud.
4. Pulsar **Dimensiones**, pasar de 10 × 6 a 12 × 8 y comparar modos «Escalar» y «Mantener» con Deshacer.
5. Añadir un mueble y un GLB, exportar JSON, recargar, abrir JSON y comprobar que el modelo no desaparece.
6. Comprobar en un proyecto incompleto que se muestran advertencias en lugar de afirmar que es un plano técnico válido.
