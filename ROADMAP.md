# Roadmap de Project House Rendering

> Última actualización: 7 de noviembre de 2026. El editor es **conceptual**. No sustituye una medición, proyecto de obra ni verificación normativa.

## Estado de entregas

| Fase | Objetivo | Estado | Criterio de salida |
| --- | --- | --- | --- |
| 0. Estabilidad | Validación estructural de proyectos, GLB en IndexedDB, exportación portable, nuevas pruebas | **Parcialmente implementada** | Falta lockfile, tests E2E, backups/migraciones de esquema y gestión de activos huérfanos |
| 1. Geometría | Caras cerradas desde intersecciones de tabiques, cálculo por polígonos, cambios de envolvente | **Base implementada** | Falta motor robusto de restricciones, comprobación de espacios útiles y casos geométricos degenerados |
| 2. Editor | Redimensionar superficie, mover muros y extremos, medidas, avisos geométricos, plano vacío | **Base implementada** | Falta pan/zoom centrado en cursor, atajos, cotas encadenadas y selección múltiple |
| 3. Interiorismo | Cocinas modulares, baños, catálogo 3D organizado, variantes de materiales | **Pendiente** | Cambiar frentes y encimeras manteniendo medidas y ubicación |
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
- [ ] Añadir `package-lock.json` con npm en un entorno conectado y usar `npm ci`.
- [ ] Pruebas E2E de creación, arrastre, guardado, importación y render 3D con Playwright.
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

- [ ] Módulos de cocina (bajos, altos, columnas, fregadero, encimeras, electrodomésticos).
- [ ] Composiciones de baño y gestión de revestimientos horizontales y verticales.
- [ ] Catálogo GLB reutilizable con metadatos, miniaturas y licencias válidas.
- [ ] Materiales PBR reales, HDRI, tonemapping y cámaras interiores.
- [ ] Vista rápida frente a captura de alta calidad; presets de iluminación de día y noche.
- [ ] Variantes A/B con instantáneas de cámara y de los parámetros de diseño.

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

## Seguimiento en GitHub

- [Issue #1: estabilidad, E2E y lockfile](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/1)
- [Issue #2: topología y colisiones](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/2)
- [Issue #3: editor preciso](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/3)
- [Issue #4: cocinas y baños](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/4)
- [Issue #5: render realista y versiones](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/issues/5)
