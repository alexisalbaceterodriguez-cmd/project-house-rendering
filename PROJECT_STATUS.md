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

## Revisión de continuidad — 2026-11-08 01:37 (Europe/Madrid)

- Inspeccionados `main`, commits recientes, `package.json`, workflow `.github/workflows/ci.yml`, `src/store.ts`, validación, topología y los issues #1–#5. No se han observado nuevos commits ajenos posteriores al registro anterior en el momento de la consulta. La búsqueda de PR no permitió identificar inequívocamente PR abiertos (la búsqueda devolvió issues), por lo que **no se afirma** que no existan.
- **Nuevo commit `0a1618e8e215695d0270baeb3a2cc9288a1ce538`**: `src/__tests__/storage.test.ts` añade cuatro pruebas automatizadas de restauración local, JSON corrupto, fallo de cuota y flujo editar/guardar/deshacer/rehacer.
- **Verificación pendiente**: pruebas añadidas pero no ejecutadas. Intento de `git clone` desde el entorno de ejecución falló con `Could not resolve host: github.com`. GitHub API sí permite leer/escribir; no se debe presentar CI como superado.
- F0 continúa abierta. La próxima ejecución debe priorizar obtener checkout y npm operativos, ejecutar estas pruebas, generar el lockfile real (no sintetizarlo), pasar a `npm ci` y comenzar Playwright. Si GitHub Actions indica fallos, corregirlos antes de añadir más funciones.
- No se ha detectado evidencia de edición simultánea; tampoco hay garantía técnica de detectar una conversación activa. No se simuló una espera.

## Revisión de continuidad — 2026-11-08 02:40 (Europe/Madrid)

- F0 sigue abierta; issues #1–#5 continúan abiertos. No hay evidencia de ejecución de CI para el último commit: la consulta de estados y workflows asociados devolvió listas vacías (el conector de workflows solo consulta ejecuciones asociadas a PR).
- Commit `ec78ba25f98657b6ecd0a31047d941c13ad051fb`: `src/store.ts` incorpora respaldo validado en `localStorage`, recuperación desde respaldo cuando el principal está corrupto y rechazo de guardado inválido.
- Commit `20baa6848ef10a8d5035665f29e80d1159901c6c`: `src/__tests__/storage.test.ts` incorpora tres casos de prueba para recuperación, rechazo de proyectos inválidos y escritura de respaldo.
- **No verificado**: el checkout por `git clone` vuelve a fallar por DNS (`Could not resolve host: github.com`); no se pudieron ejecutar npm, Vitest, compilación ni E2E. Los cambios se publicaron mediante GitHub API, no mediante un checkout local.
- Próxima prioridad: comprobar y corregir las pruebas en un runner operativo; obtener `package-lock.json` auténtico, sustituir `npm install` por `npm ci` y comenzar Playwright. No cerrar F0 hasta verificar aceptación.
