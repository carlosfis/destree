# Uso del lienzo

## Conceptos
- **Software** (contenedor): aplicación, módulo o feature. Puede ser **raíz** o vivir dentro de otro software (eso es una *ramificación*, con su tipo: feature, fork, versión mobile…).
- **Design System** y **UI Kit**: viven dentro de un software. Un software *usa* uno o varios DS (línea continua; discontinua si el DS vive en otra raíz). Un UI Kit *deriva de* una fuente (DS u otro software).
- **Nombres de tipo**: en `Administrar → Tipos` puedes renombrar Software / Design System / UI Kit por página (p. ej. Producto / Librería / Plantilla). El nombre cambia en cards, menús, editor, leyenda y avisos; las reglas de anidación y de fuente se mantienen.
- **Página**: un lienzo independiente (p. ej. por cliente o área). Cambia de página desde `⌂`.

## Crear y editar (admin / head)
- `＋ Nueva card` o clic derecho en el fondo → **Main instance** (software raíz). Dentro de un contenedor: botón `＋` o menú `⋯` → Child instance (feature, DS o UI Kit).
- Doble clic / Enter / `⋯ → Editar` abre el **sidebar** de la instancia (**Main instance** si es raíz, **Child instance** si vive dentro de un contenedor), con pestañas: **General** (tipo, nombre, contenedor padre, descripción, imagen, etiquetas, DS que usa / fuente), **Staff** (usuario `@nombre` + rol, p. ej. `@Lorena / UX Designer`; responsable, asignados y **visibilidad de la raíz**), **Documentación** (enlaces) y **Notas** (markdown: títulos, listas, enlaces, código, negrita).
- Si la card tiene imagen se muestra arriba como **hero** (también en la cabecera de los contenedores).
- Una página sin cards muestra una guía centrada con el botón **＋ Nueva Main instance** (en modo lectura, un aviso).
- Arrastra una card dentro de otro contenedor para anidarla, o fuera para sacarla a raíz. Arrastra desde un puerto para conectar.
- `⇅ Auto-layout` ordena todo. Ctrl/⌘+Z deshace. Todo se guarda solo ("Guardado" arriba).

## Ver (designer)
Modo lectura: pan/zoom, doble clic o Enter abren la **ficha** en el sidebar, con las mismas pestañas (General, Staff, Documentación, Notas). Solo ves las raíces de la organización, las de tus células y aquellas donde estás asignado o eres responsable; `⇢ ocultas` indica conexiones con elementos que no ves.

## Mi cuenta (chip de usuario)
Pulsa tu nombre arriba a la derecha: cambia tu **nombre** o tu **contraseña** (actual, nueva, repetir; mínimo 8). Al cambiar la contraseña se cierran tus demás sesiones; también puedes cerrarlas sin cambiarla con **Cerrar las demás sesiones**. Si la olvidaste, un admin te da una temporal desde Administración → Usuarios.

## Mis asignaciones (`★ Mías` o `#/me`)
Lista de cards donde eres responsable o asignado en todas las páginas; cada una centra el lienzo en la card.

## Atajos
`?` muestra la lista. Rueda: desplazar · Ctrl/⌘+rueda: zoom · Espacio+arrastrar o `H`: mano · `V`: selección · Shift+1 ajustar · Shift+2 ajustar a selección · Supr eliminar · Ctrl/⌘+D duplicar · `E`/Enter editar · Esc cierra menús, el sidebar, el lobby o la administración y vuelve al lienzo.
