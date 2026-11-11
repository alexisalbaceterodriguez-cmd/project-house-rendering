# Atelier 60 — criterios de entrega

Fecha: 11/11/2026. Rama de trabajo: `codex/product-release`.

La aplicación está destinada al diseño conceptual de interiores. Una entrega válida debe preservar los datos, completar los recorridos siguientes y dejar claros los límites de precisión y render. Una compilación correcta por sí sola no acredita estos criterios.

## Recorrido de producto implementado

1. Crear vivienda de dimensiones libres, dibujar tabiques/estancias, insertar puertas y ventanas y editar paredes compartidas. Plano y 3D proceden del mismo estado.
2. Editar con rejilla configurable, magnetismo y ortogonalidad opcionales, zoom en cursor, pan, selección de grupos y arrastre reversible con Escape. Calibrar una imagen de referencia mediante su ancho real.
3. Dividir/fusionar tabiques, normalizar T/X, modificar longitud/ángulo y separar expresamente un extremo. Persistir el grafo de conexiones y conservar acabados de habitaciones al recalcular.
4. Insertar tres modelos autorizados con miniatura, procedencia y licencia; reutilizar los mismos bytes entre instancias y proyectos. Dos recursos son modelos de referencia/escaneo; no se inventan fabricantes ni SKU. La lámpara representa un producto identificado.
5. Elegir cuatro materiales de color/normal/rugosidad y asignarlos a un suelo, pared u objeto, o a una superficie GLB elegida desde Propiedades. Mantener personalizaciones independientes entre instancias.
6. Componer cocina con módulos bajos, altos, columnas, fregadero, placa y horno; configurar baño con lavabo y elementos existentes. Cambiar frentes, encimera y tiradores del módulo seleccionado.
7. Guardar/restaurar propuestas completas en IndexedDB. La restauración guarda antes una copia del estado actual. Conservar un recurso mientras cualquier versión o paso del historial lo utilice.
8. Guardar cámara, escoger día/noche/estudio HDRI y calidad rápida/alta, caminar en primera persona y exportar PNG a resolución configurable dentro del presupuesto de GPU.
9. Comparar A/B solo con geometría coincidente: misma cámara y luz, distinto acabado. Exportar ambas imágenes y recuperar tres propuestas de cocina sin mover arquitectura ni encuadre.
10. Exportar/importar JSON portable con modelos y atribuciones. Recuperar respaldo, rechazar importaciones inválidas y mantener el editor usable si un GLB ya guardado está ausente o corrupto.
11. Indicar precios manuales por objeto, exportar presupuesto CSV y preparar un plano de presentación para imprimir o guardar como PDF desde el navegador.

## Evidencia automatizada

- Unitarias: contrato JSON v1, migración aditiva, grafo en X y estabilidad de nodos, topología, áreas, divisiones con puertas, fusión invertida, variantes independientes, colisiones, historial y validación binaria de GLB.
- E2E Chromium: recorridos básicos anteriores y negativos de almacenamiento; Escape/scroll; GLB ya corrupto; tres cocinas/versiones; cuatro texturas/A-B/dos PNG; modelos reales juntos, reuse/atribución y protección contra borrado; referencia calibrada y pantalla móvil.
- `npm run build`: TypeScript estricto y producción Vite. El 3D se carga en un chunk independiente.
- Resultados y SHA/run exactos en `PROJECT_STATUS.md`. No atribuir una CI del commit base a esta rama.

## Límites que permanecen explícitos

- Perímetro exterior rectangular; no hay muros curvos, BIM/IFC, cálculo estructural, instalaciones ni comprobación normativa.
- Superficie descontando espesores y avisos de colisión son orientativos. Los encuentros complejos, circulaciones y cualquier reforma requieren revisión técnica.
- Render físico rasterizado WebGL; no es render offline con trazado de rayos. Calidad rápida simplifica transmisión/sheen y dibuja bajo demanda; calidad alta puede ser costosa con ciertos GLB o GPU.
- Biblioteca inicial de tres recursos, no un catálogo exhaustivo de fabricantes. Los módulos de cocina/baño son diseños paramétricos propios.
- Proyectos privados guardados en un navegador; sin cuentas, sincronización ni colaboración en servidor. El borrado de datos del navegador puede eliminar proyectos y modelos: conservar JSON portable.
- No se han certificado todos los móviles, navegadores, GPU ni proyectos de tamaño máximo. Presupuestos de recursos y licencias en `ASSET_LICENSES.md`.

## Puerta de publicación

La rama debe pasar unitarias, compilación y toda la suite E2E. Revisar capturas reales y probar al menos un recorrido de render/material/versiones en el bundle de producción. Publicar únicamente el SHA que haya superado CI; conservar abierta cualquier fase cuyo alcance restante no cumpla sus criterios.
