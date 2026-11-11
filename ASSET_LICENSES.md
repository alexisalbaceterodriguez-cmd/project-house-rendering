# Recursos distribuidos con Atelier 60

Los archivos se incluyen localmente; no se requiere conexión a los proveedores para abrir un proyecto. No se afirma afiliación ni disponibilidad comercial de productos. Los diseños paramétricos de Atelier 60 son independientes de estos recursos.

## Modelos

Fuente de los tres GLB y sus miniaturas oficiales: [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets). Se distribuyen sin modificar, con sus documentos de origen en `public/models/*.LICENSE.md`.

- **SheenChair**, 4.125.648 bytes: Eric Chadwick / Wayfair, LLC, 2020; CC0 1.0. Modelo de referencia de materiales, no un SKU comercial. [Procedencia y licencia](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair).
- **SheenWoodLeatherSofa**, 10.107.912 bytes: Fran Calvente, original CC0 (2021); mejoras de Eric Chadwick / Darmstadt Graphics Group GmbH (2024), CC BY 4.0. [Procedencia y licencia](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa).
- **IridescenceLamp**, 4.083.912 bytes: Eric Chadwick / Wayfair, LLC (2022), CC BY 4.0. Representa Bonsell 19″ Table Lamp. [Procedencia y licencia](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/IridescenceLamp).

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) permite redistribución con atribución. Las atribuciones se incluyen en la ficha de producto, exportaciones JSON y este documento. [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Materiales y ambiente

Mapas originales JPEG de 1K (color, normal OpenGL y rugosidad), sin modificar, de Poly Haven; [licencia CC0](https://polyhaven.com/license). No se utiliza su API desde la aplicación.

- [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck).
- [Floor Tiles 02](https://polyhaven.com/a/floor_tiles_02).
- [Fabric Pattern 07](https://polyhaven.com/a/fabric_pattern_07).
- [White Plaster Rough 01](https://polyhaven.com/a/white_plaster_rough_01).
- [Studio Small 09](https://polyhaven.com/a/studio_small_09), HDRI 1K, 1.615.248 bytes.

## Presupuesto

Modelos: 18,32 MB en disco; miniaturas: 1,17 MB; texturas: 6,78 MB; HDRI: 1,62 MB. Carga bajo demanda, compartida entre instancias. Cada GLB se guarda una vez en IndexedDB y se referencia por ID estable; el JSON portable deduplica recursos compartidos. Importaciones privadas: máximo 12 MB por modelo, JSON máximo 64 MB. Calidad rápida simplifica materiales físicos, reduce sombras y resolución; alta conserva los materiales del recurso. PNG de alta resolución se limita a 3840 px y 8 millones de píxeles.
