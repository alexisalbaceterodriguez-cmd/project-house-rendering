# Instrucciones de los agentes | House Rendering / Atelier 60

Este repositorio desarrolla **Atelier 60**, un editor web de viviendas en 2D y 3D con React/TypeScript/Vite/Zustand/Three.js. El ejemplo inicial de 10 × 6 m no restringe el tamaño de proyectos nuevos.

## Leer antes de actuar (orden obligatorio)

1. **`AUTOMATION_RUNBOOK.md`**: procedimiento operativo, diagnóstico de CI, salidas alternativas si falla el entorno y prioridades actualizadas. Aplicar en cada sesión.
2. **`PROJECT_STATUS.md`**, primero la cabecera actualizada y la revisión más reciente, para conocer última tarea terminada y siguiente paso exacto.
3. **`PROJECT_MEMORY.md`** para arquitectura, objetivos y decisiones históricas. Sus descripciones antiguas no prevalecen sobre el estado actual.
4. Código real en `main`, `README.md`, commits, issues #1–#5, PR y GitHub Actions. El código y las ejecuciones reales prevalecen sobre los documentos.

## Reglas esenciales

- **No bloquearse por el DNS de la terminal del agente.** GitHub Actions funciona y permite ejecutar tests y compilar. Cuando `git clone` / npm local fallen, continuar mediante GitHub API y consultar los runs del SHA actual en `/actions/runs` con sus jobs. Los estados combinados vacíos no sustituyen ese control.
- **No repetir trabajo resuelto:** `package-lock.json` v3 ya está publicado; CI usa `npm ci` con Node 22; tests y build pasaron en GitHub Actions el 08/11/2026. El workflow de bootstrap temporal ya fue eliminado.
- Los tests de Vitest + build **NO equivalen a E2E**. La tarea inmediata de F0 es añadir Playwright en GitHub Actions y cubrir operaciones de edición y guardado/importación.
- En cada sesión escoger **una unidad concreta**, implementar código y tests, comprobar CI del commit cuando sea posible, subsanar fallos reales, registrar la siguiente tarea y seguir en el ciclo siguiente. No conformarse con diagnosticar o planificar.
- Mantener coherencia de geometría en plano SVG, 3D y JSON; preservar datos anteriores y undo/redo. No declarar cerradas fases sin cumplir los criterios de los issues.
- Evitar conflictos: comprobar HEAD y SHA de los archivos antes de escribir, usar rama/PR si procede y no forzar pushes ni sobrescribir trabajo paralelo. No fingir espera ni acciones completadas.
- Al terminar, actualizar `PROJECT_STATUS.md` con **SHA, run ID y conclusión de CI**, cambios comprobados, pendientes y siguiente tarea **exacta**. Informar brevemente. Si no hay herramienta operativa, registrar el fallo específico y trabajar en algo independiente verificable.

## Referencias de código

- `src/types.ts`, `src/store.ts`, `src/lib/validation.ts`: modelo, estado/historial, persistencia y validación.
- `src/lib/geometry.ts`, `src/lib/topology.ts`: geometría, recintos e intersecciones.
- `src/components/Plan2D.tsx`, `src/components/Scene3D.tsx`: edición 2D y render 3D sincronizado.
- `src/App.tsx`: herramientas, dimensiones, paneles, importación/exportación.
- `src/__tests__/`: tests existentes; `.github/workflows/ci.yml`: CI.
- `standalone.html`: prototipo legacy; no usar su JSON como si fuese compatible con el proyecto React.

**Orden actual de fases:** F0 (E2E y persistencia) → F1 (topología avanzada) → F2 (ergonomía y precisión) → F3 (catálogo modular) → F4/F5 (renders y gestión). F1 y F2 tienen ya avances parciales: nunca volver a describirlas como totalmente ausentes sin comprobar código.
