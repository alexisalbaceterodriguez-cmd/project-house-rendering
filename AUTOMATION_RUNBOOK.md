# Protocolo operativo para automatizaciones | Atelier 60

**Fecha:** 2026-11-08. **Aplicación:** House Rendering / Atelier 60.
**Repositorio:** `alexisalbaceterodriguez-cmd/project-house-rendering`, rama `main`.
**Propósito:** avanzar en el producto con resultados verificables en cada ejecución horaria; evitar bloqueos falsos, duplicaciones y planes sin código.

## 1. Fuente de verdad y arranque obligatorio

1. Leer este fichero, `AGENTS.md`, la **cabecera más reciente** y el final de `PROJECT_STATUS.md`, `PROJECT_MEMORY.md` y `README.md`. El texto histórico puede estar obsoleto.
2. Consultar el **HEAD real de main**, los commits más recientes, issues #1-#5, PR abiertos, `package.json`, `.github/workflows/ci.yml` y las ejecuciones de GitHub Actions. Comprobar código antes de considerar algo hecho o pendiente.
3. Orden de autoridad: (a) código y archivos existentes en `main`; (b) resultados de CI para el **SHA exacto**; (c) issues/criterios de aceptación; (d) estado persistente; (e) documentación histórica.
4. Localizar trabajo parcialmente hecho y terminarlo antes de iniciar una tarea nueva. Evitar reimplementar funciones ya presentes.

## 2. Lección crítica del 08/11/2026: CI es ejecutable aunque el agente no tenga red

**Problema pasado:** el agente recibió `Could not resolve host: github.com` desde su terminal y concluyó repetidamente que no podía validar ni generar el lockfile. **Sin embargo, GitHub Actions estaba ejecutando tests y builds con éxito.** El estado de commits devolvía listas vacías y eso se interpretó erróneamente como falta de validación.

**Solución ya aplicada y verificada:**
- `package-lock.json` **real**, formato npm lockfile v3, generado en runner GitHub Actions (commit `d29e07b`).
- `.github/workflows/ci.yml` usa `npm ci --no-audit --no-fund` en Node 22 (commit `a2fa4db`).
- GitHub Actions `Test and build` ejecuta `npm ci`, `npm run test` y `npm run build`. Ejecución **correcta** posterior al cambio de CI: [run 42463858802](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42463858802). También aprobó [run 42463921846](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/42463921846).
- El bootstrap temporal del lockfile se eliminó al completar la tarea. **No regenerar el lockfile ni recuperar ese workflow salvo cambio real de dependencias que lo requiera.**

**Regla permanente:** un fallo de DNS/npm/git **del entorno del agente** no significa que GitHub Actions falle. No repetir indefinidamente `git clone` ni detener F0 por ello. Consultar la CI del SHA correspondiente, y usar GitHub Actions para ejecutar y validar lo que la terminal del agente no permita. No afirmar que una prueba se ha ejecutado si no consta su resultado real.

### Consultar correctamente GitHub Actions

Si el conector GitHub está disponible, leer el endpoint de GitHub REST permitido, por ejemplo:
- `GET https://api.github.com/repos/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs?per_page=15`
- `GET https://api.github.com/repos/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/<run_id>`
- `GET https://api.github.com/repos/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/<run_id>/jobs`, o herramienta `fetch_workflow_run_jobs`.

Buscar por **nombre de workflow, `head_sha`, evento, `status` y `conclusion`**. `status=completed` y `conclusion=success` juntos confirman el éxito de ese runner. Un estado vacío de `get_commit_combined_status` **NO** implica tests ausentes ni pasados. El wrapper `fetch_commit_workflow_runs` puede limitarse a PR y no mostrar pushes a main.

Diferenciar los niveles de cobertura:
- `Test and build` verde = unidad Vitest + compilación TypeScript/Vite; **no demuestra** todavía E2E, interacción en navegador, calidad visual o accesibilidad.
- `Deploy to GitHub Pages` verde = despliegue del workflow; no demuestra que toda la UX sea correcta.
- Si una ejecución está `queued` o `in_progress`, dejar resultado `pendiente`, no inventar éxito. Revisarla en el siguiente ciclo o cuando sea consultable.

### Cuando sea necesario generar artefactos npm

1. Verificar si `package-lock.json` existe y si corresponde al `package.json` actual. **Hoy existe.**
2. Si hubiera que actualizarlo y no hubiese npm accesible en el agente, crear **temporalmente** un workflow de GitHub Actions con Node 22 y acceso a dependencias reales; generar el archivo con `npm install --package-lock-only`, verificar `npm ci`, tests y build, publicarlo con permisos mínimos en GitHub o como artefacto, y retirar el workflow temporal.
3. Jamás inventar a mano las entradas `integrity` y `resolved` del lockfile. No instalar paquetes ficticios ni hacer depender el avance de herramientas que no están disponibles en este entorno.

## 3. Bucle de trabajo de cada ejecución

