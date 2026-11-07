# Instrucciones de continuidad | House Rendering

Este repositorio desarrolla la aplicación de diseño residencial **Atelier 60**. Antes de tocar código lee **`PROJECT_MEMORY.md`** (objetivo, arquitectura, estado verificado, roadmap, limitaciones, backlog y protocolo de actualización) y `README.md`. No interpretar el nombre «60» como límite dimensional.

## Procedimiento en CADA sesión

1. Comprobar la rama y el commit actuales, últimos cambios y workflows, issues y PR.
2. Abrir `PROJECT_MEMORY.md`, identificar **siguiente tarea pendiente verificada**, comprobarla en código y no dar por implementadas funciones solo planificadas.
3. Prioridad actual: **F1 geometría coherente** + **F2 edición visual de dimensiones y muros**; el MVP ya permite cambiar medidas externas y extremos por formularios, pero no arrastrar paredes ni sincronizar nodos compartidos.
4. Conservar una sola fuente de geometría compartida entre SVG 2D, Three.js 3D y el formato JSON. Probar los casos límite y la compatibilidad de proyectos ya guardados.
5. Antes de terminar, ejecutar `npm run test` y `npm run build` o explicar por qué no se pudieron ejecutar. No confundir éxito de GitHub Actions con prueba manual de navegador.
6. Actualizar **`PROJECT_MEMORY.md`** con fecha, commit/PR, tareas realmente completadas, fallos, nueva prioridad y criterios de aceptación para la siguiente sesión. Si el trabajo queda parcialmente hecho, registrarlo como tal.

## Referencia inicial

- `src/types.ts` modelo y versión; `src/lib/geometry.ts` operaciones geométricas; `src/store.ts` estado/historial.
- `src/components/Plan2D.tsx` editor SVG; `src/components/Scene3D.tsx` modelo 3D.
- `src/App.tsx` UI, inspector y redimensionado; `src/data/defaultProject.ts` ejemplo 10 × 6 m.
- `standalone.html` es un prototipo distinto; no es la app React ni tiene JSON intercambiable.

**Objetivo del próximo incremento:** editar interactivamente extremos/muros, ver cotas y 3D sincronizados y poder deshacer/reimportar el resultado. Después, topología de habitaciones y mejoras de realismo conforme al roadmap.