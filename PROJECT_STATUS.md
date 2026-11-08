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

## Revisión de continuidad — 2026-11-08 03:35 (Europe/Madrid)

- Consultados commits de main, issues #1–#5, PR abiertos (búsqueda sin resultados), workflow de CI, package.json, store, validación y pruebas. El commit anterior a esta revisión era `3b2969c`.
- **Commit `42eb858`**: lectura independiente de proyecto principal y respaldo. Antes, el acceso a ambos se evaluaba en una única expresión; si leer la copia fallaba, se descartaba incluso un principal válido, y viceversa. Ahora cada error de lectura se aísla y se prueba la otra copia.
- **Commit `fb4e496`**: dos pruebas de regresión para errores de acceso al respaldo y al principal. Estas pruebas no se han ejecutado todavía.
- Los estados de commit y workflow asociados consultados no devuelven verificaciones; esto **no equivale a CI verde**. F0 permanece abierta. No hay checkout npm verificable en este entorno.
- **Siguiente tarea exacta:** ejecutar Vitest/TypeScript en un runner operativo, comprobar estas dos pruebas, generar y versionar package-lock auténtico, cambiar CI a npm ci y añadir E2E. Evitar añadir nuevas funciones sin resolver esta verificación.

## Revisión de continuidad — 2026-11-08 04:41 (Europe/Madrid)

- Confirmados los cinco issues abiertos (#1–#5), `package.json`, workflow `.github/workflows/ci.yml`, `src/store.ts` y pruebas de persistencia. F0 sigue sin lockfile ni Playwright, y CI usa `npm install`.
- Intento de `git ls-remote` desde el entorno de ejecución: `Could not resolve host: github.com`. Node 22.16.0 y npm 10.9.2 están disponibles, pero no hay checkout ni acceso de red para instalar dependencias; no se han ejecutado Vitest, compilación, lint ni E2E. No se declara CI verde.
- Commit `58b2e5f`: `saveLocal` conserva la versión anterior estructuralmente válida como respaldo antes de escribir la nueva. El primer guardado sigue sembrando una copia; un principal corrupto no reemplaza un respaldo válido. Esto evita que ambos slots contengan siempre la última revisión.
- Commit `07253ca`: dos pruebas para comprobar la conservación de la versión anterior y la protección frente a un principal corrupto. **Pendientes de ejecutar**.
- **Siguiente tarea exacta**: obtener un checkout con conectividad npm, ejecutar `npm run test` y `npm run build`, corregir regresiones, generar un `package-lock.json` auténtico y cambiar CI a `npm ci`. Después añadir Playwright. No cerrar F0 sin verificaciones.
- No se ha podido determinar de forma fiable si existe una conversación concurrente activa; no se ha simulado una espera de diez minutos.

## Revisión de continuidad — 2026-11-08 05:43 (Europe/Madrid)

- Confirmados los issues #1–#5 abiertos y comprobados `PROJECT_STATUS.md`, `package.json`, `.github/workflows/ci.yml`, `src/store.ts`, `src/lib/validation.ts`, `src/App.tsx` y pruebas existentes. F0 continúa sin lockfile y sin E2E.
- Commit `cd2751403816286616490e47145a90d3111d88cf`: dos pruebas de regresión adicionales en `src/__tests__/storage.test.ts` para fallos al escribir la copia principal. Verifican que `saveLocal` indique fallo, la última versión principal siga legible y el respaldo conserve la versión válida más reciente. No se modificó el comportamiento productivo.
- **Sin ejecución de tests**: `git ls-remote` sigue fallando por DNS (`Could not resolve host: github.com`); no hay checkout instalable ni acceso npm confirmado. Estas pruebas deben verificarse en CI/runner antes de afirmar que pasan.
- Siguiente tarea exacta: obtener checkout y registro npm funcionales, ejecutar tests/build, generar lockfile real y sustituir `npm install` por `npm ci`; después añadir Playwright E2E. No cerrar F0 sin aceptación verificada.
- No se pudo verificar con certeza si había conversación concurrente; no se simuló espera.
