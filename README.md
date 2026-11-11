# Atelier 60

Editor local de viviendas en 2D y 3D. Permite crear una planta, distribuir objetos, asignar acabados, preparar propuestas y exportar imágenes comparables. El ejemplo de 10 × 6 m es una plantilla, no una restricción de tamaño.

## Ejecutar

Node 22.12+ y npm; CI usa Node 22.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Abrir la URL indicada por Vite. Producción local:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
```

La aplicación React está en la raíz. `standalone.html` es un prototipo antiguo con JSON incompatible.

## Diseñar

- **Nuevo** crea una envolvente editable. Configura ancho, fondo y altura; escala la distribución o conserva sus medidas. Estudio permite elegir la esquina de anclaje.
- **Tabique / Estancia** dibujan cerramientos. Puertas y ventanas se insertan sobre muros. El plano y la escena usan la misma geometría.
- Arrastra paredes y extremos; divide y fusiona segmentos o normaliza intersecciones T/X. En **Estudio → Plano y revisión** puedes editar longitud, ángulo y separación de una unión.
- Usa rueda para ampliar, botón central o Espacio para desplazar. Escape revierte el arrastre en curso. Mayús + clic selecciona varios muebles; puedes mover y duplicar el grupo.
- Configura paso de rejilla, magnetismo y ortogonalidad. Importa una imagen de referencia y calibra su ancho real.
- Consulta superficies aproximadas y avisos de solapamientos. Las áreas desde ejes y el descuento de espesor son estimaciones.

## Modelos y acabados

**Estudio → Modelos** incluye butaca, sofá escaneado y lámpara autorizados, con miniaturas, procedencia y licencia. No se inventan fabricantes ni referencias: la butaca es un modelo de referencia; la lámpara representa un producto identificado.

Importa GLB autónomos de hasta 12 MB. Su contenido se comprueba antes de guardarlo. Los modelos se almacenan en IndexedDB y se reutilizan entre proyectos. Si un archivo guardado falta o se corrompe, aparece un marcador y el editor sigue disponible. Puedes reparar el archivo del objeto seleccionado o retirarlo.

**Estudio → Acabados** ofrece madera, cerámica, tejido y enlucido con mapas de color, normal y rugosidad. Aplica el acabado a una estancia, pared u objeto. Para una parte del GLB, selecciona su superficie en Propiedades o con Mayús + clic en 3D. Las instancias conservan sus acabados de forma independiente.

**Cocina y baño** añade módulos propios de medidas normalizadas: bajos, altos, columnas, fregadero, placa, horno y lavabo. Configura frentes, encimeras y tiradores; combina estos módulos con los sanitarios y modelos de la biblioteca.

Fuentes, atribuciones, tamaños y licencias: [ASSET_LICENSES.md](ASSET_LICENSES.md).

## Guardar y comparar

- Autoguardado en localStorage, copia de recuperación y guardado pendiente al salir de la pestaña. El encabezado muestra si se ha guardado o si hace falta exportar.
- **Exportar** crea un JSON portable con los modelos. Los recursos compartidos se incluyen una sola vez; se conserva el formato anterior para modelos únicos. Máximo 64 MB por archivo.
- **Estudio → Versiones** guarda propuestas completas en IndexedDB. Al restaurar una versión se guarda primero una copia del estado actual.
- La comparación A/B exige geometría coincidente y mantiene cámara y luz mientras cambian los acabados. Puedes exportar ambos PNG y recuperar después las propuestas.
- Un recurso no puede borrarse de la biblioteca mientras lo utilice el proyecto activo, cualquiera de los dos guardados locales, una versión, una comparación o el historial (incluido rehacer y cancelar un arrastre). Si no se pueden comprobar los guardados, se conserva el recurso. Archivo y metadatos se eliminan juntos o se conservan juntos si falla el borrado.

**Plano y revisión** permite indicar precios por objeto y exportar un presupuesto CSV. También prepara un plano de presentación para imprimir o guardar en PDF desde el navegador.

Los datos pertenecen a este navegador. No hay cuentas ni sincronización: borrar sus datos puede eliminar proyectos y modelos. Conserva copias JSON fuera del navegador.

## Imágenes y recorrido

En **Imagen y cámara**, elige día, noche o estudio HDRI; exposición y calidad. Guarda el encuadre para recuperarlo con el proyecto. PNG configurable hasta 3840 px y 8 millones de píxeles.

La calidad rápida simplifica materiales físicos costosos y renderiza bajo demanda. Alta conserva efectos más exigentes; su rendimiento depende de la GPU. El modo paseo utiliza WASD o flechas y limita el movimiento con paredes/puertas. Escape libera el ratón.

Es render físico WebGL en tiempo real; no es trazado de rayos offline.

## Validar

```bash
npm run test
npm run build
npm run test:e2e -- --workers=1
npm audit --omit=dev
```

Build comprueba TypeScript de aplicación y E2E. GitHub Actions ejecuta instalación reproducible, unitarias, build y Chromium en Ubuntu 24.04. Pages publica el SHA de main que acaba de superar CI; no publica ramas de trabajo.

Criterios y límites: [PRODUCT_ACCEPTANCE.md](PRODUCT_ACCEPTANCE.md). Estado, SHA y ejecuciones exactas: [PROJECT_STATUS.md](PROJECT_STATUS.md). Auditoría inicial: [LOCAL_AUDIT.md](LOCAL_AUDIT.md).

## Alcance

Herramienta conceptual de diseño e interiorismo, no CAD/BIM ni proyecto técnico. Perímetro exterior rectangular. Sin cálculo estructural, instalaciones ni verificación normativa. Las circulaciones y superficies requieren revisión profesional antes de ejecutar una reforma.

La biblioteca es inicial, no un catálogo exhaustivo de fabricantes. Los precios son manuales; no hay cotizaciones comerciales automáticas, PDF técnico, cuentas o colaboración en servidor. Las ampliaciones siguen registradas en [ROADMAP.md](ROADMAP.md); no se consideran cerradas por tener una compilación correcta.
