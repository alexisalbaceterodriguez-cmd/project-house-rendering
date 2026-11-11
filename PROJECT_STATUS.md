# Atelier 60 — Estado persistente

Última revisión: 2026-11-11 (Europe/Madrid).
Repositorio: `alexisalbaceterodriguez-cmd/project-house-rendering`; rama de referencia: `main`.

## Estado operativo vigente — retención segura de modelos 2026-11-11

- **Unidad F0 implementada:** el borrado manual de recursos protege ahora ambos guardados de localStorage (principal y respaldo), además del proyecto activo, versiones, comparación A/B, undo/redo y los estados recuperables al cancelar un arrastre. Antes podía eliminarse un GLB usado solo por el respaldo, dejando incompleta una recuperación posterior.
- Archivo GLB y metadatos se retiran en una sola transacción IndexedDB. Una operación abortada conserva ambos; si un guardado es ilegible o no se pueden comprobar las referencias, se bloquea la limpieza. Las referencias vivas y los guardados se releen tras abrir IndexedDB, justo antes de retirar el recurso.
- **Código:** `eca76de01e6de3eadf68da82225301fce0aa12ef`, rama `codex/product-release`, [PR #7](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/pull/7). Base local anterior `464978f96dc3c849ce5dff00a818fe3cd364eade`; main remoto comprobado en `dc882baaf2e2e9fe7b4881f2259660f5a0a760c1`. Sin integración ni despliegue de esta rama.
- **Verificación local:** 72 unitarias, build TypeScript/Vite y 27 E2E Chromium correctos. Cuatro E2E nuevos: recuperación/exportación de un modelo usado solo por el respaldo, rollback de archivo/metadatos tras abortar el borrado, bloqueo por respaldo ilegible y protección del modelo usado solo por redo. Doce unitarias nuevas cubren referencias, lecturas denegadas, datos corruptos y cambios durante la espera de IndexedDB.
- **CI del nuevo código:** [Test and build 43020782024](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43020782024), SHA exacto `eca76de01e6de3eadf68da82225301fce0aa12ef`, `completed/success`; job `130523157891` con instalación, unitarias, build y E2E correctos. La CI exacta del estado previo `464978f` también se comprobó: run `43016791553`, `completed/success`. El commit posterior de bitácora modifica únicamente PROJECT_STATUS.md y PROJECT_MEMORY.md; el run citado acredita el commit de código.
- **Auditoría de pendientes:** ROADMAP.md ya distingue bases implementadas de ampliaciones: F0 con bloqueos/coordinación de pestañas aún pendientes; F1 con restricciones/encuentros degenerados y pasos libres; F2 con cotas encadenadas y cobertura táctil real; F3A/F3B con más familias comerciales/baños; F4 con más cobertura de GPU; F5 con PDF técnico, cotización automática y colaboración. Ninguna fase se cierra por esta corrección.
- **Siguiente tarea exacta de código:** gestionar `onversionchange` y aperturas `onblocked` en las bases IndexedDB de activos/versiones, cerrando conexiones y mostrando un error recuperable; añadir E2E con dos pestañas. La retención actual no garantiza exclusión mutua de operaciones entre pestañas.
- **Publicación pendiente:** revisión e integración de PR #7; después comprobar CI/Pages del SHA integrado y recorrer la URL pública.

## Estado anterior — entrega de producto 2026-11-11

- Rama `codex/product-release`, commit de código `29cf67d75d4f782956094bbc0449a349522eb7ed`, base `dc882baaf2e2e9fe7b4881f2259660f5a0a760c1`. [PR #7](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/pull/7). Se conserva el trabajo de la auditoría anterior y se amplía con código, recursos autorizados y pruebas; main no se ha sobrescrito.
- Implementados: grafo/migración v1 aditiva, arrastre cancelable con historial/redo, zoom sin scroll, grupos, rejilla configurable, imagen calibrada y anclaje; aislamiento/reparación de GLB dañados; biblioteca de tres modelos con origen/licencia y cuatro materiales texturados por superficie; módulos; versiones, cámara, HDRI/paseo y comparación A/B; presupuesto manual CSV y plano imprimible/PDF de presentación.
- Persistencia: flush al salir solo con cambios pendientes, avisos reales de guardado, JSON portable con deduplicación de activos compartidos y rollback atómico. No se eliminan recursos usados por versiones o historial.
- Rendimiento: 3D en chunk separado, render bajo demanda, sombras actualizadas por geometría y calidad rápida que simplifica transmisión/sheen. El recorrido de tres modelos juntos pasó de bloqueo por GPU software a unos 8 s en la prueba local aislada.
- Verificación local actual: **60 unitarias, build (incluye tipos E2E) y 23 E2E completos correctos**. Captura al recrear canvas comprobada además en tres ejecuciones consecutivas en frío. CI del mismo código también correcta: [Test and build 43016376602](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43016376602), `completed/success`; jobs de instalación, unitarias, build y E2E comprobados.
- Producción local revisada en `http://127.0.0.1:5173/`: catálogo real, texturas, HDRI, versiones, móvil e impresión; cero excepciones y cero errores de consola en el recorrido. Auditoría npm de producción: 0 vulnerabilidades notificadas.
- CI base `43005276652` y Pages base `43005462273`: `completed/success`; cubren solo `dc882ba`, no esta entrega. **CI nueva de código 29cf67d: run 43016376602, success.** PR #7 publicada para revisión; no se ha integrado ni desplegado esta rama en Pages.
- Criterios y límites explícitos en `PRODUCT_ACCEPTANCE.md`; licencias y presupuesto de recursos en `ASSET_LICENSES.md`. No se afirma CAD/BIM, certificación normativa, render offline ni catálogo comercial exhaustivo. Cuentas/colaboración, cotizaciones automáticas y PDF técnico siguen siendo ampliaciones.
- **Siguiente tarea exacta:** revisar PR #7 e integrar tras revisión; comprobar Pages del SHA integrado y realizar el recorrido de aceptación en la URL pública. Las ampliaciones pendientes conservan su seguimiento en ROADMAP.md.

## Estado anterior — auditoría local 2026-11-11

- **Base:** `dc882baaf2e2e9fe7b4881f2259660f5a0a760c1`, coincide con main remoto. CI [43005276652](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43005276652) y Pages [43005462273](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43005462273): `completed/success`; jobs CI comprobados.
- **Local Windows:** instalación correcta; base pasa 37 unitarias, build y 9 E2E. Tras correcciones: **42 unitarias, build y 13 E2E correctos**. Producción comprobada en `http://127.0.0.1:5173/`, con vista mixta/3D y exportación PNG real.
- **Corregido:** GLB ilegibles aceptados por JSON/importación directa podían dejar la interfaz en blanco; ahora se valida contenido antes de guardar. Acciones de muros recortadas: ahora admiten varias filas. Incluye regresiones de navegador y cinco unitarias de topología reciente.
- **Producto:** F0/F1/F2 abiertas. F3A tiene biblioteca GLB local y acabados por superficie como bases; catálogo comercial, texturas PBR completas, módulos y render/versiones pendientes. Véase [LOCAL_AUDIT.md](LOCAL_AUDIT.md).
- **Entrega:** cambios locales sin commit ni push; sin run nuevo. Los runs citados validan exclusivamente el SHA base.
- **Siguiente tarea exacta:** aislar fallos 3D por objeto; E2E que corrompa un GLB ya guardado en IndexedDB y compruebe que recarga, plano y retirada del objeto siguen funcionando. Otros pendientes: listener de rueda no pasivo y división del bundle de 1,37 MB.

## Estado operativo anterior (2026-11-08, primer E2E Chromium validado)

**F0 en curso, pero lockfile, CI reproducible e infraestructura E2E ya funcionan.** La ejecución [Test and build #42467419830](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42467419830) en `f449e59` terminó **success** con 37 pruebas unitarias, build y recorrido Playwright de Chromium. Repositorio en Node 22, `npm ci`, runner `ubuntu-24.04` (Playwright 1.56.1 no acepta ubuntu-26.04).

- **Playwright ya integrado:** `playwright.config.ts`, `e2e/editor.e2e.ts`, script `npm run test:e2e` y paso Chromium en `.github/workflows/ci.yml`. Escenario real: vivienda en blanco, dimensiones, dibujar/arrastrar pared, undo/redo, JSON, recarga local e importación.
- **Defecto real detectado y corregido:** el formulario de dimensiones quedaba bloqueado por la validación de `Altura=2.55` con paso 0.1. `src/App.tsx` utiliza ahora validación explícita del ancho/fondo (`noValidate`) y paso 0.01 para altura, commit `f449e59`.
- **Fases:** F1/F2 parcialmente implementadas, F3-F5 pendientes. No cerrar F0 hasta comprobar activos GLB/IndexedDB, corrupción/cuotas de almacenamiento y migraciones del formato.
- **Siguiente tarea exacta:** tests de recuperación y persistencia IndexedDB/GLB, especialmente exportación portable, assets ausentes y errores de cuota. Añadir pruebas E2E negativas de JSON corrupto como incremento cercano; preservar proyectos anteriores.
- **Continuidad:** consultar [AUTOMATION_RUNBOOK.md](AUTOMATION_RUNBOOK.md) y runs de Actions del SHA real. No repetir lockfile/bootstrap, ni diagnosticar falta de red de la terminal si CI funciona.

## Revisión 2026-11-08 11:38 (Europe/Madrid): roundtrip GLB en navegador

- Commit de código `d694574ca8a900fdca54d98284565866dec4dcdd`: `e2e/editor.e2e.ts` incorpora escenario Chromium que importa un GLB binario mínimo válido, verifica almacenamiento por `assetId` en IndexedDB y JSON local sin `modelData`, exporta un JSON portable con los bytes GLB en base64, reimporta y comprueba una segunda exportación idéntica.
- Los escenarios negativos del commit `073d7cf` continúan pendientes de validación por SHA exacto. La consulta directa de `/actions/runs?per_page=5` desde el navegador de herramientas devolvió «not accessible»; no se atribuye ningún run anterior a este commit ni se declara E2E verde.
- **Próximo paso exacto:** consultar el run de `d694574` (y `073d7cf`) en Actions, corregir cualquier fallo real de Playwright y añadir prueba de asset ausente/denegación de IndexedDB y manejo de cuota. F0 permanece abierta.

## Revisión 2026-11-08 10:38 (Europe/Madrid): E2E negativos de persistencia

- Commit de código `073d7cf602fb14537feeb92643d054ef53ab0113`: `e2e/editor.e2e.ts` añade dos escenarios Chromium: importación de JSON sintácticamente corrupto/esquema incompatible sin pérdida del plano activo y recuperación desde copia válida cuando la clave primaria de localStorage está corrupta.
- Se comprobó que el run anterior `42467419830` tenía job `verify` `completed/success` (npm ci, Vitest, build, instalación Chromium y E2E). **Ese resultado corresponde al código anterior**, no al commit nuevo.
- **Validación pendiente del nuevo SHA:** el endpoint `actions/runs` no estuvo accesible en esta sesión mediante el navegador web, y el conector disponible permite leer jobs por run ID, pero no listar runs push nuevos. No atribuir el verde anterior a `073d7cf`. Revisar Actions de ese SHA en el próximo ciclo y reparar cualquier fallo antes de avanzar.
- **Siguiente unidad exacta:** comprobar resultado de CI para `073d7cf`; si es verde, ampliar pruebas IndexedDB para `putModelAsset`/`getModelAsset` y fallos de cuota o activos ausentes, y asegurar exportación/importación portable sin pérdida de modelos.

## Estado comprobado

- F0 (#1): **en curso**. Hay Vitest, TypeScript, compilación Vite y GitHub Actions; `package-lock.json` v3 ya está versionado y CI utiliza `npm ci`. El primer recorrido Playwright/E2E ya pasó en Chromium; faltan assets, migraciones y más escenarios de borde.
- F1 (#2): **parcial**. `src/lib/topology.ts` contiene subdivisión de caras, conciliación de habitaciones y propagación de juntas. `src/components/Plan2D.tsx` ya permite arrastrar paredes y extremos. Falta verificar topología avanzada, colisiones y casos límite.
- F2 (#3): **parcial**. Hay controles de dimensiones, zoom y snapping básico; faltan controles avanzados y pruebas E2E.
- F3 (#4): **pendiente de criterios de aceptación**.
- F4/F5 (#5): **pendiente de criterios de aceptación**.

## Cambio de esta revisión

- Commit `608858cb860614060fcad3c1464a8e06b5dbcf0d`: nuevas pruebas en `src/__tests__/persistence.test.ts` para roundtrip JSON, redimensionado, IDs duplicados, referencias huérfanas y coordenadas inválidas.
- Estas pruebas **no están ejecutadas**: el entorno de ejecución no dispone de acceso de red a GitHub ni de una copia local instalable del repositorio. La conexión GitHub permite leer/escribir archivos mediante API, pero no ejecutar `npm` ni consultar aquí los resultados de Actions. No se afirma CI verde.
- No se cerró ningún issue. No se detectó ni se afirmó ningún conflicto con conversaciones en curso.

## Siguiente unidad de trabajo (registro histórico previo al lockfile; NO usar como prioridad vigente)

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

## Revisión de continuidad — 2026-11-08 06:37 (Europe/Madrid)

- Consultados los cinco issues #1–#5 (todos abiertos), commits recientes de main, `package.json`, CI, `src/store.ts`, validación y pruebas. No hay cambios ajenos identificados desde la revisión anterior. No hay forma fiable de detectar una conversación simultánea desde este entorno; no se simuló espera.
- **Commit `6acf56f`**: `useEditor.load` clona defensivamente el proyecto recibido antes de introducirlo en el estado del editor. Evita que una referencia externa a un JSON importado altere muros o metadatos sin pasar por el historial de operaciones.
- **Commit `fba1eb8`**: prueba de regresión de aislamiento de la importación en `src/__tests__/storage.test.ts`. La prueba comprueba nombre, geometría e historial tras mutar el objeto original.
- **Verificación pendiente**: `git ls-remote` falla por DNS (`Could not resolve host: github.com`). No hay checkout instalable ni acceso npm confirmado; Vitest, compilación, lint y E2E no ejecutados. Estados y workflow runs del commit consultado devuelven listas vacías, lo que no demuestra CI verde.
- **Siguiente tarea exacta**: obtener un runner con checkout y acceso npm, ejecutar las pruebas existentes y la nueva, generar `package-lock.json` auténtico y pasar CI a `npm ci`. Añadir Playwright después. F0 y los otros cuatro issues siguen abiertos.

## Revisión de continuidad — 2026-11-08 07:40 (Europe/Madrid)

- Inspeccionados los últimos commits de main, los cinco issues abiertos (#1–#5), `PROJECT_STATUS.md`, `package.json`, `.github/workflows/ci.yml`, `src/store.ts`, `src/lib/validation.ts`, `src/types.ts`, `src/App.tsx` y las pruebas de almacenamiento. No se identificó un trabajo concurrente por commits posteriores al último avance registrado; no hay detección fiable de conversación activa.
- Commit `6356fcc`: `useEditor.load` ahora valida con `isProject` antes de reemplazar el estado. La anotación TypeScript `Project` no impide que un JSON inválido llegue en ejecución; se conserva el proyecto activo y su historial cuando falla la validación.
- Commit `fda8c38`: prueba de regresión para una importación con abertura huérfana; comprueba que no se destruyen ni el proyecto activo ni las pilas de deshacer/rehacer.
- **Sin validación de ejecución**: `git ls-remote` falla por DNS (`Could not resolve host: github.com`). No hay checkout local ni dependencias instaladas; no se han ejecutado Vitest, build, lint ni E2E. El workflow sigue usando `npm install` y falta un lockfile real.
- **Siguiente tarea exacta**: habilitar un runner con checkout y acceso npm, ejecutar pruebas y compilación, corregir fallos, generar `package-lock.json` auténtico y pasar CI a `npm ci`. Añadir Playwright E2E tras la validación. Mantener los cinco issues abiertos hasta cumplir criterios de aceptación.

## Revisión de continuidad — 2026-11-08 08:37 (Europe/Madrid)

- Inspeccionados `PROJECT_STATUS.md`, `package.json`, `.github/workflows/ci.yml`, `src/store.ts`, `src/lib/validation.ts`, `src/App.tsx` y las pruebas de persistencia. Los issues #1–#5 siguen siendo el plan de fases; F0 continúa sin lockfile real ni Playwright.
- Commit `802129c`: `useEditor.change` rechaza cambios que no superen `isProject` antes de introducirlos en el estado o historial. Antes, una edición con valores inválidos podía contaminar el editor y provocar fallos de autoguardado.
- Commit `9060d04`: prueba de regresión para verificar que una edición inválida no modifica proyecto/historial y que una edición posterior válida sigue funcionando.
- Intento real de `git clone --depth 1` fallido: `Could not resolve host: github.com`. El conector GitHub permite editar archivos, pero este entorno no puede instalar dependencias ni ejecutar Vitest, build, lint o E2E. **Estos commits no están validados mediante ejecución.**
- **Siguiente tarea exacta:** comprobar tests y compilación en runner con conectividad; corregir posibles incompatibilidades de `isProject` con estados transitorios de arrastre; generar `package-lock.json` auténtico y configurar `npm ci` en CI, seguido de Playwright. No cerrar F0 ni otros issues sin aceptación.
- No hay forma fiable de detectar una conversación concurrente ni de posponer exactamente diez minutos; no se simuló espera.

## Revisión de continuidad — 2026-11-08, lockfile y CI reproducible

- La ejecución de GitHub Actions [Bootstrap npm lockfile](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42463787120) **terminó correctamente**. Generó `package-lock.json` con Node 22/npm, ejecutó `npm ci`, `npm run test` y `npm run build`, y versionó el lockfile en el commit `d29e07b`.
- El workflow `.github/workflows/ci.yml` se actualizó para utilizar exclusivamente `npm ci --no-audit --no-fund` (commit `a2fa4db`). Comprobar el resultado de esta ejecución antes de declarar la nueva configuración verificada.
- Bloqueo anterior resuelto: no hace falta disponer de un checkout local en el entorno de conversación, porque GitHub Actions dispone de conectividad y ejecuta los comandos correctamente.
- F0 permanece abierta: siguiente prioridad pruebas E2E con Playwright, importación/exportación JSON con assets GLB, persistencia y migraciones. No regresar a tareas de bootstrap ya completadas.

## Revisión de continuidad — 2026-11-08 (E2E Chromium operativo)

- `@playwright/test@1.56.1` instalado y lockfile real actualizado por [bootstrap validado](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42466786619) (commit `dde1e4f`). La instalación de Chromium exigió fijar `ubuntu-24.04` por la falta de compatibilidad con `ubuntu-26.04` del runner anterior.
- Commit `cda6b25`: configuración Playwright, `e2e/editor.e2e.ts`, script npm, CI E2E con capturas y traces en fallos. Commit `8c6fcc1`: runner Ubuntu compatible.
- El primer E2E reveló una **regresión funcional real**: la altura inicial de 2,55 m no satisfacía el `step=0.1` del mismo formulario y bloqueaba el submit de dimensiones. Se documentó en [run fallido 42467092988](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42467092988); commit `f449e59` corrigió el formulario. Commit `4317bf1` incorporó regresión unitaria sobre redimensionado de un plano nuevo.
- **Verificación exacta:** [Test and build #42467419830](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42467419830) = `completed/success`; 37 tests Vitest, build TypeScript/Vite y E2E Chromium reales pasaron. No representa aún cobertura de toda la app.
- El workflow temporal `bootstrap-playwright.yml` ya puede retirarse. **Siguiente unidad F0:** pruebas de activos GLB/IndexedDB y recuperación ante errores de almacenamiento; comprobar la exportación portable y la migración de JSON antiguo. Issues #1-#5 siguen abiertos salvo criterios completos.
