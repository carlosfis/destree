# Uso del lienzo

## Recorrido de 10 minutos
### Si eres designer (lectura)
1. **Entrar**: abre la URL de tu organización, pon el correo y la contraseña que creaste al aceptar la invitación. Si la olvidaste, pide a un admin una temporal (o usa «¿Olvidaste tu contraseña?» si el correo está configurado).
2. **Orientarte**: el lienzo muestra el árbol de software de la página actual. Arriba a la izquierda, `⌂` abre el **lobby** con todas las páginas que puedes ver. Rueda = desplazar, Ctrl/⌘+rueda = zoom, `Shift+1` = ajustar todo.
3. **Encontrar lo tuyo**: pulsa `★ Mías` (o `#/me`). Verás las cards donde eres responsable o estás asignado, en cualquier página; cada una te lleva al lienzo centrado en esa card.
4. **Leer una ficha**: doble clic (o Enter) sobre una card abre el sidebar con cuatro pestañas: **General** (tipo, descripción, imagen, etiquetas, DS que usa o fuente), **Staff** (`@usuario / rol`, responsable, asignados), **Documentación** (enlaces a Figma, Notion, repos…) y **Notas**.
5. **Entender las líneas**: continua = usa su Design System; discontinua = usa el DS de otro software; punteada = el UI Kit deriva de esa fuente. `⇢ ocultas` indica conexiones con cards que no puedes ver.
6. **Historial**: `⟲ Historial` lista las versiones de la página; puedes ver cualquiera y compararla con la actual (restaurar es cosa de heads).

### Si eres head (edición)
1. **Crear una página**: `⌂` → `＋ Nueva página` (una por cliente o área). En `⚙ Página` pon descripción y visibilidad (toda la organización o solo ciertas células).
2. **Main instance**: `＋ Nueva card` → Software. Es una raíz: una aplicación o producto. Ponle nombre, descripción, imagen (se muestra como hero) y etiquetas.
3. **Anidar**: dentro de la raíz, `＋` (o arrastrar una card dentro) crea **Child instances**: features, forks, versiones mobile… con su tipo de ramificación.
4. **Design System y UI Kit**: crea un DS dentro del software que lo mantiene; conecta otros softwares arrastrando desde un puerto («usa DS»). Un UI Kit siempre tiene **fuente** (el DS o software del que deriva).
5. **Staff y responsables**: pestaña Staff → `@usuario / rol` (texto libre), responsable y asignados (usuarios reales; aparecen en `★ Mías` de cada uno). Visibilidad de la raíz: organización o células.
6. **Documentación**: pestaña Documentación → enlaces (hasta 20) y Notas en markdown. Todo se guarda solo («Guardado» arriba).
7. **Historial**: `⟲ Historial` → «Crear versión» con etiqueta antes de un cambio grande; «Cambios» muestra el diff; «Restaurar» vuelve atrás sin perder nada (crea una versión de restauración).
8. **Equipo**: `⚑ Admin → Usuarios` para invitar designers a tus células; `Células` para gestionar miembros de las tuyas.

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
