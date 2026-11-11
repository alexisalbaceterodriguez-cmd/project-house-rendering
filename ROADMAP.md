# Roadmap de Project House Rendering

> Última actualización: 11 de noviembre de 2026. Estado de implementación de `codex/product-release` (PR #7, todavía sin integrar en main). El editor es **conceptual**. No sustituye una medición, proyecto de obra ni verificación normativa.

> **Incremento local 11/11/2026:** rama `codex/product-release` incorpora protección de activos dañados, migración/grafo persistido, cancelación/selección múltiple, rejilla y referencia calibrada, biblioteca de tres modelos autorizados con miniaturas, cuatro materiales texturados, módulos de cocina/baño, HDRI/paseo/cámaras, versiones y comparación A/B. Criterios observables en [PRODUCT_ACCEPTANCE.md](PRODUCT_ACCEPTANCE.md); resultados y CI en [PROJECT_STATUS.md](PROJECT_STATUS.md). Las secciones de planificación posteriores reflejan el alcance completo y no deben interpretarse como ausencia de estas bases. Cotizaciones comerciales automáticas, PDF técnico, colaboración y catálogo comercial extenso siguen pendientes; no se cierran automáticamente todas las fases.

## Estado de entregas

| Fase | Objetivo | Estado | Criterio de salida |
| --- | --- | --- | --- |
| 0. Estabilidad | Validación, GLB en IndexedDB, exportación portable, lockfile, CI y Playwright | **En curso; recuperación y errores cubiertos** | Ampliar coordinación entre pestañas, bloqueos de IndexedDB y pruebas de migraciones históricas |
| 1. Geometría | Grafo persistido, T/X, división/fusión, recintos y envolvente | **Base implementada** | Restricciones robustas, pasos libres y más casos geométricos degenerados; áreas aún aproximadas |
| 2. Editor | Arrastre cancelable, zoom en cursor/pan, grupos, rejilla y referencia calibrada | **Base implementada** | Cotas encadenadas y cobertura táctil real; validación de conflictos antes de confirmar |
| 3A. Biblioteca universal | Modelos autorizados, variantes por superficie y cuatro PBR (issue #6) | **Catálogo inicial implementado** | Ampliar familias/proveedores y optimización de recursos grandes; verificar aceptación en web publicada |
| 3B. Interiorismo modular | Cocina y lavabo propios con medidas/frentes/encimeras (issue #4) | **Base paramétrica implementada** | Ampliar composición de baños y productos comerciales integrados |
| 4. Render | PBR/HDRI, cámaras, paseo, calidad rápida/alta y PNG | **Base WebGL implementada** | Más pruebas de GPU y fidelidad de capturas; render offline sigue fuera de la entrega |
| 5. Proyectos | Versiones locales, A/B, presupuesto CSV e impresión/PDF | **Flujo local implementado** | PDF técnico, cotizaciones automáticas y colaboración; integración y aceptación pública pendientes |

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
- [x] E2E de activos ausentes/corruptos, cuotas, rollback de importación y modelos reales.
- [x] Proteger activos usados por respaldos locales e historial; retirar archivo y metadatos de forma atómica, con E2E de recuperación/aborto.
- [ ] Ampliar migraciones históricas y coordinación entre pestañas/bloqueos de IndexedDB.
- [ ] Más validaciones de colisiones entre muebles, pasos libres y aperturas.
- [x] Retirada manual de huérfanos y recuperación/reparación de modelos ausentes.
- [ ] Mostrar cuota disponible y coordinar cambios de biblioteca entre pestañas.

### P1. Arquitectura del editor

- [ ] Separar el monolito `App.tsx` en módulos de configuración, persistencia y propiedades.
- [x] Persistir un grafo derivado de nodos/segmentos con migración aditiva y operaciones explícitas de unión/separación.
- [ ] Muros no rectos, espesores por cara, acabado por pared y operaciones de corte/ unión.
- [ ] Garantizar etiquetas de habitaciones estables tras unir, dividir y fusionar recintos complejos.
- [ ] Previsualizar colisiones antes de confirmar arrastres.
- [x] Importación de planos de imagen como referencia y calibrado para trazado manual.
- [x] Reportar superficie aproximada descontando espesores; no equivale a medición técnica de superficie útil.

### P2. Interiorismo y realismo

- [ ] Biblioteca general de modelos de fabricantes/productos reales, referencias y licencias, búsqueda, miniaturas y variantes (F3A, issue #6).
- [x] Cuatro materiales PBR con mapas y escala física aplicables por superficie o submalla (F3A, issue #6).
- [x] Módulos propios de cocina: bajos, altos, columnas, fregadero, encimeras, placa y horno.
- [ ] Composiciones de baño y gestión de revestimientos horizontales y verticales.
- [x] Catálogo inicial de tres GLB reutilizables con metadatos, miniaturas y licencias.
- [x] Materiales PBR, HDRI, tonemapping y cámaras guardadas.
- [x] Calidad rápida/alta y exportación PNG; presets de iluminación de día y noche.
- [x] Variantes A/B con instantáneas de cámara y de los parámetros de diseño.


## Ampliación aprobada: objetos existentes, materiales y renders (08/11/2026)

**Objetivo de producto:** que Atelier 60 permita diseñar un piso desde cero e incorporar **objetos reales** (muebles de salón/dormitorio, lámparas, baños, cocinas y electrodomésticos), acabados reales y renders comparables sin depender de generar una imagen aislada para cada cambio. Una fotografía comercial por sí sola no equivale a un modelo 3D; para orbitar el objeto hace falta un archivo 3D válido, creado o cedido con permiso. Se mantienen siempre sincronizados el modelo de arquitectura, las vistas 2D/3D y la exportación.

**Estado actual, no confundir con la meta:** hay catálogo paramétrico propio y tres GLB autorizados, importación de modelos de hasta 12 MB, IndexedDB y JSON portable, cuatro PBR por superficie/submalla, HDRI, cámaras y propuestas A/B. Sigue pendiente ampliar el catálogo comercial y sus familias; no hay CDN, ingestión automática de fabricantes ni render offline. El detalle siguiente describe el alcance completo, no una lista de funciones ausentes.

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