1. **Sincronizar realidad.** Detectar commits/PR recientes y cambios de usuario; releer estado actualizado. No asumir que otro agente está inactivo solo porque no hay nuevos commits. Ante cambios concurrentes, evitar sobrescrituras usando SHA actual, rama/PR si procede y revalidación previa a cada escritura.
2. **Elegir una unidad concreta** del primer issue pendiente según F0 > F1 > F2 > F3 > F4/F5. Si F0 espera una prueba externa, trabajar en una mejora independiente y comprobable sin dejar el estado inconsistente.
3. **Implementar código y pruebas.** No dedicar una ejecución completa a un informe salvo bloqueo real. Priorizar cortes verticales funcionales y revertibles frente a cambios cosméticos.
4. **Validar.** Ejecutar `npm ci`, `npm run test`, `npm run build` donde sea posible. Si el agente no puede ejecutar comandos, publicar cambios mediante GitHub, revisar Actions de **ese SHA** y corregir fallos de runner. Para E2E, primero instalar/configurar Playwright de forma reproducible en CI y añadir pruebas de navegador.
5. **Ante fallo CI:** consultar jobs, pasos y logs, reparar y relanzar por commit. No seguir acumulando funcionalidades sobre un HEAD con fallo de tests/build. Si un servicio o permiso falla de manera persistente, registrar la limitación concreta y trasladarse a otra tarea segura no dependiente; nunca repetir intentos idénticos cada hora.
6. **Cerrar el ciclo.** Guardar en `PROJECT_STATUS.md`: hora, SHA(s), archivos, cambios concretos, run ID/resultado, tareas no verificadas, siguiente tarea exacta. Actualizar checklist de issues y cerrar solo cuando **todos** los criterios de aceptación se cumplan.
7. **Siguiente hora:** empezar por el resultado de la ejecución anterior, no por reiniciar el diagnóstico de F0. Mantener una bitácora breve y priorizar resultado funcional sobre volumen de commits.

### Manejo de bloqueos (sin parálisis)

- `git clone` falla por DNS → usar el conector GitHub para lectura/escritura y Actions para tests/build.
- Endpoint de statuses vacío → consultar la lista real de `actions/runs` y jobs.
- No existe herramienta para ejecutar npm local → correr GitHub Actions, no abandonar tareas verificables.
- Acceso GitHub no disponible → no fingir commits; documentar fallo y próximo intento en cuanto vuelva. No borrar trabajo ni revelar secretos.
- Un workflow necesita permisos que no se conceden → preferir rama/PR o artefacto y documentar exactamente el permiso faltante; no debilitar seguridad.
- E2E no instalado → instalarlo y ejecutarlo en Actions; no presentar tests unitarios como evidencia E2E.
- Usuario interviene o cambia prioridades → respetar nuevas instrucciones; no cambiar el trabajo simultáneo del usuario. Si no hay capacidad real de esperar 10 minutos, no simularla.

## 4. Roadmap y prioridad actual

- **F0 (#1):** lockfile y CI reproducible **HECHOS**. Pendientes: Playwright E2E (crear proyecto en blanco; dibujar/arrastrar pared; cambiar tamaño; undo/redo; exportar/importar JSON), pruebas de recuperación local/IndexedDB/GLB, migraciones y validación de casos límite. No cerrar F0 aún.
- **F1 (#2):** editor ya tiene arrastre básico de extremos/muros y topología de recintos parcial. Pendientes: grafo consistente, intersecciones complejas, área útil, aperturas y colisiones.
- **F2 (#3):** cotas/dimensiones, zoom y snap básicos ya existen; faltan pan/zoom preciso, controles avanzados, selección, anclajes de perímetro, usabilidad táctil y pruebas.
- **F3 (#4):** cocinas y baños modulares con catálogo GLB y variantes; criterios aún pendientes.
- **F4/F5 (#5):** materiales PBR, HDRI/iluminación, renders comparables, cámaras, rendimiento y versiones; criterios aún pendientes.

**Próxima tarea prioritaria:** añadir una infraestructura Playwright mínima con al menos un escenario E2E reproducible y ejecución en GitHub Actions; ampliar a las operaciones críticas del editor. Confirmar primero que no ha sido implementada por otro ciclo.

## 5. Límites y comunicación

- Mantener geometría 2D/3D/JSON consistente, preservar proyectos antiguos y no convertir una app conceptual en promesa de seguridad estructural o cumplimiento normativo.
- No borrar datos, reescribir historia ni forzar pushes. No publicar secretos. Hacer cambios reversibles y preferir cambios pequeños.
- Una automatización horaria es una **ejecución discreta**, no un agente perpetuamente ejecutándose. Continuidad mediante documentos y la próxima ejecución, no mediante promesas de trabajo silencioso entre runs.
- Informar de avances **reales**, bloqueos concretos y verificación observada. No declarar todas las fases hechas por pasar solo los tests básicos.
