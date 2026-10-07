# Uso del lienzo

## Conceptos
- **Software** (contenedor): aplicación, módulo o feature. Puede ser **raíz** o vivir dentro de otro software (eso es una *ramificación*, con su tipo: feature, fork, versión mobile…).
- **Design System** y **UI Kit**: viven dentro de un software. Un software *usa* uno o varios DS (línea continua; discontinua si el DS vive en otra raíz). Un UI Kit *deriva de* una fuente (DS u otro software).
- **Página**: un lienzo independiente (p. ej. por cliente o área). Cambia de página desde `⌂`.

## Crear y editar (admin / head)
- `＋ Nueva card` o clic derecho en el fondo → software raíz. Dentro de un contenedor: botón `＋` o menú `⋯` → feature, DS o UI Kit.
- Doble clic / Enter / `⋯ → Editar`: nombre, descripción, imagen (arrastra, pega o sube), etiquetas, responsable, asignados, **visibilidad de la raíz** (organización o solo células), DS que usa / fuente, **enlaces de documentación** y **notas** (markdown: títulos, listas, enlaces, código, negrita).
- Arrastra una card dentro de otro contenedor para anidarla, o fuera para sacarla a raíz. Arrastra desde un puerto para conectar.
- `⇅ Auto-layout` ordena todo. Ctrl/⌘+Z deshace. Todo se guarda solo ("Guardado" arriba).

## Ver (designer)
Modo lectura: pan/zoom, doble clic o Enter abren la **ficha** (documentación, enlaces, equipo). Solo ves las raíces de la organización, las de tus células y aquellas donde estás asignado o eres responsable; `⇢ ocultas` indica conexiones con elementos que no ves.

## Mis asignaciones (`★ Mías` o `#/me`)
Lista de cards donde eres responsable o asignado en todas las páginas; cada una centra el lienzo en la card.

## Atajos
`?` muestra la lista. Rueda: desplazar · Ctrl/⌘+rueda: zoom · Espacio+arrastrar o `H`: mano · `V`: selección · Shift+1 ajustar · Shift+2 ajustar a selección · Supr eliminar · Ctrl/⌘+D duplicar · `E`/Enter editar.
