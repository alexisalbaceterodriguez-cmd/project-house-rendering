# Atelier 60 — Estado persistente

Última revisión: 2026-11-08 (Europe/Madrid).
Repositorio: `alexisalbaceterodriguez-cmd/project-house-rendering`; rama de referencia: `main`.

## Estado comprobado

- F0 (#1): **en curso**. Hay Vitest, TypeScript, compilación Vite y workflow de GitHub Actions; todavía NO existe `package-lock.json`, el workflow utiliza `npm install` y no `npm ci`, y no hay pruebas Playwright/E2E identificadas en los archivos inspeccionados.
- F1 (#2): **parcial**. `src/lib/topology.ts` contiene subdivisión de caras, conciliación de habitaciones y propagación de juntas. `src/components/Plan2D.tsx` ya permite arrastrar paredes y extremos. Falta verificar topología avanzada, colisiones y casos límite.
- F2 (#3): **parcial**. Hay controles de dimensiones, zoom y snapping básico; faltan controles avanzados y pruebas E2E.
- F3 (#4): **pendiente de criterios de aceptación**.
- F4/F5 (#5): **pendiente de criterios de aceptación**.

## Cambio de esta revisión

- Commit `608858cb860614060fcad3c1464a8e06b5dbcf0d`: nuevas pruebas en `src/__tests__/persistence.test.ts` para roundtrip JSON, redimensionado, IDs duplicados, referencias huérfanas y coordenadas inválidas.
- Estas pruebas **no están ejecutadas**: el entorno de ejecución no dispone de acceso de red a GitHub ni de una copia local instalable del repositorio. La conexión GitHub permite leer/escribir archivos mediante API, pero no ejecutar `npm` ni consultar aquí los resultados de Actions. No se afirma CI verde.
- No se cerró ningún issue. No se detectó ni se afirmó ningún conflicto con conversaciones en curso.

## Siguiente unidad de trabajo (F0, prioridad máxima)

1. Obtener un entorno de trabajo con checkout completo y acceso al registro npm; generar `package-lock.json` con npm de Node 22, confirmar reproducibilidad y cambiar CI a `npm ci`.
2. Ejecutar `npm run test` y `npm run build`; corregir regresiones si aparecen. Añadir script de lint y configuración solo cuando pueda validarse.
3. Añadir Playwright con escenarios reales: proyecto en blanco, crear y arrastrar muro, redimensionar, undo/redo, exportar/importar JSON; ejecutar en CI.
4. Probar guardado local, assets GLB y recuperación ante cuotas de almacenamiento; diseñar migraciones versionadas.

**Regla de continuidad:** consultar este archivo, commits y issues al iniciar cada sesión; no repetir tareas completadas, no declarar terminada una fase sin cumplir sus criterios y dejar main estable.
