# Auditoría local de Atelier 60 — 11/11/2026

## Conclusión

Funciona en local como editor conceptual 2D/3D. No está terminado como herramienta de interiorismo con productos comerciales y renders fotorrealistas. Se encontraron y corrigieron dos defectos fuera de la cobertura anterior.

Base: `main`, `dc882baaf2e2e9fe7b4881f2259660f5a0a760c1`, coincidente con main remoto. Árbol inicial limpio. Entorno: Windows, Node 25.6.1, npm 11.9.0 y Chromium de Playwright 1.56.1. CI usa Node 22; no se modificó Node global.

## Evidencia

- `npm ci --no-audit --no-fund`: correcto, 171 paquetes instalados; lockfile intacto.
- Base sin cambios: 37 unitarias, build y 9 E2E pasan en esta máquina.
- Con las correcciones: **42 unitarias, build y 13 E2E pasan**. Navegador ejecutado con `npm run test:e2e -- --workers=1`.
- Bundle de producción comprobado con `npm run preview -- --host 127.0.0.1 --port 5173 --strictPort`: vista mixta, 2D, 3D, selección de pared y PNG real. Sin excepciones de JavaScript en el recorrido normal.
- Revisión visual de escritorio 1600 × 1000 y comprobación básica a 390 × 844: documento sin desbordamiento horizontal. No certifica interacción táctil ni todos los paneles móviles.
- CI base: [Test and build 43005276652](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43005276652), `completed/success`; jobs de instalación, unitarias, build y E2E comprobados.
- Pages base: [43005462273](https://github.com/alexisalbaceterodriguez-cmd/project-house-rendering/actions/runs/43005462273), `completed/success`. No se auditó la URL pública.
- Cambios locales sin commit ni push: **esos runs no validan las correcciones nuevas**.

## Defectos corregidos

1. **GLB corrupto podía dejar toda la interfaz en blanco al abrir 3D.** JSON aceptaba bytes base64 sin comprobar el modelo. La importación directa comprobaba cabecera, pero toleraba contenido ilegible al capturar errores de medición y miniatura. Ahora ambas vías validan contenedor y lectura mediante GLTFLoader antes de guardar. Un error conserva el proyecto y el rollback de importaciones parciales.
2. **Acciones de pared recortadas.** Contenido de 361 px en inspector de 261 px; ahora los botones se distribuyen en varias filas. Regresión E2E comprobada fallando antes y pasando después; contenido final de 261 px.

Se añadieron cinco unitarias: división con puertas, rechazo atómico, normalización T/X conservando área e idempotencia, fusión de segmentos invertidos y arrastre de anfitrión T. Cuatro E2E nuevos cubren inspector, ambas vías de importación corrupta y render/PNG tras cambiar de vista. La prueba previa de rollback por cuota usa ahora GLB válidos, en lugar del texto `example`, para alcanzar realmente el segundo guardado.

## Estado por fase

- **F0, avanzada y abierta:** CI, respaldo, IndexedDB, JSON portable y errores básicos operativos. Faltan migraciones generales y recuperación de activos antiguos que se corrompen después de guardarse.
- **F1, parcial:** recintos poligonales y huecos, movimiento conectado, snap, división/fusión, T/X y avisos de uniones abiertas. Faltan grafo persistente, superficie útil descontando espesores y colisiones robustas.
- **F2, parcial:** arrastre, campos numéricos, zoom en cursor, pan central/Espacio, guías y cotas. Faltan selección múltiple y más validación táctil. Escape cancela dibujo iniciado; no revierte un arrastre geométrico activo.
- **F3A, bases presentes:** catálogo paramétrico con metadatos, biblioteca GLB local, miniaturas, medidas, orientación/pivote y acabados por instancia/superficie. Sin catálogo comercial autorizado ni biblioteca completa de texturas PBR.
- **F3B, F4/F5 pendientes:** configuradores modulares completos, render fotorrealista, cámaras/versiones y comparación de proyectos. La escena actual es WebGL en tiempo real.

## Pendientes y siguiente tarea

- Un GLB antiguo corrupto en IndexedDB aún puede fallar durante la carga 3D: falta aislamiento por objeto.
- En una prueba de rueda apareció `Unable to preventDefault inside passive event listener invocation.` El zoom cambia, pero falta corregir y probar el posible desplazamiento simultáneo de página.
- Bundle principal: 1.370,48 kB, 389,87 kB gzip; aviso Vite de tamaño. Build correcto. Falta dividir carga 3D y medir modelos reales.
- Cobertura geométrica ampliada, todavía insuficiente para todos los casos degenerados y ediciones sucesivas.
- README y cabeceras de estado actualizados; historial antiguo conservado.

**Siguiente unidad exacta:** barrera de errores por objeto para GLB ya guardados; E2E que corrompa un blob en IndexedDB, recargue vista mixta y verifique plano, selección y retirada del objeto disponibles. Publicar las correcciones mediante el flujo habitual y comprobar CI de su nuevo SHA.
